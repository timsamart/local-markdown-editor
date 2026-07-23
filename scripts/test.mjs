import assert from "node:assert/strict";
import markdownit from "markdown-it";
import { isMisplacedHashKey } from "../src/keyboard.js";
import { isFileDragPayload } from "../src/file-drop.js";
import { shouldRenderRawHtml, shouldUseFullWidthTables, shouldWidenRenderedTable } from "../src/render-options.js";
import {
  extractOutlineEntries,
  extractPrimaryHeading,
  headingToFilename,
  isAutoNameCandidate,
  normalizeDocumentName,
  renameHeadingInContent,
} from "../src/document-name.js";
import { parseFrontmatter, splitFrontmatter, parseYaml, deriveStatus } from "../src/frontmatter.js";

const key = (overrides) => ({
  key: "'",
  code: "Quote",
  shiftKey: false,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  ...overrides,
});

assert.equal(isMisplacedHashKey(key({ code: "Backslash" })), true, "repairs German/UK physical hash key");
assert.equal(isMisplacedHashKey(key({ code: "Digit3", shiftKey: true })), true, "repairs shifted digit hash key");
assert.equal(isMisplacedHashKey(key({ code: "Quote" })), false, "preserves a normal apostrophe");
assert.equal(isMisplacedHashKey(key({ code: "Backslash", shiftKey: true })), false, "preserves shifted German apostrophe");
assert.equal(isMisplacedHashKey(key({ key: "#", code: "Backslash" })), false, "leaves correctly reported hash untouched");
assert.equal(isMisplacedHashKey(key({ code: "Backslash", altKey: true })), false, "does not alter modified shortcuts");

assert.equal(isFileDragPayload({ types: ["Files"] }), true, "recognizes desktop file drags before drop");
assert.equal(isFileDragPayload({ files: [{ name: "guide.md" }] }), true, "recognizes files at drop time");
assert.equal(isFileDragPayload({ items: [{ kind: "file" }] }), true, "recognizes file items in embedded browsers");
assert.equal(isFileDragPayload({ types: ["text/plain"], files: [], items: [{ kind: "string" }] }), false, "leaves text dragging to the editor");

assert.equal(shouldRenderRawHtml({}), true, "renders sanitized raw HTML by default");
assert.equal(shouldRenderRawHtml({ renderHtml: true }), true, "keeps explicit raw HTML rendering enabled");
assert.equal(shouldRenderRawHtml({ renderHtml: false }), false, "honors strict Markdown-only rendering");
assert.equal(shouldUseFullWidthTables({}), true, "uses full-width tables by default");
assert.equal(shouldUseFullWidthTables({ fullWidthTables: true }), true, "keeps explicit full-width tables enabled");
assert.equal(shouldUseFullWidthTables({ fullWidthTables: false }), false, "honors constrained table rendering");
assert.equal(shouldWidenRenderedTable(900, 760), true, "widens tables that overflow the reading width");
assert.equal(shouldWidenRenderedTable(760, 760), false, "keeps fitting tables in the reading width");
assert.equal(shouldWidenRenderedTable(760.5, 760), false, "ignores sub-pixel table overflow noise");

const renderer = markdownit({ html: true });
renderer.set({ html: shouldRenderRawHtml({}) });
assert.match(renderer.render("Hello <span class=\"accent\">HTML</span>"), /<span class="accent">HTML<\/span>/, "passes inline HTML through before sanitization by default");
renderer.set({ html: shouldRenderRawHtml({ renderHtml: false }) });
assert.match(renderer.render("Hello <span class=\"accent\">HTML</span>"), /&lt;span class=&quot;accent&quot;&gt;HTML&lt;\/span&gt;/, "escapes inline HTML when disabled");

assert.equal(isAutoNameCandidate("Untitled.md"), true, "detects default untitled names");
assert.equal(isAutoNameCandidate("Untitled 3.md"), true, "detects numbered untitled names");
assert.equal(isAutoNameCandidate("guide.md"), false, "ignores real filenames");

const sample = [
  "Intro",
  "",
  "```",
  "# Ignored",
  "```",
  "",
  "## Second",
  "### Nested",
  "## Gamma",
].join("\n");
assert.equal(extractPrimaryHeading(sample), "Second", "uses the first heading at the highest level");
assert.equal(extractOutlineEntries(sample).length, 3, "extracts visible headings only");
assert.equal(headingToFilename("Main Chapter", ["main-chapter.md"]), "main-chapter 2.md", "avoids filename collisions");
assert.equal(normalizeDocumentName("notes"), "notes.md", "adds markdown extension");
assert.equal(
  renameHeadingInContent("## Old title\n\nBody", 0, "New title"),
  "## New title\n\nBody",
  "renames a heading line in place",
);
assert.equal(
  renameHeadingInContent("# Keep\n\nBody", 99, "Nope"),
  "# Keep\n\nBody",
  "leaves content unchanged for an invalid heading line index",
);
assert.equal(
  renameHeadingInContent("### Nested heading ###", 0, "Renamed"),
  "### Renamed ###",
  "preserves heading level and trailing closers",
);
assert.equal(
  extractOutlineEntries("```\n# Fenced\n```\n\n# Real").map((entry) => entry.text).join(","),
  "Real",
  "skips headings inside fenced code blocks when building the outline",
);

// Frontmatter parsing — detection, splitting, and the lightweight YAML subset.
assert.equal(parseFrontmatter("# No frontmatter").data, null, "treats bare markdown as having no frontmatter");
assert.equal(parseFrontmatter("---\nstatus: draft\n---\n# Body").data.status, "draft", "parses a leading frontmatter block");
assert.equal(parseFrontmatter("---\nstatus: draft\n---\n# Body").body, "# Body", "strips the frontmatter from the rendered body");
assert.equal(
  parseFrontmatter("Intro\n\n---\n\nStatus").data,
  null,
  "ignores a thematic break that is not at the very start of the document",
);

const deep = parseFrontmatter([
  "---",
  'title: "Hello world"',
  "status: published",
  "tags: [onboarding, setup, help]",
  "created: 2026-07-22",
  "draft: false",
  "notes:",
  "  - first",
  "  - second",
  "---",
].join("\n"));
assert.equal(deep.data.title, "Hello world", "unwraps double-quoted scalar values");
assert.equal(deep.data.status, "published", "keeps plain scalar values as strings");
assert.deepEqual(deep.data.tags, ["onboarding", "setup", "help"], "parses inline list values");
assert.equal(deep.data.draft, false, "coerces known YAML booleans");
assert.deepEqual(deep.data.notes, ["first", "second"], "parses indented block sequence values");

assert.deepEqual(parseYaml('list: [a, "b, c", d]'), { list: ["a", "b, c", "d"] }, "respects quoted commas inside inline lists");
assert.equal(splitFrontmatter("---\n---\nbody").endLine, 1, "reports the closing fence line index for an empty block");
assert.equal(parseFrontmatter("---\ntitle: Oops").data, null, "treats an unclosed fence as plain markdown");

// Real-world robustness: Windows line endings, folded scalars, inline comments.
const crlf = "---\r\ntitle: CRLF\r\nstatus: draft\r\ntags: [a, b]\r\n---\r\n# Body";
const crlfParsed = parseFrontmatter(crlf);
assert.equal(crlfParsed.data.title, "CRLF", "detects frontmatter despite CRLF line endings");
assert.deepEqual(crlfParsed.data.tags, ["a", "b"], "parses inline lists under CRLF");
assert.equal(crlfParsed.body, "# Body", "strips the frontmatter body under CRLF");

const folded = parseFrontmatter([
  "---",
  "summary: >",
  "  This is a folded",
  "  scalar that should become",
  "  one paragraph.",
  "",
  "  With a second sentence.",
  "tags: [x]",
  "---",
  "",
  "# Doc",
].join("\n"));
assert.equal(
  folded.data.summary,
  "This is a folded scalar that should become one paragraph.\nWith a second sentence.",
  "folds `>` block scalars into joined text, keeping a blank line as a paragraph break",
);
assert.deepEqual(folded.data.tags, ["x"], "continues parsing keys after a folded block scalar");

const commented = parseFrontmatter([
  "---",
  "lead: value # trailing comment",
  "sources:",
  "  - ./a.md # reference architecture",
  "  - ./b.md",
  "version: \"0.2\" # keep this",
  "---",
].join("\n"));
assert.equal(commented.data.lead, "value", "strips inline comments from plain scalars");
assert.deepEqual(commented.data.sources, ["./a.md", "./b.md"], "strips inline comments from list items");
assert.equal(commented.data.version, "0.2", "strips inline comments from quoted scalars");


// Heading extraction must skip frontmatter and keep body line indices valid.
const withFrontmatter = "---\n# Hidden by frontmatter\n---\n# Real title";
const outline = extractOutlineEntries(withFrontmatter);
assert.equal(outline.length, 1, "excludes headings that live inside the frontmatter block");
assert.equal(outline[0].text, "Real title", "uses the first real body heading");
assert.equal(extractPrimaryHeading(withFrontmatter), "Real title", "does not let frontmatter text become the document title");

// Status derivation: explicit status wins; otherwise boolean flags become chips.
assert.equal(deriveStatus({ status: "draft" }).tone, "is-draft", "maps an explicit draft status to its tone");
assert.equal(deriveStatus({ status: "shipped" }).value, "shipped", "passes through recognized status text");
assert.equal(deriveStatus({ status: "custom" }).tone, "is-default", "falls back to a neutral tone for unknown statuses");
assert.equal(deriveStatus({ draft: true }).value, "Draft", "derives a Draft chip from a draft:true flag");
assert.equal(deriveStatus({ published: true }).tone, "is-published", "derives a published tone from published:true");
assert.equal(deriveStatus({ published: false }).value, "Unpublished", "derives an unpublished chip from published:false");
assert.equal(deriveStatus({ featured: true }).value, "Featured", "derives a Featured chip from featured:true");
assert.equal(deriveStatus({ title: "No flags here" }), null, "returns null when no lifecycle signal is present");

console.log("Keyboard, drag-and-drop, rendering, frontmatter, and document naming tests passed.");
