import { findMovieById, findRandomMovie } from "./movieApi";

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
    body: JSON.stringify({ filters, excludedIds: [10, 11] }),
  }));
});
