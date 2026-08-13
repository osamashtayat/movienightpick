const recommendHandler = require("../../api/recommend");

const {
  buildDiscoverParams,
  candidatePageLimit,
  getImdbRating,
  normalizeInput,
} = recommendHandler.__test;
const { getMovieById } = recommendHandler.shared;

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
    genre: "27,53",
    language: "en",
    maxRuntime: "120",
    mode: "crowd",
    minimumRating: 8,
    startDate: "2000-01-01",
    endDate: "2025-12-31",
  }, 2, "tmdb-key");

  expect(params.get("with_genres")).toBe("27,53");
  expect(params.get("vote_average.gte")).toBe("7");
  expect(params.get("sort_by")).toBe("vote_average.desc");
  expect(params.get("page")).toBe("2");
  expect(candidatePageLimit(500, 8)).toBe(6);
  expect(candidatePageLimit(500, 7)).toBe(16);
});

test("normalizes multiple unique genres for an AND search", () => {
  const normalized = normalizeInput({
    filters: {
      genres: ["9648", "53", "9648", "not-a-genre"],
      minimumRating: 7,
    },
  });

  expect(normalized.filters.genre).toBe("9648,53");
});

test("keeps a larger recent-pick exclusion list", () => {
  const excludedIds = Array.from({ length: 30 }, (_, index) => index + 1);
  const normalized = normalizeInput({
    filters: { minimumRating: 7 },
    excludedIds,
  });

  expect(normalized.excludedIds).toEqual(excludedIds);
});

test("normalizes imported IMDb and title-year exclusions", () => {
  const normalized = normalizeInput({
    filters: { minimumRating: 7 },
    excludedImdbIds: ["TT0133093", "bad-id", "tt0133093"],
    excludedMovieKeys: ["the-matrix:1999", "bad movie key", "arrival:2016"],
  });

  expect(normalized.excludedImdbIds).toEqual(["tt0133093"]);
  expect(normalized.excludedMovieKeys).toEqual(["the-matrix:1999", "arrival:2016"]);
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

test("loads an exact shared movie with its verified IMDb details", async () => {
  const movieId = 303303;
  jest.spyOn(global, "fetch").mockImplementation(async (url) => {
    if (url.includes("api.mdblist.com")) {
      return jsonResponse([{
        title: "Shared Pick",
        description: "A carefully selected shared movie.",
        ids: { tmdb: movieId, imdb: "tt0303303" },
        ratings: [{ source: "imdb", value: 8.4, votes: 123456 }],
        genres: [{ title: "Mystery" }],
      }]);
    }
    if (url.includes(`/movie/${movieId}?`)) {
      return jsonResponse({
        id: movieId,
        title: "Shared Pick",
        release_date: "2022-10-14",
        overview: "A carefully selected shared movie.",
        poster_path: "/shared-poster.jpg",
        backdrop_path: "/shared-backdrop.jpg",
        genres: [{ id: 9648, name: "Mystery" }],
        videos: { results: [] },
        "watch/providers": { results: {} },
        credits: { crew: [], cast: [] },
        release_dates: { results: [] },
      });
    }
    throw new Error(`Unexpected URL: ${url}`);
  });

  await expect(getMovieById(movieId, "tmdb-key", "mdblist-key")).resolves.toEqual(
    expect.objectContaining({
      id: movieId,
      title: "Shared Pick",
      imdbRating: 8.4,
      posterUrl: "https://image.tmdb.org/t/p/w500/shared-poster.jpg",
      backdropUrl: "https://image.tmdb.org/t/p/w1280/shared-backdrop.jpg",
    })
  );
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
      filters: { genres: ["28", "53"], minimumRating: 8, mode: "crowd" },
      excludedIds: [seenMovie.id],
    },
  }, response);

  expect(response.statusCode).toBe(200);
  expect(response.body.movie.id).toBe(freshMovie.id);
  expect(response.body.movie.imdbRating).toBe(8.2);
  expect(response.body.movie.imdb.Director).toBe("Movie Director");

  const discoverCall = fetchMock.mock.calls.find(([url]) => url.includes("/discover/movie"));
  expect(new URL(discoverCall[0]).searchParams.get("with_genres")).toBe("28,53");

  const mdblistCall = fetchMock.mock.calls.find(([url]) => url.includes("api.mdblist.com"));
  expect(mdblistCall).toBeDefined();
  expect(JSON.parse(mdblistCall[1].body).ids).toEqual([freshMovie.id]);
  expect(fetchMock.mock.calls.some(([url]) => url.includes("/external_ids"))).toBe(false);
});

test("filters an imported title before spending an MDBList check on it", async () => {
  const watchedMovie = {
    id: 603,
    title: "The Matrix",
    release_date: "1999-03-30",
    vote_average: 8.7,
  };
  const freshMovie = {
    id: 27205,
    title: "Inception",
    release_date: "2010-07-15",
    vote_average: 8.4,
  };
  const fetchMock = jest.spyOn(global, "fetch").mockImplementation(async (url) => {
    if (url.includes("/discover/movie")) {
      return jsonResponse({
        total_pages: 1,
        total_results: 2,
        results: [watchedMovie, freshMovie],
      });
    }
    if (url.includes("api.mdblist.com")) {
      return jsonResponse([{
        title: freshMovie.title,
        year: 2010,
        ids: { tmdb: freshMovie.id, imdb: "tt1375666" },
        ratings: [{ source: "imdb", value: 8.8, votes: 2600000 }],
      }]);
    }
    if (url.includes(`/movie/${freshMovie.id}?`)) {
      return jsonResponse({
        ...freshMovie,
        genres: [],
        videos: { results: [] },
        "watch/providers": { results: {} },
        credits: { crew: [], cast: [] },
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
      "x-forwarded-for": "imported-title-test",
    },
    body: {
      filters: { minimumRating: 8, mode: "crowd" },
      excludedMovieKeys: ["the-matrix:1999"],
    },
  }, response);

  expect(response.statusCode).toBe(200);
  expect(response.body.movie.id).toBe(freshMovie.id);
  const mdblistCall = fetchMock.mock.calls.find(([url]) => url.includes("api.mdblist.com"));
  expect(JSON.parse(mdblistCall[1].body).ids).toEqual([freshMovie.id]);
});
