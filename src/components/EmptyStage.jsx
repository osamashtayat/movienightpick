export function EmptyStage({ error }) {
  if (error) {
    return (
      <section className="empty-stage error-stage" role="alert">
        <span className="stage-symbol" aria-hidden="true">!</span>
        <span className="eyebrow">The search hit a snag</span>
        <h2>We couldn’t find that one</h2>
        <p>{error}</p>
        <small>Adjust a filter and try again.</small>
      </section>
    );
  }

  return (
    <section className="empty-stage">
      <div className="ticket-stack" aria-hidden="true">
        <span />
        <span />
        <span>?</span>
      </div>
      <span className="eyebrow">Your next favorite is waiting</span>
      <h2>Stop scrolling.<br />Start watching.</h2>
      <p>Set the mood, pick your standards, and let MovieNightPick choose tonight’s movie.</p>
      <div className="feature-chips" aria-label="App features">
        <span>Verified IMDb ratings</span>
        <span>No repeat picks</span>
        <span>Matched to your taste</span>
      </div>
    </section>
  );
}
