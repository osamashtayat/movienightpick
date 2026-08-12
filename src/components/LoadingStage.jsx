export function LoadingStage() {
  return (
    <section className="loading-stage" aria-live="polite" aria-label="Searching for a movie">
      <div className="projector-beam" />
      <div className="film-reel" aria-hidden="true">
        <i /><i /><i /><i /><i />
      </div>
      <span className="eyebrow">The projector is rolling</span>
      <h2>Finding your perfect match</h2>
      <p>Matching your preferences against current IMDb ratings.</p>
    </section>
  );
}
