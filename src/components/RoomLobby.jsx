export function RoomLobby({ state, isSearching, error, onShare }) {
  const { me, members, room } = state;

  return (
    <section className="room-lobby" aria-labelledby="room-lobby-title">
      <div className="lobby-visual" aria-hidden="true">
        <div className="lobby-ticket"><span>VOTE</span></div>
        <i /><i /><i />
      </div>
      <span className="eyebrow">Room {room.code} is live</span>
      <h2 id="room-lobby-title">
        {isSearching
          ? "Building your voting lineup…"
          : me.isHost
            ? "Invite friends, then build the ballot."
            : "Waiting for the host’s movie lineup."}
      </h2>
      <p>
        {me.isHost
          ? "Use your preferences to create up to three strong options. Everyone in the room will see them automatically."
          : `${room.hostName} is choosing movies now. Keep this page open—the ballot will appear automatically.`}
      </p>

      <div className="lobby-status">
        <span className="live-dot" aria-hidden="true" />
        <strong>{members.length} joined</strong>
        <span>{members.map((member) => member.name).join(" · ")}</span>
      </div>

      {me.isHost && (
        <button className="secondary-button lobby-share" type="button" onClick={onShare}>
          <span aria-hidden="true">↗</span> Copy room link
        </button>
      )}
      {error && <div className="room-error" role="alert">{error}</div>}
    </section>
  );
}
