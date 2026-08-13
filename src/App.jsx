import { useEffect, useMemo, useRef, useState } from "react";
import { AppHeader } from "./components/AppHeader";
import { EmptyStage } from "./components/EmptyStage";
import { FilterPanel } from "./components/FilterPanel";
import { LoadingStage } from "./components/LoadingStage";
import { MovieCard } from "./components/MovieCard";
import { MovieShelf } from "./components/MovieShelf";
import { SeenMoviesDialog } from "./components/SeenMoviesDialog";
import { DEFAULT_FILTERS } from "./data/movieOptions";
import { useLocalStorage } from "./hooks/useLocalStorage";
import { useMovieDiscovery } from "./hooks/useMovieDiscovery";
import { uniqueById } from "./utils/movie";
import {
  buildMovieExclusions,
  importWatchedFile,
  isMovieWatched,
  mergeWatchedMovies,
  removeWatchedMovie,
  watchedMovieFromResult,
} from "./utils/watchedMovies";
import "./index.css";

const HISTORY_LIMIT = 12;

function App() {
  const [filters, setFilters] = useLocalStorage("reel-roulette-filters", DEFAULT_FILTERS);
  const [favorites, setFavorites] = useLocalStorage("reel-roulette-favorites", []);
  const [history, setHistory] = useLocalStorage("reel-roulette-history", []);
  const [watchedMovies, setWatchedMovies] = useLocalStorage("movienightpick-seen-v1", []);
  const [toast, setToast] = useState("");
  const [isSeenDialogOpen, setIsSeenDialogOpen] = useState(false);
  const resultStageRef = useRef(null);
  const {
    movie,
    status,
    error,
    discover,
    loadSharedMovie,
    cancel,
    selectMovie,
  } = useMovieDiscovery();

  const favoriteIds = useMemo(
    () => new Set(favorites.map((favorite) => favorite.id)),
    [favorites]
  );

  const isCurrentMovieWatched = useMemo(
    () => Boolean(movie && isMovieWatched(movie, watchedMovies)),
    [movie, watchedMovies]
  );

  const runDiscovery = async () => {
    if (new URLSearchParams(window.location.search).has("movie")) {
      window.history.replaceState({}, "", window.location.pathname);
    }

    const exclusions = [movie].filter(Boolean).map(watchedMovieFromResult);
    if (filters.avoidSeen) {
      exclusions.push(...watchedMovies, ...history.map(watchedMovieFromResult));
    }

    const result = await discover(filters, buildMovieExclusions(exclusions));

    if (result) {
      setHistory((current) => uniqueById([result, ...current]).slice(0, HISTORY_LIMIT));
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    runDiscovery();
  };

  const handleFiltersChange = (nextFilters) => {
    if (new URLSearchParams(window.location.search).has("movie")) {
      window.history.replaceState({}, "", window.location.pathname);
    }
    setFilters(nextFilters);
    selectMovie(null);
  };

  const toggleFavorite = (selectedMovie) => {
    setFavorites((current) => {
      const exists = current.some((favorite) => favorite.id === selectedMovie.id);
      setToast(exists ? "Removed from favorites" : "Saved to favorites");
      return exists
        ? current.filter((favorite) => favorite.id !== selectedMovie.id)
        : uniqueById([selectedMovie, ...current]);
    });
  };

  const toggleWatched = (selectedMovie) => {
    setWatchedMovies((current) => {
      const alreadyWatched = isMovieWatched(selectedMovie, current);
      setToast(alreadyWatched ? "Removed from seen movies" : "Added to seen movies");
      return alreadyWatched
        ? removeWatchedMovie(current, selectedMovie)
        : mergeWatchedMovies(current, [watchedMovieFromResult(selectedMovie)]);
    });
  };

  const importWatchedMovies = async ({ file, source, mode }) => {
    try {
      const importedMovies = await importWatchedFile(file, source);
      if (!importedMovies.length) {
        throw new Error(`No movies were found in that ${source === "imdb" ? "IMDb" : "Letterboxd"} export.`);
      }

      setWatchedMovies((current) => {
        const next = mergeWatchedMovies(mode === "replace" ? [] : current, importedMovies);
        setToast(
          `${importedMovies.length.toLocaleString()} movies imported · ${next.length.toLocaleString()} remembered`
        );
        return next;
      });
    } catch (importError) {
      setToast(importError.message || "That movie history could not be imported.");
    }
  };

  const shareMovie = async (selectedMovie) => {
    const year = selectedMovie.release_date?.slice(0, 4);
    const rating = Number.isFinite(selectedMovie.imdbRating)
      ? `IMDb ${selectedMovie.imdbRating.toFixed(1)}`
      : "MovieNightPick recommendation";
    const shareUrl = new URL(`/share/${selectedMovie.id}`, window.location.origin).toString();
    const shareTitle = `${selectedMovie.title}${year ? ` (${year})` : ""} — MovieNightPick`;
    const shareText = `${rating} · See why MovieNightPick chose ${selectedMovie.title}.`;

    try {
      if (navigator.share) {
        await navigator.share({ title: shareTitle, text: shareText, url: shareUrl });
        setToast("Shared!");
      } else {
        await navigator.clipboard.writeText(`${shareTitle}\n${shareText}\n${shareUrl}`);
        setToast("Movie link copied to your clipboard");
      }
    } catch (shareError) {
      if (shareError.name !== "AbortError") setToast("Could not share this movie");
    }
  };

  useEffect(() => {
    const sharedMovieId = Number(new URLSearchParams(window.location.search).get("movie"));
    if (Number.isInteger(sharedMovieId) && sharedMovieId > 0) {
      loadSharedMovie(sharedMovieId);
    }
  }, [loadSharedMovie]);

  useEffect(() => {
    if (!toast) return undefined;
    const timeout = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    if (status !== "success" || !movie) return undefined;

    const animationFrame = window.requestAnimationFrame(() => {
      resultStageRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, [movie, status]);

  return (
    <div className="app-shell" id="top">
      <div className="ambient-glow glow-one" />
      <div className="ambient-glow glow-two" />

      <AppHeader
        favoriteCount={favorites.length}
        historyCount={history.length}
        watchedCount={watchedMovies.length}
      />

      <main>
        <section className="hero-intro">
          <span className="eyebrow">A better way to pick movie night</span>
          <h1>Less browsing.<br /><em>More watching.</em></h1>
          <p>Tell us what feels right. We’ll match your preferences and verify the latest IMDb score before making your pick.</p>
        </section>

        <div className="discovery-layout">
          <FilterPanel
            filters={filters}
            onChange={handleFiltersChange}
            onSubmit={handleSubmit}
            onCancel={cancel}
            status={status}
            watchedCount={watchedMovies.length}
            onManageWatched={() => setIsSeenDialogOpen(true)}
          />

          <div className="result-stage" ref={resultStageRef}>
            {status === "loading" && <LoadingStage />}
            {status !== "loading" && movie && (
              <MovieCard
                movie={movie}
                isFavorite={favoriteIds.has(movie.id)}
                isWatched={isCurrentMovieWatched}
                onFavorite={toggleFavorite}
                onWatched={toggleWatched}
                onShare={shareMovie}
                onReroll={runDiscovery}
              />
            )}
            {status !== "loading" && !movie && <EmptyStage error={error} />}
            {status === "error" && movie && (
              <div className="inline-error" role="alert">{error}</div>
            )}
          </div>
        </div>

        <div className="collections">
          <MovieShelf
            title="Recent picks"
            subtitle="Your last twelve recommendations"
            movies={history}
            onSelect={selectMovie}
            onClear={() => setHistory([])}
            emptyMessage="Your recommendations will appear here after the first pick."
          />
          <MovieShelf
            title="Favorites"
            subtitle="The ones worth remembering"
            movies={favorites}
            onSelect={selectMovie}
            onClear={() => setFavorites([])}
            emptyMessage="Tap the heart on a recommendation to save it here."
          />
        </div>
      </main>

      <footer>
        <span>Made for indecisive movie lovers.</span>
        <span>Uses TMDB and MDBList data. Not endorsed by TMDB, MDBList, or IMDb.</span>
      </footer>

      {toast && <div className="toast" role="status">{toast}</div>}

      <SeenMoviesDialog
        isOpen={isSeenDialogOpen}
        watchedMovies={watchedMovies}
        onClose={() => setIsSeenDialogOpen(false)}
        onImport={importWatchedMovies}
        onRemove={(selectedMovie) => {
          setWatchedMovies((current) => removeWatchedMovie(current, selectedMovie));
          setToast("Removed from seen movies");
        }}
        onClear={() => {
          setWatchedMovies([]);
          setToast("Seen movie history cleared");
        }}
      />
    </div>
  );
}

export default App;
