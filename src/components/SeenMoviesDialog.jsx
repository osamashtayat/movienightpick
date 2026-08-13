import { useEffect, useMemo, useRef, useState } from "react";

const SOURCE_LABELS = {
  imdb: "IMDb",
  letterboxd: "Letterboxd",
  manual: "MovieNightPick",
};

export function SeenMoviesDialog({
  isOpen,
  watchedMovies,
  onClose,
  onImport,
  onRemove,
  onClear,
}) {
  const imdbInputRef = useRef(null);
  const letterboxdInputRef = useRef(null);
  const [importMode, setImportMode] = useState("merge");
  const [query, setQuery] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [clearConfirmation, setClearConfirmation] = useState(false);

  const filteredMovies = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const matches = normalizedQuery
      ? watchedMovies.filter((movie) => (
        `${movie.title} ${movie.year}`.toLowerCase().includes(normalizedQuery)
      ))
      : watchedMovies;
    return matches.slice().reverse().slice(0, 100);
  }, [query, watchedMovies]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleFile = async (source, event) => {
    const [file] = event.target.files || [];
    event.target.value = "";
    if (!file) return;

    setIsImporting(true);
    try {
      await onImport({ file, source, mode: importMode });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="seen-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="seen-dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="seen-dialog-header">
          <div>
            <span className="eyebrow">Your movie memory</span>
            <h2 id="seen-dialog-title">Seen movies</h2>
            <p>We’ll skip these titles whenever “Avoid watched movies” is on.</p>
          </div>
          <button className="dialog-close" type="button" onClick={onClose} aria-label="Close seen movies">
            ×
          </button>
        </div>

        <div className="seen-count-card">
          <strong>{watchedMovies.length.toLocaleString()}</strong>
          <span>movies remembered in this browser</span>
        </div>

        <div className="import-mode" role="group" aria-label="Import behavior">
          <button
            className={importMode === "merge" ? "active" : ""}
            type="button"
            onClick={() => setImportMode("merge")}
            aria-pressed={importMode === "merge"}
          >
            Add to my list
          </button>
          <button
            className={importMode === "replace" ? "active" : ""}
            type="button"
            onClick={() => setImportMode("replace")}
            aria-pressed={importMode === "replace"}
          >
            Replace my list
          </button>
        </div>

        <div className="import-options">
          <button
            className="import-card imdb-import"
            type="button"
            onClick={() => imdbInputRef.current?.click()}
            disabled={isImporting}
          >
            <span className="import-logo">IMDb</span>
            <span>
              <strong>Import from IMDb</strong>
              <small>Choose a Ratings or watched-list CSV</small>
            </span>
            <b aria-hidden="true">＋</b>
          </button>
          <input
            ref={imdbInputRef}
            className="visually-hidden"
            type="file"
            accept=".csv,text/csv"
            aria-label="Choose IMDb CSV"
            onChange={(event) => handleFile("imdb", event)}
          />

          <button
            className="import-card letterboxd-import"
            type="button"
            onClick={() => letterboxdInputRef.current?.click()}
            disabled={isImporting}
          >
            <span className="letterboxd-dots" aria-hidden="true"><i /><i /><i /></span>
            <span>
              <strong>Import from Letterboxd</strong>
              <small>Choose your account ZIP or watched.csv</small>
            </span>
            <b aria-hidden="true">＋</b>
          </button>
          <input
            ref={letterboxdInputRef}
            className="visually-hidden"
            type="file"
            accept=".zip,.csv,application/zip,text/csv"
            aria-label="Choose Letterboxd export"
            onChange={(event) => handleFile("letterboxd", event)}
          />
        </div>

        <p className="privacy-note">
          <span aria-hidden="true">⌁</span>
          Your file is processed privately and stays in this browser.
        </p>

        {watchedMovies.length > 0 && (
          <div className="seen-manager">
            <div className="seen-manager-heading">
              <label>
                <span>Manage your list</span>
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search seen movies"
                />
              </label>
              {!clearConfirmation ? (
                <button className="danger-text-button" type="button" onClick={() => setClearConfirmation(true)}>
                  Clear all
                </button>
              ) : (
                <span className="clear-confirmation">
                  Clear everything?
                  <button type="button" onClick={() => setClearConfirmation(false)}>Cancel</button>
                  <button type="button" onClick={() => { onClear(); setClearConfirmation(false); }}>Clear</button>
                </span>
              )}
            </div>

            <div className="seen-list">
              {filteredMovies.map((movie) => (
                <div className="seen-list-row" key={`${movie.tmdbId || movie.imdbId || movie.title}-${movie.year}`}>
                  <span className="seen-check" aria-hidden="true">✓</span>
                  <span>
                    <strong>{movie.title}</strong>
                    <small>{[movie.year, SOURCE_LABELS[movie.source]].filter(Boolean).join(" · ")}</small>
                  </span>
                  <button type="button" onClick={() => onRemove(movie)} aria-label={`Remove ${movie.title} from seen movies`}>
                    Remove
                  </button>
                </div>
              ))}
              {filteredMovies.length === 0 && <p className="no-seen-results">No seen movies match that search.</p>}
            </div>
            {watchedMovies.length > 100 && !query && (
              <small className="list-limit-note">Showing your 100 most recently added movies.</small>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
