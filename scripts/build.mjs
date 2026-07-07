import { build } from "esbuild";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const [template, styles] = await Promise.all([
  readFile(resolve(root, "src/template.html"), "utf8"),
  readFile(resolve(root, "src/styles.css"), "utf8"),
]);

const result = await build({
  entryPoints: [resolve(root, "src/main.js")],
  bundle: true,
  minify: true,
  write: false,
  format: "iife",
  target: ["chrome109", "firefox115", "safari16"],
  legalComments: "eof",
  define: { "process.env.NODE_ENV": '"production"' },
});

const script = new TextDecoder()
  .decode(result.outputFiles[0].contents)
  .replace(/<\/script/gi, "<\\u002Fscript");
const html = template
  .replace("/*__INLINE_STYLES__*/", () => styles)
  .replace("/*__INLINE_SCRIPT__*/", () => script)
  .replace("__BUILD_DATE__", new Date().toISOString().slice(0, 10));

await writeFile(resolve(root, "markdown-studio.html"), html, "utf8");
console.log(`Built markdown-studio.html (${(Buffer.byteLength(html) / 1024 / 1024).toFixed(2)} MB)`);
