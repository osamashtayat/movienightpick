const recommendHandler = require("../../api/recommend");

const {
  buildDiscoverParams,
  candidatePageLimit,
  getImdbRating,
  normalizeInput,
} = recommendHandler.__test;

const originalTmdbKey = process.env.TMDB_API_KEY;
const originalMdblistKey = process.env.MDBLIST_API_KEY;

beforeAll(() => {
  process.env.TMDB_API_KEY = "test-tmdb-key";
  process.env.MDBLIST_API_KEY = "test-mdblist-key";
});

afterAll(() => {
  if (originalTmdbKey === undefined) delete process.env.TMDB_API_KEY;
  else process.env.TMDB_API_KEY = originalTmdbKey;

  if (originalMdblistKey === undefined) delete process.env.MDBLIST_API_KEY;
  else process.env.MDBLIST_API_KEY = originalMdblistKey;
});

afterEach(() => {
  jest.restoreAllMocks();
});

function jsonResponse(payload) {
  return {
    ok: true,
    status: 200,
    json: async () => payload,
  };
}

function functionResponse() {
  return {
    statusCode: 200,
    body: null,
    setHeader: jest.fn(),
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

test("prioritizes strong TMDB candidates for high IMDb rating searches", () => {
  const params = buildDiscoverParams({
    genre: "27",
    language: "en",
    maxRuntime: "120",
    mode: "crowd",
    minimumRating: 8,
    startDate: "2000-01-01",
    endDate: "2025-12-31",
  }, 2, "tmdb-key");

  expect(params.get("with_genres")).toBe("27");
  expect(params.get("vote_average.gte")).toBe("7");
  expect(params.get("sort_by")).toBe("vote_average.desc");
  expect(params.get("page")).toBe("2");
  expect(candidatePageLimit(500, 8)).toBe(6);
  expect(candidatePageLimit(500, 7)).toBe(16);
});

test("keeps a larger recent-pick exclusion list", () => {
  const excludedIds = Array.from({ length: 30 }, (_, index) => index + 1);
  const normalized = normalizeInput({
    filters: { minimumRating: 7 },
    excludedIds,
  });

  expect(normalized.excludedIds).toEqual(excludedIds);
});

test("reads the exact IMDb rating and vote count from MDBList", () => {
  expect(getImdbRating({
    ratings: [
      { source: "tmdb", value: 84, votes: 2000 },
      { source: "imdb", value: 8.2, votes: 345678 },
    ],
  })).toEqual({ rating: 8.2, votes: 345678 });
  expect(getImdbRating({ ratings: [] })).toBeNull();
});

test("skips an excluded recent movie and returns a fresh matching candidate", async () => {
  const seenMovie = { id: 101, title: "Seen Movie", vote_average: 8.4 };
  const freshMovie = { id: 202, title: "Fresh Movie", vote_average: 8.2 };
  const fetchMock = jest.spyOn(global, "fetch").mockImplementation(async (url) => {
    if (url.includes("/discover/movie")) {
      return jsonResponse({
        total_pages: 1,
        total_results: 2,
        results: [seenMovie, freshMovie],
      });
    }
    if (url.includes("api.mdblist.com")) {
      return jsonResponse([{
        title: freshMovie.title,
        ids: { tmdb: freshMovie.id, imdb: "tt0000202" },
        ratings: [{ source: "imdb", value: 8.2, votes: 54321 }],
        certification: "PG-13",
        awards: "One award",
      }]);
    }
    if (url.includes("/movie/202?")) {
      return jsonResponse({
        ...freshMovie,
        genres: [{ id: 28, name: "Action" }],
        videos: { results: [] },
        "watch/providers": { results: {} },
        credits: {
          crew: [{ job: "Director", name: "Movie Director" }],
          cast: [{ name: "Lead Actor" }],
        },
        release_dates: { results: [] },
      });
    }
    throw new Error(`Unexpected URL: ${url}`);
  });
  const response = functionResponse();

  await recommendHandler({
    method: "POST",
    headers: {
      origin: "https://movienightpick.vercel.app",
      host: "movienightpick.vercel.app",
      "x-forwarded-for": "recent-pick-test",
    },
    body: {
      filters: { genre: "28", minimumRating: 8, mode: "crowd" },
      excludedIds: [seenMovie.id],
    },
  }, response);

  expect(response.statusCode).toBe(200);
  expect(response.body.movie.id).toBe(freshMovie.id);
  expect(response.body.movie.imdbRating).toBe(8.2);
  expect(response.body.movie.imdb.Director).toBe("Movie Director");

  const mdblistCall = fetchMock.mock.calls.find(([url]) => url.includes("api.mdblist.com"));
  expect(mdblistCall).toBeDefined();
  expect(JSON.parse(mdblistCall[1].body).ids).toEqual([freshMovie.id]);
  expect(fetchMock.mock.calls.some(([url]) => url.includes("/external_ids"))).toBe(false);
});
