import assert from "node:assert/strict";
import markdownit from "markdown-it";
import { isMisplacedHashKey } from "../src/keyboard.js";
import { isFileDragPayload } from "../src/file-drop.js";
import { shouldRenderRawHtml } from "../src/render-options.js";

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

const renderer = markdownit({ html: true });
renderer.set({ html: shouldRenderRawHtml({}) });
assert.match(renderer.render("Hello <span class=\"accent\">HTML</span>"), /<span class="accent">HTML<\/span>/, "passes inline HTML through before sanitization by default");
renderer.set({ html: shouldRenderRawHtml({ renderHtml: false }) });
assert.match(renderer.render("Hello <span class=\"accent\">HTML</span>"), /&lt;span class=&quot;accent&quot;&gt;HTML&lt;\/span&gt;/, "escapes inline HTML when disabled");

console.log("Keyboard, drag-and-drop, and rendering preference tests passed.");
