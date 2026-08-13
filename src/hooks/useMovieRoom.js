import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  beginRoomVote,
  closeMovieRoom,
  createMovieRoom,
  getMovieRoomState,
  joinMovieRoom,
  loadRoomSession,
  normalizeRoomCode,
  resetRoomVote,
  revealRoomWinner,
  roomSessionKey,
  saveRoomSession,
  submitRoomFailure,
  submitRoomMovie,
  voteInRoom,
} from "../services/roomApi";

const NAME_KEY = "movienightpick-room-name";
const ACTIVE_ROOM_KEY = "movienightpick-active-room";
const POLL_INTERVAL_MS = 2500;

function roomCodeFromUrl() {
  return normalizeRoomCode(new URLSearchParams(window.location.search).get("room"));
}

function updateRoomUrl(code) {
  const url = new URL(window.location.href);
  url.searchParams.delete("movie");
  if (code) url.searchParams.set("room", code);
  else url.searchParams.delete("room");
  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
}

function activeRoomCode() {
  return normalizeRoomCode(window.localStorage.getItem(ACTIVE_ROOM_KEY));
}

export function useMovieRoom() {
  const initialCode = useMemo(roomCodeFromUrl, []);
  const [mode, setMode] = useState(initialCode ? "room" : "solo");
  const [invitedCode, setInvitedCode] = useState(initialCode);
  const [session, setSession] = useState(() => (
    initialCode ? loadRoomSession(initialCode) : null
  ));
  const [roomState, setRoomState] = useState(null);
  const [status, setStatus] = useState(session ? "loading" : "idle");
  const [error, setError] = useState("");
  const [defaultName, setDefaultName] = useState(
    () => window.localStorage.getItem(NAME_KEY) || ""
  );
  const [rememberedRoomCode, setRememberedRoomCode] = useState(activeRoomCode);
  const actionVersionRef = useRef(0);
  const isActionRunningRef = useRef(false);

  const applyState = useCallback((nextState) => {
    setRoomState(nextState);
    setError("");
    setStatus("idle");
  }, []);

  const enterRoomMode = useCallback(() => {
    const code = roomCodeFromUrl() || activeRoomCode();
    const savedSession = code ? loadRoomSession(code) : null;
    setInvitedCode(code);
    setSession(savedSession);
    setRoomState(null);
    setError("");
    setStatus(savedSession ? "loading" : "idle");
    setMode("room");
    updateRoomUrl(code);
  }, []);

  const backToSolo = useCallback(() => {
    setMode("solo");
    setInvitedCode("");
    setSession(null);
    setRoomState(null);
    setError("");
    setStatus("idle");
    updateRoomUrl("");
    window.requestAnimationFrame(() => {
      document.getElementById("experience-switcher")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }, []);

  const createRoom = useCallback(async (name) => {
    setStatus("working");
    setError("");
    try {
      const payload = await createMovieRoom(name);
      const nextSession = {
        code: payload.state.room.code,
        token: payload.token,
        hostToken: payload.hostToken,
        name: payload.state.me.name,
      };
      saveRoomSession(nextSession);
      window.localStorage.setItem(ACTIVE_ROOM_KEY, nextSession.code);
      setRememberedRoomCode(nextSession.code);
      window.localStorage.setItem(NAME_KEY, nextSession.name);
      setDefaultName(nextSession.name);
      setSession(nextSession);
      setInvitedCode(nextSession.code);
      updateRoomUrl(nextSession.code);
      applyState(payload.state);
      return payload.state;
    } catch (actionError) {
      setError(actionError.message);
      setStatus("idle");
      return null;
    }
  }, [applyState]);

  const joinRoom = useCallback(async (code, name) => {
    setStatus("working");
    setError("");
    try {
      const payload = await joinMovieRoom(code, name);
      const nextSession = {
        code: payload.state.room.code,
        token: payload.token,
        hostToken: "",
        name: payload.state.me.name,
      };
      saveRoomSession(nextSession);
      window.localStorage.setItem(ACTIVE_ROOM_KEY, nextSession.code);
      setRememberedRoomCode(nextSession.code);
      window.localStorage.setItem(NAME_KEY, nextSession.name);
      setDefaultName(nextSession.name);
      setSession(nextSession);
      setInvitedCode(nextSession.code);
      updateRoomUrl(nextSession.code);
      applyState(payload.state);
      return payload.state;
    } catch (actionError) {
      setError(actionError.message);
      setStatus("idle");
      return null;
    }
  }, [applyState]);

  const runRoomAction = useCallback(async (action) => {
    if (!session) return null;
    isActionRunningRef.current = true;
    actionVersionRef.current += 1;
    setStatus("working");
    setError("");
    try {
      const nextState = await action(session);
      applyState(nextState);
      return nextState;
    } catch (actionError) {
      setError(actionError.message);
      setStatus("idle");
      return null;
    } finally {
      actionVersionRef.current += 1;
      isActionRunningRef.current = false;
    }
  }, [applyState, session]);

  const submitMovie = useCallback(
    (movie, filters) => runRoomAction(
      (currentSession) => submitRoomMovie(currentSession, movie, filters)
    ),
    [runRoomAction]
  );

  const submitFailure = useCallback(
    (message, filters) => runRoomAction(
      (currentSession) => submitRoomFailure(currentSession, message, filters)
    ),
    [runRoomAction]
  );

  const startVoting = useCallback(
    () => runRoomAction((currentSession) => beginRoomVote(currentSession)),
    [runRoomAction]
  );

  const vote = useCallback(
    (movieId) => runRoomAction((currentSession) => voteInRoom(currentSession, movieId)),
    [runRoomAction]
  );

  const reveal = useCallback(
    () => runRoomAction((currentSession) => revealRoomWinner(currentSession)),
    [runRoomAction]
  );

  const reset = useCallback(
    () => runRoomAction((currentSession) => resetRoomVote(currentSession)),
    [runRoomAction]
  );

  const close = useCallback(async () => {
    if (!session) return;
    const closedState = await runRoomAction(
      (currentSession) => closeMovieRoom(currentSession)
    );
    if (closedState) {
      window.localStorage.removeItem(roomSessionKey(session.code));
      window.localStorage.removeItem(ACTIVE_ROOM_KEY);
      setRememberedRoomCode("");
      backToSolo();
    }
  }, [backToSolo, runRoomAction, session]);

  useEffect(() => {
    if (mode !== "room" || !session) return undefined;

    let active = true;
    const controller = new AbortController();

    const refresh = async () => {
      if (isActionRunningRef.current) return;
      const actionVersion = actionVersionRef.current;
      try {
        const nextState = await getMovieRoomState(session, { signal: controller.signal });
        if (
          active
          && !isActionRunningRef.current
          && actionVersion === actionVersionRef.current
        ) applyState(nextState);
      } catch (refreshError) {
        if (!active || refreshError.name === "AbortError") return;
        if (refreshError.status === 401 || refreshError.status === 404) {
          window.localStorage.removeItem(roomSessionKey(session.code));
          if (activeRoomCode() === session.code) {
            window.localStorage.removeItem(ACTIVE_ROOM_KEY);
            setRememberedRoomCode("");
          }
          setSession(null);
          setRoomState(null);
          setInvitedCode(session.code);
        }
        setError(refreshError.message);
        setStatus("idle");
      }
    };

    refresh();
    const interval = window.setInterval(refresh, POLL_INTERVAL_MS);

    return () => {
      active = false;
      controller.abort();
      window.clearInterval(interval);
    };
  }, [applyState, mode, session]);

  return {
    mode,
    invitedCode,
    session,
    roomState,
    status,
    error,
    defaultName,
    rememberedRoomCode,
    enterRoomMode,
    backToSolo,
    createRoom,
    joinRoom,
    submitMovie,
    submitFailure,
    startVoting,
    vote,
    reveal,
    reset,
    close,
  };
}
