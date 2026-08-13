import JSZip from "jszip";

const MAX_IMPORTED_MOVIES = 12_000;

export function normalizeMovieTitle(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, "-");
}

export function movieYear(value) {
  const match = String(value || "").match(/(?:18|19|20|21)\d{2}/);
  return match?.[0] || "";
}

export function movieTitleYearKey(title, year) {
  const normalizedTitle = normalizeMovieTitle(title);
  const normalizedYear = movieYear(year);
  return normalizedTitle && normalizedYear
    ? `${normalizedTitle}:${normalizedYear}`
    : "";
}

function imdbIdFromValue(value) {
  return String(value || "").match(/tt\d{5,12}/i)?.[0]?.toLowerCase() || "";
}

function safeTmdbId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function cleanCell(value) {
  return String(value || "").replace(/^\uFEFF/, "").trim();
}

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < String(text).length; index += 1) {
    const character = text[index];

    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      row.push(cleanCell(cell));
      cell = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(cleanCell(cell));
      cell = "";
      if (row.some(Boolean)) rows.push(row);
      row = [];
    } else {
      cell += character;
    }
  }

  row.push(cleanCell(cell));
  if (row.some(Boolean)) rows.push(row);
  if (rows.length < 2) return [];

  const headers = rows[0].map((header) => cleanCell(header).toLowerCase());
  return rows.slice(1).map((values) => Object.fromEntries(
    headers.map((header, index) => [header, cleanCell(values[index])])
  ));
}

function rowValue(row, names) {
  for (const name of names) {
    const value = row[name.toLowerCase()];
    if (value) return value;
  }
  return "";
}

function watchedEntry({ title, year, imdbId, tmdbId, source }) {
  const cleanTitle = cleanCell(title);
  const cleanYear = movieYear(year);
  const cleanImdbId = imdbIdFromValue(imdbId);
  const cleanTmdbId = safeTmdbId(tmdbId);

  if (!cleanTitle && !cleanImdbId && !cleanTmdbId) return null;

  return {
    title: cleanTitle || "Untitled movie",
    year: cleanYear,
    imdbId: cleanImdbId,
    tmdbId: cleanTmdbId,
    source,
    addedAt: new Date().toISOString(),
  };
}

export function parseImdbCsv(text) {
  return parseCsv(text).map((row) => watchedEntry({
    title: rowValue(row, ["Title", "Name", "Original Title"]),
    year: rowValue(row, ["Year", "Release Year", "Release Date"]),
    imdbId: rowValue(row, ["Const", "IMDb ID", "URL"]),
    tmdbId: rowValue(row, ["TMDB ID"]),
    source: "imdb",
  })).filter(Boolean).slice(0, MAX_IMPORTED_MOVIES);
}

export function parseLetterboxdCsv(text) {
  return parseCsv(text).map((row) => watchedEntry({
    title: rowValue(row, ["Name", "Title"]),
    year: rowValue(row, ["Year", "Release Year", "Watched Date"]),
    imdbId: rowValue(row, ["IMDb ID", "IMDb URL"]),
    tmdbId: rowValue(row, ["TMDB ID"]),
    source: "letterboxd",
  })).filter(Boolean).slice(0, MAX_IMPORTED_MOVIES);
}

async function textFromFile(file) {
  if (typeof file.text === "function") return file.text();
  return new Response(file).text();
}

export async function importWatchedFile(file, source) {
  if (!file) throw new Error("Choose an export file first.");
  const lowerName = file.name.toLowerCase();

  if (source === "imdb") {
    if (!lowerName.endsWith(".csv")) {
      throw new Error("IMDb imports must be a CSV export file.");
    }
    return parseImdbCsv(await textFromFile(file));
  }

  if (source !== "letterboxd") {
    throw new Error("That import source is not supported.");
  }

  if (lowerName.endsWith(".csv")) {
    return parseLetterboxdCsv(await textFromFile(file));
  }

  if (!lowerName.endsWith(".zip")) {
    throw new Error("Letterboxd imports must be the export ZIP or a watched CSV file.");
  }

  let archive;
  try {
    const archiveData = typeof file.arrayBuffer === "function"
      ? await file.arrayBuffer()
      : file;
    archive = await JSZip.loadAsync(archiveData);
  } catch {
    throw new Error("That Letterboxd ZIP could not be opened.");
  }

  const watchedCsv = Object.values(archive.files).find((archiveFile) => (
    !archiveFile.dir && /(^|\/)watched\.csv$/i.test(archiveFile.name)
  ));

  if (!watchedCsv) {
    throw new Error("The Letterboxd export does not contain watched.csv.");
  }

  return parseLetterboxdCsv(await watchedCsv.async("string"));
}

function identityKeys(movie) {
  const keys = [];
  const tmdbId = safeTmdbId(movie.tmdbId ?? movie.id);
  const imdbId = imdbIdFromValue(movie.imdbId || movie.imdb?.imdbID);
  const titleYear = movieTitleYearKey(
    movie.title || movie.name,
    movie.year || movie.release_date
  );

  if (tmdbId) keys.push(`tmdb:${tmdbId}`);
  if (imdbId) keys.push(`imdb:${imdbId}`);
  if (titleYear) keys.push(`title:${titleYear}`);
  return keys;
}

function mergePair(previous, next) {
  return {
    ...previous,
    ...next,
    title: next.title && next.title !== "Untitled movie" ? next.title : previous.title,
    year: next.year || previous.year || "",
    imdbId: next.imdbId || previous.imdbId || "",
    tmdbId: next.tmdbId || previous.tmdbId || null,
    source: previous.source === "manual" || next.source === "manual"
      ? "manual"
      : next.source || previous.source,
    addedAt: previous.addedAt || next.addedAt || new Date().toISOString(),
  };
}

export function mergeWatchedMovies(current, incoming) {
  const merged = [];
  const identityIndex = new Map();

  [...current, ...incoming].forEach((rawMovie) => {
    const movie = watchedEntry({
      title: rawMovie.title || rawMovie.name,
      year: rawMovie.year || rawMovie.release_date,
      imdbId: rawMovie.imdbId || rawMovie.imdb?.imdbID,
      tmdbId: rawMovie.tmdbId ?? rawMovie.id,
      source: rawMovie.source || "manual",
    });
    if (!movie) return;
    movie.addedAt = rawMovie.addedAt || movie.addedAt;

    const keys = identityKeys(movie);
    const existingIndex = keys.map((key) => identityIndex.get(key)).find(Number.isInteger);

    if (Number.isInteger(existingIndex)) {
      merged[existingIndex] = mergePair(merged[existingIndex], movie);
      identityKeys(merged[existingIndex]).forEach((key) => identityIndex.set(key, existingIndex));
      return;
    }

    const nextIndex = merged.length;
    merged.push(movie);
    keys.forEach((key) => identityIndex.set(key, nextIndex));
  });

  return merged.slice(-MAX_IMPORTED_MOVIES);
}

export function watchedMovieFromResult(movie) {
  return watchedEntry({
    title: movie.title,
    year: movie.release_date,
    imdbId: movie.imdb?.imdbID,
    tmdbId: movie.id,
    source: "manual",
  });
}

export function isMovieWatched(movie, watchedMovies) {
  const watchedIdentities = new Set(watchedMovies.flatMap(identityKeys));
  return identityKeys(movie).some((key) => watchedIdentities.has(key));
}

export function removeWatchedMovie(watchedMovies, movie) {
  const removalKeys = new Set(identityKeys(movie));
  return watchedMovies.filter(
    (watchedMovie) => !identityKeys(watchedMovie).some((key) => removalKeys.has(key))
  );
}

export function buildMovieExclusions(watchedMovies) {
  const tmdbIds = new Set();
  const imdbIds = new Set();
  const movieKeys = new Set();

  watchedMovies.forEach((movie) => {
    const tmdbId = safeTmdbId(movie.tmdbId ?? movie.id);
    const imdbId = imdbIdFromValue(movie.imdbId || movie.imdb?.imdbID);
    const titleYear = movieTitleYearKey(
      movie.title || movie.name,
      movie.year || movie.release_date
    );
    if (tmdbId) tmdbIds.add(tmdbId);
    if (imdbId) imdbIds.add(imdbId);
    if (titleYear) movieKeys.add(titleYear);
  });

  return {
    tmdbIds: [...tmdbIds],
    imdbIds: [...imdbIds],
    movieKeys: [...movieKeys],
  };
}
