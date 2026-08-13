import { formatRuntime, posterUrl, releaseYear } from "../utils/movie";

export function RoomBallot({ state, isBusy, error, onVote, onReveal, onReset }) {
  const { room, me, voteCounts, totalVotes, myVote, members } = state;
  const isRevealed = room.status === "revealed";
  const winnerIds = new Set(room.winnerIds);
  const maxVotes = Math.max(1, ...Object.values(voteCounts));
  const allVoted = totalVotes >= members.length;

  return (
    <section className={`room-ballot ${isRevealed ? "revealed" : ""}`} aria-labelledby="ballot-title">
      <div className="ballot-heading">
        <div>
          <span className="eyebrow">{isRevealed ? "The room has spoken" : "Your movie ballot"}</span>
          <h2 id="ballot-title">
            {isRevealed
              ? winnerIds.size > 1 ? "It’s a tie." : "Tonight’s winner."
              : "Choose the one you’d watch tonight."}
          </h2>
          <p>
            {isRevealed
              ? winnerIds.size > 1
                ? "Your top choices finished level. The final call is yours."
                : "Decision made. Press play and enjoy the movie."
              : "You can change your vote until the host reveals the result."}
          </p>
        </div>
        <div className="vote-progress-badge" aria-live="polite">
          <strong>{totalVotes}/{members.length}</strong>
          <span>{allVoted ? "Everyone voted" : "votes in"}</span>
        </div>
      </div>

      <div className="ballot-grid">
        {room.candidates.map((movie) => {
          const poster = movie.posterUrl || posterUrl(movie.poster_path);
          const votes = voteCounts[movie.id] || 0;
          const selected = myVote === movie.id;
          const winner = winnerIds.has(movie.id);
          const genres = movie.genres?.map((genre) => genre.name).filter(Boolean).join(" · ");

          return (
            <article
              className={`ballot-card ${selected ? "selected" : ""} ${winner ? "winner" : ""}`}
              key={movie.id}
            >
              {winner && <div className="winner-ribbon">{winnerIds.size > 1 ? "Tied winner" : "Winner"}</div>}
              <div className="ballot-poster-wrap">
                {poster ? (
                  <img src={poster} alt={`${movie.title} poster`} />
                ) : (
                  <div className="ballot-poster-placeholder">{movie.title}</div>
                )}
                <span className="ballot-number" aria-hidden="true">{room.candidates.indexOf(movie) + 1}</span>
              </div>
              <div className="ballot-card-copy">
                <div className="ballot-movie-meta">
                  <span className="imdb-badge"><b>IMDb</b> {movie.imdbRating.toFixed(1)}</span>
                  <span>{releaseYear(movie.release_date)}</span>
                  {movie.runtime && <span>{formatRuntime(movie.runtime)}</span>}
                </div>
                <h3>{movie.title}</h3>
                {genres && <p className="ballot-genres">{genres}</p>}
                <p className="ballot-overview">{movie.overview || "No synopsis is available yet."}</p>

                <div className="vote-meter" aria-label={`${votes} ${votes === 1 ? "vote" : "votes"}`}>
                  <span style={{ width: `${(votes / maxVotes) * 100}%` }} />
                  <b>{votes} {votes === 1 ? "vote" : "votes"}</b>
                </div>

                {!isRevealed ? (
                  <button
                    className={`ballot-vote-button ${selected ? "selected" : ""}`}
                    type="button"
                    disabled={isBusy}
                    aria-pressed={selected}
                    onClick={() => onVote(movie.id)}
                  >
                    <span aria-hidden="true">{selected ? "✓" : "○"}</span>
                    {selected ? "Your vote" : "Vote for this"}
                  </button>
                ) : (
                  <a className="ballot-movie-link" href={`/share/${movie.id}`}>
                    View full movie <span aria-hidden="true">→</span>
                  </a>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {error && <div className="room-error ballot-error" role="alert">{error}</div>}

      <div className="ballot-controls">
        {me.isHost ? (
          isRevealed ? (
            <button className="primary-button compact" type="button" disabled={isBusy} onClick={onReset}>
              <span aria-hidden="true">↻</span> Build a new ballot
            </button>
          ) : (
            <button className="primary-button compact" type="button" disabled={isBusy || totalVotes === 0} onClick={onReveal}>
              <span aria-hidden="true">✦</span> Reveal the winner
            </button>
          )
        ) : (
          <p>{isRevealed ? "The result is ready." : "The host will reveal the result when everyone is ready."}</p>
        )}
      </div>
    </section>
  );
}
