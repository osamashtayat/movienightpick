export function ExperienceSwitcher({ mode, rememberedRoomCode, onSolo, onRoom }) {
  return (
    <section className="experience-switcher" id="experience-switcher" aria-labelledby="experience-title">
      <div className="experience-heading">
        <span className="eyebrow">Choose your movie-night mode</span>
        <h2 id="experience-title">Watching alone or deciding together?</h2>
      </div>

      <div className="experience-options">
        <button
          className={`experience-option solo-option ${mode === "solo" ? "active" : ""}`}
          type="button"
          aria-pressed={mode === "solo"}
          onClick={onSolo}
        >
          <span className="experience-icon solo-icon" aria-hidden="true">▶</span>
          <span className="experience-copy">
            <strong>Pick for me</strong>
            <small>One clear recommendation</small>
          </span>
          <span className="experience-check" aria-hidden="true">{mode === "solo" ? "✓" : "→"}</span>
        </button>

        <button
          className={`experience-option group-option ${mode === "room" ? "active" : ""}`}
          type="button"
          aria-pressed={mode === "room"}
          onClick={onRoom}
        >
          <span className="group-new">Pick together</span>
          <span className="experience-icon group-icon" aria-hidden="true">
            <i /><i /><i />
          </span>
          <span className="experience-copy">
            <strong>{mode === "solo" && rememberedRoomCode ? "Return to your room" : "Vote with friends"}</strong>
            <small>
              {mode === "solo" && rememberedRoomCode
                ? `Room ${rememberedRoomCode} is still waiting for you`
                : "Everyone brings a pick, then you vote"}
            </small>
          </span>
          <span className="experience-check" aria-hidden="true">{mode === "room" ? "✓" : "→"}</span>
        </button>
      </div>
    </section>
  );
}
