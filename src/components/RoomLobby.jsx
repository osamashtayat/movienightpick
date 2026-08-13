import { GENRES } from "../data/movieOptions";
import { formatRuntime, posterUrl, releaseYear } from "../utils/movie";

const genreNames = new Map(GENRES.map((genre) => [genre.value, genre.label]));

function preferenceSummary(filters = {}) {
  const genres = (filters.genres || []).map((genre) => genreNames.get(String(genre))).filter(Boolean);
  const rating = Number(filters.minimumRating);
  return [
    genres.length ? genres.join(" + ") : "Any genre",
    Number.isFinite(rating) ? `IMDb ${rating.toFixed(1)}+` : null,
  ].filter(Boolean).join(" · ");
}

function SubmissionCard({ member, submission, isSearching }) {
  if (isSearching) {
    return (
      <article className="submission-card pending-submission">
        <div className="submission-person"><span>{member.name.slice(0, 1).toUpperCase()}</span><b>{member.name}</b></div>
        <div className="submission-spinner" aria-hidden="true" />
        <h3>Searching their corner of movie night…</h3>
        <p>Checking this person’s genres and IMDb standard.</p>
      </article>
    );
  }

  if (!submission) {
    return (
      <article className="submission-card waiting-submission">
        <div className="submission-person"><span>{member.name.slice(0, 1).toUpperCase()}</span><b>{member.name}</b></div>
        <div className="waiting-symbol" aria-hidden="true">…</div>
        <h3>Choosing preferences</h3>
        <p>They can search independently whenever they’re ready.</p>
      </article>
    );
  }

  if (submission.status === "failed") {
    return (
      <article className="submission-card failed-submission">
        <div className="submission-person"><span>{member.name.slice(0, 1).toUpperCase()}</span><b>{member.name}</b></div>
        <div className="failed-symbol" aria-hidden="true">!</div>
        <span className="submission-kicker">The search hit a snag</span>
        <h3>We couldn’t find {submission.isMe ? "your" : `${member.name}’s`} movie</h3>
        <p>{submission.error || "No movie matched those preferences."}</p>
        <small>{preferenceSummary(submission.filters)}</small>
        {submission.isMe && <strong className="retry-hint">Adjust your filters and try again</strong>}
      </article>
    );
  }

  const movie = submission.movie;
  const poster = movie.posterUrl || posterUrl(movie.poster_path);
  return (
    <article className="submission-card successful-submission">
      <div className="submission-person"><span>{member.name.slice(0, 1).toUpperCase()}</span><b>{member.name}’s pick</b></div>
      <div className="submission-movie">
        {poster ? <img src={poster} alt={`${movie.title} poster`} /> : <div className="submission-no-poster">No poster</div>}
        <div>
          <span className="submission-kicker">Ready for the ballot</span>
          <h3>{movie.title}</h3>
          <div className="submission-meta">
            <b>IMDb {movie.imdbRating.toFixed(1)}</b>
            <span>{releaseYear(movie.release_date)}</span>
            {movie.runtime && <span>{formatRuntime(movie.runtime)}</span>}
          </div>
          <p>{preferenceSummary(submission.filters)}</p>
        </div>
      </div>
      {submission.isMe && <strong className="retry-hint">Not feeling it? Search again to replace it</strong>}
    </article>
  );
}

export function RoomLobby({
  state,
  isSearching,
  error,
  onShare,
  onStartVote,
  isBusy,
}) {
  const { me, members, room, submissions } = state;
  const submissionsByMember = new Map(submissions.map((submission) => [submission.memberId, submission]));
  const successSubmissions = submissions.filter((submission) => submission.status === "success");
  const uniqueMovieCount = new Set(successSubmissions.map((submission) => submission.movie?.id)).size;
  const readyCount = submissions.length;
  const canStartVote = uniqueMovieCount >= 2;

  return (
    <section className="room-lobby room-pick-board" aria-labelledby="room-lobby-title">
      <div className="room-board-heading">
        <div>
          <span className="eyebrow">Everyone brings one movie</span>
          <h2 id="room-lobby-title">Build the ballot together.</h2>
          <p>Each person uses their own genres and IMDb rating. Searches run independently, so one failed match never stops the room.</p>
        </div>
        <div className="room-ready-count" aria-live="polite">
          <strong>{readyCount}/{members.length}</strong>
          <span>picks ready</span>
        </div>
      </div>

      <div className="submission-grid">
        {members.map((member) => (
          <SubmissionCard
            key={member.id}
            member={member}
            submission={submissionsByMember.get(member.id)}
            isSearching={member.id === me.id && isSearching}
          />
        ))}
      </div>

      {error && <div className="room-error" role="alert">{error}</div>}

      <div className="room-board-controls">
        <div>
          <span className="live-dot" aria-hidden="true" />
          <p>{room.code} · {members.length} {members.length === 1 ? "person" : "people"} connected</p>
        </div>
        {me.isHost ? (
          <button
            className="primary-button compact"
            type="button"
            disabled={!canStartVote || isBusy}
            onClick={onStartVote}
          >
            <span aria-hidden="true">▶</span>
            Start voting with {uniqueMovieCount} {uniqueMovieCount === 1 ? "movie" : "movies"}
          </button>
        ) : (
          <p className="host-wait-note">
            {canStartVote ? "The host can start voting now." : "At least two different movie picks are needed."}
          </p>
        )}
      </div>

      {me.isHost && !canStartVote && (
        <p className="start-vote-hint">At least two different successful picks are needed. Failed cards can stay—the room will continue.</p>
      )}
      {me.isHost && onShare && (
        <button className="text-button room-copy-link" type="button" onClick={onShare}>Copy invitation link</button>
      )}
    </section>
  );
}
