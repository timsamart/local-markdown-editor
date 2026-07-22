// Lightweight YAML frontmatter detection and parsing for Markdown documents.
//
// Intentionally dependency-free: the editor ships as a single self-contained
// HTML file, so we avoid pulling in a full YAML library (and the bundle cost
// that comes with it). This covers the metadata conventions used in practice —
// scalars, quoted strings, inline lists `tags: [a, b]`, block sequences,
// folded (`>`) and literal (`|`) block scalars, and booleans/nulls — while
// degrading gracefully on anything it cannot parse.

const OPEN_DELIMITER = /^\uFEFF?---[ \t\r]*$/;
const CLOSE_DELIMITER = /^(?:---|\.\.\.)[ \t\r]*$/;
const KEY_VALUE = /^([A-Za-z0-9_][\w\-. ]*?)\s*:[ \t]*(.*)$/;
const BLOCK_ITEM = /^[\t ]*-(?:[ \t]+(.*))?$/;
const FOLDED_INDICATOR = /^([>|])([-+0-9]*)[ \t]*$/;

// Normalize CRLF/CR to \n up front so every line check can stay simple. This
// matters because real-world Markdown — especially on Windows — frequently
// arrives with \r\n endings, and a trailing \r would otherwise defeat the
// `---$` fence match and silently swallow the whole block.
function normalizeContent(content = "") {
  return content.replace(/\r\n?/g, "\n");
}

// Returns { startLine, endLine } for a frontmatter block at the very start of
// the document, or null when no valid block is present. Line indices are
// relative to the normalized content.split("\n").
export function frontmatterRange(content = "") {
  if (!content) return null;
  const lines = normalizeContent(content).split("\n");
  if (!OPEN_DELIMITER.test(lines[0])) return null;
  for (let index = 1; index < lines.length; index += 1) {
    if (CLOSE_DELIMITER.test(lines[index])) {
      return { startLine: 0, endLine: index };
    }
  }
  // An opening fence with no matching close is just a thematic break, not
  // frontmatter, so leave the document untouched.
  return null;
}

// Splits a document into its raw YAML block (string | null) and body. `body`
// is returned without the fence, and `endLine` lets callers skip those lines
// when scanning the original content.
export function splitFrontmatter(content = "") {
  const range = frontmatterRange(content);
  if (!range) return { frontmatter: null, body: content, endLine: -1 };
  const lines = normalizeContent(content).split("\n");
  const yamlText = lines.slice(range.startLine + 1, range.endLine).join("\n");
  const body = lines.slice(range.endLine + 1).join("\n");
  return { frontmatter: yamlText, body, endLine: range.endLine };
}

// Derives a lifecycle "status" tone from frontmatter when the explicit
// `status`/`state` key is absent. Falls back to common boolean flags so that
// `draft: true`, `published: false`, and `featured: true` still get a chip.
// Returns null when nothing useful is present.
export function deriveStatus(data = {}) {
  const explicit = pick(data, ["status", "state"]);
  if (explicit !== null && explicit !== undefined && explicit !== "") {
    return { key: "status", value: String(explicit), tone: STATUS_TONES[String(explicit).toLowerCase()] || "is-default" };
  }
  if (data.draft === true) return { key: "status", value: "Draft", tone: STATUS_TONES.draft };
  if (data.published === false) return { key: "status", value: "Unpublished", tone: STATUS_TONES.draft };
  if (data.published === true) return { key: "status", value: "Published", tone: STATUS_TONES.published };
  if (data.featured === true) return { key: "status", value: "Featured", tone: STATUS_TONES.published };
  return null;
}

// Map of common status strings to the tone class used for the chip dot.
const STATUS_TONES = {
  draft: "is-draft", wip: "is-draft", pending: "is-draft", todo: "is-draft", "in-progress": "is-draft",
  published: "is-published", live: "is-published", done: "is-published", complete: "is-published", completed: "is-published", shipped: "is-published", ready: "is-published", approved: "is-published", active: "is-published",
  archived: "is-archived", deprecated: "is-archived", obsolete: "is-archived", stale: "is-archived", inactive: "is-archived",
  review: "is-review", "in-review": "is-review", "peer-review": "is-review", feedback: "is-review",
  blocked: "is-blocked", failed: "is-blocked", rejected: "is-blocked", error: "is-blocked",
};

function pick(data, keys) {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(data, key)) return data[key];
  }
  return undefined;
}

// Parses a document's frontmatter into { data, body }.
// `data` is null when no frontmatter block is present.
export function parseFrontmatter(content = "") {
  const { frontmatter, body, endLine } = splitFrontmatter(content);
  if (frontmatter === null) return { data: null, body, endLine };
  return { data: parseYaml(frontmatter), body, endLine };
}

// Parses a small subset of YAML into a plain object. Never throws: anything it
// cannot understand is skipped rather than aborting the whole block.
export function parseYaml(yaml = "") {
  const data = {};
  const lines = yaml.split("\n");
  let lastKey = null;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    // Skip blank lines and comments (a top-level comment line).
    if (/^\s*(#.*)?$/.test(line)) continue;

    // Block sequence item belonging to the previous key.
    const blockItem = BLOCK_ITEM.exec(line);
    if (blockItem && lastKey) {
      const value = parseScalar(blockItem[1] || "");
      const existing = data[lastKey];
      if (Array.isArray(existing)) existing.push(value);
      else if (existing === undefined || existing === null) data[lastKey] = [value];
      else data[lastKey] = [existing, value];
      continue;
    }

    const match = KEY_VALUE.exec(line);
    if (!match) continue;

    const key = match[1].trim();
    const rawValue = match[2];
    lastKey = key;

    if (rawValue.trim() === "") {
      if (!(key in data)) data[key] = null;
      continue;
    }

    // Folded (">") and literal ("|") block scalars: gather indented lines.
    const folded = FOLDED_INDICATOR.exec(rawValue);
    if (folded) {
      const { text, next } = collectBlockScalar(lines, index + 1, folded[1] === ">");
      index = next - 1;
      data[key] = text;
      continue;
    }

    const inline = /^\[(.*)\]$/s.exec(rawValue.trim());
    if (inline) {
      data[key] = parseInlineList(inline[1]);
    } else {
      data[key] = parseScalar(rawValue);
    }
  }

  return data;
}

// Gathers an indented block scalar (the body of a `>` or `|` value). Folded
// mode joins lines with spaces; literal mode preserves newlines. Returns the
// joined text and the index of the first line after the block.
function collectBlockScalar(lines, start, folded) {
  const collected = [];
  let end = start;
  for (let index = start; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.trim() === "") { collected.push(""); continue; }
    // A line that is no longer indented ends the block.
    if (!/^[ \t]/.test(line)) break;
    collected.push(line.replace(/^[ \t]+/, ""));
    end = index + 1;
  }
  const trimmed = trimTrailingBlank(collected).map((entry) => entry.trimEnd());
  const text = folded ? foldedJoin(trimmed) : trimmed.join("\n");
  return { text, next: end };
}

function foldedJoin(lines) {
  // YAML folded scalars fold internal newlines into spaces. A blank line keeps
  // a real newline (and consumes the leading space of the following line), so
  // a paragraph break survives the fold.
  const segments = [];
  let pendingBlank = 0;
  for (const line of lines) {
    if (line === "") {
      pendingBlank += 1;
    } else {
      while (pendingBlank > 0) {
        segments.push("\n");
        pendingBlank -= 1;
      }
      // No separating space immediately after an emitted newline.
      if (segments.length && segments[segments.length - 1] !== "\n") segments.push(" ");
      segments.push(line);
    }
  }
  return segments.join("").replace(/\n{3,}/g, "\n\n").trim();
}

function trimTrailingBlank(lines) {
  const copy = [...lines];
  while (copy.length && copy[copy.length - 1] === "") copy.pop();
  return copy;
}

function stripInlineComment(value) {
  // Quoted scalars are already unwrapped before this runs, so we only need to
  // strip a `# comment` that is preceded by whitespace in a plain scalar.
  const match = /\s#/.exec(value);
  return match ? value.slice(0, match.index).trimEnd() : value;
}

function parseScalar(raw = "") {
  const trimmed = raw.trim();
  if (trimmed === "") return null;

  // A value that opens with a quote is a quoted scalar even when a trailing
  // comment follows. Find the matching close quote, unwrap, and ignore any
  // text after it (comments are not recognized inside quotes).
  if (trimmed[0] === '"' || trimmed[0] === "'") {
    const quote = trimmed[0];
    const closed = findClosingQuote(trimmed, quote);
    if (closed !== null) {
      const inner = trimmed.slice(1, closed);
      return quote === '"' ? stripEscapes(inner) : inner.replace(/''/g, "'");
    }
  }

  // Unquoted: drop a trailing ` # comment` (must be preceded by whitespace).
  const unquoted = stripInlineComment(trimmed);
  if (unquoted === "") return null;

  const lower = unquoted.toLowerCase();
  if (lower === "true" || lower === "yes" || lower === "on") return true;
  if (lower === "false" || lower === "no" || lower === "off") return false;
  if (lower === "null" || lower === "~" || lower === "none") return null;

  // Leave numbers as strings: metadata values such as versions, IDs, or
  // padded numbers ("007") should be displayed verbatim, not coerced.
  return unquoted;
}

// Returns the index of the closing quote for a `"` or `'`-delimited scalar, or
// null if none is found. Double quotes honor backslash escapes; single quotes
// use the YAML convention of doubled `''` for a literal apostrophe.
function findClosingQuote(value, quote) {
  for (let i = 1; i < value.length; i += 1) {
    if (quote === '"' && value[i] === "\\" && value[i + 1]) {
      i += 1;
    } else if (quote === "'" && value[i] === "'") {
      if (value[i + 1] === "'") i += 1;
      else return i;
    } else if (quote === '"' && value[i] === '"') {
      return i;
    }
  }
  return null;
}

function stripEscapes(value) {
  return value.replace(/\\"/g, '"').replace(/\\n/g, "\n").replace(/\\t/g, "\t");
}

function parseInlineList(raw = "") {
  if (!raw.trim()) return [];
  return splitListItems(raw).map((item) => parseScalar(item));
}

// Splits an inline list on top-level commas, respecting quotes and nesting.
function splitListItems(raw) {
  const items = [];
  let depth = 0;
  let quote = null;
  let current = "";

  for (const char of raw) {
    if (quote) {
      current += char;
      if (char === quote) quote = null;
    } else if (char === '"' || char === "'") {
      quote = char;
      current += char;
    } else if (char === "[" || char === "{") {
      depth += 1;
      current += char;
    } else if (char === "]" || char === "}") {
      depth = Math.max(0, depth - 1);
      current += char;
    } else if (char === "," && depth === 0) {
      items.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  if (current.trim()) items.push(current);
  return items;
}
