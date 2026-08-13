const crypto = require("crypto");
const { RoomStoreError, roomStore } = require("../server/roomStore");

const ROOM_LIFETIME_MS = 24 * 60 * 60 * 1_000;
const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const MAX_ROOM_MEMBERS = 12;

class RoomApiError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "RoomApiError";
    this.status = status;
  }
}

function parseBody(request) {
  if (typeof request.body === "string") {
    try {
      return JSON.parse(request.body);
    } catch {
      throw new RoomApiError("Invalid request body.");
    }
  }
  return request.body || {};
}

function enforceSameOrigin(request) {
  const origin = request.headers.origin;
  const requestHost = request.headers["x-forwarded-host"] || request.headers.host;
  if (!origin || !requestHost) return;

  try {
    if (new URL(origin).host !== requestHost) {
      throw new RoomApiError("This API can only be used by MovieNightPick.", 403);
    }
  } catch (error) {
    if (error instanceof RoomApiError) throw error;
    throw new RoomApiError("Invalid request origin.", 403);
  }
}

function cleanName(value) {
  const name = String(value || "").replace(/\s+/g, " ").trim();
  if (name.length < 1 || name.length > 24) {
    throw new RoomApiError("Enter a name between 1 and 24 characters.");
  }
  return name;
}

function cleanCode(value) {
  const code = String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!/^[A-HJ-NP-Z2-9]{6}$/.test(code)) {
    throw new RoomApiError("Enter a valid six-character room code.");
  }
  return code;
}

function roomCode() {
  return Array.from({ length: 6 }, () => (
    ROOM_CODE_ALPHABET[crypto.randomInt(ROOM_CODE_ALPHABET.length)]
  )).join("");
}

function secretToken() {
  return crypto.randomBytes(24).toString("base64url");
}

function tokenHash(token) {
  return crypto.createHash("sha256").update(String(token || "")).digest("hex");
}

function bearerToken(request) {
  return String(request.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
}

function hostToken(request) {
  return String(request.headers["x-room-host"] || "").trim();
}

function isExpired(room) {
  return !room || Date.parse(room.expires_at) <= Date.now();
}

function cleanCandidate(movie) {
  const id = Number(movie?.id);
  const imdbRating = Number(movie?.imdbRating);
  if (!Number.isInteger(id) || id <= 0 || !movie?.title || !Number.isFinite(imdbRating)) {
    throw new RoomApiError("The voting lineup contains an invalid movie.");
  }

  return {
    id,
    title: String(movie.title).slice(0, 160),
    release_date: String(movie.release_date || "").slice(0, 10),
    imdbRating,
    runtime: Number(movie.runtime) || null,
    posterUrl: String(movie.posterUrl || "").slice(0, 300),
    poster_path: String(movie.poster_path || "").slice(0, 180),
    backdropUrl: String(movie.backdropUrl || "").slice(0, 300),
    overview: String(movie.overview || movie.imdb?.Plot || "").slice(0, 900),
    genres: Array.isArray(movie.genres)
      ? movie.genres.slice(0, 8).map((genre) => ({
        id: Number(genre.id) || 0,
        name: String(genre.name || "").slice(0, 60),
      }))
      : [],
    trailerKey: String(movie.trailerKey || "").slice(0, 80),
  };
}

async function authenticatedState(store, code, token) {
  const room = await store.getRoom(code);
  if (!room || isExpired(room) || room.status === "closed") {
    throw new RoomApiError("That room is no longer available.", 404);
  }

  const members = await store.getMembers(code);
  const member = members.find((item) => item.token_hash === tokenHash(token));
  if (!member) throw new RoomApiError("Your room invitation is invalid.", 401);
  const votes = await store.getVotes(code);
  return { room, members, member, votes };
}

function requireHost(room, member, suppliedHostToken) {
  if (
    member.id !== room.host_member_id
    || tokenHash(suppliedHostToken) !== room.host_token_hash
  ) {
    throw new RoomApiError("Only the room host can do that.", 403);
  }
}

function publicState({ room, members, member, votes }) {
  const voteCounts = Object.fromEntries((room.candidates || []).map((movie) => [movie.id, 0]));
  votes.forEach((vote) => {
    if (Object.prototype.hasOwnProperty.call(voteCounts, vote.movie_id)) {
      voteCounts[vote.movie_id] += 1;
    }
  });

  return {
    room: {
      code: room.code,
      status: room.status,
      hostName: room.host_name,
      candidates: room.candidates || [],
      winnerIds: room.winner_ids || [],
      expiresAt: room.expires_at,
    },
    members: members.map((item) => ({
      id: item.id,
      name: item.name,
      isHost: item.id === room.host_member_id,
    })),
    me: {
      id: member.id,
      name: member.name,
      isHost: member.id === room.host_member_id,
    },
    voteCounts,
    totalVotes: votes.length,
    myVote: votes.find((vote) => vote.member_id === member.id)?.movie_id || null,
  };
}

async function createRoom(store, body) {
  const name = cleanName(body.name);
  const now = new Date();
  await store.deleteExpiredRooms(now.toISOString());
  const memberId = crypto.randomUUID();
  const token = secretToken();
  const hostSecret = secretToken();
  let room;

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const code = roomCode();
    try {
      room = await store.insertRoom({
        code,
        status: "lobby",
        host_name: name,
        host_member_id: memberId,
        host_token_hash: tokenHash(hostSecret),
        filters: {},
        candidates: [],
        winner_ids: [],
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
        expires_at: new Date(now.getTime() + ROOM_LIFETIME_MS).toISOString(),
      });
      break;
    } catch (error) {
      if (error.status !== 409 || attempt === 5) throw error;
    }
  }

  let member;
  try {
    member = await store.insertMember({
      id: memberId,
      room_code: room.code,
      name,
      token_hash: tokenHash(token),
      joined_at: now.toISOString(),
    });
  } catch (error) {
    await store.deleteRoom(room.code);
    throw error;
  }
  return {
    token,
    hostToken: hostSecret,
    state: publicState({ room, members: [member], member, votes: [] }),
  };
}

async function joinRoom(store, body) {
  const code = cleanCode(body.code);
  const name = cleanName(body.name);
  const room = await store.getRoom(code);
  if (!room || isExpired(room) || room.status === "closed") {
    throw new RoomApiError("That room is no longer available.", 404);
  }
  const existingMembers = await store.getMembers(code);
  if (existingMembers.length >= MAX_ROOM_MEMBERS) {
    throw new RoomApiError("That room is full.", 409);
  }

  const token = secretToken();
  const member = await store.insertMember({
    id: crypto.randomUUID(),
    room_code: code,
    name,
    token_hash: tokenHash(token),
    joined_at: new Date().toISOString(),
  });
  const members = await store.getMembers(code);
  const votes = await store.getVotes(code);
  return {
    token,
    hostToken: "",
    state: publicState({ room, members, member, votes }),
  };
}

async function setCandidates(store, body, token, suppliedHostToken) {
  const code = cleanCode(body.code);
  const state = await authenticatedState(store, code, token);
  requireHost(state.room, state.member, suppliedHostToken);
  const candidates = Array.isArray(body.candidates)
    ? body.candidates.map(cleanCandidate)
    : [];
  if (candidates.length < 2 || candidates.length > 3) {
    throw new RoomApiError("A voting lineup needs two or three movies.");
  }
  if (new Set(candidates.map((movie) => movie.id)).size !== candidates.length) {
    throw new RoomApiError("Every voting choice must be a different movie.");
  }

  await store.deleteVotes(code);
  const room = await store.updateRoom(code, {
    status: "voting",
    filters: body.filters || {},
    candidates,
    winner_ids: [],
  });
  return publicState({ ...state, room, votes: [] });
}

async function saveVote(store, body, token) {
  const code = cleanCode(body.code);
  const state = await authenticatedState(store, code, token);
  if (state.room.status !== "voting") {
    throw new RoomApiError("Voting is not open in this room.");
  }
  const movieId = Number(body.movieId);
  if (!state.room.candidates.some((movie) => movie.id === movieId)) {
    throw new RoomApiError("Choose one of the movies in this room.");
  }

  await store.upsertVote({
    room_code: code,
    member_id: state.member.id,
    movie_id: movieId,
    updated_at: new Date().toISOString(),
  });
  const votes = await store.getVotes(code);
  return publicState({ ...state, votes });
}

async function revealWinner(store, body, token, suppliedHostToken) {
  const code = cleanCode(body.code);
  const state = await authenticatedState(store, code, token);
  requireHost(state.room, state.member, suppliedHostToken);
  if (state.room.status !== "voting") {
    throw new RoomApiError("Start a vote before revealing a winner.");
  }
  if (!state.votes.length) throw new RoomApiError("Wait for at least one vote first.");

  const counts = new Map(state.room.candidates.map((movie) => [movie.id, 0]));
  state.votes.forEach((vote) => counts.set(vote.movie_id, (counts.get(vote.movie_id) || 0) + 1));
  const highestVoteCount = Math.max(...counts.values());
  const winnerIds = [...counts.entries()]
    .filter(([, count]) => count === highestVoteCount)
    .map(([movieId]) => movieId);
  const room = await store.updateRoom(code, { status: "revealed", winner_ids: winnerIds });
  return publicState({ ...state, room });
}

async function resetVote(store, body, token, suppliedHostToken) {
  const code = cleanCode(body.code);
  const state = await authenticatedState(store, code, token);
  requireHost(state.room, state.member, suppliedHostToken);
  await store.deleteVotes(code);
  const room = await store.updateRoom(code, {
    status: "lobby",
    candidates: [],
    winner_ids: [],
  });
  return publicState({ ...state, room, votes: [] });
}

async function closeRoom(store, body, token, suppliedHostToken) {
  const code = cleanCode(body.code);
  const state = await authenticatedState(store, code, token);
  requireHost(state.room, state.member, suppliedHostToken);
  const room = await store.updateRoom(code, { status: "closed" });
  return { ...publicState({ ...state, room }), closed: true };
}

module.exports = async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Type", "application/json; charset=utf-8");

  try {
    enforceSameOrigin(request);
    const store = roomStore();
    const token = bearerToken(request);

    if (request.method === "GET") {
      const code = cleanCode(request.headers["x-room-code"]);
      const state = await authenticatedState(store, code, token);
      return response.status(200).json({ state: publicState(state) });
    }

    if (request.method !== "POST") {
      response.setHeader("Allow", "GET, POST");
      throw new RoomApiError("Method not allowed.", 405);
    }

    const body = parseBody(request);
    let result;
    if (body.action === "create") result = await createRoom(store, body);
    else if (body.action === "join") result = await joinRoom(store, body);
    else if (body.action === "candidates") {
      result = { state: await setCandidates(store, body, token, hostToken(request)) };
    } else if (body.action === "vote") {
      result = { state: await saveVote(store, body, token) };
    } else if (body.action === "reveal") {
      result = { state: await revealWinner(store, body, token, hostToken(request)) };
    } else if (body.action === "reset") {
      result = { state: await resetVote(store, body, token, hostToken(request)) };
    } else if (body.action === "close") {
      result = { state: await closeRoom(store, body, token, hostToken(request)) };
    } else {
      throw new RoomApiError("That room action is not supported.");
    }
    return response.status(200).json(result);
  } catch (error) {
    const knownError = error instanceof RoomApiError || error instanceof RoomStoreError;
    return response.status(knownError ? error.status : 500).json({
      error: knownError ? error.message : "The room service encountered an unexpected error.",
    });
  }
};

module.exports.__test = {
  cleanCandidate,
  cleanCode,
  cleanName,
  tokenHash,
};
