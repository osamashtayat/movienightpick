import { useEffect, useState } from "react";
import { normalizeRoomCode } from "../services/roomApi";

export function RoomStartPanel({
  defaultName,
  invitedCode,
  isBusy,
  error,
  onCreate,
  onJoin,
  onBack,
}) {
  const [name, setName] = useState(defaultName);
  const [code, setCode] = useState(invitedCode);

  useEffect(() => setCode(invitedCode), [invitedCode]);

  const submitCreate = (event) => {
    event.preventDefault();
    onCreate(name);
  };

  const submitJoin = (event) => {
    event.preventDefault();
    onJoin(code, name);
  };

  return (
    <section className="room-start-card" aria-labelledby="room-start-title">
      <button className="back-to-solo" type="button" onClick={onBack}>
        <span aria-hidden="true">←</span> Back to picking for one
      </button>

      <div className="room-start-hero">
        <div className="room-orbit" aria-hidden="true">
          <span>YOU</span><i /><i /><i />
        </div>
        <span className="eyebrow">Movie-night rooms</span>
        <h2 id="room-start-title">Everyone gets a vote.<br /><em>No endless group chat.</em></h2>
        <p>Invite your friends, vote on a short lineup, and reveal tonight’s winner together.</p>
      </div>

      <ol className="room-steps" aria-label="How group voting works">
        <li><b>1</b><span><strong>Create</strong><small>Start a private room</small></span></li>
        <li><b>2</b><span><strong>Share</strong><small>Send one simple link</small></span></li>
        <li><b>3</b><span><strong>Vote</strong><small>Reveal the winner</small></span></li>
      </ol>

      {invitedCode ? (
        <form className="invited-room-form" onSubmit={submitJoin}>
          <div className="invitation-badge">
            <span>You’re invited to room</span>
            <strong>{invitedCode}</strong>
          </div>
          <label className="room-field">
            <span>Your name</span>
            <input
              type="text"
              value={name}
              maxLength="24"
              autoComplete="name"
              placeholder="What should friends call you?"
              onChange={(event) => setName(event.target.value)}
              required
              autoFocus
              disabled={isBusy}
            />
          </label>
          <button className="primary-button room-primary" type="submit" disabled={isBusy}>
            <span aria-hidden="true">✦</span>
            {isBusy ? "Joining room…" : `Join ${invitedCode}`}
          </button>
        </form>
      ) : (
        <div className="room-entry-grid">
          <form className="room-entry-card create-room-card" onSubmit={submitCreate}>
            <span className="room-entry-icon" aria-hidden="true">+</span>
            <h3>Start a new room</h3>
            <p>You choose the filters, then everyone votes.</p>
            <label className="room-field">
              <span>Your name</span>
              <input
                type="text"
                value={name}
                maxLength="24"
                autoComplete="name"
                placeholder="Your name"
                onChange={(event) => setName(event.target.value)}
                required
                disabled={isBusy}
              />
            </label>
            <button className="primary-button room-primary" type="submit" disabled={isBusy}>
              {isBusy ? "Creating room…" : "Create my room"}
            </button>
          </form>

          <form className="room-entry-card join-room-card" onSubmit={submitJoin}>
            <span className="room-entry-icon" aria-hidden="true">→</span>
            <h3>Join friends</h3>
            <p>Use the six-character code they sent you.</p>
            <div className="join-fields">
              <label className="room-field">
                <span>Room code</span>
                <input
                  className="room-code-input"
                  type="text"
                  value={code}
                  maxLength="6"
                  autoCapitalize="characters"
                  autoComplete="off"
                  placeholder="ABC123"
                  onChange={(event) => setCode(normalizeRoomCode(event.target.value))}
                  required
                  disabled={isBusy}
                />
              </label>
              <label className="room-field">
                <span>Your name</span>
                <input
                  type="text"
                  value={name}
                  maxLength="24"
                  autoComplete="name"
                  placeholder="Your name"
                  onChange={(event) => setName(event.target.value)}
                  required
                  disabled={isBusy}
                />
              </label>
            </div>
            <button className="secondary-button room-secondary" type="submit" disabled={isBusy || code.length !== 6}>
              Join room
            </button>
          </form>
        </div>
      )}

      {error && <div className="room-error" role="alert">{error}</div>}
      <p className="room-expiry-note">Rooms are private and close automatically after 24 hours.</p>
    </section>
  );
}
