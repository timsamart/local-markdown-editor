import { EditorView, basicSetup } from "codemirror";
import { EditorState, Compartment } from "@codemirror/state";
import { markdown } from "@codemirror/lang-markdown";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { keymap } from "@codemirror/view";
import { indentWithTab } from "@codemirror/commands";
import { tags } from "@lezer/highlight";
import markdownit from "markdown-it";
import footnote from "markdown-it-footnote";
import deflist from "markdown-it-deflist";
import taskLists from "markdown-it-task-lists";
import DOMPurify from "dompurify";
import mermaid from "mermaid";
import { isMisplacedHashKey } from "./keyboard.js";
import { isFileDragPayload } from "./file-drop.js";
import { shouldRenderRawHtml, shouldUseFullWidthTables, shouldWidenRenderedTable } from "./render-options.js";
import {
  slugify,
  isAutoNameCandidate,
  extractOutlineEntries,
  extractPrimaryHeading,
  headingToFilename,
  normalizeDocumentName,
  renameHeadingInContent,
} from "./document-name.js";
import { parseFrontmatter, deriveStatus } from "./frontmatter.js";

const BUILD_DATE = "__BUILD_DATE__";
const APP_VERSION = "1.0.0";
const DEFAULT_EDITOR_THEME = "adaptive";

const SAMPLE = [
  "# Welcome to Local Markdown Studio",
  "",
  "> A private place to read, write, and understand Markdown — entirely on your device.",
  "",
  "## Start with the essentials",
  "",
  "- **Drop files** anywhere to open several documents at once",
  "- Switch between **Edit**, **Split**, and **Preview**",
  "- Press `Ctrl/Cmd + Shift + R` for a calm reading mode",
  "- Open **Theme Studio** to make documents feel like yours",
  "",
  "## Mermaid works out of the box",
  "",
  "```mermaid",
  "flowchart LR",
  "  A[Drop Markdown] --> B{Choose a mode}",
  "  B -->|Write| C[Workspace]",
  "  B -->|Read| D[Reader]",
  "  C --> E[Save locally]",
  "  D --> E",
  "```",
  "",
  "## A small table",
  "",
  "| Capability | Local | Private |",
  "|---|:---:|:---:|",
  "| Markdown editing | Yes | Yes |",
  "| Mermaid rendering | Yes | Yes |",
  "| Theme customization | Yes | Yes |",
  "",
  "The finished HTML contains its editor, parser, renderer, and styles. No CDN. No account. No telemetry.",
  "",
  "[^local]: Your documents and recovery drafts stay in this browser profile.",
  "",
  "That is the whole idea.[^local]",
].join("\n");

const ICONS = {
  logo: '<svg class="brand-mark" viewBox="0 0 32 32" aria-hidden="true"><rect x="1" y="1" width="30" height="30" rx="9" fill="#3157d5"/><path d="M9 9.5h8.2l5.8 5.8V23a2 2 0 0 1-2 2H11a2 2 0 0 1-2-2V9.5Z" fill="none" stroke="#fff" stroke-width="1.7"/><path d="M17 9.5V16h6" fill="none" stroke="#fff" stroke-width="1.7"/><path d="M12.4 20.8v-4l2 2 2-2v4" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
  files: '<path d="M15 2H6a2 2 0 0 0-2 2v13"/><path d="M18 7h-8a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2Z"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"/><path d="M17 21v-8H7v8M7 3v5h8"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/>',
  split: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M12 4v16"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  maximize: '<path d="M8 3H3v5M16 3h5v5M21 16v5h-5M3 16v5h5"/><path d="M3 3l6 6M21 3l-6 6M21 21l-6-6M3 21l6-6"/>',
  zoomIn: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4M11 8v6M8 11h6"/>',
  zoomOut: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4M8 11h6"/>',
  fit: '<path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M3 16v3a2 2 0 0 0 2 2h3"/><rect x="8" y="8" width="8" height="8" rx="1.5"/>',
  palette: '<circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2a10 10 0 0 0 0 20h1.5a2 2 0 0 0 0-4H12a2 2 0 0 1 0-4h2a8 8 0 0 0 0-16Z"/>',
  x: '<path d="m18 6-12 12M6 6l12 12"/>',
  chevronLeft: '<path d="m15 18-6-6 6-6"/>',
  chevronRight: '<path d="m9 18 6-6-6-6"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5M12 3v12"/>',
  shield: '<path d="M20 13c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V5l8-3 8 3Z"/><path d="m9 12 2 2 4-4"/>',
  check: '<path d="m20 6-11 11-5-5"/>',
  command: '<path d="M18 9a3 3 0 1 0-3-3v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3Z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z"/>',
  monitor: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v5M14 11v5"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  alert: '<path d="M10.3 2.9 1.8 17a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 2.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  printer: '<path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
  reset: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
};

function icon(name, classes = "") {
  if (name === "logo") return ICONS.logo;
  return `<svg class="icon ${classes}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ICONS.file}</svg>`;
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
}

function uid() {
  return globalThis.crypto?.randomUUID?.() || `doc-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const defaultPreferences = {
  appTheme: "system",
  docTheme: "modern",
  editorTheme: DEFAULT_EDITOR_THEME,
  viewMode: "split",
  sidebar: true,
  renderHtml: true,
  fullWidthTables: true,
  customTokens: {},
};

const state = {
  docs: [],
  archivedDocs: [],
  activeId: null,
  surface: "welcome",
  mode: "workspace",
  preferences: { ...defaultPreferences, ...readJSON("lms-preferences", {}) },
  editor: null,
  editorThemeCompartment: new Compartment(),
  suppressEditor: false,
  renderTimer: null,
  sessionTimer: null,
  pendingOpenMode: "workspace",
  dragDepth: 0,
  commandIndex: 0,
  tableLayoutFrame: 0,
  selectedDocIds: new Set(),
  selectionAnchorId: null,
  archiveExpanded: false,
  docMenuOpen: false,
  diagramViewer: {
    scale: 1,
    x: 0,
    y: 0,
    width: 1,
    height: 1,
    trigger: null,
    drag: null,
    minimapDrag: false,
  },
};

const THEMES = [
  { id: "modern", name: "Modern", desc: "Balanced & clear", colors: ["#ffffff", "#252b35", "#3157d5"] },
  { id: "editorial", name: "Editorial", desc: "Warm long-form", colors: ["#fbf8f1", "#332f29", "#a45136"] },
  { id: "folio", name: "Folio", desc: "Old-book calm", colors: ["#f6f0e2", "#2f2a20", "#5f6f52"] },
  { id: "technical", name: "Technical", desc: "Dense & precise", colors: ["#f8fafc", "#243047", "#0074c8"] },
  { id: "graphite", name: "Graphite", desc: "Quiet dark", colors: ["#171a1e", "#d6dae1", "#8da8ff"] },
  { id: "nordic", name: "Nordic", desc: "Cool & soft", colors: ["#f3f6f6", "#2d3a3d", "#2b8587"] },
  { id: "solarized", name: "Solarized", desc: "Low fatigue", colors: ["#fdf6e3", "#586e75", "#b58900"] },
  { id: "terminal", name: "Terminal", desc: "Monospace focus", colors: ["#0e1512", "#b5cabd", "#58cf94"] },
  { id: "contrast", name: "High Contrast", desc: "Maximum clarity", colors: ["#ffffff", "#000000", "#0033cc"] },
  { id: "ruv", name: "R+V Brand", desc: "Slab & brand palette", colors: ["#001957", "#f79506", "#00dcdc"] },
];

const EDITOR_THEMES = [
  { id: "adaptive", name: "Follow App", desc: "Semantic auto", colors: ["#fbfcfe", "#101418", "#3157d5"] },
  { id: "studio-light", name: "Studio Light", desc: "Crisp daylight", colors: ["#fbfcfe", "#1d2433", "#005cc5"] },
  { id: "studio-dark", name: "Studio Dark", desc: "Calm contrast", colors: ["#101418", "#e6edf3", "#79c0ff"] },
  { id: "solarized", name: "Solarized", desc: "Low fatigue", colors: ["#fdf6e3", "#586e75", "#268bd2"] },
  { id: "midnight", name: "Midnight", desc: "Focused dark", colors: ["#0b1020", "#e6edf7", "#82aaff"] },
  { id: "contrast", name: "High Contrast", desc: "Maximum clarity", colors: ["#ffffff", "#000000", "#0033cc"] },
];

const EDITOR_THEME_PALETTES = {
  "studio-light": {
    dark: false,
    bg: "#fbfcfe",
    panel: "#f2f5f9",
    panelStrong: "#e7edf5",
    text: "#1d2433",
    muted: "#687386",
    faint: "#8792a3",
    border: "#d8dee8",
    caret: "#005cc5",
    selection: "#cfe2ff",
    activeLine: "#eef5ff",
    matching: "#d7f5dd",
    search: "#fff0a6",
    searchSelected: "#ffd66b",
    heading: "#005cc5",
    headingStrong: "#003f8f",
    link: "#0969da",
    emphasis: "#8250df",
    strong: "#0f172a",
    mono: "#9a3412",
    string: "#116329",
    keyword: "#8250df",
    atom: "#9a3412",
    meta: "#57606a",
    quote: "#4f6f52",
    list: "#b35c00",
    punctuation: "#6b7280",
    invalid: "#b42318",
    invalidBg: "#ffe2de",
  },
  "studio-dark": {
    dark: true,
    bg: "#101418",
    panel: "#171c22",
    panelStrong: "#202832",
    text: "#e6edf3",
    muted: "#9ba6b4",
    faint: "#778391",
    border: "#2f3844",
    caret: "#79c0ff",
    selection: "#254e78",
    activeLine: "#182330",
    matching: "#1f4f3a",
    search: "#5c4b18",
    searchSelected: "#7a5f17",
    heading: "#79c0ff",
    headingStrong: "#a5d6ff",
    link: "#8ab4ff",
    emphasis: "#d2a8ff",
    strong: "#ffffff",
    mono: "#ffa657",
    string: "#a5d6a7",
    keyword: "#d2a8ff",
    atom: "#ffa657",
    meta: "#9ba6b4",
    quote: "#8ddb8c",
    list: "#ffb86b",
    punctuation: "#8b949e",
    invalid: "#ffb4ab",
    invalidBg: "#5a1f1b",
  },
  solarized: {
    dark: false,
    bg: "#fdf6e3",
    panel: "#eee8d5",
    panelStrong: "#e4ddc8",
    text: "#586e75",
    muted: "#657b83",
    faint: "#93a1a1",
    border: "#d8cfb8",
    caret: "#268bd2",
    selection: "#d7e3c6",
    activeLine: "#f4eedc",
    matching: "#d5e8d4",
    search: "#f5df8d",
    searchSelected: "#e7c45c",
    heading: "#268bd2",
    headingStrong: "#00629d",
    link: "#268bd2",
    emphasis: "#6c71c4",
    strong: "#073642",
    mono: "#cb4b16",
    string: "#2aa198",
    keyword: "#859900",
    atom: "#b58900",
    meta: "#657b83",
    quote: "#859900",
    list: "#b58900",
    punctuation: "#839496",
    invalid: "#dc322f",
    invalidBg: "#f6d7d1",
  },
  midnight: {
    dark: true,
    bg: "#0b1020",
    panel: "#11182a",
    panelStrong: "#19223a",
    text: "#e6edf7",
    muted: "#aab6c8",
    faint: "#7787a2",
    border: "#29344f",
    caret: "#c3e88d",
    selection: "#334b75",
    activeLine: "#121b31",
    matching: "#254a36",
    search: "#564a16",
    searchSelected: "#74641b",
    heading: "#82aaff",
    headingStrong: "#b2ccff",
    link: "#89ddff",
    emphasis: "#c792ea",
    strong: "#ffffff",
    mono: "#ffcb6b",
    string: "#c3e88d",
    keyword: "#c792ea",
    atom: "#f78c6c",
    meta: "#aab6c8",
    quote: "#80cbc4",
    list: "#f78c6c",
    punctuation: "#89a1c1",
    invalid: "#ff9a9a",
    invalidBg: "#5f2528",
  },
  contrast: {
    dark: false,
    bg: "#ffffff",
    panel: "#f0f0f0",
    panelStrong: "#e2e2e2",
    text: "#000000",
    muted: "#3f3f3f",
    faint: "#5d5d5d",
    border: "#000000",
    caret: "#0033cc",
    selection: "#ffe66d",
    activeLine: "#f2f2ff",
    matching: "#c9ffd8",
    search: "#fff176",
    searchSelected: "#ffbf47",
    heading: "#0033cc",
    headingStrong: "#001f80",
    link: "#0033cc",
    emphasis: "#5b2eb2",
    strong: "#000000",
    mono: "#00612f",
    string: "#00612f",
    keyword: "#5b2eb2",
    atom: "#9a3412",
    meta: "#303030",
    quote: "#005a30",
    list: "#7a3e00",
    punctuation: "#303030",
    invalid: "#b00020",
    invalidBg: "#ffd7dc",
  },
};

const FONT_OPTIONS = {
  system: 'Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  humanist: 'Optima, Candara, "Noto Sans", Arial, sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
  book: 'Charter, "Bitstream Charter", "Sitka Text", Cambria, serif',
  mono: '"SFMono-Regular", Consolas, "Liberation Mono", monospace',
  ruv: '"RuVSans", Arial, Helvetica, sans-serif',
};

function readJSON(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}

function savePreferences() {
  localStorage.setItem("lms-preferences", JSON.stringify(state.preferences));
}

function activeDoc() {
  return state.docs.find((doc) => doc.id === state.activeId) || null;
}

function isDirty(doc) {
  return doc && doc.content !== doc.savedContent;
}

function makeDocument(name = "Untitled.md", content = "", extras = {}) {
  const { nameCustomized, savedContent, ...rest } = extras;
  return {
    id: uid(),
    name,
    content,
    savedContent: savedContent ?? content,
    handle: null,
    cursor: 0,
    ...rest,
    nameCustomized: nameCustomized ?? !isAutoNameCandidate(name),
  };
}

const md = markdownit({ html: true, linkify: true, typographer: true, breaks: false })
  .use(footnote)
  .use(deflist)
  .use(taskLists, { enabled: true, label: true, labelAfter: true });

const defaultFence = md.renderer.rules.fence.bind(md.renderer.rules);
const defaultImage = md.renderer.rules.image.bind(md.renderer.rules);
md.renderer.rules.fence = (tokens, idx, options, env, self) => {
  const token = tokens[idx];
  if (token.info.trim().toLowerCase() === "mermaid") {
    return `<div class="mermaid-shell"><div class="mermaid-loading" data-mermaid>${md.utils.escapeHtml(token.content)}</div></div>`;
  }
  return defaultFence(tokens, idx, options, env, self);
};

md.renderer.rules.image = (tokens, idx, options, env, self) => {
  const source = tokens[idx].attrGet("src") || "";
  if (/^(https?:)?\/\//i.test(source)) {
    return `<span class="blocked-resource" role="note">Remote image blocked: ${md.utils.escapeHtml(source)}</span>`;
  }
  return defaultImage(tokens, idx, options, env, self);
};

md.renderer.rules.heading_open = (tokens, idx, options, env) => {
  const level = tokens[idx].tag;
  const title = tokens[idx + 1]?.content || "section";
  env.slugs ||= new Map();
  const base = slugify(title);
  const count = env.slugs.get(base) || 0;
  env.slugs.set(base, count + 1);
  const id = count ? `${base}-${count + 1}` : base;
  return `<${level} id="${escapeHtml(id)}">`;
};

const renderVersions = new WeakMap();

async function renderInto(target, content) {
  if (!target) return;
  resetWideTables(target);
  const version = (renderVersions.get(target) || 0) + 1;
  renderVersions.set(target, version);
  if (!content.trim()) {
    target.innerHTML = `<div class="render-empty"><div><div>${icon("file")}</div><strong>Nothing to preview yet</strong><p>Start writing and your document will appear here.</p></div></div>`;
    return;
  }

  md.set({ html: shouldRenderRawHtml(state.preferences) });
  // Split off a leading YAML frontmatter block so it renders as a meaningful
  // byline instead of two <hr> rules with raw key/value text. The byline HTML
  // is prepended and runs through the same sanitization pass as the body.
  const { data: frontmatter, body } = parseFrontmatter(content);
  const frontmatterHtml = frontmatter ? renderFrontmatter(frontmatter) : "";
  const rendered = md.render(body, { slugs: new Map() });
  target.innerHTML = DOMPurify.sanitize(`${frontmatterHtml}${rendered}`, {
    USE_PROFILES: { html: true },
    ADD_ATTR: ["target", "rel", "data-mermaid", "disabled", "datetime"],
    FORBID_TAGS: ["script", "style", "iframe", "object", "embed"],
  });

  target.querySelectorAll("a").forEach((link) => {
    link.rel = "noreferrer noopener";
    if (/^https?:/i.test(link.href)) link.dataset.external = "true";
  });
  // When the frontmatter carries a title, the body usually repeats it as an
  // <h1>. Drop that duplicate so the title shows once, in the byline.
  suppressDuplicateTitle(target);
  target.querySelectorAll("img").forEach((image) => {
    const source = image.getAttribute("src") || "";
    if (/^(https?:)?\/\//i.test(source)) {
      const replacement = document.createElement("span");
      replacement.className = "mermaid-error";
      replacement.textContent = `Remote image blocked: ${source}`;
      image.replaceWith(replacement);
    }
  });
  target.querySelectorAll("pre:not(:has([data-mermaid]))").forEach((pre) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn btn-sm code-copy";
    button.setAttribute("aria-label", "Copy code");
    button.innerHTML = `${icon("copy", "icon-sm")}<span>Copy</span>`;
    pre.append(button);
  });
  updateWideTables(target);

  const ruvDiagram = state.preferences.docTheme === "ruv";
  const diagramTheme = ["graphite", "terminal"].includes(state.preferences.docTheme) ? "dark" : ruvDiagram ? "base" : "neutral";
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "strict",
    // Pure SVG labels survive the strict SVG sanitizer; Mermaid's HTML labels
    // use foreignObject and would otherwise be intentionally removed.
    htmlLabels: false,
    theme: diagramTheme,
    themeVariables: ruvDiagram ? {
      fontFamily: "RuVSans, Arial, sans-serif",
      primaryColor: "#fff4e0",
      primaryTextColor: "#001957",
      primaryBorderColor: "#f79506",
      lineColor: "#109da8",
      secondaryColor: "#e8eefb",
      tertiaryColor: "#f4f6f8",
    } : undefined,
    suppressErrorRendering: true,
    flowchart: { useMaxWidth: true },
    sequence: { useMaxWidth: true },
  });

  const diagrams = [...target.querySelectorAll("[data-mermaid]")];
  for (let index = 0; index < diagrams.length; index += 1) {
    if (renderVersions.get(target) !== version) return;
    const node = diagrams[index];
    const source = node.textContent;
    try {
      const id = `lms-mermaid-${version}-${index}-${Math.random().toString(36).slice(2)}`;
      const result = await mermaid.render(id, source);
      if (renderVersions.get(target) !== version) return;
      node.innerHTML = DOMPurify.sanitize(result.svg, { USE_PROFILES: { svg: true, svgFilters: true } });
      node.classList.remove("mermaid-loading");
      enhanceMermaidShell(node.closest(".mermaid-shell"));
      result.bindFunctions?.(node);
    } catch (error) {
      node.className = "mermaid-error";
      node.innerHTML = `<strong>Diagram could not be rendered</strong><span>${escapeHtml(cleanMermaidError(error))}</span>`;
    }
  }
}

function enhanceMermaidShell(shell) {
  if (!shell || shell.querySelector(".diagram-open")) return;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "btn btn-quiet icon-btn btn-sm diagram-open";
  button.title = "Open diagram fullscreen";
  button.setAttribute("aria-label", "Open diagram fullscreen");
  button.innerHTML = icon("maximize", "icon-sm");
  shell.append(button);
}

function resetWideTables(target) {
  target.dataset.wideTables = "false";
  target.querySelectorAll("table.wide-table").forEach((table) => table.classList.remove("wide-table"));
}

function updateWideTables(target) {
  if (!target) return;
  resetWideTables(target);
  if (!shouldUseFullWidthTables(state.preferences) || !target.getClientRects().length) return;

  const wideTables = [...target.querySelectorAll("table")].filter((table) => (
    table.clientWidth > 0 && shouldWidenRenderedTable(table.scrollWidth, table.clientWidth)
  ));
  if (!wideTables.length) return;

  target.dataset.wideTables = "true";
  wideTables.forEach((table) => table.classList.add("wide-table"));
}

function refreshWideTableLayouts() {
  if (state.surface !== "shell") return;
  cancelAnimationFrame(state.tableLayoutFrame);
  state.tableLayoutFrame = requestAnimationFrame(() => {
    state.tableLayoutFrame = 0;
    document.querySelectorAll("[data-render-target]").forEach(updateWideTables);
  });
}

function cleanMermaidError(error) {
  const text = String(error?.message || error || "Unknown Mermaid error").replace(/\s+/g, " ").trim();
  return text.length > 260 ? `${text.slice(0, 257)}…` : text;
}

// Renders parsed frontmatter as a calm, borderless editorial byline that flows
// above the document body. Semantic keys get dedicated, meaningful
// presentations; every other key is surfaced as a quiet key/value row so no
// metadata is ever silently dropped.
const META_TITLE_KEYS = ["title", "name"];
const META_SUBTITLE_KEYS = ["subtitle", "tagline"];
const META_DESC_KEYS = ["description", "summary", "abstract", "excerpt", "lead"];
const META_DATE_KEYS = ["created", "updated", "date", "published", "modified"];
const META_TAG_KEYS = ["tags", "keywords", "topics"];
const META_AUTHOR_KEYS = ["author", "authors", "by"];
const META_TYPE_KEYS = ["type", "kind"];
const META_CATEGORY_KEYS = ["category", "categories", "section"];
const META_VERSION_KEYS = ["version", "revision", "rev"];
const META_TIME_KEYS = ["reading_time", "readingtime", "reading-time", "minutes", "readtime", "time_to_read"];
const META_URL_KEYS = ["url", "permalink", "slug", "canonical_url", "canonical"];
const META_STATUS_FLAG_KEYS = ["draft", "published", "featured"];

const META_RECOGNIZED = new Set([
  ...META_TITLE_KEYS, ...META_SUBTITLE_KEYS, ...META_DESC_KEYS, ...META_DATE_KEYS,
  ...META_TAG_KEYS, ...META_AUTHOR_KEYS, ...META_TYPE_KEYS, ...META_CATEGORY_KEYS,
  ...META_VERSION_KEYS, ...META_TIME_KEYS, ...META_URL_KEYS, ...META_STATUS_FLAG_KEYS,
  "status", "state",
]);

function renderFrontmatter(data) {
  const parts = [];

  const title = firstValue(data, META_TITLE_KEYS);
  if (title) parts.push(`<h1 class="doc-meta-title">${escapeHtml(formatInline(title))}</h1>`);
  const subtitle = firstValue(data, META_SUBTITLE_KEYS);
  if (subtitle) parts.push(`<p class="doc-meta-subtitle">${escapeHtml(formatInline(subtitle))}</p>`);

  const status = deriveStatus(data);
  const type = firstValue(data, META_TYPE_KEYS);
  const category = firstValue(data, META_CATEGORY_KEYS);
  const version = firstValue(data, META_VERSION_KEYS);
  const chips = [
    status && metaChip("status", status.value, status.tone),
    type && metaChip("type", type),
    category && metaChip("category", category),
    version && metaChip("version", version),
  ].filter(Boolean).join("");
  if (chips) parts.push(`<div class="doc-meta-chips">${chips}</div>`);

  const description = firstValue(data, META_DESC_KEYS);
  if (description) parts.push(`<p class="doc-meta-description">${escapeHtml(formatInline(description))}</p>`);

  const author = firstValue(data, META_AUTHOR_KEYS);
  const dates = META_DATE_KEYS.map((key) => data[key]).filter((value) => value !== null && value !== undefined && value !== "" && typeof value !== "boolean").flatMap(asList)
    .map((value) => formatDate(value)).filter(Boolean);
  const readingTime = firstValue(data, META_TIME_KEYS);
  const bylineParts = [];
  if (author) bylineParts.push(`<span class="doc-meta-author">By ${escapeHtml(formatInline(author))}</span>`);
  if (dates.length) bylineParts.push(dates.map((date) => `<time class="doc-meta-date" datetime="${escapeHtml(date.value)}">${escapeHtml(date.display)}</time>`).join('<span class="doc-meta-sep" aria-hidden="true">·</span>'));
  if (readingTime !== null) bylineParts.push(`<span class="doc-meta-readtime">${escapeHtml(formatReadingTime(readingTime))}</span>`);
  if (bylineParts.length) parts.push(`<p class="doc-meta-byline">${bylineParts.join('<span class="doc-meta-sep" aria-hidden="true">·</span>')}</p>`);

  const tags = META_TAG_KEYS.flatMap((key) => asList(data[key]));
  if (tags.length) parts.push(`<p class="doc-meta-tags">${tags.map((tag) => `<span class="doc-meta-tag">${escapeHtml(String(tag))}</span>`).join("")}</p>`);

  const url = firstValue(data, META_URL_KEYS);
  if (url) parts.push(`<p class="doc-meta-url-row"><span class="doc-meta-url-label">Link</span><span class="doc-meta-url">${escapeHtml(formatInline(url))}</span></p>`);

  const rest = Object.entries(data).filter(([key]) => !META_RECOGNIZED.has(key.toLowerCase()));
  if (rest.length) parts.push(renderMetaRest(rest));

  if (!parts.length) return "";
  return `<header class="doc-frontmatter" data-meta-title="${escapeHtml(title ? formatInline(title) : "")}">${parts.join("")}</header>`;
}

function firstValue(data, keys) {
  for (const key of keys) {
    if (data[key] !== undefined && data[key] !== null && data[key] !== "") return data[key];
  }
  return null;
}

function asList(value) {
  if (value === null || value === undefined) return [];
  return Array.isArray(value) ? value.map(String) : [String(value)];
}

function metaChip(kind, value, tone) {
  const text = String(value).trim();
  if (!text) return "";
  // Normalize booleans that reach a chip (e.g. a derived status) to readable text.
  const label = text === "true" ? "Yes" : text === "false" ? "No" : text;
  const toneClass = tone || (kind === "status" ? "is-default" : "");
  return `<span class="doc-meta-chip doc-meta-${kind} ${toneClass}"><span class="doc-meta-dot" aria-hidden="true"></span>${escapeHtml(label)}</span>`;
}

function renderMetaRest(entries) {
  const rows = entries
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .map(([key, value]) => `<dt class="doc-meta-key">${escapeHtml(key)}</dt><dd class="doc-meta-value">${escapeHtml(formatInline(value))}</dd>`)
    .join("");
  if (!rows) return "";
  return `<dl class="doc-meta-rest">${rows}</dl>`;
}

function formatInline(value) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean).join(", ");
  if (typeof value === "boolean") return value ? "yes" : "no";
  return String(value).trim();
}

// Renders a reading-time value as "N min read", accepting bare numbers, the
// common `minutes: N` form, and already-human strings ("5 min") unchanged.
function formatReadingTime(value) {
  const text = String(value).trim();
  const match = /^(\d+)\s*(?:min(?:utes?)?|m)?$/i.exec(text);
  if (match) return `${match[1]} min read`;
  return text;
}

function formatDate(value) {
  const text = String(value).trim();
  if (!text) return null;
  // Accept full ISO 8601 and common calendar forms (YYYY-MM-DD, DD/MM/YYYY, MM/DD/YYYY).
  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:[T ].*)?$/.exec(text);
  if (iso) {
    const date = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    if (!Number.isNaN(date.getTime())) return { value: text, display: date.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }) };
  }
  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    return { value: text, display: parsed.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }) };
  }
  // Bare, human-readable dates ("yesterday", "Q3 2026") stay as-is.
  return { value: text, display: text };
}

// Removes a leading body <h1> when it restates the frontmatter title, so the
// title is shown once (in the byline) instead of twice. The outline already
// reflects the real first heading, so dropping a duplicate does not orphan it.
function suppressDuplicateTitle(target) {
  const byline = target.querySelector(":scope > .doc-frontmatter[data-meta-title]");
  const title = byline?.dataset.metaTitle?.trim();
  if (!title) return;
  const firstHeading = target.querySelector(":scope > h1");
  if (!firstHeading) return;
  if (normalizeTitle(firstHeading.textContent) === normalizeTitle(title)) firstHeading.remove();
}

function normalizeTitle(text) {
  return String(text).toLowerCase().replace(/[#:`*_/~]/g, "").replace(/\s+/g, " ").trim();
}

function appTemplateWelcome() {
  return `
    <main class="welcome" id="main-content">
      <header class="welcome-bar">
        <div class="brand">${icon("logo")}<span class="brand-word">Local Markdown Studio</span></div>
        <div class="privacy-chip"><span class="privacy-dot"></span>Entirely on this device</div>
      </header>
      <section class="welcome-content">
        <div class="welcome-copy">
          <div class="eyebrow">Private by design</div>
          <h1>Your documents.<br><span>Your device.</span></h1>
          <p class="welcome-lead">A focused Markdown workspace and reader with beautiful themes, multi-file editing, and Mermaid diagrams. No server required.</p>
          <div class="welcome-features">
            <span class="welcome-feature">${icon("check", "icon-sm")} No uploads</span>
            <span class="welcome-feature">${icon("check", "icon-sm")} No telemetry</span>
            <span class="welcome-feature">${icon("check", "icon-sm")} One portable file</span>
          </div>
        </div>
        <div>
          <div class="drop-card">
            <div class="drop-zone" id="welcomeDrop" tabindex="0" role="button" aria-label="Drop Markdown files or press Enter to open files">
              <div class="drop-icon">${icon("upload")}</div>
              <h2>Drop Markdown here</h2>
              <p>One file or a whole handful.<br>They stay on this device.</p>
              <div class="drop-actions">
                <button class="btn btn-primary" type="button" data-action="open-workspace">${icon("folder")} Open files</button>
                <button class="btn" type="button" data-action="open-reader">${icon("book")} Read a file</button>
              </div>
            </div>
            <div class="new-row">
              <button class="btn" type="button" data-action="new">${icon("plus")} New document</button>
              <button class="btn" type="button" data-action="sample">${icon("file")} Explore sample</button>
            </div>
          </div>
          <div class="welcome-footnote">Markdown, Mermaid, themes, and recovery — all bundled locally.</div>
        </div>
      </section>
      <input class="sr-only" id="fileInput" type="file" accept=".md,.markdown,.mdown,.mkd,.txt,text/markdown,text/plain" multiple>
    </main>
    ${globalOverlays()}`;
}

function appTemplateShell() {
  return `
    <div class="shell" id="main-content">
      <header class="topbar">
        <button class="btn btn-quiet icon-btn" type="button" data-action="toggle-sidebar" aria-label="Toggle outline sidebar">${icon("menu")}</button>
        <div class="brand">${icon("logo")}<span class="brand-word">Local Markdown Studio</span></div>
        <button class="btn btn-quiet icon-btn" type="button" data-action="open" aria-label="Open Markdown files">${icon("folder")}</button>
        <button class="btn btn-quiet icon-btn" type="button" data-action="new" aria-label="New document">${icon("plus")}</button>
        <button class="btn btn-quiet icon-btn" type="button" data-action="save" aria-label="Save active document">${icon("save")}</button>
        <button class="btn command-trigger" type="button" data-action="commands">${icon("search")}<span>Search commands</span><kbd>Ctrl K</kbd></button>
        <div class="topbar-spacer"></div>
        <div class="segmented" aria-label="Workspace view">
          <button class="btn" type="button" data-view="edit" aria-label="Editor only">${icon("edit", "icon-sm")}<span>Edit</span></button>
          <button class="btn" type="button" data-view="split" aria-label="Split editor and preview">${icon("split", "icon-sm")}<span>Split</span></button>
          <button class="btn" type="button" data-view="preview" aria-label="Preview only">${icon("eye", "icon-sm")}<span>Preview</span></button>
        </div>
        <button class="btn btn-reader" type="button" data-action="reader">${icon("book")}<span class="optional">Reader</span></button>
        <button class="btn btn-theme" type="button" data-action="theme">${icon("palette")}<span class="optional">Theme</span></button>
      </header>
      <div class="workspace-grid" id="workspaceGrid">
        <aside class="sidebar" aria-label="Documents and outline">
          <section class="sidebar-section sidebar-docs">
            <div class="section-heading">
              <span>Documents</span>
              <div class="section-actions">
                <button class="btn btn-quiet icon-btn btn-sm" type="button" data-action="doc-menu" aria-label="Document actions" aria-haspopup="menu" aria-expanded="false">${icon("list", "icon-sm")}</button>
                <button class="btn btn-quiet icon-btn btn-sm" type="button" data-action="new" aria-label="New document">${icon("plus", "icon-sm")}</button>
              </div>
            </div>
            <div class="doc-rail-actions hidden" id="docRailActions" aria-live="polite"></div>
            <div class="doc-overflow-menu hidden" id="docOverflowMenu" role="menu" aria-label="Document actions"></div>
            <div class="document-list" id="documentList"></div>
          </section>
          <section class="sidebar-section sidebar-outline">
            <div class="section-heading"><span>Outline</span><span id="outlineCount"></span></div>
            <nav class="outline-list" id="outlineList" aria-label="Document outline"></nav>
          </section>
          <section class="sidebar-section sidebar-archive">
            <button class="section-heading archive-toggle" type="button" data-action="toggle-archive" aria-expanded="false">
              <span>Archived</span>
              <span class="archive-count" id="archiveCount"></span>
              ${icon("chevronDown", "icon-sm")}
            </button>
            <div class="archive-list hidden" id="archiveList" aria-label="Archived documents"></div>
          </section>
        </aside>
        <main class="work-area">
          <section class="workspace" id="workspaceSurface">
            <div class="workspace-toolbar" id="workspaceToolbar">
              <div class="mobile-view-switch" aria-label="Mobile document view">
                <button class="btn btn-quiet icon-btn btn-sm" type="button" data-view="edit" aria-label="Show editor">${icon("edit", "icon-sm")}</button>
                <button class="btn btn-quiet icon-btn btn-sm" type="button" data-view="preview" aria-label="Show preview">${icon("eye", "icon-sm")}</button>
              </div>
            </div>
            <div class="editor-stage" id="editorStage" data-view="split">
              <section class="pane editor-pane" aria-label="Markdown editor"><div id="editor"></div></section>
              <div class="splitter" id="splitter" role="separator" aria-orientation="vertical" aria-label="Resize editor and preview"></div>
              <section class="pane preview-pane" id="previewPane" aria-label="Markdown preview"><article class="render-surface markdown-body" id="previewContent" data-render-target></article></section>
            </div>
          </section>
          <section class="reader hidden" id="readerSurface" aria-label="Reading mode">
            <div class="reader-progress" aria-hidden="true"></div>
            <header class="reader-header">
              <button class="btn btn-quiet icon-btn" type="button" data-action="workspace" aria-label="Back to workspace">${icon("chevronLeft")}</button>
              <button class="btn btn-quiet icon-btn" type="button" data-action="reader-outline" aria-label="Toggle outline">${icon("list")}</button>
              <div class="reader-header-title" id="readerTitle"></div>
              <button class="btn btn-quiet icon-btn" type="button" data-action="print" aria-label="Print document">${icon("printer")}</button>
              <button class="btn btn-quiet icon-btn" type="button" data-action="theme" aria-label="Open Theme Studio">${icon("palette")}</button>
              <button class="btn" type="button" data-action="workspace">${icon("edit", "icon-sm")} Edit</button>
            </header>
            <nav class="reader-outline hidden" id="readerOutline" aria-label="Reader outline"></nav>
            <article class="render-surface markdown-body" id="readerContent" data-render-target></article>
          </section>
        </main>
      </div>
      <footer class="statusbar">
        <span class="status-item" id="saveStatus"></span>
        <span class="status-item hide-mobile" id="cursorStatus">Ln 1, Col 1</span>
        <span class="status-spacer"></span>
        <span class="status-item hide-mobile" id="wordStatus">0 words</span>
        <span class="status-item">Markdown</span>
      </footer>
      <input class="sr-only" id="fileInput" type="file" accept=".md,.markdown,.mdown,.mkd,.txt,text/markdown,text/plain" multiple>
    </div>
    ${themeDrawerTemplate()}
    ${globalOverlays()}`;
}

function themeDrawerTemplate() {
  return `
    <div class="drawer-backdrop hidden" id="drawerBackdrop" data-action="close-theme"></div>
    <aside class="theme-drawer hidden" id="themeDrawer" aria-label="Theme Studio">
      <header class="drawer-header"><h2>Theme Studio</h2><button class="btn btn-quiet icon-btn" type="button" data-action="close-theme" aria-label="Close Theme Studio">${icon("x")}</button></header>
      <div class="drawer-content">
        <section class="settings-group">
          <h3>Document presets</h3>
          <div class="theme-grid" id="themeGrid">${THEMES.map(themeCard).join("")}</div>
        </section>
        <section class="settings-group">
          <h3>Code editor</h3>
          <div class="theme-grid" id="editorThemeGrid">${EDITOR_THEMES.map(editorThemeCard).join("")}</div>
        </section>
        <section class="settings-group">
          <h3>Typography & measure</h3>
          <div class="field"><label for="fontSelect">Document font</label><select id="fontSelect"><option value="system">Modern sans</option><option value="humanist">Humanist sans</option><option value="serif">Classic serif</option><option value="book">Book serif</option><option value="mono">Monospace</option><option value="ruv">R+V Sans</option></select></div>
          <div class="field"><div class="field-row"><label for="fontSize">Text size</label><output id="fontSizeOutput">17px</output></div><input id="fontSize" type="range" min="14" max="22" step="1" value="17"></div>
          <div class="field"><div class="field-row"><label for="lineHeight">Line height</label><output id="lineHeightOutput">1.72</output></div><input id="lineHeight" type="range" min="1.4" max="2" step=".02" value="1.72"></div>
          <div class="field"><div class="field-row"><label for="contentWidth">Reading width</label><output id="contentWidthOutput">760px</output></div><input id="contentWidth" type="range" min="560" max="980" step="20" value="760"></div>
        </section>
        <section class="settings-group">
          <h3>Color</h3>
          <div class="color-grid">
            ${colorField("docBg", "Page", "#ffffff")}
            ${colorField("docText", "Text", "#252b35")}
            ${colorField("docHeading", "Headings", "#131820")}
            ${colorField("docLink", "Links", "#3157d5")}
            ${colorField("docAccent", "Accent", "#3157d5")}
            ${colorField("docSurface", "Blocks", "#f7f8fa")}
          </div>
        </section>
        <section class="settings-group">
          <h3>Application</h3>
          <div class="field"><label for="appThemeSelect">Interface appearance</label><select id="appThemeSelect"><option value="system">Follow system</option><option value="light">Light</option><option value="dark">Dark</option></select></div>
        </section>
        <section class="settings-group">
          <h3>Markdown rendering</h3>
          <label class="check-field" for="fullWidthTablesToggle">
            <input id="fullWidthTablesToggle" type="checkbox">
            <span><strong>Full-width tables</strong><small>Only tables wider than the reading measure use the available preview and Reader width.</small></span>
          </label>
          <label class="check-field" for="renderHtmlToggle">
            <input id="renderHtmlToggle" type="checkbox">
            <span><strong>Render sanitized HTML</strong><small>Supports inline HTML tags in Markdown while still removing unsafe scriptable content.</small></span>
          </label>
        </section>
        <div class="drawer-actions"><button class="btn" type="button" data-action="reset-theme">${icon("reset", "icon-sm")} Reset customizations</button></div>
      </div>
    </aside>`;
}

function themeCard(theme) {
  const swatches = theme.colors.map((color) => `<span class="theme-swatch" style="--swatch:${color}"></span>`).join("");
  return `<button class="theme-card" type="button" data-theme-preset="${theme.id}" style="--theme-card-bg:${theme.colors[0]};--theme-card-text:${theme.colors[1]}"><span class="theme-swatches">${swatches}</span><span class="theme-card-name">${theme.name}</span><span class="theme-card-desc">${theme.desc}</span></button>`;
}

function editorThemeCard(theme) {
  const swatches = theme.colors.map((color) => `<span class="theme-swatch" style="--swatch:${color}"></span>`).join("");
  return `<button class="theme-card" type="button" data-code-editor-theme="${theme.id}" style="--theme-card-bg:${theme.colors[0]};--theme-card-text:${theme.colors[1]}"><span class="theme-swatches">${swatches}</span><span class="theme-card-name">${theme.name}</span><span class="theme-card-desc">${theme.desc}</span></button>`;
}

function colorField(id, label, value) {
  return `<div class="field color-field"><input id="${id}" type="color" value="${value}" aria-label="${label} color"><label for="${id}">${label}</label></div>`;
}

function globalOverlays() {
  return `
    <div class="drop-overlay hidden" id="dropOverlay"><div class="drop-overlay-card"><div class="drop-icon">${icon("files")}</div><h2>Drop to open</h2><p id="dropOverlayText">Files will open in the workspace</p></div></div>
    <dialog class="command-dialog" id="commandDialog"><div class="command-input-wrap">${icon("search")}<input class="command-input" id="commandInput" type="search" autocomplete="off" placeholder="Type a command or document name…" aria-label="Search commands"></div><div class="command-results" id="commandResults"></div></dialog>
    <dialog class="confirm-dialog" id="confirmDialog"><div class="dialog-content"><h2 id="confirmTitle"></h2><p id="confirmMessage"></p></div><div class="dialog-actions" id="confirmActions"></div></dialog>
    <section class="diagram-viewer hidden" id="diagramViewer" role="dialog" aria-modal="true" aria-label="Mermaid diagram viewer">
      <header class="diagram-viewer-toolbar">
        <div class="diagram-viewer-title" id="diagramViewerTitle">Mermaid diagram</div>
        <div class="diagram-viewer-controls" aria-label="Diagram zoom controls">
          <button class="btn btn-quiet icon-btn" type="button" data-diagram-action="zoom-out" aria-label="Zoom out">${icon("zoomOut")}</button>
          <output class="diagram-zoom-level" id="diagramZoomLevel">100%</output>
          <button class="btn btn-quiet icon-btn" type="button" data-diagram-action="zoom-in" aria-label="Zoom in">${icon("zoomIn")}</button>
          <button class="btn btn-quiet icon-btn" type="button" data-diagram-action="fit" aria-label="Fit diagram">${icon("fit")}</button>
          <button class="btn btn-quiet icon-btn" type="button" data-diagram-action="close" aria-label="Close diagram viewer">${icon("x")}</button>
        </div>
      </header>
      <div class="diagram-stage" id="diagramStage" tabindex="0">
        <div class="diagram-canvas" id="diagramCanvas"></div>
      </div>
      <div class="diagram-minimap" id="diagramMinimap" aria-hidden="true">
        <div class="diagram-minimap-content" id="diagramMinimapContent"></div>
        <div class="diagram-minimap-viewport" id="diagramMinimapViewport"></div>
      </div>
    </section>
    <div class="toast-region" id="toastRegion" aria-live="polite" aria-atomic="true"></div>`;
}

function showWelcome() {
  state.surface = "welcome";
  state.editor?.destroy();
  state.editor = null;
  document.querySelector("#app").innerHTML = appTemplateWelcome();
  bindCommonEvents();
  applyAppearance();
  document.querySelector("#app").setAttribute("aria-busy", "false");
}

function showShell(mode = "workspace") {
  state.surface = "shell";
  state.mode = mode;
  document.querySelector("#app").innerHTML = appTemplateShell();
  createEditor();
  bindCommonEvents();
  bindShellEvents();
  applyAppearance();
  updateAll();
  setMode(mode);
  document.querySelector("#app").setAttribute("aria-busy", "false");
}

function createEditor() {
  const parent = document.querySelector("#editor");
  state.editor = new EditorView({
    state: EditorState.create({
      doc: activeDoc()?.content || "",
      extensions: [
        basicSetup,
        markdown(),
        keymap.of([indentWithTab]),
        EditorView.domEventHandlers({ keydown: correctKeyboardLayoutMismatch }),
        EditorView.lineWrapping,
        state.editorThemeCompartment.of(editorTheme()),
        EditorView.updateListener.of((update) => {
          if (state.suppressEditor) return;
          const doc = activeDoc();
          if (!doc) return;
          if (update.docChanged) {
            doc.content = update.state.doc.toString();
            applyAutoName(doc);
            scheduleRender();
            renderNavigation();
            updateStatus();
            scheduleSessionSave();
          }
          if (update.selectionSet || update.docChanged) {
            doc.cursor = update.state.selection.main.head;
            updateCursorStatus();
          }
        }),
      ],
      selection: { anchor: Math.min(activeDoc()?.cursor || 0, activeDoc()?.content.length || 0) },
    }),
    parent,
  });
}

function correctKeyboardLayoutMismatch(event, view) {
  // Some embedded Chromium hosts forward the German/UK hash key using its
  // US-layout character. Physical-key checks keep normal apostrophes intact.
  if (!isMisplacedHashKey(event)) return false;

  event.preventDefault();
  const selection = view.state.selection.main;
  view.dispatch({
    changes: { from: selection.from, to: selection.to, insert: "#" },
    selection: { anchor: selection.from + 1 },
    userEvent: "input.type",
  });
  return true;
}

function preferredEditorTheme() {
  const preferred = state.preferences.editorTheme || DEFAULT_EDITOR_THEME;
  return EDITOR_THEMES.some((theme) => theme.id === preferred) ? preferred : DEFAULT_EDITOR_THEME;
}

function resolvedEditorTheme() {
  const preferred = preferredEditorTheme();
  if (preferred !== "adaptive") return preferred;
  return resolvedAppTheme() === "dark" ? "studio-dark" : "studio-light";
}

function editorTheme() {
  const palette = EDITOR_THEME_PALETTES[resolvedEditorTheme()] || EDITOR_THEME_PALETTES["studio-light"];
  return [
    EditorView.theme({
      "&.cm-editor": { backgroundColor: palette.bg, color: palette.text },
      ".cm-content": { caretColor: palette.caret },
      ".cm-line": { color: palette.text },
      ".cm-gutters": { backgroundColor: palette.bg, color: palette.faint, borderRightColor: palette.border },
      ".cm-activeLine": { backgroundColor: palette.activeLine },
      ".cm-activeLineGutter": { backgroundColor: palette.activeLine, color: palette.muted },
      ".cm-selectionBackground, .cm-content ::selection": { backgroundColor: `${palette.selection} !important` },
      ".cm-cursor": { borderLeftColor: palette.caret },
      ".cm-matchingBracket": { backgroundColor: palette.matching, color: palette.strong, outline: `1px solid ${palette.border}` },
      ".cm-nonmatchingBracket": { backgroundColor: palette.invalidBg, color: palette.invalid },
      ".cm-foldPlaceholder": { backgroundColor: palette.panelStrong, borderColor: palette.border, color: palette.muted },
      ".cm-searchMatch": { backgroundColor: palette.search, outline: `1px solid ${palette.searchSelected}` },
      ".cm-searchMatch.cm-searchMatch-selected": { backgroundColor: palette.searchSelected },
      ".cm-tooltip": { backgroundColor: `${palette.panel} !important`, color: `${palette.text} !important`, borderColor: `${palette.border} !important` },
      ".cm-tooltip-autocomplete ul li[aria-selected]": { backgroundColor: palette.selection, color: palette.text },
      ".cm-panels": { backgroundColor: palette.panel, color: palette.text, borderColor: palette.border },
      ".cm-textfield": { backgroundColor: `${palette.bg} !important`, color: `${palette.text} !important`, borderColor: `${palette.border} !important` },
      ".cm-button": { backgroundColor: `${palette.panelStrong} !important`, color: `${palette.text} !important`, borderColor: `${palette.border} !important`, backgroundImage: "none !important" },
    }, { dark: palette.dark }),
    syntaxHighlighting(HighlightStyle.define([
      { tag: tags.heading1, color: palette.headingStrong, fontWeight: "700" },
      { tag: [tags.heading2, tags.heading3, tags.heading4, tags.heading5, tags.heading6], color: palette.heading, fontWeight: "700" },
      { tag: tags.link, color: palette.link, textDecoration: "underline", textUnderlineOffset: "2px" },
      { tag: tags.url, color: palette.link },
      { tag: tags.emphasis, color: palette.emphasis, fontStyle: "italic" },
      { tag: tags.strong, color: palette.strong, fontWeight: "700" },
      { tag: tags.strikethrough, color: palette.muted, textDecoration: "line-through" },
      { tag: tags.monospace, color: palette.mono },
      { tag: tags.quote, color: palette.quote, fontStyle: "italic" },
      { tag: tags.list, color: palette.text },
      { tag: [tags.meta, tags.documentMeta, tags.annotation, tags.processingInstruction], color: palette.meta },
      { tag: [tags.keyword, tags.operatorKeyword, tags.definitionKeyword, tags.moduleKeyword, tags.modifier], color: palette.keyword },
      { tag: [tags.atom, tags.bool, tags.number, tags.literal], color: palette.atom },
      { tag: [tags.string, tags.character, tags.regexp], color: palette.string },
      { tag: [tags.escape, tags.color], color: palette.mono },
      { tag: [tags.name, tags.variableName, tags.propertyName, tags.typeName, tags.className, tags.labelName, tags.namespace], color: palette.text },
      { tag: [tags.operator, tags.punctuation, tags.separator, tags.bracket], color: palette.punctuation },
      { tag: tags.contentSeparator, color: palette.punctuation, fontWeight: "700" },
      { tag: tags.comment, color: palette.meta, fontStyle: "italic" },
      { tag: tags.invalid, color: palette.invalid, backgroundColor: palette.invalidBg },
    ])),
  ];
}

function bindCommonEvents() {
  unbindDocumentEvents();
  document.querySelector("#fileInput")?.addEventListener("change", async (event) => {
    await handleFiles([...event.target.files], state.pendingOpenMode);
    event.target.value = "";
  });

  // Capture at the window boundary so dropping remains available over the
  // editor, Reader chrome, sanitized previews, and Mermaid SVG content.
  window.addEventListener("dragenter", onDragEnter, true);
  window.addEventListener("dragover", onDragOver, true);
  window.addEventListener("dragleave", onDragLeave, true);
  window.addEventListener("drop", onDrop, true);

  document.querySelector("#app").addEventListener("click", handleActionClick);
  document.querySelector("#app").addEventListener("keydown", (event) => {
    if (event.target?.id === "welcomeDrop" && ["Enter", " "].includes(event.key)) {
      event.preventDefault();
      openFiles("workspace");
    }
  });

  const commandDialog = document.querySelector("#commandDialog");
  const commandInput = document.querySelector("#commandInput");
  commandInput?.addEventListener("input", () => { state.commandIndex = 0; renderCommandResults(); });
  commandInput?.addEventListener("keydown", handleCommandKeys);
  commandDialog?.addEventListener("click", (event) => {
    const item = event.target.closest("[data-command-id]");
    if (item) runCommand(item.dataset.commandId);
  });
  commandDialog?.addEventListener("close", () => { state.commandIndex = 0; });
  bindDiagramViewerEvents();
}

function bindDiagramViewerEvents() {
  const viewer = document.querySelector("#diagramViewer");
  const stage = document.querySelector("#diagramStage");
  const minimap = document.querySelector("#diagramMinimap");
  if (!viewer || !stage || viewer.dataset.bound) return;
  viewer.dataset.bound = "true";

  viewer.addEventListener("click", (event) => {
    const button = event.target.closest("[data-diagram-action]");
    if (!button) return;
    event.preventDefault();
    const action = button.dataset.diagramAction;
    if (action === "close") closeDiagramViewer();
    else if (action === "fit") fitDiagramToStage();
    else if (action === "zoom-in") zoomDiagram(1.2);
    else if (action === "zoom-out") zoomDiagram(1 / 1.2);
  });

  stage.addEventListener("pointerdown", onDiagramStagePointerDown);
  stage.addEventListener("pointermove", onDiagramStagePointerMove);
  stage.addEventListener("pointerup", onDiagramStagePointerUp);
  stage.addEventListener("pointercancel", onDiagramStagePointerUp);
  stage.addEventListener("wheel", onDiagramWheel, { passive: false });

  minimap?.addEventListener("pointerdown", onDiagramMinimapPointerDown);
  minimap?.addEventListener("pointermove", onDiagramMinimapPointerMove);
  minimap?.addEventListener("pointerup", onDiagramMinimapPointerUp);
  minimap?.addEventListener("pointercancel", onDiagramMinimapPointerUp);
  window.addEventListener("resize", updateDiagramMinimap);
}

function isDiagramViewerOpen() {
  return !document.querySelector("#diagramViewer")?.classList.contains("hidden");
}

function openDiagramViewer(shell, trigger = document.activeElement) {
  const sourceSvg = shell?.querySelector("svg");
  const viewer = document.querySelector("#diagramViewer");
  const canvas = document.querySelector("#diagramCanvas");
  const minimapContent = document.querySelector("#diagramMinimapContent");
  if (!sourceSvg || !viewer || !canvas || !minimapContent) {
    toast("Diagram is still rendering.", "error");
    return;
  }

  const size = svgNaturalSize(sourceSvg);
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const canvasSvg = cloneSvgForViewer(sourceSvg, `viewer-${stamp}`);
  const minimapSvg = cloneSvgForViewer(sourceSvg, `map-${stamp}`);
  canvas.style.width = `${size.width}px`;
  canvas.style.height = `${size.height}px`;
  canvas.replaceChildren(canvasSvg);
  minimapContent.style.width = `${size.width}px`;
  minimapContent.style.height = `${size.height}px`;
  minimapContent.replaceChildren(minimapSvg);

  Object.assign(state.diagramViewer, {
    scale: 1,
    x: 0,
    y: 0,
    width: size.width,
    height: size.height,
    trigger,
    drag: null,
    minimapDrag: false,
  });

  viewer.classList.remove("hidden");
  document.body.classList.add("diagram-viewer-open");
  document.querySelector("#diagramStage")?.focus();
  requestAnimationFrame(fitDiagramToStage);
}

function closeDiagramViewer() {
  if (!isDiagramViewerOpen()) return;
  document.querySelector("#diagramViewer")?.classList.add("hidden");
  document.body.classList.remove("diagram-viewer-open");
  document.querySelector("#diagramCanvas")?.replaceChildren();
  document.querySelector("#diagramMinimapContent")?.replaceChildren();
  const trigger = state.diagramViewer.trigger;
  Object.assign(state.diagramViewer, { drag: null, minimapDrag: false, trigger: null });
  if (trigger?.isConnected) trigger.focus();
}

function cloneSvgForViewer(sourceSvg, suffix) {
  const clone = sourceSvg.cloneNode(true);
  uniquifySvgIds(clone, suffix);
  clone.removeAttribute("width");
  clone.removeAttribute("height");
  clone.style.width = "100%";
  clone.style.height = "100%";
  clone.style.maxWidth = "none";
  clone.style.display = "block";
  return clone;
}

function svgNaturalSize(svg) {
  const viewBox = parseSvgViewBox(svg);
  const width = parseSvgLength(svg.getAttribute("width")) || viewBox?.width || 960;
  const height = parseSvgLength(svg.getAttribute("height")) || viewBox?.height || 640;
  return { width: Math.max(1, width), height: Math.max(1, height) };
}

function parseSvgViewBox(svg) {
  const values = (svg.getAttribute("viewBox") || "").trim().split(/[,\s]+/).map(Number);
  if (values.length !== 4 || values.some((value) => !Number.isFinite(value))) return null;
  return { x: values[0], y: values[1], width: Math.abs(values[2]), height: Math.abs(values[3]) };
}

function parseSvgLength(value) {
  if (!value || value.includes("%")) return 0;
  const match = /^([\d.]+)/.exec(value);
  return match ? Number(match[1]) : 0;
}

function uniquifySvgIds(svg, suffix) {
  const replacements = new Map();
  svg.querySelectorAll("[id]").forEach((node) => {
    const next = `${node.id}-${suffix}`;
    replacements.set(node.id, next);
    node.id = next;
  });
  if (!replacements.size) return;

  const referenceAttrs = ["href", "xlink:href", "fill", "stroke", "filter", "clip-path", "mask", "marker-start", "marker-mid", "marker-end", "style"];
  svg.querySelectorAll("*").forEach((node) => {
    referenceAttrs.forEach((attr) => {
      const value = node.getAttribute(attr);
      if (value) node.setAttribute(attr, replaceSvgIdReferences(value, replacements));
    });
  });
  svg.querySelectorAll("style").forEach((node) => {
    node.textContent = replaceSvgIdReferences(node.textContent || "", replacements);
  });
}

function replaceSvgIdReferences(value, replacements) {
  let result = value;
  replacements.forEach((next, previous) => {
    const escaped = escapeRegExp(previous);
    result = result
      .replace(new RegExp(`url\\(#${escaped}\\)`, "g"), `url(#${next})`)
      .replace(new RegExp(`(["'])#${escaped}\\1`, "g"), `$1#${next}$1`)
      .replace(new RegExp(`(^|\\s)#${escaped}(?=\\s|$)`, "g"), `$1#${next}`);
  });
  return result;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function fitDiagramToStage() {
  const stage = document.querySelector("#diagramStage");
  if (!stage || !isDiagramViewerOpen()) return;
  const viewer = state.diagramViewer;
  const availableWidth = Math.max(1, stage.clientWidth - 72);
  const availableHeight = Math.max(1, stage.clientHeight - 72);
  viewer.scale = clamp(Math.min(availableWidth / viewer.width, availableHeight / viewer.height), 0.08, 4);
  viewer.x = (stage.clientWidth - viewer.width * viewer.scale) / 2;
  viewer.y = (stage.clientHeight - viewer.height * viewer.scale) / 2;
  applyDiagramTransform();
}

function zoomDiagram(factor, point = null) {
  const stage = document.querySelector("#diagramStage");
  if (!stage || !isDiagramViewerOpen()) return;
  const rect = stage.getBoundingClientRect();
  const viewer = state.diagramViewer;
  const originX = point?.clientX ?? rect.left + rect.width / 2;
  const originY = point?.clientY ?? rect.top + rect.height / 2;
  const localX = originX - rect.left;
  const localY = originY - rect.top;
  const contentX = (localX - viewer.x) / viewer.scale;
  const contentY = (localY - viewer.y) / viewer.scale;
  const nextScale = clamp(viewer.scale * factor, 0.08, 8);
  viewer.x = localX - contentX * nextScale;
  viewer.y = localY - contentY * nextScale;
  viewer.scale = nextScale;
  applyDiagramTransform();
}

function applyDiagramTransform() {
  const canvas = document.querySelector("#diagramCanvas");
  const zoomLevel = document.querySelector("#diagramZoomLevel");
  const viewer = state.diagramViewer;
  if (!canvas) return;
  canvas.style.transform = `translate(${viewer.x}px, ${viewer.y}px) scale(${viewer.scale})`;
  if (zoomLevel) zoomLevel.textContent = `${Math.round(viewer.scale * 100)}%`;
  updateDiagramMinimap();
}

function onDiagramWheel(event) {
  if (!isDiagramViewerOpen()) return;
  event.preventDefault();
  zoomDiagram(event.deltaY < 0 ? 1.12 : 1 / 1.12, event);
}

function onDiagramStagePointerDown(event) {
  if (!isDiagramViewerOpen() || event.button !== 0) return;
  const viewer = state.diagramViewer;
  viewer.drag = { id: event.pointerId, startX: event.clientX, startY: event.clientY, x: viewer.x, y: viewer.y };
  event.currentTarget.setPointerCapture(event.pointerId);
  event.currentTarget.classList.add("dragging");
}

function onDiagramStagePointerMove(event) {
  const drag = state.diagramViewer.drag;
  if (!drag || drag.id !== event.pointerId) return;
  state.diagramViewer.x = drag.x + event.clientX - drag.startX;
  state.diagramViewer.y = drag.y + event.clientY - drag.startY;
  applyDiagramTransform();
}

function onDiagramStagePointerUp(event) {
  const stage = event.currentTarget;
  if (stage.hasPointerCapture?.(event.pointerId)) stage.releasePointerCapture(event.pointerId);
  state.diagramViewer.drag = null;
  stage.classList.remove("dragging");
}

function minimapGeometry() {
  const minimap = document.querySelector("#diagramMinimap");
  const rect = minimap?.getBoundingClientRect();
  if (!rect?.width || !rect?.height) return null;
  const viewer = state.diagramViewer;
  const scale = Math.min((rect.width - 14) / viewer.width, (rect.height - 14) / viewer.height);
  const width = viewer.width * scale;
  const height = viewer.height * scale;
  return { rect, scale, offsetX: (rect.width - width) / 2, offsetY: (rect.height - height) / 2 };
}

function updateDiagramMinimap() {
  const stage = document.querySelector("#diagramStage");
  const content = document.querySelector("#diagramMinimapContent");
  const viewport = document.querySelector("#diagramMinimapViewport");
  if (!stage || !content || !viewport || !isDiagramViewerOpen()) return;
  const geometry = minimapGeometry();
  if (!geometry) return;
  const viewer = state.diagramViewer;
  content.style.transform = `translate(${geometry.offsetX}px, ${geometry.offsetY}px) scale(${geometry.scale})`;

  const visibleLeft = -viewer.x / viewer.scale;
  const visibleTop = -viewer.y / viewer.scale;
  const visibleRight = visibleLeft + stage.clientWidth / viewer.scale;
  const visibleBottom = visibleTop + stage.clientHeight / viewer.scale;
  const left = clamp(geometry.offsetX + visibleLeft * geometry.scale, 2, geometry.rect.width - 2);
  const top = clamp(geometry.offsetY + visibleTop * geometry.scale, 2, geometry.rect.height - 2);
  const right = clamp(geometry.offsetX + visibleRight * geometry.scale, 2, geometry.rect.width - 2);
  const bottom = clamp(geometry.offsetY + visibleBottom * geometry.scale, 2, geometry.rect.height - 2);
  viewport.style.left = `${left}px`;
  viewport.style.top = `${top}px`;
  viewport.style.width = `${Math.max(8, right - left)}px`;
  viewport.style.height = `${Math.max(8, bottom - top)}px`;
}

function onDiagramMinimapPointerDown(event) {
  if (!isDiagramViewerOpen()) return;
  state.diagramViewer.minimapDrag = true;
  event.currentTarget.setPointerCapture(event.pointerId);
  centerDiagramFromMinimap(event);
}

function onDiagramMinimapPointerMove(event) {
  if (!state.diagramViewer.minimapDrag) return;
  centerDiagramFromMinimap(event);
}

function onDiagramMinimapPointerUp(event) {
  if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  state.diagramViewer.minimapDrag = false;
}

function centerDiagramFromMinimap(event) {
  const stage = document.querySelector("#diagramStage");
  const geometry = minimapGeometry();
  if (!stage || !geometry) return;
  event.preventDefault();
  const viewer = state.diagramViewer;
  const contentX = clamp((event.clientX - geometry.rect.left - geometry.offsetX) / geometry.scale, 0, viewer.width);
  const contentY = clamp((event.clientY - geometry.rect.top - geometry.offsetY) / geometry.scale, 0, viewer.height);
  viewer.x = stage.clientWidth / 2 - contentX * viewer.scale;
  viewer.y = stage.clientHeight / 2 - contentY * viewer.scale;
  applyDiagramTransform();
}

function handleDiagramViewerKeydown(event) {
  if (event.key === "Escape") {
    event.preventDefault();
    closeDiagramViewer();
  } else if (event.key === "+" || event.key === "=") {
    event.preventDefault();
    zoomDiagram(1.2);
  } else if (event.key === "-" || event.key === "_") {
    event.preventDefault();
    zoomDiagram(1 / 1.2);
  } else if (event.key === "0") {
    event.preventDefault();
    fitDiagramToStage();
  }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function unbindDocumentEvents() {
  window.removeEventListener("dragenter", onDragEnter, true);
  window.removeEventListener("dragover", onDragOver, true);
  window.removeEventListener("dragleave", onDragLeave, true);
  window.removeEventListener("drop", onDrop, true);
}

function bindShellEvents() {
  document.querySelector("#previewPane")?.addEventListener("click", onRenderedClick);
  document.querySelector("#readerContent")?.addEventListener("click", onRenderedClick);
  document.querySelector("#readerSurface")?.addEventListener("scroll", onReaderScroll, { passive: true });
  document.querySelector("#documentList")?.addEventListener("click", onDocumentListClick);
  document.querySelector("#documentList")?.addEventListener("dblclick", onDocumentListDblClick);
  document.querySelector("#docRailActions")?.addEventListener("click", onDocumentListClick);
  document.querySelector("#docOverflowMenu")?.addEventListener("click", onDocumentListClick);
  document.querySelector("#archiveList")?.addEventListener("click", onDocumentListClick);
  document.querySelector("#outlineList")?.addEventListener("click", onOutlineClick);
  document.querySelector("#outlineList")?.addEventListener("dblclick", onDocumentListDblClick);
  document.querySelector("#readerOutline")?.addEventListener("click", onOutlineClick);
  document.querySelector("#readerOutline")?.addEventListener("dblclick", onDocumentListDblClick);
  document.querySelector("#readerTitle")?.addEventListener("dblclick", onReaderTitleDblClick);
  document.addEventListener("click", onDocumentMenuDismiss, true);
  document.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => setViewMode(button.dataset.view)));
  document.querySelector("#themeGrid")?.addEventListener("click", (event) => {
    const card = event.target.closest("[data-theme-preset]");
    if (card) selectDocumentTheme(card.dataset.themePreset);
  });
  document.querySelector("#editorThemeGrid")?.addEventListener("click", (event) => {
    const card = event.target.closest("[data-code-editor-theme]");
    if (card) selectEditorTheme(card.dataset.codeEditorTheme);
  });
  bindThemeControls();
  bindSplitter();
}

async function handleActionClick(event) {
  const action = event.target.closest("[data-action]")?.dataset.action;
  if (!action) return;
  const actions = {
    "open-workspace": () => openFiles("workspace"),
    "open-reader": () => openFiles("reader"),
    open: () => openFiles("workspace"),
    new: newDocument,
    sample: openSample,
    save: () => saveDocument(activeDoc()),
    reader: () => setMode("reader"),
    workspace: () => setMode("workspace"),
    theme: openThemeDrawer,
    "close-theme": closeThemeDrawer,
    "toggle-sidebar": toggleSidebar,
    "toggle-archive": toggleArchiveSection,
    "doc-menu": toggleDocOverflowMenu,
    commands: openCommandPalette,
    "reader-outline": toggleReaderOutline,
    print: () => window.print(),
    "reset-theme": resetThemeCustomizations,
  };
  await actions[action]?.();
}

function otherDocumentNames(doc) {
  return state.docs.filter((item) => item.id !== doc?.id).map((item) => item.name);
}

function applyAutoName(doc) {
  if (!doc || doc.nameCustomized) return false;
  const heading = extractPrimaryHeading(doc.content);
  if (!heading) return false;
  const nextName = headingToFilename(heading, otherDocumentNames(doc));
  if (doc.name === nextName) return false;
  doc.name = nextName;
  return true;
}

function uniqueDocumentName(name, doc) {
  const taken = new Set(otherDocumentNames(doc).map((item) => item.toLowerCase()));
  let candidate = normalizeDocumentName(name);
  let index = 2;
  const base = candidate.replace(/\.md$/i, "");
  while (taken.has(candidate.toLowerCase())) {
    candidate = `${base} ${index}.md`;
    index += 1;
  }
  return candidate;
}

function commitDocumentRename(doc, rawName, { customized = true } = {}) {
  if (!doc) return;
  doc.name = uniqueDocumentName(rawName, doc);
  if (customized) doc.nameCustomized = true;
  renderNavigation();
  updateReaderTitle();
  updateStatus();
  scheduleSessionSave();
}

function updateReaderTitle() {
  const title = document.querySelector("#readerTitle");
  if (title && !title.querySelector("input")) title.textContent = activeDoc()?.name || "";
}

function startInlineRename({ element, value, className, onCommit, onCancel }) {
  if (!element || element.querySelector("input")) return;
  const input = document.createElement("input");
  input.type = "text";
  input.className = className;
  input.value = value;
  input.setAttribute("aria-label", "Rename");
  const finish = (commit) => {
    const next = input.value;
    input.remove();
    element.hidden = false;
    if (commit) onCommit?.(next);
    else onCancel?.();
  };
  element.hidden = true;
  element.after(input);
  input.focus();
  input.select();
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") { event.preventDefault(); finish(true); }
    if (event.key === "Escape") { event.preventDefault(); finish(false); }
  });
  input.addEventListener("blur", () => finish(true), { once: true });
}

function clearDocSelection() {
  state.selectedDocIds.clear();
  state.selectionAnchorId = null;
  renderDocRailActions();
}

function toggleDocSelection(id, { range = false, additive = false } = {}) {
  if (!state.docs.some((doc) => doc.id === id)) return;
  if (range && state.selectionAnchorId) {
    const ids = state.docs.map((doc) => doc.id);
    const start = ids.indexOf(state.selectionAnchorId);
    const end = ids.indexOf(id);
    if (start !== -1 && end !== -1) {
      const [from, to] = start < end ? [start, end] : [end, start];
      if (!additive) state.selectedDocIds.clear();
      ids.slice(from, to + 1).forEach((docId) => state.selectedDocIds.add(docId));
    }
  } else if (additive || state.selectedDocIds.size) {
    if (state.selectedDocIds.has(id)) state.selectedDocIds.delete(id);
    else state.selectedDocIds.add(id);
    state.selectionAnchorId = id;
  } else {
    state.selectedDocIds.clear();
    state.selectionAnchorId = id;
  }
  renderDocRailActions();
  renderDocumentList();
}

function selectedDocuments() {
  return state.docs.filter((doc) => state.selectedDocIds.has(doc.id));
}

function renderDocRailActions() {
  const bar = document.querySelector("#docRailActions");
  if (!bar) return;
  const count = state.selectedDocIds.size;
  if (!count) {
    bar.classList.add("hidden");
    bar.innerHTML = "";
    return;
  }
  bar.classList.remove("hidden");
  bar.innerHTML = `
    <span class="doc-rail-count">${count} selected</span>
    <button class="btn btn-quiet btn-sm" type="button" data-bulk-action="download">${icon("download", "icon-sm")} Download</button>
    <button class="btn btn-quiet btn-sm" type="button" data-bulk-action="archive">${icon("folder", "icon-sm")} Archive</button>
    <button class="btn btn-quiet btn-sm" type="button" data-bulk-action="close">${icon("x", "icon-sm")} Close</button>`;
}

function renderDocumentList() {
  const selectionMode = state.selectedDocIds.size > 0;
  const docsHtml = state.docs.map((doc) => `
    <div class="doc-item ${doc.id === state.activeId ? "active" : ""} ${state.selectedDocIds.has(doc.id) ? "selected" : ""}" data-doc-id="${doc.id}">
      <input class="doc-select ${selectionMode ? "visible" : ""}" type="checkbox" data-select-checkbox="${doc.id}" ${state.selectedDocIds.has(doc.id) ? "checked" : ""} aria-label="Select ${escapeHtml(doc.name)}" />
      ${icon("file", "icon-sm doc-icon")}
      <button class="doc-name" type="button" data-select-doc="${doc.id}" title="${escapeHtml(doc.name)}">${escapeHtml(doc.name)}</button>
      ${isDirty(doc) ? '<span class="dirty-dot" aria-label="Unsaved changes"></span>' : ""}
      <button class="doc-close" type="button" data-close-doc="${doc.id}" aria-label="Close ${escapeHtml(doc.name)}">${icon("x", "icon-sm")}</button>
    </div>`).join("");
  document.querySelector("#documentList").innerHTML = docsHtml || '<div class="outline-empty">Open or create a document to begin.</div>';
}

function renderArchiveList() {
  const list = document.querySelector("#archiveList");
  const count = document.querySelector("#archiveCount");
  const toggle = document.querySelector("[data-action='toggle-archive']");
  if (count) count.textContent = state.archivedDocs.length ? `(${state.archivedDocs.length})` : "";
  if (toggle) toggle.setAttribute("aria-expanded", String(state.archiveExpanded));
  if (!list) return;
  list.classList.toggle("hidden", !state.archiveExpanded || !state.archivedDocs.length);
  if (!state.archivedDocs.length) {
    list.innerHTML = "";
    return;
  }
  list.innerHTML = state.archivedDocs.map((doc) => `
    <div class="archive-item" data-archive-id="${doc.id}">
      ${icon("file", "icon-sm doc-icon")}
      <button class="archive-name" type="button" data-restore-archive="${doc.id}" title="${escapeHtml(doc.name)}">${escapeHtml(doc.name)}</button>
      <button class="btn btn-quiet icon-btn btn-sm archive-download" type="button" data-download-archive="${doc.id}" aria-label="Download ${escapeHtml(doc.name)}">${icon("download", "icon-sm")}</button>
      <button class="btn btn-quiet icon-btn btn-sm archive-delete" type="button" data-delete-archive="${doc.id}" aria-label="Delete ${escapeHtml(doc.name)} permanently">${icon("trash", "icon-sm")}</button>
    </div>`).join("");
}

function renderNavigation() {
  if (state.surface !== "shell") return;
  renderDocumentList();
  renderDocRailActions();
  renderArchiveList();
  renderOutline();
}

function extractOutline(content) {
  return extractOutlineEntries(content);
}

function renderOutline() {
  const doc = activeDoc();
  const outline = doc ? extractOutline(doc.content) : [];
  const html = outline.length ? outline.map((entry) => `<button class="outline-link level-${entry.level}" type="button" data-heading-id="${escapeHtml(entry.id)}" data-heading-line="${entry.lineIndex}" title="${escapeHtml(entry.text)}">${escapeHtml(entry.text)}</button>`).join("") : '<div class="outline-empty">Add headings to build a navigable outline.</div>';
  const sidebar = document.querySelector("#outlineList");
  const reader = document.querySelector("#readerOutline");
  if (sidebar) sidebar.innerHTML = html;
  if (reader) reader.innerHTML = `<div class="section-heading"><span>Outline</span><button class="btn btn-quiet icon-btn btn-sm" type="button" data-action="reader-outline" aria-label="Close outline">${icon("x", "icon-sm")}</button></div>${html}`;
  const count = document.querySelector("#outlineCount");
  if (count) count.textContent = outline.length || "";
}

function applyDocumentContent(doc, content) {
  if (!doc) return;
  doc.content = content;
  applyAutoName(doc);
  scheduleRender();
  renderNavigation();
  updateStatus();
  scheduleSessionSave();
  if (doc.id === state.activeId && state.editor) {
    state.suppressEditor = true;
    state.editor.dispatch({
      changes: { from: 0, to: state.editor.state.doc.length, insert: content },
      selection: { anchor: Math.min(doc.cursor || 0, content.length) },
    });
    state.suppressEditor = false;
  }
}

function onDocumentListClick(event) {
  const close = event.target.closest("[data-close-doc]");
  const checkbox = event.target.closest("[data-select-checkbox]");
  const select = event.target.closest("[data-select-doc]");
  const bulk = event.target.closest("[data-bulk-action]");
  const restore = event.target.closest("[data-restore-archive]");
  const downloadArchive = event.target.closest("[data-download-archive]");
  const deleteArchive = event.target.closest("[data-delete-archive]");
  const overflow = event.target.closest("[data-doc-overflow]");

  if (bulk) {
    event.preventDefault();
    if (bulk.dataset.bulkAction === "download") bulkDownloadDocuments(selectedDocuments());
    else if (bulk.dataset.bulkAction === "archive") archiveDocuments(selectedDocuments().map((doc) => doc.id));
    else if (bulk.dataset.bulkAction === "close") bulkCloseDocuments(selectedDocuments().map((doc) => doc.id));
    return;
  }
  if (overflow) {
    event.preventDefault();
    closeDocOverflowMenu();
    runDocOverflowAction(overflow.dataset.docOverflow);
    return;
  }
  if (restore) { event.preventDefault(); restoreArchivedDocument(restore.dataset.restoreArchive); return; }
  if (downloadArchive) { event.preventDefault(); downloadArchivedDocument(downloadArchive.dataset.downloadArchive); return; }
  if (deleteArchive) { event.preventDefault(); deleteArchivedDocument(deleteArchive.dataset.deleteArchive); return; }
  if (close) { event.preventDefault(); closeDocument(close.dataset.closeDoc); return; }
  if (checkbox) {
    event.stopPropagation();
    toggleDocSelection(checkbox.dataset.selectCheckbox, { additive: true });
    return;
  }
  if (!select) return;
  const id = select.dataset.selectDoc;
  if (event.shiftKey) toggleDocSelection(id, { range: true, additive: event.ctrlKey || event.metaKey });
  else if (event.ctrlKey || event.metaKey) toggleDocSelection(id, { additive: true });
  else {
    clearDocSelection();
    selectDocument(id);
  }
}

function onDocumentListDblClick(event) {
  const nameButton = event.target.closest(".doc-name");
  if (nameButton) {
    event.preventDefault();
    const doc = state.docs.find((item) => item.id === nameButton.dataset.selectDoc);
    if (!doc) return;
    startInlineRename({
      element: nameButton,
      value: doc.name.replace(/\.md$/i, ""),
      className: "doc-rename-input",
      onCommit: (value) => commitDocumentRename(doc, value),
    });
    return;
  }
  const outlineLink = event.target.closest(".outline-link");
  if (outlineLink) {
    event.preventDefault();
    const doc = activeDoc();
    if (!doc) return;
    const lineIndex = Number(outlineLink.dataset.headingLine);
    startInlineRename({
      element: outlineLink,
      value: outlineLink.textContent,
      className: `outline-rename-input level-${outlineLink.className.match(/level-(\d)/)?.[1] || "1"}`,
      onCommit: (value) => {
        const next = renameHeadingInContent(doc.content, lineIndex, value);
        if (next !== doc.content) applyDocumentContent(doc, next);
      },
    });
  }
}

function onReaderTitleDblClick(event) {
  const doc = activeDoc();
  if (!doc || event.target.closest("input")) return;
  const title = document.querySelector("#readerTitle");
  startInlineRename({
    element: title,
    value: doc.name.replace(/\.md$/i, ""),
    className: "doc-rename-input reader-rename-input",
    onCommit: (value) => commitDocumentRename(doc, value),
    onCancel: updateReaderTitle,
  });
}

function onOutlineClick(event) {
  if (event.target.closest("input")) return;
  const link = event.target.closest("[data-heading-id]");
  if (!link) return;
  const surface = state.mode === "reader" ? document.querySelector("#readerContent") : document.querySelector("#previewContent");
  surface?.querySelector(`#${CSS.escape(link.dataset.headingId)}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  if (state.mode === "reader") document.querySelector("#readerOutline")?.classList.add("hidden");
}

function updateAll() {
  renderNavigation();
  updateEditorDocument();
  renderActiveDocument();
  updateStatus();
  updateViewModeUI();
  applyAppearance();
}

function updateEditorDocument() {
  if (!state.editor) return;
  const doc = activeDoc();
  const content = doc?.content || "";
  state.suppressEditor = true;
  state.editor.dispatch({
    changes: { from: 0, to: state.editor.state.doc.length, insert: content },
    selection: { anchor: Math.min(doc?.cursor || 0, content.length) },
  });
  state.suppressEditor = false;
  requestAnimationFrame(() => state.editor?.focus());
}

function scheduleRender() {
  clearTimeout(state.renderTimer);
  state.renderTimer = setTimeout(renderActiveDocument, 180);
}

function renderActiveDocument() {
  const doc = activeDoc();
  if (!doc || state.surface !== "shell") return;
  const preview = document.querySelector("#previewContent");
  const reader = document.querySelector("#readerContent");
  renderInto(preview, doc.content);
  if (state.mode === "reader") renderInto(reader, doc.content);
  const title = document.querySelector("#readerTitle");
  if (title && !title.querySelector("input")) title.textContent = doc.name;
}

function selectDocument(id) {
  if (!state.docs.some((doc) => doc.id === id)) return;
  const current = activeDoc();
  if (current && state.editor) current.cursor = state.editor.state.selection.main.head;
  state.activeId = id;
  state.selectionAnchorId = id;
  updateAll();
  if (matchMedia("(max-width: 760px)").matches) document.querySelector("#workspaceGrid")?.classList.add("sidebar-hidden");
  scheduleSessionSave();
}

function newDocument() {
  const existing = new Set(state.docs.map((doc) => doc.name));
  let index = 1;
  let name = "Untitled.md";
  while (existing.has(name)) name = `Untitled ${++index}.md`;
  const doc = makeDocument(name, "", { savedContent: "__new__", nameCustomized: false });
  state.docs.push(doc);
  state.activeId = doc.id;
  if (state.surface === "welcome") showShell("workspace");
  else { setMode("workspace"); updateAll(); }
  scheduleSessionSave();
}

function openSample() {
  const doc = makeDocument("Welcome.md", SAMPLE, { nameCustomized: true });
  state.docs.push(doc);
  state.activeId = doc.id;
  showShell("workspace");
  scheduleSessionSave();
}

async function openFiles(mode = "workspace") {
  state.pendingOpenMode = mode;
  if ("showOpenFilePicker" in window) {
    try {
      const handles = await window.showOpenFilePicker({
        multiple: true,
        types: [{ description: "Markdown documents", accept: { "text/markdown": [".md", ".markdown", ".mdown", ".mkd"], "text/plain": [".txt"] } }],
      });
      const files = await Promise.all(handles.map((handle) => handle.getFile()));
      await handleFiles(files, mode, handles);
      return;
    } catch (error) {
      if (error?.name === "AbortError") return;
    }
  }
  document.querySelector("#fileInput")?.click();
}

async function handleFiles(files, mode = "workspace", handles = []) {
  const accepted = files.filter((file) => /\.(md|markdown|mdown|mkd|txt)$/i.test(file.name) || ["text/markdown", "text/plain"].includes(file.type));
  if (!accepted.length) {
    toast("No supported Markdown or text files found.", "error");
    return;
  }
  const opened = await Promise.all(accepted.map(async (file, index) => {
    const content = await file.text();
    return makeDocument(file.name, content, { handle: handles[index] || null, lastModified: file.lastModified, nameCustomized: true });
  }));
  state.docs.push(...opened);
  state.activeId = opened[0].id;
  if (state.surface === "welcome") showShell(mode);
  else { updateAll(); setMode(mode); }
  const destination = mode === "reader" ? " in Reader mode" : "";
  toast(`Opened ${opened.length} ${opened.length === 1 ? "document" : "documents"}${destination}.`);
  scheduleSessionSave();
}

async function saveDocument(doc) {
  if (!doc) return false;
  if (doc.handle?.createWritable) {
    try {
      let permission = await doc.handle.queryPermission?.({ mode: "readwrite" });
      if (permission !== "granted") permission = await doc.handle.requestPermission?.({ mode: "readwrite" });
      if (permission === "granted" || permission === undefined) {
        const writable = await doc.handle.createWritable();
        await writable.write(doc.content);
        await writable.close();
        doc.savedContent = doc.content;
        updateStatus();
        renderNavigation();
        scheduleSessionSave();
        toast(`Saved ${doc.name}`);
        return true;
      }
    } catch (error) {
      toast(`Could not write directly: ${error.message}`, "error");
    }
  }
  downloadText(doc.name, doc.content, "text/markdown;charset=utf-8");
  doc.savedContent = doc.content;
  updateStatus();
  renderNavigation();
  scheduleSessionSave();
  toast(`Downloaded ${doc.name}`);
  return true;
}

function downloadText(name, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function toggleArchiveSection() {
  state.archiveExpanded = !state.archiveExpanded;
  renderArchiveList();
}

function toggleDocOverflowMenu() {
  const menu = document.querySelector("#docOverflowMenu");
  if (!menu) return;
  state.docMenuOpen = !state.docMenuOpen;
  if (!state.docMenuOpen) {
    menu.classList.add("hidden");
    document.querySelector("[data-action='doc-menu']")?.setAttribute("aria-expanded", "false");
    return;
  }
  const selectedCount = state.selectedDocIds.size;
  const items = [
    ...(selectedCount ? [{ id: "close-selected", label: `Close selected (${selectedCount})` }] : []),
    { id: "close-others", label: "Close others" },
    { id: "close-all", label: "Close all" },
    { id: "download-all", label: "Download all" },
    { id: "archive-selected", label: selectedCount ? `Archive selected (${selectedCount})` : "Archive all" },
  ];
  menu.innerHTML = items.map((item) => `<button class="doc-overflow-item" type="button" role="menuitem" data-doc-overflow="${item.id}">${escapeHtml(item.label)}</button>`).join("");
  menu.classList.remove("hidden");
  document.querySelector("[data-action='doc-menu']")?.setAttribute("aria-expanded", "true");
}

function closeDocOverflowMenu() {
  state.docMenuOpen = false;
  document.querySelector("#docOverflowMenu")?.classList.add("hidden");
  document.querySelector("[data-action='doc-menu']")?.setAttribute("aria-expanded", "false");
}

function onDocumentMenuDismiss(event) {
  if (!state.docMenuOpen) return;
  if (event.target.closest("#docOverflowMenu, [data-action='doc-menu']")) return;
  closeDocOverflowMenu();
}

function runDocOverflowAction(action) {
  const active = state.activeId;
  if (action === "close-selected") bulkCloseDocuments([...state.selectedDocIds]);
  else if (action === "close-others") bulkCloseDocuments(state.docs.filter((doc) => doc.id !== active).map((doc) => doc.id));
  else if (action === "close-all") bulkCloseDocuments(state.docs.map((doc) => doc.id));
  else if (action === "download-all") bulkDownloadDocuments(state.docs);
  else if (action === "archive-selected") archiveDocuments(state.selectedDocIds.size ? [...state.selectedDocIds] : state.docs.map((doc) => doc.id));
}

function bulkDownloadDocuments(docs) {
  docs.forEach((doc) => downloadText(doc.name, doc.content, "text/markdown;charset=utf-8"));
  if (docs.length) toast(`Downloaded ${docs.length} ${docs.length === 1 ? "document" : "documents"}.`);
}

async function bulkCloseDocuments(ids) {
  for (const id of [...ids]) {
    if (!state.docs.some((doc) => doc.id === id)) continue;
    // eslint-disable-next-line no-await-in-loop
    await closeDocument(id, { allowWelcome: false });
  }
  if (!state.docs.length) showWelcome();
  else updateAll();
  clearDocSelection();
  scheduleSessionSave();
}

function archiveDocuments(ids) {
  const uniqueIds = [...new Set(ids)];
  const docs = uniqueIds.map((id) => state.docs.find((doc) => doc.id === id)).filter(Boolean);
  if (!docs.length) return;
  docs.forEach((doc) => {
    const { handle, ...snapshot } = doc;
    state.archivedDocs.unshift({ ...snapshot, archivedAt: new Date().toISOString() });
    const index = state.docs.indexOf(doc);
    state.docs.splice(index, 1);
    if (state.activeId === doc.id) state.activeId = state.docs[Math.min(index, state.docs.length - 1)]?.id || null;
  });
  state.archiveExpanded = true;
  clearDocSelection();
  if (!state.docs.length) showWelcome();
  else updateAll();
  scheduleArchiveSave();
  scheduleSessionSave();
  toast(`Archived ${docs.length} ${docs.length === 1 ? "document" : "documents"}.`);
}

function restoreArchivedDocument(id) {
  const index = state.archivedDocs.findIndex((doc) => doc.id === id);
  if (index === -1) return;
  const [archived] = state.archivedDocs.splice(index, 1);
  const restored = makeDocument(archived.name, archived.content, {
    id: archived.id,
    savedContent: archived.savedContent,
    cursor: archived.cursor || 0,
    nameCustomized: archived.nameCustomized ?? !isAutoNameCandidate(archived.name),
    handle: null,
  });
  state.docs.push(restored);
  state.activeId = restored.id;
  if (state.surface === "welcome") showShell("workspace");
  else updateAll();
  scheduleArchiveSave();
  scheduleSessionSave();
  toast(`Restored ${restored.name}`);
}

function downloadArchivedDocument(id) {
  const doc = state.archivedDocs.find((item) => item.id === id);
  if (!doc) return;
  downloadText(doc.name, doc.content, "text/markdown;charset=utf-8");
  toast(`Downloaded ${doc.name}`);
}

function deleteArchivedDocument(id) {
  const doc = state.archivedDocs.find((item) => item.id === id);
  if (!doc) return;
  state.archivedDocs = state.archivedDocs.filter((item) => item.id !== id);
  renderArchiveList();
  scheduleArchiveSave();
  toast(`Deleted ${doc.name} from archive.`);
}

async function closeDocument(id, { allowWelcome = true } = {}) {
  const doc = state.docs.find((item) => item.id === id);
  if (!doc) return;
  if (isDirty(doc)) {
    const choice = await confirmChoice({
      title: `Save changes to ${doc.name}?`,
      message: "Your recovery copy remains local until you deliberately discard it.",
      choices: [
        { id: "cancel", label: "Cancel" },
        { id: "discard", label: "Discard", className: "btn-danger" },
        { id: "save", label: "Save", className: "btn-primary" },
      ],
    });
    if (!choice || choice === "cancel") return;
    if (choice === "save" && !(await saveDocument(doc))) return;
  }
  const index = state.docs.indexOf(doc);
  state.docs.splice(index, 1);
  if (state.activeId === id) state.activeId = state.docs[Math.min(index, state.docs.length - 1)]?.id || null;
  if (!state.docs.length && allowWelcome) showWelcome();
  else updateAll();
  scheduleSessionSave();
}

function setMode(mode) {
  if (state.surface !== "shell") return;
  state.mode = mode;
  document.querySelector(".shell")?.classList.toggle("reader-mode", mode === "reader");
  const workspace = document.querySelector("#workspaceSurface");
  const reader = document.querySelector("#readerSurface");
  const sidebar = document.querySelector("#workspaceGrid");
  if (mode === "reader") {
    workspace.classList.add("hidden");
    reader.classList.remove("hidden");
    sidebar.classList.add("sidebar-hidden");
    renderInto(document.querySelector("#readerContent"), activeDoc()?.content || "");
    updateReaderTitle();
    document.querySelector("#readerSurface").scrollTop = 0;
  } else {
    reader.classList.add("hidden");
    workspace.classList.remove("hidden");
    const narrow = matchMedia("(max-width: 760px)").matches;
    sidebar.classList.toggle("sidebar-hidden", narrow || !state.preferences.sidebar);
    requestAnimationFrame(() => state.editor?.requestMeasure());
  }
  refreshWideTableLayouts();
}

function setViewMode(mode) {
  state.preferences.viewMode = mode;
  savePreferences();
  updateViewModeUI();
}

function updateViewModeUI() {
  const mode = state.preferences.viewMode;
  const stage = document.querySelector("#editorStage");
  if (stage) stage.dataset.view = mode;
  document.querySelectorAll("[data-view]").forEach((button) => {
    const mobileSplitDefault = mode === "split" && button.closest(".mobile-view-switch") && button.dataset.view === "edit";
    button.classList.toggle("active", button.dataset.view === mode || mobileSplitDefault);
  });
  if (mode !== "edit") renderActiveDocument();
  requestAnimationFrame(() => state.editor?.requestMeasure());
  refreshWideTableLayouts();
}

function toggleSidebar() {
  if (state.mode === "reader") return toggleReaderOutline();
  const grid = document.querySelector("#workspaceGrid");
  if (matchMedia("(max-width: 760px)").matches) {
    grid?.classList.toggle("sidebar-hidden");
    refreshWideTableLayouts();
    return;
  }
  state.preferences.sidebar = !state.preferences.sidebar;
  savePreferences();
  grid?.classList.toggle("sidebar-hidden", !state.preferences.sidebar);
  requestAnimationFrame(() => state.editor?.requestMeasure());
  refreshWideTableLayouts();
}

function toggleReaderOutline() {
  document.querySelector("#readerOutline")?.classList.toggle("hidden");
}

function onReaderScroll(event) {
  const reader = event.currentTarget;
  const max = reader.scrollHeight - reader.clientHeight;
  const progress = max > 0 ? Math.min(100, (reader.scrollTop / max) * 100) : 0;
  reader.style.setProperty("--reader-progress", `${progress}%`);
  reader.classList.toggle("scrolling", reader.scrollTop > (reader.dataset.lastScroll || 0) && reader.scrollTop > 90);
  clearTimeout(reader._scrollTimer);
  reader._scrollTimer = setTimeout(() => reader.classList.remove("scrolling"), 650);
  reader.dataset.lastScroll = reader.scrollTop;
}

function bindSplitter() {
  const splitter = document.querySelector("#splitter");
  const stage = document.querySelector("#editorStage");
  if (!splitter || !stage) return;
  splitter.addEventListener("pointerdown", (event) => {
    if (stage.dataset.view !== "split") return;
    splitter.setPointerCapture(event.pointerId);
    splitter.classList.add("dragging");
  });
  splitter.addEventListener("pointermove", (event) => {
    if (!splitter.hasPointerCapture(event.pointerId)) return;
    const rect = stage.getBoundingClientRect();
    const ratio = Math.max(.25, Math.min(.75, (event.clientX - rect.left) / rect.width));
    stage.style.gridTemplateColumns = `${ratio}fr 5px ${1 - ratio}fr`;
    state.editor?.requestMeasure();
    refreshWideTableLayouts();
  });
  splitter.addEventListener("pointerup", (event) => {
    if (splitter.hasPointerCapture(event.pointerId)) splitter.releasePointerCapture(event.pointerId);
    splitter.classList.remove("dragging");
    refreshWideTableLayouts();
  });
}

function updateStatus() {
  if (state.surface !== "shell") return;
  const doc = activeDoc();
  const saveStatus = document.querySelector("#saveStatus");
  if (doc && isDirty(doc)) {
    saveStatus.className = "status-item status-dirty";
    saveStatus.innerHTML = '<span class="dirty-dot"></span> Unsaved changes';
  } else {
    saveStatus.className = "status-item status-saved";
    saveStatus.innerHTML = `${icon("check", "icon-sm")} Saved locally`;
  }
  const words = doc?.content.trim() ? doc.content.trim().split(/\s+/u).length : 0;
  document.querySelector("#wordStatus").textContent = `${words.toLocaleString()} ${words === 1 ? "word" : "words"}`;
  updateCursorStatus();
}

function updateCursorStatus() {
  if (!state.editor || state.surface !== "shell") return;
  const position = state.editor.state.selection.main.head;
  const line = state.editor.state.doc.lineAt(position);
  document.querySelector("#cursorStatus").textContent = `Ln ${line.number}, Col ${position - line.from + 1}`;
}

function openThemeDrawer() {
  document.querySelector("#themeDrawer")?.classList.remove("hidden");
  document.querySelector("#drawerBackdrop")?.classList.remove("hidden");
  syncThemeControls();
  document.querySelector("#themeDrawer button")?.focus();
}

function closeThemeDrawer() {
  document.querySelector("#themeDrawer")?.classList.add("hidden");
  document.querySelector("#drawerBackdrop")?.classList.add("hidden");
}

function selectDocumentTheme(theme) {
  state.preferences.docTheme = theme;
  state.preferences.customTokens = {};
  savePreferences();
  applyAppearance();
  renderActiveDocument();
  syncThemeControls();
}

function selectEditorTheme(theme) {
  if (!EDITOR_THEMES.some((option) => option.id === theme)) return;
  state.preferences.editorTheme = theme;
  savePreferences();
  applyAppearance();
  syncThemeControls();
}

function resolvedAppTheme() {
  if (state.preferences.appTheme !== "system") return state.preferences.appTheme;
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyAppearance() {
  document.documentElement.dataset.appTheme = resolvedAppTheme();
  document.documentElement.dataset.docTheme = state.preferences.docTheme;
  document.documentElement.dataset.editorTheme = resolvedEditorTheme();
  const allowedTokens = ["doc-font", "doc-size", "doc-leading", "doc-width", "doc-bg", "doc-text", "doc-heading", "doc-link", "doc-accent", "doc-surface"];
  allowedTokens.forEach((token) => document.documentElement.style.removeProperty(`--${token}`));
  Object.entries(state.preferences.customTokens || {}).forEach(([token, value]) => {
    if (allowedTokens.includes(token)) document.documentElement.style.setProperty(`--${token}`, value);
  });
  document.querySelectorAll("[data-theme-preset]").forEach((card) => card.classList.toggle("active", card.dataset.themePreset === state.preferences.docTheme));
  document.querySelectorAll("[data-code-editor-theme]").forEach((card) => card.classList.toggle("active", card.dataset.codeEditorTheme === preferredEditorTheme()));
  if (state.editor) state.editor.dispatch({ effects: state.editorThemeCompartment.reconfigure(editorTheme()) });
}

function bindThemeControls() {
  const mappings = {
    fontSize: ["doc-size", (v) => `${v}px`, "fontSizeOutput", (v) => `${v}px`],
    lineHeight: ["doc-leading", (v) => v, "lineHeightOutput", (v) => v],
    contentWidth: ["doc-width", (v) => `${v}px`, "contentWidthOutput", (v) => `${v}px`],
    docBg: ["doc-bg", (v) => v],
    docText: ["doc-text", (v) => v],
    docHeading: ["doc-heading", (v) => v],
    docLink: ["doc-link", (v) => v],
    docAccent: ["doc-accent", (v) => v],
    docSurface: ["doc-surface", (v) => v],
  };
  Object.entries(mappings).forEach(([id, [token, format, outputId, outputFormat]]) => {
    document.querySelector(`#${id}`)?.addEventListener("input", (event) => {
      const value = format(event.target.value);
      state.preferences.customTokens[token] = value;
      document.documentElement.style.setProperty(`--${token}`, value);
      if (outputId) document.querySelector(`#${outputId}`).textContent = outputFormat(event.target.value);
      savePreferences();
      refreshWideTableLayouts();
    });
  });
  document.querySelector("#fontSelect")?.addEventListener("change", (event) => {
    state.preferences.customTokens["doc-font"] = FONT_OPTIONS[event.target.value];
    document.documentElement.style.setProperty("--doc-font", FONT_OPTIONS[event.target.value]);
    savePreferences();
    refreshWideTableLayouts();
  });
  document.querySelector("#appThemeSelect")?.addEventListener("change", (event) => {
    state.preferences.appTheme = event.target.value;
    savePreferences();
    applyAppearance();
  });
  document.querySelector("#renderHtmlToggle")?.addEventListener("change", (event) => {
    state.preferences.renderHtml = event.target.checked;
    savePreferences();
    renderActiveDocument();
    toast(event.target.checked ? "Sanitized HTML rendering enabled." : "Raw HTML rendering disabled.");
  });
  document.querySelector("#fullWidthTablesToggle")?.addEventListener("change", (event) => {
    state.preferences.fullWidthTables = event.target.checked;
    savePreferences();
    renderActiveDocument();
    toast(event.target.checked ? "Full-width tables enabled." : "Tables constrained to reading width.");
  });
}

function syncThemeControls() {
  const styles = getComputedStyle(document.documentElement);
  const setValue = (id, value) => { const element = document.querySelector(`#${id}`); if (element) element.value = value; };
  const number = (token, fallback) => parseFloat(styles.getPropertyValue(token)) || fallback;
  setValue("fontSize", number("--doc-size", 17));
  setValue("lineHeight", number("--doc-leading", 1.72));
  setValue("contentWidth", number("--doc-width", 760));
  document.querySelector("#fontSizeOutput").textContent = `${number("--doc-size", 17)}px`;
  document.querySelector("#lineHeightOutput").textContent = number("--doc-leading", 1.72).toFixed(2);
  document.querySelector("#contentWidthOutput").textContent = `${number("--doc-width", 760)}px`;
  const colors = { docBg: "--doc-bg", docText: "--doc-text", docHeading: "--doc-heading", docLink: "--doc-link", docAccent: "--doc-accent", docSurface: "--doc-surface" };
  Object.entries(colors).forEach(([id, token]) => setValue(id, rgbToHex(styles.getPropertyValue(token).trim())));
  const currentFont = styles.getPropertyValue("--doc-font").trim();
  const currentFontKey = Object.entries(FONT_OPTIONS).find(([, value]) => value === currentFont)?.[0];
  if (currentFontKey) setValue("fontSelect", currentFontKey);
  setValue("appThemeSelect", state.preferences.appTheme);
  const renderHtmlToggle = document.querySelector("#renderHtmlToggle");
  if (renderHtmlToggle) renderHtmlToggle.checked = shouldRenderRawHtml(state.preferences);
  const fullWidthTablesToggle = document.querySelector("#fullWidthTablesToggle");
  if (fullWidthTablesToggle) fullWidthTablesToggle.checked = shouldUseFullWidthTables(state.preferences);
  document.querySelectorAll("[data-theme-preset]").forEach((card) => card.classList.toggle("active", card.dataset.themePreset === state.preferences.docTheme));
  document.querySelectorAll("[data-code-editor-theme]").forEach((card) => card.classList.toggle("active", card.dataset.codeEditorTheme === preferredEditorTheme()));
}

function rgbToHex(value) {
  if (/^#[0-9a-f]{6}$/i.test(value)) return value;
  const numbers = value.match(/\d+/g)?.slice(0, 3).map(Number);
  return numbers?.length === 3 ? `#${numbers.map((n) => n.toString(16).padStart(2, "0")).join("")}` : "#000000";
}

function resetThemeCustomizations() {
  state.preferences.customTokens = {};
  savePreferences();
  applyAppearance();
  syncThemeControls();
  toast("Theme customizations reset.");
}

function commandItems() {
  const items = [
    { id: "open", label: "Open Markdown files", icon: "folder", shortcut: "Ctrl O", run: () => openFiles("workspace") },
    { id: "new", label: "New document", icon: "plus", shortcut: "Ctrl N", run: newDocument },
    { id: "save", label: "Save active document", icon: "save", shortcut: "Ctrl S", run: () => saveDocument(activeDoc()) },
    { id: "reader", label: state.mode === "reader" ? "Return to workspace" : "Enter Reader mode", icon: state.mode === "reader" ? "edit" : "book", shortcut: "Ctrl ⇧ R", run: () => setMode(state.mode === "reader" ? "workspace" : "reader") },
    { id: "theme", label: "Open Theme Studio", icon: "palette", run: openThemeDrawer },
    { id: "sidebar", label: "Toggle outline sidebar", icon: "list", run: toggleSidebar },
    { id: "edit", label: "Show editor only", icon: "edit", run: () => setViewMode("edit") },
    { id: "split", label: "Show editor and preview", icon: "split", run: () => setViewMode("split") },
    { id: "preview", label: "Show preview only", icon: "eye", run: () => setViewMode("preview") },
    { id: "print", label: "Print or save as PDF", icon: "printer", shortcut: "Ctrl P", run: () => window.print() },
  ];
  state.docs.forEach((doc) => items.push({ id: `doc:${doc.id}`, label: doc.name, icon: "file", meta: isDirty(doc) ? "Unsaved" : "Open document", run: () => selectDocument(doc.id) }));
  return items;
}

function openCommandPalette() {
  const dialog = document.querySelector("#commandDialog");
  if (!dialog) return;
  dialog.showModal();
  const input = document.querySelector("#commandInput");
  input.value = "";
  state.commandIndex = 0;
  renderCommandResults();
  requestAnimationFrame(() => input.focus());
}

function renderCommandResults() {
  const query = document.querySelector("#commandInput")?.value.trim().toLowerCase() || "";
  const filtered = commandItems().filter((item) => `${item.label} ${item.meta || ""}`.toLowerCase().includes(query));
  state.commandIndex = Math.min(state.commandIndex, Math.max(0, filtered.length - 1));
  document.querySelector("#commandResults").innerHTML = filtered.length ? filtered.map((item, index) => `<button class="command-item ${index === state.commandIndex ? "active" : ""}" type="button" data-command-id="${item.id}">${icon(item.icon)}<span class="command-label">${escapeHtml(item.label)}</span>${item.meta ? `<span class="command-meta">${escapeHtml(item.meta)}</span>` : ""}${item.shortcut ? `<kbd>${escapeHtml(item.shortcut)}</kbd>` : ""}</button>`).join("") : '<div class="outline-empty">No matching commands.</div>';
  document.querySelector(".command-item.active")?.scrollIntoView({ block: "nearest" });
}

function handleCommandKeys(event) {
  const query = event.currentTarget.value.trim().toLowerCase();
  const filtered = commandItems().filter((item) => `${item.label} ${item.meta || ""}`.toLowerCase().includes(query));
  if (event.key === "ArrowDown") { event.preventDefault(); state.commandIndex = Math.min(filtered.length - 1, state.commandIndex + 1); renderCommandResults(); }
  if (event.key === "ArrowUp") { event.preventDefault(); state.commandIndex = Math.max(0, state.commandIndex - 1); renderCommandResults(); }
  if (event.key === "Enter" && filtered[state.commandIndex]) { event.preventDefault(); runCommand(filtered[state.commandIndex].id); }
}

function runCommand(id) {
  const command = commandItems().find((item) => item.id === id);
  document.querySelector("#commandDialog")?.close();
  command?.run();
}

async function confirmChoice({ title, message, choices }) {
  const dialog = document.querySelector("#confirmDialog");
  document.querySelector("#confirmTitle").textContent = title;
  document.querySelector("#confirmMessage").textContent = message;
  document.querySelector("#confirmActions").innerHTML = choices.map((choice) => `<button class="btn ${choice.className || ""}" type="button" data-choice="${choice.id}">${escapeHtml(choice.label)}</button>`).join("");
  dialog.showModal();
  return new Promise((resolve) => {
    const finish = (value) => { dialog.close(); resolve(value); };
    document.querySelector("#confirmActions").onclick = (event) => {
      const button = event.target.closest("[data-choice]");
      if (button) finish(button.dataset.choice);
    };
    dialog.oncancel = (event) => { event.preventDefault(); finish(null); };
  });
}

async function onRenderedClick(event) {
  const diagramOpen = event.target.closest(".diagram-open");
  if (diagramOpen) {
    event.preventDefault();
    openDiagramViewer(diagramOpen.closest(".mermaid-shell"), diagramOpen);
    return;
  }

  const copy = event.target.closest(".code-copy");
  if (copy) {
    const code = copy.closest("pre")?.querySelector("code")?.textContent || "";
    await navigator.clipboard.writeText(code);
    copy.querySelector("span").textContent = "Copied";
    setTimeout(() => { if (copy.isConnected) copy.querySelector("span").textContent = "Copy"; }, 1300);
    return;
  }
  const link = event.target.closest("a[data-external]");
  if (link) {
    event.preventDefault();
    const choice = await confirmChoice({ title: "Open external link?", message: link.href, choices: [{ id: "cancel", label: "Cancel" }, { id: "open", label: "Open link", className: "btn-primary" }] });
    if (choice === "open") window.open(link.href, "_blank", "noopener,noreferrer");
  }
}

function onDragEnter(event) {
  if (!isFileDragPayload(event.dataTransfer)) return;
  event.preventDefault();
  event.stopPropagation();
  state.dragDepth += 1;
  document.querySelector("#dropOverlay")?.classList.remove("hidden");
  const text = document.querySelector("#dropOverlayText");
  if (text) text.textContent = `Files will open in ${state.mode === "reader" ? "Reader mode" : "the workspace"}`;
}

function onDragOver(event) {
  if (!isFileDragPayload(event.dataTransfer)) return;
  event.preventDefault();
  event.stopPropagation();
  document.querySelector("#dropOverlay")?.classList.remove("hidden");
  event.dataTransfer.dropEffect = "copy";
}

function onDragLeave(event) {
  if (!state.dragDepth) return;
  state.dragDepth = Math.max(0, state.dragDepth - 1);
  if (!state.dragDepth) document.querySelector("#dropOverlay")?.classList.add("hidden");
}

async function onDrop(event) {
  if (!isFileDragPayload(event.dataTransfer)) return;
  event.preventDefault();
  event.stopPropagation();
  state.dragDepth = 0;
  document.querySelector("#dropOverlay")?.classList.add("hidden");
  await handleFiles(Array.from(event.dataTransfer.files || []), state.mode === "reader" ? "reader" : "workspace");
}

function toast(message, type = "success") {
  const region = document.querySelector("#toastRegion");
  if (!region) return;
  const element = document.createElement("div");
  element.className = `toast ${type}`;
  element.innerHTML = `${icon(type === "error" ? "alert" : "check")}<div class="toast-copy">${escapeHtml(message)}</div>`;
  region.append(element);
  setTimeout(() => element.remove(), 3600);
}

function onGlobalKeydown(event) {
  if (isDiagramViewerOpen()) {
    handleDiagramViewerKeydown(event);
    return;
  }

  const mod = event.ctrlKey || event.metaKey;
  if (!mod) {
    if (event.key === "Escape") {
      if (state.selectedDocIds.size) { clearDocSelection(); renderDocumentList(); }
      else if (state.docMenuOpen) closeDocOverflowMenu();
      else if (state.mode === "reader") setMode("workspace");
    }
    return;
  }
  const key = event.key.toLowerCase();
  if (key === "o") { event.preventDefault(); openFiles("workspace"); }
  else if (key === "s") { event.preventDefault(); saveDocument(activeDoc()); }
  else if (key === "n") { event.preventDefault(); newDocument(); }
  else if (key === "k" || (key === "p" && event.shiftKey)) { event.preventDefault(); openCommandPalette(); }
  else if (key === "r" && event.shiftKey) { event.preventDefault(); setMode(state.mode === "reader" ? "workspace" : "reader"); }
  else if (key === "v" && event.shiftKey) { event.preventDefault(); setViewMode(state.preferences.viewMode === "preview" ? "split" : "preview"); }
  else if (key === "w" && state.surface === "shell") { event.preventDefault(); closeDocument(state.activeId); }
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("local-markdown-studio", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("state", { keyPath: "key" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function loadSession() {
  try {
    const db = await openDatabase();
    const [workspace, archive] = await Promise.all([
      new Promise((resolve, reject) => {
        const request = db.transaction("state", "readonly").objectStore("state").get("workspace");
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      }),
      new Promise((resolve, reject) => {
        const request = db.transaction("state", "readonly").objectStore("state").get("archive");
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      }),
    ]);
    db.close();
    if (archive?.docs?.length) state.archivedDocs = archive.docs.map((doc) => ({ ...doc, id: doc.id || uid() }));
    if (!workspace?.docs?.length) return false;
    state.docs = workspace.docs.map((doc) => ({
      ...doc,
      id: doc.id || uid(),
      handle: doc.handle || null,
      nameCustomized: doc.nameCustomized ?? !isAutoNameCandidate(doc.name),
    }));
    state.activeId = state.docs.some((doc) => doc.id === workspace.activeId) ? workspace.activeId : state.docs[0].id;
    return true;
  } catch { return false; }
}

let archiveTimer = null;
function scheduleArchiveSave() {
  clearTimeout(archiveTimer);
  archiveTimer = setTimeout(saveArchive, 350);
}

async function saveArchive() {
  try {
    const db = await openDatabase();
    const record = { key: "archive", docs: state.archivedDocs.map((doc) => ({ ...doc })) };
    await new Promise((resolve, reject) => {
      const request = db.transaction("state", "readwrite").objectStore("state").put(record);
      request.onsuccess = resolve;
      request.onerror = () => reject(request.error);
    });
    db.close();
  } catch { /* Archive is optional recovery storage. */ }
}

function scheduleSessionSave() {
  clearTimeout(state.sessionTimer);
  state.sessionTimer = setTimeout(saveSession, 350);
}

async function saveSession() {
  try {
    const db = await openDatabase();
    const record = { key: "workspace", activeId: state.activeId, docs: state.docs.map((doc) => ({ ...doc })) };
    await new Promise((resolve, reject) => {
      const request = db.transaction("state", "readwrite").objectStore("state").put(record);
      request.onsuccess = resolve;
      request.onerror = () => reject(request.error);
    });
    db.close();
  } catch {
    try {
      const db = await openDatabase();
      const safeRecord = { key: "workspace", activeId: state.activeId, docs: state.docs.map(({ handle, ...doc }) => doc) };
      db.transaction("state", "readwrite").objectStore("state").put(safeRecord);
    } catch { /* Storage may be disabled; the editor remains usable. */ }
  }
}

async function initialize() {
  applyAppearance();
  document.addEventListener("keydown", onGlobalKeydown);
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (state.preferences.appTheme === "system") applyAppearance();
  });
  const restored = await loadSession();
  if (restored) showShell("workspace");
  else showWelcome();
}

window.addEventListener("beforeunload", (event) => {
  if (state.docs.some(isDirty)) {
    event.preventDefault();
    event.returnValue = "";
  }
});

initialize();
