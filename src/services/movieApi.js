export async function findRandomMovie(
  filters,
  { signal, exclusions = {}, excludedIds } = {}
) {
  const normalizedExclusions = {
    tmdbIds: exclusions.tmdbIds || excludedIds || [],
    imdbIds: exclusions.imdbIds || [],
    movieKeys: exclusions.movieKeys || [],
  };
  const response = await fetch("/api/recommend", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filters,
      excludedIds: normalizedExclusions.tmdbIds,
      excludedImdbIds: normalizedExclusions.imdbIds,
      excludedMovieKeys: normalizedExclusions.movieKeys,
    }),
    signal,
  });

  let payload;
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }

  if (!response.ok) {
    throw new Error(payload.error || "The movie service is unavailable right now.");
  }

  if (!payload.movie) {
    throw new Error("The movie service returned an unexpected response.");
  }

  return payload.movie;
}

export async function findMovieById(movieId, { signal } = {}) {
  const response = await fetch(`/api/movie?id=${encodeURIComponent(movieId)}`, { signal });

  let payload;
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }

  if (!response.ok) {
    throw new Error(payload.error || "This shared movie is unavailable right now.");
  }

  if (!payload.movie) {
    throw new Error("The shared movie could not be loaded.");
  }

  return payload.movie;
}
