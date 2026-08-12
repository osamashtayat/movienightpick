export const GENRES = [
  { value: "28", label: "Action" },
  { value: "12", label: "Adventure" },
  { value: "16", label: "Animation" },
  { value: "35", label: "Comedy" },
  { value: "80", label: "Crime" },
  { value: "99", label: "Documentary" },
  { value: "18", label: "Drama" },
  { value: "10751", label: "Family" },
  { value: "14", label: "Fantasy" },
  { value: "36", label: "History" },
  { value: "27", label: "Horror" },
  { value: "10402", label: "Music" },
  { value: "9648", label: "Mystery" },
  { value: "10749", label: "Romance" },
  { value: "878", label: "Science Fiction" },
  { value: "53", label: "Thriller" },
  { value: "10752", label: "War" },
  { value: "37", label: "Western" },
];

export const LANGUAGES = [
  { value: "", label: "Any language" },
  { value: "en", label: "English" },
  { value: "fr", label: "French" },
  { value: "es", label: "Spanish" },
  { value: "de", label: "German" },
  { value: "it", label: "Italian" },
  { value: "ja", label: "Japanese" },
  { value: "ko", label: "Korean" },
  { value: "hi", label: "Hindi" },
  { value: "ar", label: "Arabic" },
  { value: "zh", label: "Chinese" },
];

export const RUNTIMES = [
  { value: "", label: "Any length" },
  { value: "90", label: "Up to 90 min" },
  { value: "120", label: "Up to 2 hours" },
  { value: "150", label: "Up to 2.5 hours" },
  { value: "180", label: "Up to 3 hours" },
];

export const DISCOVERY_MODES = [
  {
    value: "crowd",
    label: "Crowd pleaser",
    description: "Well-known and widely rated",
    icon: "✦",
  },
  {
    value: "hidden",
    label: "Hidden gem",
    description: "Great films beyond the obvious",
    icon: "◇",
  },
  {
    value: "wild",
    label: "Wild card",
    description: "Anything can happen",
    icon: "↯",
  },
];

export const DEFAULT_FILTERS = {
  genres: ["28"],
  minimumRating: 7,
  startDate: "",
  endDate: "",
  maxRuntime: "",
  language: "",
  mode: "crowd",
  avoidSeen: true,
};
