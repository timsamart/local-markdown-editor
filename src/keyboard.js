export function isMisplacedHashKey(event) {
  if (
    event.key !== "'" ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey
  ) return false;

  return (
    (event.code === "Backslash" && !event.shiftKey) ||
    (event.code === "Digit3" && event.shiftKey)
  );
}
