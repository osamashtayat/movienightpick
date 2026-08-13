import { findMovieById, findRandomMovie, findRoomCandidates } from "./movieApi";

afterEach(() => {
  jest.restoreAllMocks();
});

test("loads an exact movie from the public shared-movie endpoint", async () => {
  const movie = { id: 278, title: "The Shawshank Redemption", imdbRating: 9.3 };
  const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
    ok: true,
    json: async () => ({ movie }),
  });

  await expect(findMovieById(278)).resolves.toEqual(movie);
  expect(fetchMock).toHaveBeenCalledWith("/api/movie?id=278", { signal: undefined });
});

test("sends filters to the protected same-origin recommendation endpoint", async () => {
  const movie = { id: 42, title: "A secure recommendation", imdbRating: 8.1 };
  const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
    ok: true,
    json: async () => ({ movie }),
  });
  const filters = { genres: ["878", "12"], minimumRating: 8 };

  await expect(findRandomMovie(filters, {
    excludedIds: [10, 11],
  })).resolves.toEqual(movie);

  expect(fetchMock).toHaveBeenCalledWith("/api/recommend", expect.objectContaining({
    method: "POST",
    headers: { "Content-Type": "application/json" },
  }));
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
    filters,
    excludedIds: [10, 11],
    excludedImdbIds: [],
    excludedMovieKeys: [],
  });
});

test("requests one three-movie lineup for a group vote", async () => {
  const movies = [
    { id: 1, title: "One", imdbRating: 8.1 },
    { id: 2, title: "Two", imdbRating: 7.9 },
    { id: 3, title: "Three", imdbRating: 8.3 },
  ];
  const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
    ok: true,
    json: async () => ({ movie: movies[0], movies }),
  });
  const filters = { genres: ["9648"], minimumRating: 7.5 };

  await expect(findRoomCandidates(filters, {
    exclusions: { tmdbIds: [99], imdbIds: ["tt0000099"], movieKeys: ["seen:2020"] },
  })).resolves.toEqual(movies);

  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
    filters,
    count: 3,
    excludedIds: [99],
    excludedImdbIds: ["tt0000099"],
    excludedMovieKeys: ["seen:2020"],
  });
});
