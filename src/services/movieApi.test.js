import { findRandomMovie } from "./movieApi";

afterEach(() => {
  jest.restoreAllMocks();
});

test("sends filters to the protected same-origin recommendation endpoint", async () => {
  const movie = { id: 42, title: "A secure recommendation", imdbRating: 8.1 };
  const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
    ok: true,
    json: async () => ({ movie }),
  });
  const filters = { genre: "878", minimumRating: 8 };

  await expect(findRandomMovie(filters, {
    excludedIds: [10, 11],
  })).resolves.toEqual(movie);

  expect(fetchMock).toHaveBeenCalledWith("/api/recommend", expect.objectContaining({
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filters, excludedIds: [10, 11] }),
  }));
});
