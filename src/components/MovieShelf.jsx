import { posterUrl, releaseYear } from "../utils/movie";

export function MovieShelf({ title, subtitle, movies, onSelect, onClear, emptyMessage }) {
  return (
    <section className="movie-shelf">
      <div className="shelf-heading">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {movies.length > 0 && onClear && (
          <button className="text-button" type="button" onClick={onClear}>Clear</button>
        )}
      </div>

      {movies.length === 0 ? (
        <div className="empty-shelf">{emptyMessage}</div>
      ) : (
        <div className="shelf-track">
          {movies.map((movie) => (
            <button
              className="shelf-card"
              type="button"
              key={movie.id}
              onClick={() => onSelect(movie)}
              aria-label={`Show ${movie.title}`}
            >
              {movie.posterUrl || movie.poster_path ? (
                <img
                  src={movie.posterUrl || posterUrl(movie.poster_path, "w342")}
                  alt=""
                  loading="lazy"
                />
              ) : (
                <span className="mini-poster-placeholder">No poster</span>
              )}
              <span className="shelf-card-overlay" />
              <span className="shelf-card-copy">
                <strong>{movie.title}</strong>
                <small>
                  {releaseYear(movie.release_date)}
                  {movie.imdbRating ? ` · IMDb ${movie.imdbRating.toFixed(1)}` : ""}
                </small>
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
