import JSZip from "jszip";
import {
  buildMovieExclusions,
  importWatchedFile,
  isMovieWatched,
  mergeWatchedMovies,
  parseImdbCsv,
  parseLetterboxdCsv,
  removeWatchedMovie,
  watchedMovieFromResult,
} from "./watchedMovies";

test("parses IMDb exports with stable IMDb IDs and quoted titles", () => {
  const movies = parseImdbCsv(
    'Const,Your Rating,Title,Year,URL\n'
    + 'tt0133093,9,"The Matrix, The",1999,https://www.imdb.com/title/tt0133093/\n'
    + 'tt0088763,10,Back to the Future,1985,https://www.imdb.com/title/tt0088763/'
  );

  expect(movies).toEqual([
    expect.objectContaining({
      title: "The Matrix, The",
      year: "1999",
      imdbId: "tt0133093",
      source: "imdb",
    }),
    expect.objectContaining({ title: "Back to the Future", year: "1985" }),
  ]);
});

test("parses Letterboxd watched history and deduplicates it with manual picks", () => {
  const imported = parseLetterboxdCsv(
    'Date,Name,Year,Letterboxd URI\n2024-01-01,Arrival,2016,https://boxd.it/ed3k'
  );
  const manual = watchedMovieFromResult({
    id: 329865,
    title: "Arrival",
    release_date: "2016-11-11",
    imdb: { imdbID: "tt2543164" },
  });
  const merged = mergeWatchedMovies(imported, [manual]);

  expect(merged).toHaveLength(1);
  expect(merged[0]).toEqual(expect.objectContaining({
    title: "Arrival",
    year: "2016",
    tmdbId: 329865,
    imdbId: "tt2543164",
  }));
  expect(isMovieWatched({ id: 329865, title: "Arrival" }, merged)).toBe(true);
  expect(removeWatchedMovie(merged, { id: 329865 })).toEqual([]);
});

test("imports the watched.csv inside a Letterboxd account ZIP", async () => {
  const zip = new JSZip();
  zip.file(
    "letterboxd-username-2026-08-13/watched.csv",
    "Date,Name,Year,Letterboxd URI\n2025-02-03,Parasite,2019,https://boxd.it/hTha"
  );
  const archive = await zip.generateAsync({ type: "uint8array" });

  const movies = await importWatchedFile({
    name: "letterboxd-export.zip",
    arrayBuffer: async () => archive.buffer,
  }, "letterboxd");

  expect(movies).toEqual([
    expect.objectContaining({ title: "Parasite", year: "2019", source: "letterboxd" }),
  ]);
});

test("builds compact exclusions using every available movie identity", () => {
  const exclusions = buildMovieExclusions([
    {
      title: "The Matrix",
      year: "1999",
      tmdbId: 603,
      imdbId: "tt0133093",
    },
  ]);

  expect(exclusions).toEqual({
    tmdbIds: [603],
    imdbIds: ["tt0133093"],
    movieKeys: ["the-matrix:1999"],
  });
});

