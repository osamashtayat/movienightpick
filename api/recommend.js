const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const MDBLIST_BASE_URL = "https://api.mdblist.com";
const MAX_SEARCH_ATTEMPTS = 40;
const REQUEST_TIMEOUT_MS = 8_000;
const SEARCH_WINDOW_MS = 10 * 60 * 1_000;
const SEARCHES_PER_WINDOW = 30;
const MDBLIST_CACHE_TTL_MS = 6 * 60 * 60 * 1_000;

const requestBuckets = new Map();
const mdblistCache = new Map();

class ApiError extends Error {
  constructor(message, status = 500) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function getClientIp(request) {
  const forwarded = request.headers["x-forwarded-for"];
  return String(Array.isArray(forwarded) ? forwarded[0] : forwarded || "unknown")
    .split(",")[0]
    .trim();
}

function formatRetryDelay(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const parts = [];

  if (minutes) parts.push(`${minutes} minute${minutes === 1 ? "" : "s"}`);
  if (seconds || !minutes) parts.push(`${seconds} second${seconds === 1 ? "" : "s"}`);

  return parts.join(" and ");
}

function enforceRateLimit(request, response) {
  const now = Date.now();
  const clientIp = getClientIp(request);
  const current = requestBuckets.get(clientIp);

  if (!current || now >= current.resetAt) {
    requestBuckets.set(clientIp, { count: 1, resetAt: now + SEARCH_WINDOW_MS });
    return;
  }

  if (current.count >= SEARCHES_PER_WINDOW) {
    const retryAfterSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1_000));
    response.setHeader("Retry-After", retryAfterSeconds);
    throw new ApiError(
      `Too many searches. Try again in ${formatRetryDelay(retryAfterSeconds)}.`,
      429
    );
  }

  current.count += 1;
}

function enforceSameOrigin(request) {
  const origin = request.headers.origin;
  const requestHost = request.headers["x-forwarded-host"] || request.headers.host;
  if (!origin || !requestHost) return;

  try {
    if (new URL(origin).host !== requestHost) {
      throw new ApiError("This API can only be used by MovieNightPick.", 403);
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError("Invalid request origin.", 403);
  }
}

function parseBody(request) {
  if (typeof request.body === "string") {
    try {
      return JSON.parse(request.body);
    } catch {
      throw new ApiError("Invalid request body.", 400);
    }
  }
  return request.body || {};
}

function validDate(value) {
  return !value || /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function normalizeInput(body) {
  const source = body.filters || {};
  const minimumRating = Number(source.minimumRating);

  if (!Number.isFinite(minimumRating) || minimumRating < 0 || minimumRating > 10) {
    throw new ApiError("The IMDb rating must be between 0 and 10.", 400);
  }

  if (!validDate(source.startDate) || !validDate(source.endDate)) {
    throw new ApiError("The release dates are invalid.", 400);
  }

  if (source.startDate && source.endDate && source.startDate > source.endDate) {
    throw new ApiError("The start date must be before the end date.", 400);
  }

  const genre = /^\d+$/.test(source.genre || "") ? source.genre : "";
  const language = /^[a-z]{2}$/.test(source.language || "") ? source.language : "";
  const maxRuntime = ["90", "120", "150", "180"].includes(source.maxRuntime)
    ? source.maxRuntime
    : "";
  const mode = ["crowd", "hidden", "wild"].includes(source.mode)
    ? source.mode
    : "crowd";
  const excludedIds = Array.isArray(body.excludedIds)
    ? body.excludedIds.filter(Number.isInteger).slice(0, 50)
    : [];

  return {
    filters: {
      genre,
      language,
      maxRuntime,
      mode,
      minimumRating,
      startDate: source.startDate || "",
      endDate: source.endDate || "",
    },
    excludedIds,
  };
}

async function fetchJson(url, serviceName, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });

    if (response.status === 401) {
      throw new ApiError(`${serviceName} rejected the configured API key.`, 502);
    }

    if (response.status === 429) {
      throw new ApiError(`${serviceName} request limit reached. Try again later.`, 429);
    }

    if (!response.ok) {
      throw new ApiError(`${serviceName} is unavailable right now.`, 502);
    }

    try {
      return await response.json();
    } catch {
      throw new ApiError(`${serviceName} returned an unexpected response.`, 502);
    }
  } catch (error) {
    if (error.name === "AbortError") {
      throw new ApiError(`${serviceName} took too long to respond.`, 504);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function buildDiscoverParams(filters, page, tmdbKey) {
  const params = new URLSearchParams({
    api_key: tmdbKey,
    include_adult: "false",
    include_video: "false",
    language: "en-US",
    page: String(page),
  });

  if (filters.genre) params.set("with_genres", filters.genre);
  if (filters.startDate) params.set("primary_release_date.gte", filters.startDate);
  if (filters.endDate) params.set("primary_release_date.lte", filters.endDate);
  if (filters.maxRuntime) params.set("with_runtime.lte", filters.maxRuntime);
  if (filters.language) params.set("with_original_language", filters.language);

  // TMDB narrows the candidate pool; the final pass/fail rating is always IMDb.
  if (filters.minimumRating >= 5) {
    params.set("vote_average.gte", String(Math.max(0, filters.minimumRating - 1)));
  }

  if (filters.mode === "crowd") {
    params.set("vote_count.gte", "200");
  } else if (filters.mode === "hidden") {
    params.set("vote_count.gte", "20");
    params.set("vote_count.lte", "1500");
  } else {
    params.set("vote_count.gte", "20");
  }

  const prioritizeRating = filters.minimumRating >= 6.5 || filters.mode === "hidden";
  params.set("sort_by", prioritizeRating ? "vote_average.desc" : "popularity.desc");

  return params;
}

function qualityBiasedCandidates(items, minimumRating) {
  const randomWeight = minimumRating >= 7 ? 0.8 : 1.6;
  return [...items]
    .map((movie) => ({
      movie,
      score: Number(movie.vote_average || 0) + Math.random() * randomWeight,
    }))
    .sort((left, right) => right.score - left.score)
    .map(({ movie }) => movie);
}

function candidatePageLimit(totalPages, minimumRating) {
  let maximumPages = 60;

  if (minimumRating >= 8.5) maximumPages = 3;
  else if (minimumRating >= 8) maximumPages = 6;
  else if (minimumRating >= 7.5) maximumPages = 10;
  else if (minimumRating >= 7) maximumPages = 16;
  else if (minimumRating >= 6) maximumPages = 30;

  return Math.min(totalPages, maximumPages);
}

function randomUnvisitedPage(totalPages, visitedPages) {
  if (visitedPages.size >= totalPages) return null;

  let page;
  do {
    page = Math.floor(Math.random() * totalPages) + 1;
  } while (visitedPages.has(page));
  return page;
}

function getImdbRating(mdblistMovie) {
  const imdb = mdblistMovie?.ratings?.find(
    (rating) => String(rating.source).toLowerCase() === "imdb"
  );
  const rating = Number.parseFloat(imdb?.value);

  if (!Number.isFinite(rating)) return null;
  return {
    rating,
    votes: Number.isFinite(Number(imdb.votes)) ? Number(imdb.votes) : null,
  };
}

function cachedMdblistMovie(movieId) {
  const cached = mdblistCache.get(movieId);
  if (!cached) return null;
  if (Date.now() - cached.savedAt > MDBLIST_CACHE_TTL_MS) {
    mdblistCache.delete(movieId);
    return null;
  }
  return cached.movie;
}

async function getMdblistMovies(candidates, mdblistKey) {
  const results = new Map();
  const uncachedIds = [];

  candidates.forEach((candidate) => {
    const cached = cachedMdblistMovie(candidate.id);
    if (cached) results.set(candidate.id, cached);
    else uncachedIds.push(candidate.id);
  });

  if (!uncachedIds.length) return results;

  const mdblistMovies = await fetchJson(
    `${MDBLIST_BASE_URL}/tmdb/movie/?apikey=${encodeURIComponent(mdblistKey)}`,
    "MDBList",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: uncachedIds }),
    }
  );

  if (!Array.isArray(mdblistMovies)) {
    throw new ApiError("MDBList returned an unexpected response.", 502);
  }

  mdblistMovies.forEach((movie) => {
    const tmdbId = Number(movie?.ids?.tmdb);
    if (!Number.isInteger(tmdbId)) return;
    results.set(tmdbId, movie);
    mdblistCache.set(tmdbId, { movie, savedAt: Date.now() });
  });

  return results;
}

function releaseCertification(details, mdblistMovie) {
  const usReleases = details.release_dates?.results?.find(
    (country) => country.iso_3166_1 === "US"
  )?.release_dates || [];
  const theatrical = usReleases.find(
    (release) => release.certification && [2, 3].includes(release.type)
  );
  const anyCertification = usReleases.find((release) => release.certification);
  return theatrical?.certification
    || anyCertification?.certification
    || mdblistMovie?.certification
    || "";
}

function youtubeKey(url) {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    return parsed.searchParams.get("v") || parsed.pathname.split("/").filter(Boolean).pop() || "";
  } catch {
    return "";
  }
}

async function enrichMovie(movie, tmdbKey, mdblistMovie, imdbRating) {
  try {
    const details = await fetchJson(
      `${TMDB_BASE_URL}/movie/${movie.id}?api_key=${tmdbKey}&language=en-US&append_to_response=videos,watch/providers,credits,release_dates`,
      "TMDB"
    );

    const officialTrailer = details.videos?.results?.find(
      (video) => video.site === "YouTube" && video.type === "Trailer" && video.official
    );
    const anyTrailer = details.videos?.results?.find(
      (video) => video.site === "YouTube" && video.type === "Trailer"
    );
    const providers = details["watch/providers"]?.results?.US;
    const directors = details.credits?.crew
      ?.filter((person) => person.job === "Director")
      .map((person) => person.name)
      .filter(Boolean)
      .slice(0, 3)
      .join(", ");
    const actors = details.credits?.cast
      ?.map((person) => person.name)
      .filter(Boolean)
      .slice(0, 5)
      .join(", ");
    const genres = details.genres?.map((genre) => genre.name).join(", ");

    return {
      ...movie,
      ...details,
      imdb: {
        imdbID: mdblistMovie?.ids?.imdb || "",
        Genre: genres || "",
        Runtime: details.runtime ? `${details.runtime} min` : "",
        Rated: releaseCertification(details, mdblistMovie),
        Director: directors || "",
        Actors: actors || "",
        imdbVotes: imdbRating.votes,
        Awards: mdblistMovie?.awards || "",
        Plot: mdblistMovie?.description || details.overview || movie.overview || "",
      },
      imdbRating: imdbRating.rating,
      trailerKey: (officialTrailer || anyTrailer)?.key || youtubeKey(mdblistMovie?.trailer),
      providers: providers?.flatrate?.slice(0, 6) || [],
      watchLink: providers?.link || "",
    };
  } catch {
    return {
      ...movie,
      imdb: {
        imdbID: mdblistMovie?.ids?.imdb || "",
        Genre: mdblistMovie?.genres?.map((genre) => genre.title).join(", ") || "",
        Runtime: mdblistMovie?.runtime ? `${mdblistMovie.runtime} min` : "",
        Rated: mdblistMovie?.certification || "",
        imdbVotes: imdbRating.votes,
        Awards: mdblistMovie?.awards || "",
        Plot: mdblistMovie?.description || movie.overview || "",
      },
      imdbRating: imdbRating.rating,
      trailerKey: youtubeKey(mdblistMovie?.trailer),
    };
  }
}

function imageUrl(path, size) {
  return path ? `https://image.tmdb.org/t/p/${size}${path}` : "";
}

async function recommendMovie(filters, excludedIds, tmdbKey, mdblistKey) {
  const firstPage = await fetchJson(
    `${TMDB_BASE_URL}/discover/movie?${buildDiscoverParams(filters, 1, tmdbKey)}`,
    "TMDB"
  );

  const totalPages = Math.min(firstPage.total_pages || 0, 500);
  if (!totalPages || !firstPage.total_results) {
    throw new ApiError("No movies match those filters. Try widening your search.", 404);
  }

  const excluded = new Set(excludedIds);
  const visitedMovies = new Set();
  const visitedPages = new Set();
  const pageCache = new Map([[1, firstPage]]);
  const candidatePages = candidatePageLimit(totalPages, filters.minimumRating);
  let attempts = 0;

  while (attempts < MAX_SEARCH_ATTEMPTS) {
    const page = randomUnvisitedPage(candidatePages, visitedPages);
    if (page === null) break;
    visitedPages.add(page);

    const pageData = pageCache.get(page) || await fetchJson(
      `${TMDB_BASE_URL}/discover/movie?${buildDiscoverParams(filters, page, tmdbKey)}`,
      "TMDB"
    );

    const candidates = qualityBiasedCandidates(
      pageData.results || [],
      filters.minimumRating
    ).filter((candidate) => (
      !visitedMovies.has(candidate.id) && !excluded.has(candidate.id)
    )).slice(0, MAX_SEARCH_ATTEMPTS - attempts);

    candidates.forEach((candidate) => visitedMovies.add(candidate.id));
    attempts += candidates.length;

    const mdblistMovies = await getMdblistMovies(candidates, mdblistKey);

    for (let index = 0; index < candidates.length; index += 1) {
      const candidate = candidates[index];
      const mdblistMovie = mdblistMovies.get(candidate.id);
      const imdbRating = getImdbRating(mdblistMovie);
      if (!imdbRating || imdbRating.rating < filters.minimumRating) continue;

      const movie = await enrichMovie(candidate, tmdbKey, mdblistMovie, imdbRating);
      return {
        ...movie,
        posterUrl: imageUrl(movie.poster_path, "w500"),
        backdropUrl: imageUrl(movie.backdrop_path, "w1280"),
      };
    }
  }

  const repeatHint = excluded.size ? " You can also turn off ‘Avoid recent picks’." : "";
  throw new ApiError(
    `No IMDb ${filters.minimumRating}+ movie was found. Try a lower rating or wider date range.${repeatHint}`,
    404
  );
}

module.exports = async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Type", "application/json; charset=utf-8");

  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed." });
  }

  try {
    const tmdbKey = process.env.TMDB_API_KEY;
    const mdblistKey = process.env.MDBLIST_API_KEY;
    if (!tmdbKey || !mdblistKey) {
      throw new ApiError("The movie service is not configured yet.", 503);
    }

    enforceSameOrigin(request);
    enforceRateLimit(request, response);
    const { filters, excludedIds } = normalizeInput(parseBody(request));
    const movie = await recommendMovie(filters, excludedIds, tmdbKey, mdblistKey);
    return response.status(200).json({ movie });
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 500;
    const message = error instanceof ApiError
      ? error.message
      : "The movie service encountered an unexpected error.";
    return response.status(status).json({ error: message });
  }
};

module.exports.__test = {
  buildDiscoverParams,
  candidatePageLimit,
  getImdbRating,
  normalizeInput,
};
