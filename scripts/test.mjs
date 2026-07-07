import assert from "node:assert/strict";
import { isMisplacedHashKey } from "../src/keyboard.js";

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

console.log("Keyboard layout compatibility tests passed.");
