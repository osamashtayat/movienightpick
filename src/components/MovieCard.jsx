import { formatNumber, formatRuntime, posterUrl, releaseYear } from "../utils/movie";

function Detail({ label, value }) {
  if (!value || value === "N/A") return null;
  return (
    <div className="movie-detail">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

const PLATFORM_LINKS = [
  [/netflix/i, "https://www.netflix.com/"],
  [/mgm/i, "https://www.mgmplus.com/"],
  [/amazon|prime video/i, "https://www.primevideo.com/"],
  [/disney/i, "https://www.disneyplus.com/"],
  [/hulu/i, "https://www.hulu.com/"],
  [/hbo|max/i, "https://play.max.com/"],
  [/apple tv/i, "https://tv.apple.com/"],
  [/google play/i, "https://play.google.com/store/movies"],
  [/youtube/i, "https://www.youtube.com/"],
  [/paramount/i, "https://www.paramountplus.com/"],
  [/peacock/i, "https://www.peacocktv.com/"],
  [/fubo/i, "https://www.fubo.tv/"],
  [/tubi/i, "https://tubitv.com/"],
  [/pluto/i, "https://pluto.tv/"],
  [/roku/i, "https://therokuchannel.roku.com/"],
  [/crunchyroll/i, "https://www.crunchyroll.com/"],
  [/starz/i, "https://www.starz.com/"],
  [/plex/i, "https://www.plex.tv/watch-free-tv/"],
  [/philo/i, "https://www.philo.com/"],
  [/amc/i, "https://www.amcplus.com/"],
  [/kanopy/i, "https://www.kanopy.com/"],
  [/hoopla/i, "https://www.hoopladigital.com/"],
  [/spectrum/i, "https://ondemand.spectrum.net/"],
  [/fandango|vudu/i, "https://athome.fandango.com/"],
  [/microsoft/i, "https://www.microsoft.com/store/movies-and-tv"],
  [/britbox/i, "https://www.britbox.com/"],
];

function providerLink(providerName, fallback) {
  return PLATFORM_LINKS.find(([pattern]) => pattern.test(providerName || ""))?.[1]
    || fallback
    || "#";
}

export function MovieCard({ movie, isFavorite, onFavorite, onShare, onReroll }) {
  const imdb = movie.imdb || {};
  const genres = movie.genres?.map((genre) => genre.name).join(" · ") || imdb.Genre;
  const runtime = formatRuntime(movie.runtime, imdb.Runtime);
  const poster = movie.posterUrl || posterUrl(movie.poster_path);

  return (
    <article className="movie-feature">
      {movie.backdropUrl && (
        <div
          className="movie-backdrop"
          style={{ backgroundImage: `url(${movie.backdropUrl})` }}
          aria-hidden="true"
        />
      )}
      <div className="movie-feature-overlay" />

      <div className="movie-feature-content">
        <div className="poster-column">
          {poster ? (
            <img className="feature-poster" src={poster} alt={`${movie.title} poster`} />
          ) : (
            <div className="poster-placeholder" aria-label="No poster available">{movie.title}</div>
          )}
          <div className="match-note">
            <span aria-hidden="true">✓</span>
            Verified IMDb match
          </div>
        </div>

        <div className="movie-copy">
          <div className="movie-topline">
            <span className="recommendation-label">Tonight’s pick</span>
            <button
              className={`icon-button favorite-button ${isFavorite ? "active" : ""}`}
              type="button"
              onClick={() => onFavorite(movie)}
              aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
              title={isFavorite ? "Remove from favorites" : "Add to favorites"}
            >
              {isFavorite ? "♥" : "♡"}
            </button>
          </div>

          <h2>{movie.title}</h2>

          <div className="movie-meta">
            <span className="imdb-badge"><b>IMDb</b> {movie.imdbRating?.toFixed(1)}</span>
            <span>{releaseYear(movie.release_date)}</span>
            {runtime && <span>{runtime}</span>}
            {imdb.Rated && imdb.Rated !== "N/A" && <span>{imdb.Rated}</span>}
          </div>

          {genres && <p className="genres">{genres}</p>}
          <p className="overview">{movie.overview || imdb.Plot || "No synopsis is available yet."}</p>

          <div className="movie-details-grid">
            <Detail label="Director" value={imdb.Director} />
            <Detail label="Cast" value={imdb.Actors} />
            <Detail label="IMDb votes" value={formatNumber(imdb.imdbVotes)} />
            <Detail label="Awards" value={imdb.Awards} />
          </div>

          {movie.trailerKey && (
            <div className="trailer-section">
              <span>Official trailer</span>
              <div className="trailer-frame">
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(movie.trailerKey)}?rel=0`}
                  title={`${movie.title} — YouTube trailer`}
                  loading="lazy"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>
            </div>
          )}

          {movie.providers?.length > 0 && (
            <div className="provider-row">
              <div className="provider-heading">
                <span>Streaming in</span>
                <small>Tap a platform to open it</small>
              </div>
              <div className="provider-links">
                {movie.providers.map((provider) => (
                  <a
                    className="provider-link"
                    key={provider.provider_id}
                    href={providerLink(provider.provider_name, movie.watchLink)}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Open ${provider.provider_name}`}
                    title={provider.provider_name}
                  >
                    <img
                      src={posterUrl(provider.logo_path, "w92")}
                      alt=""
                    />
                    <span>{provider.provider_name}</span>
                    <span className="provider-arrow" aria-hidden="true">↗</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          <div className="movie-actions">
            {movie.trailerKey && (
              <a
                className="primary-button compact"
                href={`https://www.youtube.com/watch?v=${movie.trailerKey}`}
                target="_blank"
                rel="noreferrer"
              >
                <span aria-hidden="true">▶</span>
                Open on YouTube
              </a>
            )}
            <button className="secondary-button" type="button" onClick={() => onShare(movie)}>
              <span aria-hidden="true">↗</span>
              Share
            </button>
            <button className="secondary-button" type="button" onClick={onReroll}>
              <span aria-hidden="true">↻</span>
              Pick another
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
