export const posterUrl = (path, size = "w500") =>
  path ? `https://image.tmdb.org/t/p/${size}${path}` : "";

export const backdropUrl = (path, size = "w1280") =>
  path ? `https://image.tmdb.org/t/p/${size}${path}` : "";

export function formatRuntime(minutes, fallback = "") {
  const numericMinutes = Number.parseInt(minutes, 10);
  if (!Number.isFinite(numericMinutes)) return fallback;

  const hours = Math.floor(numericMinutes / 60);
  const remainingMinutes = numericMinutes % 60;

  if (!hours) return `${remainingMinutes}m`;
  return `${hours}h ${remainingMinutes}m`;
}

export function releaseYear(date) {
  return date?.slice(0, 4) || "Unknown year";
}

export function formatNumber(value) {
  const number = Number.parseInt(String(value).replaceAll(",", ""), 10);
  return Number.isFinite(number) ? new Intl.NumberFormat().format(number) : value;
}

export function uniqueById(items) {
  const seen = new Set();
  return items.filter((item) => {
    if (!item?.id || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}
