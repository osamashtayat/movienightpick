const SESSION_PREFIX = "movienightpick-room-session:";

async function roomRequest({ method = "POST", body, session, signal }) {
  const headers = { "Content-Type": "application/json" };

  if (session?.token) headers.Authorization = `Bearer ${session.token}`;
  if (session?.code) headers["x-room-code"] = session.code;
  if (session?.hostToken) headers["x-room-host"] = session.hostToken;

  const response = await fetch("/api/rooms", {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });

  let payload = {};
  try {
    payload = await response.json();
  } catch {
    // The message below is clearer than a JSON parsing error for visitors.
  }

  if (!response.ok) {
    const error = new Error(payload.error || "The movie room is unavailable right now.");
    error.status = response.status;
    throw error;
  }

  return payload;
}

export function normalizeRoomCode(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6);
}

export function roomSessionKey(code) {
  return `${SESSION_PREFIX}${normalizeRoomCode(code)}`;
}

export function saveRoomSession(session) {
  window.localStorage.setItem(roomSessionKey(session.code), JSON.stringify(session));
}

export function loadRoomSession(code) {
  try {
    const saved = JSON.parse(window.localStorage.getItem(roomSessionKey(code)) || "null");
    return saved?.code && saved?.token ? saved : null;
  } catch {
    return null;
  }
}

export async function createMovieRoom(name, { signal } = {}) {
  return roomRequest({ body: { action: "create", name }, signal });
}

export async function joinMovieRoom(code, name, { signal } = {}) {
  return roomRequest({
    body: { action: "join", code: normalizeRoomCode(code), name },
    signal,
  });
}

export async function getMovieRoomState(session, { signal } = {}) {
  const payload = await roomRequest({ method: "GET", session, signal });
  return payload.state;
}

export async function setRoomCandidates(session, candidates, filters) {
  const payload = await roomRequest({
    session,
    body: { action: "candidates", code: session.code, candidates, filters },
  });
  return payload.state;
}

export async function voteInRoom(session, movieId) {
  const payload = await roomRequest({
    session,
    body: { action: "vote", code: session.code, movieId },
  });
  return payload.state;
}

export async function revealRoomWinner(session) {
  const payload = await roomRequest({
    session,
    body: { action: "reveal", code: session.code },
  });
  return payload.state;
}

export async function resetRoomVote(session) {
  const payload = await roomRequest({
    session,
    body: { action: "reset", code: session.code },
  });
  return payload.state;
}

export async function closeMovieRoom(session) {
  const payload = await roomRequest({
    session,
    body: { action: "close", code: session.code },
  });
  return payload.state;
}
