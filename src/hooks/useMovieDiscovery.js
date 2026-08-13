import { useCallback, useEffect, useRef, useState } from "react";
import { findMovieById, findRandomMovie } from "../services/movieApi";

export function useMovieDiscovery() {
  const [movie, setMovie] = useState(null);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const controllerRef = useRef(null);

  const discover = useCallback(async (filters, exclusions = {}) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    setMovie(null);
    setStatus("loading");
    setError("");

    try {
      const result = await findRandomMovie(filters, {
        signal: controller.signal,
        exclusions,
      });

      setMovie(result);
      setStatus("success");
      return result;
    } catch (requestError) {
      if (requestError.name === "AbortError") return null;
      setError(requestError.message || "Something went wrong. Please try again.");
      setStatus("error");
      return null;
    }
  }, []);

  const loadSharedMovie = useCallback(async (movieId) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    setMovie(null);
    setStatus("loading");
    setError("");

    try {
      const result = await findMovieById(movieId, { signal: controller.signal });
      setMovie(result);
      setStatus("success");
      return result;
    } catch (requestError) {
      if (requestError.name === "AbortError") return null;
      setError(requestError.message || "This shared movie could not be loaded.");
      setStatus("error");
      return null;
    }
  }, []);

  const cancel = useCallback(() => {
    controllerRef.current?.abort();
    setStatus(movie ? "success" : "idle");
  }, [movie]);

  useEffect(() => () => controllerRef.current?.abort(), []);

  return {
    movie,
    status,
    error,
    discover,
    loadSharedMovie,
    cancel,
    selectMovie: setMovie,
  };
}
