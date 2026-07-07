export function isFileDragPayload(dataTransfer) {
  if (!dataTransfer) return false;
  if (dataTransfer.files?.length) return true;
  if (Array.from(dataTransfer.types || []).includes("Files")) return true;
  return Array.from(dataTransfer.items || []).some((item) => item.kind === "file");
}
