export async function findRandomMovie(
  filters,
  { signal, excludedIds = [] } = {}
) {
  const response = await fetch("/api/recommend", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filters, excludedIds }),
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
