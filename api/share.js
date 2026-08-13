const recommendHandler = require("./recommend");

const { getMovieById } = recommendHandler.shared;

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function truncate(value, maximumLength) {
  const text = String(value || "").trim();
  return text.length > maximumLength
    ? `${text.slice(0, maximumLength - 1).trim()}…`
    : text;
}

function requestOrigin(request) {
  const forwardedHost = request.headers["x-forwarded-host"];
  const host = String(forwardedHost || request.headers.host || "movienightpick.vercel.app")
    .split(",")[0]
    .trim();
  if (!/^(?:localhost|127\.0\.0\.1|[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?)(?::\d+)?$/i.test(host)) {
    return "https://movienightpick.vercel.app";
  }
  const forwardedProtocol = request.headers["x-forwarded-proto"];
  const protocol = forwardedProtocol === "http" || forwardedProtocol === "https"
    ? forwardedProtocol
    : host.includes("localhost") || host.startsWith("127.0.0.1")
      ? "http"
      : "https";
  return `${protocol}://${host}`;
}

function shareDocument({ movie, movieId, origin }) {
  const title = movie?.title || "A MovieNightPick recommendation";
  const year = movie?.release_date?.slice(0, 4);
  const displayTitle = year ? `${title} (${year})` : title;
  const rating = Number.isFinite(movie?.imdbRating)
    ? `IMDb ${movie.imdbRating.toFixed(1)}`
    : "MovieNightPick recommendation";
  const genres = movie?.genres?.map((genre) => genre.name).filter(Boolean).slice(0, 3).join(" · ")
    || movie?.imdb?.Genre;
  const summary = truncate(movie?.overview || movie?.imdb?.Plot, 150);
  const description = truncate([rating, genres, summary].filter(Boolean).join(" • "), 220);
  const destination = `${origin}/?movie=${movieId}`;
  const shareUrl = `${origin}/share/${movieId}`;
  const image = `${origin}/share-preview.png`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(displayTitle)} — MovieNightPick</title>
    <meta name="description" content="${escapeHtml(description)}">
    <meta property="og:type" content="video.movie">
    <meta property="og:site_name" content="MovieNightPick">
    <meta property="og:title" content="${escapeHtml(displayTitle)} — MovieNightPick">
    <meta property="og:description" content="${escapeHtml(description)}">
    <meta property="og:url" content="${escapeHtml(shareUrl)}">
    <meta property="og:image" content="${escapeHtml(image)}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:image:alt" content="${escapeHtml(`${displayTitle} shared from MovieNightPick`)}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeHtml(displayTitle)} — MovieNightPick">
    <meta name="twitter:description" content="${escapeHtml(description)}">
    <meta name="twitter:image" content="${escapeHtml(image)}">
    <link rel="icon" href="${origin}/favicon.svg" type="image/svg+xml">
    <link rel="apple-touch-icon" href="${origin}/logo192.png">
    <meta http-equiv="refresh" content="0;url=${escapeHtml(destination)}">
  </head>
  <body style="margin:0;background:#08090c;color:#f7f7f4;font-family:system-ui,sans-serif;display:grid;min-height:100vh;place-items:center;text-align:center">
    <main>
      <img src="${origin}/logo192.png" width="72" height="72" alt="MovieNightPick logo">
      <h1>${escapeHtml(displayTitle)}</h1>
      <p>${escapeHtml(description)}</p>
      <a href="${escapeHtml(destination)}" style="color:#ff7a66">Open in MovieNightPick</a>
    </main>
    <script>window.location.replace(${JSON.stringify(destination)});</script>
  </body>
</html>`;
}

module.exports = async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).send("Method not allowed.");
  }

  const movieId = Number(request.query?.id);
  const origin = requestOrigin(request);

  try {
    const tmdbKey = process.env.TMDB_API_KEY;
    const mdblistKey = process.env.MDBLIST_API_KEY;
    if (!tmdbKey || !mdblistKey || !Number.isInteger(movieId) || movieId <= 0) {
      throw new Error("Invalid share request");
    }

    const movie = await getMovieById(movieId, tmdbKey, mdblistKey);
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=604800");
    return response.status(200).send(shareDocument({ movie, movieId, origin }));
  } catch {
    response.setHeader("Location", `/?movie=${Number.isInteger(movieId) ? movieId : ""}`);
    response.setHeader("Cache-Control", "no-store");
    return response.status(302).send("Redirecting to MovieNightPick.");
  }
};

module.exports.__test = { escapeHtml, requestOrigin, shareDocument };
