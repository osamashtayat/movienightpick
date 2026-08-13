import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import App from "./App";

beforeEach(() => {
  window.history.replaceState({}, "", "/");
  window.localStorage.clear();
  window.HTMLElement.prototype.scrollIntoView = jest.fn();
});

afterEach(() => {
  delete navigator.share;
  jest.restoreAllMocks();
});

function movieResponse(movie) {
  return {
    ok: true,
    json: async () => ({ movie }),
  };
}

const firstMovie = {
  id: 101,
  title: "First Pick",
  imdbRating: 7.8,
  release_date: "2020-01-01",
  foundAfterAttempts: 2,
  trailerKey: "example-trailer",
  providers: [{
    provider_id: 8,
    provider_name: "Netflix",
    logo_path: "/netflix.png",
  }],
  watchLink: "https://example.com/watch",
};

const secondMovie = {
  id: 202,
  title: "Second Pick",
  imdbRating: 8.1,
  release_date: "2021-01-01",
  foundAfterAttempts: 3,
};

test("renders the movie discovery experience", () => {
  render(<App />);

  expect(screen.getByRole("heading", { name: /less browsing/i })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /movienightpick home/i })).toBeInTheDocument();
  expect(screen.getByText(/movie preferences/i)).toBeInTheDocument();
  expect(screen.getByText(/your next favorite is waiting/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/minimum imdb rating/i)).toHaveValue("7");
  expect(screen.getByRole("button", { name: /find my movie/i })).toBeEnabled();
});

test("lets the user change and reset the IMDb rating", () => {
  render(<App />);

  const rating = screen.getByLabelText(/minimum imdb rating/i);
  fireEvent.change(rating, { target: { value: "8.2" } });
  expect(rating).toHaveValue("8.2");
  expect(Number.parseFloat(rating.style.getPropertyValue("--rating-progress"))).toBeCloseTo(
    (8.2 / 9) * 100
  );

  fireEvent.click(screen.getByRole("button", { name: /reset/i }));
  expect(rating).toHaveValue("7");
});

test("lets the user combine multiple genres", async () => {
  const fetchMock = jest.spyOn(global, "fetch").mockResolvedValueOnce(movieResponse(firstMovie));
  render(<App />);

  fireEvent.click(screen.getByRole("button", { name: "Mystery" }));
  fireEvent.click(screen.getByRole("button", { name: "Thriller" }));

  expect(screen.getByRole("button", { name: "Action" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("button", { name: "Mystery" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("button", { name: "Thriller" })).toHaveAttribute("aria-pressed", "true");

  fireEvent.click(screen.getByRole("button", { name: /find my movie/i }));
  await screen.findByRole("heading", { name: firstMovie.title });

  const request = JSON.parse(fetchMock.mock.calls[0][1].body);
  expect(request.filters.genres).toEqual(["28", "9648", "53"]);
});

test("reset clears and remounts both native date inputs", () => {
  render(<App />);

  const originalFromInput = screen.getByLabelText(/^from$/i);
  fireEvent.change(originalFromInput, { target: { value: "2000-01-01" } });
  fireEvent.change(screen.getByLabelText(/^until$/i), {
    target: { value: "2020-12-31" },
  });

  expect(screen.getByLabelText(/^from$/i)).toHaveValue("2000-01-01");
  expect(screen.getByLabelText(/^until$/i)).toHaveValue("2020-12-31");

  fireEvent.click(screen.getByRole("button", { name: /reset/i }));

  expect(screen.getByLabelText(/^from$/i)).toHaveValue("");
  expect(screen.getByLabelText(/^until$/i)).toHaveValue("");
  expect(screen.getByLabelText(/^from$/i)).not.toBe(originalFromInput);
});

test("clears a result as soon as the user changes its filters", async () => {
  jest.spyOn(global, "fetch").mockResolvedValueOnce(movieResponse(firstMovie));
  render(<App />);

  fireEvent.click(screen.getByRole("button", { name: /find my movie/i }));
  expect(await screen.findByRole("heading", { name: firstMovie.title })).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Comedy" }));

  expect(screen.queryByRole("heading", { name: firstMovie.title })).not.toBeInTheDocument();
  expect(screen.getByText(/your next favorite is waiting/i)).toBeInTheDocument();
});

test("shows an embedded YouTube trailer and linked streaming platforms", async () => {
  jest.spyOn(global, "fetch").mockResolvedValueOnce(movieResponse(firstMovie));
  render(<App />);

  fireEvent.click(screen.getByRole("button", { name: /find my movie/i }));

  const trailer = await screen.findByTitle(`${firstMovie.title} — YouTube trailer`);
  expect(trailer).toHaveAttribute(
    "src",
    "https://www.youtube-nocookie.com/embed/example-trailer?rel=0"
  );
  expect(screen.getByRole("link", { name: /open netflix/i })).toHaveAttribute(
    "href",
    "https://www.netflix.com/"
  );
  expect(screen.getByText("Netflix")).toBeInTheDocument();
  expect(screen.getByText(/tap a platform to open it/i)).toBeInTheDocument();
});

test("shares a branded link that opens the exact movie", async () => {
  const share = jest.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "share", {
    configurable: true,
    value: share,
  });
  jest.spyOn(global, "fetch").mockResolvedValueOnce(movieResponse(firstMovie));
  render(<App />);

  fireEvent.click(screen.getByRole("button", { name: /find my movie/i }));
  await screen.findByRole("heading", { name: firstMovie.title });
  fireEvent.click(screen.getByRole("button", { name: /^share$/i }));

  await waitFor(() => expect(share).toHaveBeenCalledWith({
    title: "First Pick (2020) — MovieNightPick",
    text: "IMDb 7.8 · See why MovieNightPick chose First Pick.",
    url: "http://localhost/share/101",
  }));
});

test("loads the exact movie from a shared link", async () => {
  window.history.replaceState({}, "", "/?movie=202");
  const fetchMock = jest.spyOn(global, "fetch").mockResolvedValueOnce(movieResponse(secondMovie));
  render(<App />);

  expect(await screen.findByRole("heading", { name: secondMovie.title })).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledWith(
    "/api/movie?id=202",
    expect.objectContaining({ signal: expect.any(AbortSignal) })
  );
});

test("sends the current movie as an exclusion when spinning again", async () => {
  const fetchMock = jest.spyOn(global, "fetch")
    .mockResolvedValueOnce(movieResponse(firstMovie))
    .mockResolvedValueOnce(movieResponse(secondMovie));
  render(<App />);

  fireEvent.click(screen.getByRole("button", { name: /find my movie/i }));
  expect(await screen.findByRole("heading", { name: firstMovie.title })).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: /pick another/i }));
  expect(await screen.findByRole("heading", { name: secondMovie.title })).toBeInTheDocument();

  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  const secondRequest = JSON.parse(fetchMock.mock.calls[1][1].body);
  expect(secondRequest.excludedIds).toContain(firstMovie.id);
});

test("scrolls to the start of the result after picking another movie", async () => {
  const scrollIntoView = jest.fn();
  window.HTMLElement.prototype.scrollIntoView = scrollIntoView;
  jest.spyOn(global, "fetch")
    .mockResolvedValueOnce(movieResponse(firstMovie))
    .mockResolvedValueOnce(movieResponse(secondMovie));
  render(<App />);

  fireEvent.click(screen.getByRole("button", { name: /find my movie/i }));
  expect(await screen.findByRole("heading", { name: firstMovie.title })).toBeInTheDocument();
  await waitFor(() => expect(scrollIntoView).toHaveBeenCalled());
  scrollIntoView.mockClear();

  fireEvent.click(screen.getByRole("button", { name: /pick another/i }));
  expect(await screen.findByRole("heading", { name: secondMovie.title })).toBeInTheDocument();

  await waitFor(() => {
    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "start",
    });
  });
});

test("does not keep showing the previous movie when a new search fails", async () => {
  jest.spyOn(global, "fetch")
    .mockResolvedValueOnce(movieResponse(firstMovie))
    .mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "No movie matched the new filters." }),
    });
  render(<App />);

  fireEvent.click(screen.getByRole("button", { name: /find my movie/i }));
  expect(await screen.findByRole("heading", { name: firstMovie.title })).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: /pick another/i }));
  expect(await screen.findByText("No movie matched the new filters.")).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: firstMovie.title })).not.toBeInTheDocument();
});
