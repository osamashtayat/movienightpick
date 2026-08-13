const recommendHandler = require("./recommend");

const { ApiError, getMovieById } = recommendHandler.shared;

module.exports = async function handler(request, response) {
  response.setHeader("Content-Type", "application/json; charset=utf-8");

  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Method not allowed." });
  }

  try {
    const tmdbKey = process.env.TMDB_API_KEY;
    const mdblistKey = process.env.MDBLIST_API_KEY;
    if (!tmdbKey || !mdblistKey) {
      throw new ApiError("The movie service is not configured yet.", 503);
    }

    const movieId = Number(request.query?.id);
    const movie = await getMovieById(movieId, tmdbKey, mdblistKey);
    response.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=604800");
    return response.status(200).json({ movie });
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 500;
    const message = error instanceof ApiError
      ? error.message
      : "The shared movie could not be loaded.";
    response.setHeader("Cache-Control", "no-store");
    return response.status(status).json({ error: message });
  }
};
