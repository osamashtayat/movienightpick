import { useState } from "react";
import {
  DEFAULT_FILTERS,
  DISCOVERY_MODES,
  GENRES,
  LANGUAGES,
  RUNTIMES,
} from "../data/movieOptions";

export function FilterPanel({
  filters,
  onChange,
  onSubmit,
  onReset,
  onCancel,
  status,
}) {
  const isLoading = status === "loading";
  const [dateInputVersion, setDateInputVersion] = useState(0);
  const ratingProgress = Math.min(
    100,
    Math.max(0, (Number(filters.minimumRating) / 9) * 100)
  );

  const updateFilter = (key, value) => {
    onChange((current) => ({ ...current, [key]: value }));
  };

  const handleReset = () => {
    onChange({ ...DEFAULT_FILTERS });
    // Remount native date controls so mobile Safari clears their displayed value.
    setDateInputVersion((current) => current + 1);
    onReset?.();
  };

  return (
    <aside className="filter-panel" aria-labelledby="preferences-title">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Tune your night</span>
          <h2 id="preferences-title">Movie preferences</h2>
        </div>
        <button className="text-button" type="button" onClick={handleReset} disabled={isLoading}>
          Reset
        </button>
      </div>

      <form onSubmit={onSubmit}>
        <div className="field-grid two-columns">
          <label className="field">
            <span>Genre</span>
            <select
              value={filters.genre}
              onChange={(event) => updateFilter("genre", event.target.value)}
              disabled={isLoading}
            >
              {GENRES.map((genre) => (
                <option key={genre.value || "any"} value={genre.value}>
                  {genre.label}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Maximum length</span>
            <select
              value={filters.maxRuntime}
              onChange={(event) => updateFilter("maxRuntime", event.target.value)}
              disabled={isLoading}
            >
              {RUNTIMES.map((runtime) => (
                <option key={runtime.value || "any"} value={runtime.value}>
                  {runtime.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="rating-field">
          <div className="field-label-row">
            <label htmlFor="minimum-rating">Minimum IMDb rating</label>
            <output htmlFor="minimum-rating">{Number(filters.minimumRating).toFixed(1)}+</output>
          </div>
          <input
            id="minimum-rating"
            type="range"
            min="0"
            max="9"
            step="0.1"
            value={filters.minimumRating}
            onChange={(event) => updateFilter("minimumRating", Number(event.target.value))}
            disabled={isLoading}
            style={{ "--rating-progress": `${ratingProgress}%` }}
          />
          <div className="range-labels" aria-hidden="true">
            <span>Anything</span>
            <span>Masterpiece</span>
          </div>
        </div>

        <fieldset className="mode-picker" disabled={isLoading}>
          <legend>Discovery style</legend>
          <div className="mode-options">
            {DISCOVERY_MODES.map((mode) => (
              <label
                className={`mode-card ${filters.mode === mode.value ? "selected" : ""}`}
                key={mode.value}
              >
                <input
                  type="radio"
                  name="mode"
                  value={mode.value}
                  checked={filters.mode === mode.value}
                  onChange={(event) => updateFilter("mode", event.target.value)}
                />
                <span className="mode-icon" aria-hidden="true">{mode.icon}</span>
                <span>
                  <strong>{mode.label}</strong>
                  <small>{mode.description}</small>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="date-section">
          <span className="section-label">Release window <small>optional</small></span>
          <div className="field-grid two-columns">
            <label className="field">
              <span>From</span>
              <input
                key={`start-date-${dateInputVersion}`}
                type="date"
                value={filters.startDate}
                max={filters.endDate || undefined}
                onChange={(event) => updateFilter("startDate", event.target.value)}
                disabled={isLoading}
              />
            </label>
            <label className="field">
              <span>Until</span>
              <input
                key={`end-date-${dateInputVersion}`}
                type="date"
                value={filters.endDate}
                min={filters.startDate || undefined}
                onChange={(event) => updateFilter("endDate", event.target.value)}
                disabled={isLoading}
              />
            </label>
          </div>
        </div>

        <label className="field language-field">
          <span>Original language</span>
          <select
            value={filters.language}
            onChange={(event) => updateFilter("language", event.target.value)}
            disabled={isLoading}
          >
            {LANGUAGES.map((language) => (
              <option key={language.value || "any"} value={language.value}>
                {language.label}
              </option>
            ))}
          </select>
        </label>

        <label className="toggle-row">
          <input
            type="checkbox"
            checked={filters.avoidSeen}
            onChange={(event) => updateFilter("avoidSeen", event.target.checked)}
            disabled={isLoading}
          />
          <span className="toggle" aria-hidden="true" />
          <span>
            <strong>Avoid recent picks</strong>
            <small>Keep every suggestion fresh</small>
          </span>
        </label>

        {isLoading && (
          <div className="search-progress" aria-live="polite">
            <div className="progress-copy">
              <span>Verifying IMDb rating</span>
              <b>Finding a strong match</b>
            </div>
            <div className="progress-track">
              <span className="indeterminate-progress" />
            </div>
            <p>Your search stays private while MovieNightPick finds a match.</p>
          </div>
        )}

        <button className="primary-button" type="submit" disabled={isLoading}>
          <span aria-hidden="true">▶</span>
          Find my movie
        </button>

        {isLoading && (
          <button className="cancel-button" type="button" onClick={onCancel}>
            Cancel search
          </button>
        )}
      </form>
    </aside>
  );
}
