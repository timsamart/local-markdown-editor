import { frontmatterRange } from "./frontmatter.js";

export function slugify(value) {
  return value.toLowerCase().trim().replace(/[^\p{L}\p{N}\s-]/gu, "").replace(/\s+/g, "-").replace(/-+/g, "-") || "section";
}

export function isAutoNameCandidate(name = "") {
  return /^Untitled( \d+)?\.md$/i.test(name);
}

export function stripHeadingDecoration(text = "") {
  return text.replace(/[*_`~\[\]]/g, "").trim();
}

export function extractOutlineEntries(content) {
  const result = [];
  const counts = new Map();
  let fenced = false;
  // Skip a leading frontmatter block so a `# Title`-like line inside it (or
  // the `---` fence itself) never pollutes the outline or auto-title. Line
  // indices are kept relative to the full content so rename/scroll stay valid.
  const range = frontmatterRange(content);
  const frontmatterEnd = range ? range.endLine : -1;
  const lines = content.split("\n");
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    if (lineIndex <= frontmatterEnd) continue;
    const line = lines[lineIndex];
    if (/^\s*```/.test(line)) { fenced = !fenced; continue; }
    if (fenced) continue;
    const match = /^(#{1,3})\s+(.+?)\s*#*\s*$/.exec(line);
    if (!match) continue;
    const text = stripHeadingDecoration(match[2]);
    const base = slugify(text);
    const count = counts.get(base) || 0;
    counts.set(base, count + 1);
    result.push({
      level: match[1].length,
      text,
      id: count ? `${base}-${count + 1}` : base,
      lineIndex,
    });
  }
  return result;
}

export function extractPrimaryHeading(content) {
  const entries = extractOutlineEntries(content);
  if (!entries.length) return null;
  const minLevel = Math.min(...entries.map((entry) => entry.level));
  return entries.find((entry) => entry.level === minLevel)?.text || null;
}

export function headingToFilename(title, existingNames = []) {
  const base = slugify(title) || "untitled";
  let candidate = `${base}.md`;
  let index = 2;
  const taken = new Set(existingNames.map((name) => name.toLowerCase()));
  while (taken.has(candidate.toLowerCase())) {
    candidate = `${base} ${index}.md`;
    index += 1;
  }
  return candidate;
}

export function normalizeDocumentName(value = "") {
  const trimmed = value.trim().replace(/[\\/]/g, "-");
  if (!trimmed) return "Untitled.md";
  const withExt = /\.(md|markdown|mdown|mkd|txt)$/i.test(trimmed) ? trimmed : `${trimmed}.md`;
  return withExt.replace(/[<>:"|?*]/g, "-");
}

export function renameHeadingInContent(content, lineIndex, newTitle) {
  const lines = content.split("\n");
  if (lineIndex < 0 || lineIndex >= lines.length) return content;
  const line = lines[lineIndex];
  const match = /^(#{1,6})\s+(.+?)(\s*#*\s*)$/.exec(line);
  if (!match) return content;
  const clean = newTitle.trim().replace(/[\r\n#]/g, " ").trim();
  if (!clean) return content;
  lines[lineIndex] = `${match[1]} ${clean}${match[3] || ""}`.trimEnd();
  return lines.join("\n");
}
