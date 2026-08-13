const roomHandler = require("../../api/rooms");
const { resetMemoryRoomStore } = require("../../server/roomStore");

const originalEnvironment = {
  vercel: process.env.VERCEL_ENV,
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseSecret: process.env.SUPABASE_SECRET_KEY,
  supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
};

beforeAll(() => {
  delete process.env.VERCEL_ENV;
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SECRET_KEY;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
});

afterAll(() => {
  if (originalEnvironment.vercel === undefined) delete process.env.VERCEL_ENV;
  else process.env.VERCEL_ENV = originalEnvironment.vercel;
  if (originalEnvironment.supabaseUrl === undefined) delete process.env.SUPABASE_URL;
  else process.env.SUPABASE_URL = originalEnvironment.supabaseUrl;
  if (originalEnvironment.supabaseSecret === undefined) delete process.env.SUPABASE_SECRET_KEY;
  else process.env.SUPABASE_SECRET_KEY = originalEnvironment.supabaseSecret;
  if (originalEnvironment.supabaseKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  else process.env.SUPABASE_SERVICE_ROLE_KEY = originalEnvironment.supabaseKey;
});

beforeEach(() => resetMemoryRoomStore());

function functionResponse() {
  return {
    statusCode: 200,
    body: null,
    headers: {},
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

async function roomRequest(body, session = {}, method = "POST") {
  const response = functionResponse();
  const headers = {
    origin: "http://localhost:3000",
    host: "localhost:3000",
  };
  if (session.token) headers.authorization = `Bearer ${session.token}`;
  if (session.hostToken) headers["x-room-host"] = session.hostToken;
  if (session.code) headers["x-room-code"] = session.code;

  await roomHandler({ method, headers, body }, response);
  return response;
}

const candidates = [
  {
    id: 101,
    title: "First Choice",
    release_date: "2020-01-01",
    imdbRating: 8.2,
    runtime: 114,
    posterUrl: "https://image.example/first.jpg",
    overview: "The first group choice.",
    genres: [{ id: 9648, name: "Mystery" }],
  },
  {
    id: 202,
    title: "Second Choice",
    release_date: "2022-04-08",
    imdbRating: 7.9,
    runtime: 106,
    posterUrl: "https://image.example/second.jpg",
    overview: "The second group choice.",
    genres: [{ id: 53, name: "Thriller" }],
  },
  {
    id: 303,
    title: "Third Choice",
    release_date: "2019-10-11",
    imdbRating: 8.0,
    runtime: 122,
    posterUrl: "https://image.example/third.jpg",
    overview: "The third group choice.",
    genres: [{ id: 18, name: "Drama" }],
  },
];

test("creates a room, accepts members and keeps private tokens out of public state", async () => {
  const created = await roomRequest({ action: "create", name: "Osama" });

  expect(created.statusCode).toBe(200);
  expect(created.body.token).toBeTruthy();
  expect(created.body.hostToken).toBeTruthy();
  expect(created.body.state.room.code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
  expect(created.body.state.members).toEqual([
    expect.objectContaining({ name: "Osama", isHost: true }),
  ]);
  expect(JSON.stringify(created.body.state)).not.toContain(created.body.token);
  expect(JSON.stringify(created.body.state)).not.toContain(created.body.hostToken);

  const code = created.body.state.room.code;
  const joined = await roomRequest({ action: "join", code, name: "Maya" });
  expect(joined.statusCode).toBe(200);
  expect(joined.body.state.members.map((member) => member.name)).toEqual(["Osama", "Maya"]);

  const refreshed = await roomRequest(undefined, {
    code,
    token: joined.body.token,
  }, "GET");
  expect(refreshed.statusCode).toBe(200);
  expect(refreshed.body.state.me.name).toBe("Maya");
});

test("runs a complete host and guest vote with an updatable vote and reveal", async () => {
  const created = await roomRequest({ action: "create", name: "Host" });
  const host = {
    code: created.body.state.room.code,
    token: created.body.token,
    hostToken: created.body.hostToken,
  };
  const joined = await roomRequest({ action: "join", code: host.code, name: "Guest" });
  const guest = { code: host.code, token: joined.body.token };

  const lineup = await roomRequest({
    action: "candidates",
    code: host.code,
    candidates,
    filters: { genres: ["9648"], minimumRating: 7.5 },
  }, host);
  expect(lineup.statusCode).toBe(200);
  expect(lineup.body.state.room.status).toBe("voting");
  expect(lineup.body.state.room.candidates).toHaveLength(3);

  await roomRequest({ action: "vote", code: host.code, movieId: 101 }, host);
  const guestVote = await roomRequest({ action: "vote", code: host.code, movieId: 202 }, guest);
  expect(guestVote.body.state.totalVotes).toBe(2);
  expect(guestVote.body.state.voteCounts).toEqual({ 101: 1, 202: 1, 303: 0 });

  const changedVote = await roomRequest({ action: "vote", code: host.code, movieId: 101 }, guest);
  expect(changedVote.body.state.totalVotes).toBe(2);
  expect(changedVote.body.state.voteCounts[101]).toBe(2);
  expect(changedVote.body.state.myVote).toBe(101);

  const guestReveal = await roomRequest({ action: "reveal", code: host.code }, guest);
  expect(guestReveal.statusCode).toBe(403);

  const revealed = await roomRequest({ action: "reveal", code: host.code }, host);
  expect(revealed.statusCode).toBe(200);
  expect(revealed.body.state.room.status).toBe("revealed");
  expect(revealed.body.state.room.winnerIds).toEqual([101]);

  const reset = await roomRequest({ action: "reset", code: host.code }, host);
  expect(reset.body.state.room.status).toBe("lobby");
  expect(reset.body.state.room.candidates).toEqual([]);
  expect(reset.body.state.totalVotes).toBe(0);
});

test("rejects invalid invitations and unrecognized voting choices", async () => {
  const missing = await roomRequest({ action: "join", code: "ABC234", name: "Guest" });
  expect(missing.statusCode).toBe(404);

  const created = await roomRequest({ action: "create", name: "Host" });
  const host = {
    code: created.body.state.room.code,
    token: created.body.token,
    hostToken: created.body.hostToken,
  };
  await roomRequest({ action: "candidates", code: host.code, candidates }, host);

  const invalidVote = await roomRequest({
    action: "vote",
    code: host.code,
    movieId: 999,
  }, host);
  expect(invalidVote.statusCode).toBe(400);
  expect(invalidVote.body.error).toMatch(/choose one of the movies/i);
});
