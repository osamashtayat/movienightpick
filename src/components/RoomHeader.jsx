import { useState } from "react";

export function RoomHeader({ state, onBack, onClose, onNotice }) {
  const { room, members, me } = state;
  const [isConfirmingClose, setIsConfirmingClose] = useState(false);

  const shareRoom = async () => {
    const url = new URL(window.location.href);
    url.searchParams.delete("movie");
    url.searchParams.set("room", room.code);
    const shareData = {
      title: `Join my MovieNightPick room ${room.code}`,
      text: "Vote with me and help choose tonight’s movie.",
      url: url.toString(),
    };

    try {
      if (navigator.share) await navigator.share(shareData);
      else await navigator.clipboard.writeText(shareData.url);
      onNotice(navigator.share ? "Invitation shared!" : "Room link copied");
    } catch (shareError) {
      if (shareError.name !== "AbortError") onNotice("Could not share the room link");
    }
  };

  return (
    <section className="room-header" aria-label={`Movie room ${room.code}`}>
      <div className="room-header-main">
        <button className="back-to-solo compact-back" type="button" onClick={onBack}>
          <span aria-hidden="true">←</span> Back to solo
        </button>
        <div className="room-identity">
          <span>Room code</span>
          <strong>{room.code}</strong>
          <small>{me.isHost ? "You’re hosting" : `${room.hostName} is hosting`}</small>
        </div>
        <button className="share-room-button" type="button" onClick={shareRoom}>
          <span aria-hidden="true">↗</span>
          Share invite
        </button>
      </div>

      <div className="room-member-bar">
        <div className="member-avatars" aria-hidden="true">
          {members.slice(0, 5).map((member, index) => (
            <span key={member.id} style={{ "--member-index": index }}>
              {member.name.slice(0, 1).toUpperCase()}
            </span>
          ))}
        </div>
        <p><strong>{members.length}</strong> {members.length === 1 ? "person" : "people"} in the room</p>
        <div className="member-names">
          {members.map((member) => (
            <span key={member.id}>{member.name}{member.isHost ? " · host" : ""}</span>
          ))}
        </div>
        {me.isHost && (
          isConfirmingClose ? (
            <div className="end-room-confirmation">
              <button type="button" onClick={() => setIsConfirmingClose(false)}>Cancel</button>
              <button type="button" onClick={onClose}>End for everyone</button>
            </div>
          ) : (
            <button className="end-room-button" type="button" onClick={() => setIsConfirmingClose(true)}>End room</button>
          )
        )}
      </div>
    </section>
  );
}
