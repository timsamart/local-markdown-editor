import { EditorView, basicSetup } from "codemirror";
import { EditorState, Compartment } from "@codemirror/state";
import { markdown } from "@codemirror/lang-markdown";
import { keymap } from "@codemirror/view";
import { indentWithTab } from "@codemirror/commands";
import markdownit from "markdown-it";
import footnote from "markdown-it-footnote";
import deflist from "markdown-it-deflist";
import taskLists from "markdown-it-task-lists";
import DOMPurify from "dompurify";
import mermaid from "mermaid";
import { isMisplacedHashKey } from "./keyboard.js";
import { isFileDragPayload } from "./file-drop.js";

const BUILD_DATE = "__BUILD_DATE__";
const APP_VERSION = "1.0.0";

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
  viewMode: "split",
  sidebar: true,
  customTokens: {},
};

const state = {
  docs: [],
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
};

const THEMES = [
  { id: "modern", name: "Modern", desc: "Balanced & clear", colors: ["#ffffff", "#252b35", "#3157d5"] },
  { id: "editorial", name: "Editorial", desc: "Warm long-form", colors: ["#fbf8f1", "#332f29", "#a45136"] },
  { id: "technical", name: "Technical", desc: "Dense & precise", colors: ["#f8fafc", "#243047", "#0074c8"] },
  { id: "graphite", name: "Graphite", desc: "Quiet dark", colors: ["#171a1e", "#d6dae1", "#8da8ff"] },
  { id: "nordic", name: "Nordic", desc: "Cool & soft", colors: ["#f3f6f6", "#2d3a3d", "#2b8587"] },
  { id: "solarized", name: "Solarized", desc: "Low fatigue", colors: ["#fdf6e3", "#586e75", "#b58900"] },
  { id: "terminal", name: "Terminal", desc: "Monospace focus", colors: ["#0e1512", "#b5cabd", "#58cf94"] },
  { id: "contrast", name: "High Contrast", desc: "Maximum clarity", colors: ["#ffffff", "#000000", "#0033cc"] },
  { id: "ruv", name: "R+V Brand", desc: "Slab & brand palette", colors: ["#001957", "#f79506", "#00dcdc"] },
];

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
  return { id: uid(), name, content, savedContent: content, handle: null, cursor: 0, ...extras };
}

const md = markdownit({ html: false, linkify: true, typographer: true, breaks: false })
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

function slugify(value) {
  return value.toLowerCase().trim().replace(/[^\p{L}\p{N}\s-]/gu, "").replace(/\s+/g, "-").replace(/-+/g, "-") || "section";
}

const renderVersions = new WeakMap();

async function renderInto(target, content) {
  if (!target) return;
  const version = (renderVersions.get(target) || 0) + 1;
  renderVersions.set(target, version);
  if (!content.trim()) {
    target.innerHTML = `<div class="render-empty"><div><div>${icon("file")}</div><strong>Nothing to preview yet</strong><p>Start writing and your document will appear here.</p></div></div>`;
    return;
  }

  const rendered = md.render(content, { slugs: new Map() });
  target.innerHTML = DOMPurify.sanitize(rendered, {
    USE_PROFILES: { html: true },
    ADD_ATTR: ["target", "rel", "data-mermaid", "disabled"],
  });

  target.querySelectorAll("a").forEach((link) => {
    link.rel = "noreferrer noopener";
    if (/^https?:/i.test(link.href)) link.dataset.external = "true";
  });
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
      result.bindFunctions?.(node);
    } catch (error) {
      node.className = "mermaid-error";
      node.innerHTML = `<strong>Diagram could not be rendered</strong><span>${escapeHtml(cleanMermaidError(error))}</span>`;
    }
  }
}

function cleanMermaidError(error) {
  const text = String(error?.message || error || "Unknown Mermaid error").replace(/\s+/g, " ").trim();
  return text.length > 260 ? `${text.slice(0, 257)}…` : text;
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
        <button class="btn btn-quiet icon-btn" type="button" data-action="toggle-sidebar" aria-label="Toggle document sidebar">${icon("menu")}</button>
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
          <section class="sidebar-section">
            <div class="section-heading"><span>Documents</span><button class="btn btn-quiet icon-btn btn-sm" type="button" data-action="new" aria-label="New document">${icon("plus", "icon-sm")}</button></div>
            <div class="document-list" id="documentList"></div>
          </section>
          <section class="sidebar-section">
            <div class="section-heading"><span>Outline</span><span id="outlineCount"></span></div>
            <nav class="outline-list" id="outlineList" aria-label="Document outline"></nav>
          </section>
        </aside>
        <main class="work-area">
          <section class="workspace" id="workspaceSurface">
            <div class="tabs-row">
              <div class="tabs" id="tabs" role="tablist" aria-label="Open documents"></div>
              <div class="tabs-actions">
                <div class="mobile-view-switch" aria-label="Mobile document view">
                  <button class="btn btn-quiet icon-btn btn-sm" type="button" data-view="edit" aria-label="Show editor">${icon("edit", "icon-sm")}</button>
                  <button class="btn btn-quiet icon-btn btn-sm" type="button" data-view="preview" aria-label="Show preview">${icon("eye", "icon-sm")}</button>
                </div>
                <button class="btn btn-quiet icon-btn btn-sm desktop-new-tab" type="button" data-action="new" aria-label="New tab">${icon("plus", "icon-sm")}</button>
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
        <div class="drawer-actions"><button class="btn" type="button" data-action="reset-theme">${icon("reset", "icon-sm")} Reset customizations</button></div>
      </div>
    </aside>`;
}

function themeCard(theme) {
  const swatches = theme.colors.map((color) => `<span class="theme-swatch" style="--swatch:${color}"></span>`).join("");
  return `<button class="theme-card" type="button" data-theme-preset="${theme.id}" style="--theme-card-bg:${theme.colors[0]};--theme-card-text:${theme.colors[1]}"><span class="theme-swatches">${swatches}</span><span class="theme-card-name">${theme.name}</span><span class="theme-card-desc">${theme.desc}</span></button>`;
}

function colorField(id, label, value) {
  return `<div class="field color-field"><input id="${id}" type="color" value="${value}" aria-label="${label} color"><label for="${id}">${label}</label></div>`;
}

function globalOverlays() {
  return `
    <div class="drop-overlay hidden" id="dropOverlay"><div class="drop-overlay-card"><div class="drop-icon">${icon("files")}</div><h2>Drop to open</h2><p id="dropOverlayText">Files will open in the workspace</p></div></div>
    <dialog class="command-dialog" id="commandDialog"><div class="command-input-wrap">${icon("search")}<input class="command-input" id="commandInput" type="search" autocomplete="off" placeholder="Type a command or document name…" aria-label="Search commands"></div><div class="command-results" id="commandResults"></div></dialog>
    <dialog class="confirm-dialog" id="confirmDialog"><div class="dialog-content"><h2 id="confirmTitle"></h2><p id="confirmMessage"></p></div><div class="dialog-actions" id="confirmActions"></div></dialog>
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

function editorTheme() {
  const dark = resolvedAppTheme() === "dark";
  return EditorView.theme({
    "&": { backgroundColor: dark ? "#202422" : "#ffffff", color: dark ? "#edf0ed" : "#18201c" },
    ".cm-content": { caretColor: dark ? "#9eb2ff" : "#3157d5" },
    ".cm-gutters": { backgroundColor: dark ? "#202422" : "#ffffff", color: dark ? "#7f8982" : "#8a948e" },
  }, { dark });
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
  document.querySelector("#tabs")?.addEventListener("click", onTabsClick);
  document.querySelector("#outlineList")?.addEventListener("click", onOutlineClick);
  document.querySelector("#readerOutline")?.addEventListener("click", onOutlineClick);
  document.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => setViewMode(button.dataset.view)));
  document.querySelector("#themeGrid")?.addEventListener("click", (event) => {
    const card = event.target.closest("[data-theme-preset]");
    if (card) selectDocumentTheme(card.dataset.themePreset);
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
    commands: openCommandPalette,
    "reader-outline": toggleReaderOutline,
    print: () => window.print(),
    "reset-theme": resetThemeCustomizations,
  };
  await actions[action]?.();
}

function renderNavigation() {
  if (state.surface !== "shell") return;
  const docsHtml = state.docs.map((doc) => `
    <div class="doc-item ${doc.id === state.activeId ? "active" : ""}" data-doc-id="${doc.id}">
      ${icon("file", "icon-sm doc-icon")}
      <button class="doc-name" type="button" data-select-doc="${doc.id}" title="${escapeHtml(doc.name)}">${escapeHtml(doc.name)}</button>
      ${isDirty(doc) ? '<span class="dirty-dot" aria-label="Unsaved changes"></span>' : ""}
    </div>`).join("");
  document.querySelector("#documentList").innerHTML = docsHtml;

  const tabsHtml = state.docs.map((doc) => `
    <div class="tab ${doc.id === state.activeId ? "active" : ""}" role="tab" aria-selected="${doc.id === state.activeId}" data-doc-id="${doc.id}">
      ${isDirty(doc) ? '<span class="dirty-dot" aria-label="Unsaved changes"></span>' : ""}
      <button class="tab-name" type="button" data-select-doc="${doc.id}" title="${escapeHtml(doc.name)}">${escapeHtml(doc.name)}</button>
      <button class="doc-close" type="button" data-close-doc="${doc.id}" aria-label="Close ${escapeHtml(doc.name)}">${icon("x", "icon-sm")}</button>
    </div>`).join("");
  document.querySelector("#tabs").innerHTML = tabsHtml;
  renderOutline();
}

function extractOutline(content) {
  const result = [];
  const counts = new Map();
  let fenced = false;
  for (const line of content.split("\n")) {
    if (/^\s*```/.test(line)) { fenced = !fenced; continue; }
    if (fenced) continue;
    const match = /^(#{1,3})\s+(.+?)\s*#*\s*$/.exec(line);
    if (!match) continue;
    const text = match[2].replace(/[*_`~\[\]]/g, "");
    const base = slugify(text);
    const count = counts.get(base) || 0;
    counts.set(base, count + 1);
    result.push({ level: match[1].length, text, id: count ? `${base}-${count + 1}` : base });
  }
  return result;
}

function renderOutline() {
  const doc = activeDoc();
  const outline = doc ? extractOutline(doc.content) : [];
  const html = outline.length ? outline.map((entry) => `<button class="outline-link level-${entry.level}" type="button" data-heading-id="${escapeHtml(entry.id)}" title="${escapeHtml(entry.text)}">${escapeHtml(entry.text)}</button>`).join("") : '<div class="outline-empty">Add headings to build a navigable outline.</div>';
  const sidebar = document.querySelector("#outlineList");
  const reader = document.querySelector("#readerOutline");
  if (sidebar) sidebar.innerHTML = html;
  if (reader) reader.innerHTML = `<div class="section-heading"><span>Outline</span><button class="btn btn-quiet icon-btn btn-sm" type="button" data-action="reader-outline" aria-label="Close outline">${icon("x", "icon-sm")}</button></div>${html}`;
  const count = document.querySelector("#outlineCount");
  if (count) count.textContent = outline.length || "";
}

function onDocumentListClick(event) {
  const select = event.target.closest("[data-select-doc]");
  if (select) selectDocument(select.dataset.selectDoc);
}

function onTabsClick(event) {
  const close = event.target.closest("[data-close-doc]");
  const select = event.target.closest("[data-select-doc]");
  if (close) closeDocument(close.dataset.closeDoc);
  else if (select) selectDocument(select.dataset.selectDoc);
}

function onOutlineClick(event) {
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
  if (title) title.textContent = doc.name;
}

function selectDocument(id) {
  if (!state.docs.some((doc) => doc.id === id)) return;
  const current = activeDoc();
  if (current && state.editor) current.cursor = state.editor.state.selection.main.head;
  state.activeId = id;
  updateAll();
  if (matchMedia("(max-width: 760px)").matches) document.querySelector("#workspaceGrid")?.classList.add("sidebar-hidden");
  scheduleSessionSave();
}

function newDocument() {
  const existing = new Set(state.docs.map((doc) => doc.name));
  let index = 1;
  let name = "Untitled.md";
  while (existing.has(name)) name = `Untitled ${++index}.md`;
  const doc = makeDocument(name, "", { savedContent: "__new__" });
  state.docs.push(doc);
  state.activeId = doc.id;
  if (state.surface === "welcome") showShell("workspace");
  else { setMode("workspace"); updateAll(); }
  scheduleSessionSave();
}

function openSample() {
  const doc = makeDocument("Welcome.md", SAMPLE);
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
    return makeDocument(file.name, content, { handle: handles[index] || null, lastModified: file.lastModified });
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

async function closeDocument(id) {
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
  if (!state.docs.length) showWelcome();
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
    document.querySelector("#readerTitle").textContent = activeDoc()?.name || "";
    document.querySelector("#readerSurface").scrollTop = 0;
  } else {
    reader.classList.add("hidden");
    workspace.classList.remove("hidden");
    const narrow = matchMedia("(max-width: 760px)").matches;
    sidebar.classList.toggle("sidebar-hidden", narrow || !state.preferences.sidebar);
    requestAnimationFrame(() => state.editor?.requestMeasure());
  }
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
}

function toggleSidebar() {
  if (state.mode === "reader") return toggleReaderOutline();
  const grid = document.querySelector("#workspaceGrid");
  if (matchMedia("(max-width: 760px)").matches) {
    grid?.classList.toggle("sidebar-hidden");
    return;
  }
  state.preferences.sidebar = !state.preferences.sidebar;
  savePreferences();
  grid?.classList.toggle("sidebar-hidden", !state.preferences.sidebar);
  requestAnimationFrame(() => state.editor?.requestMeasure());
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
  });
  splitter.addEventListener("pointerup", (event) => {
    if (splitter.hasPointerCapture(event.pointerId)) splitter.releasePointerCapture(event.pointerId);
    splitter.classList.remove("dragging");
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

function resolvedAppTheme() {
  if (state.preferences.appTheme !== "system") return state.preferences.appTheme;
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyAppearance() {
  document.documentElement.dataset.appTheme = resolvedAppTheme();
  document.documentElement.dataset.docTheme = state.preferences.docTheme;
  const allowedTokens = ["doc-font", "doc-size", "doc-leading", "doc-width", "doc-bg", "doc-text", "doc-heading", "doc-link", "doc-accent", "doc-surface"];
  allowedTokens.forEach((token) => document.documentElement.style.removeProperty(`--${token}`));
  Object.entries(state.preferences.customTokens || {}).forEach(([token, value]) => {
    if (allowedTokens.includes(token)) document.documentElement.style.setProperty(`--${token}`, value);
  });
  document.querySelectorAll("[data-theme-preset]").forEach((card) => card.classList.toggle("active", card.dataset.themePreset === state.preferences.docTheme));
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
    });
  });
  document.querySelector("#fontSelect")?.addEventListener("change", (event) => {
    state.preferences.customTokens["doc-font"] = FONT_OPTIONS[event.target.value];
    document.documentElement.style.setProperty("--doc-font", FONT_OPTIONS[event.target.value]);
    savePreferences();
  });
  document.querySelector("#appThemeSelect")?.addEventListener("change", (event) => {
    state.preferences.appTheme = event.target.value;
    savePreferences();
    applyAppearance();
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
  document.querySelectorAll("[data-theme-preset]").forEach((card) => card.classList.toggle("active", card.dataset.themePreset === state.preferences.docTheme));
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
    { id: "sidebar", label: "Toggle document sidebar", icon: "list", run: toggleSidebar },
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
  const mod = event.ctrlKey || event.metaKey;
  if (!mod) {
    if (event.key === "Escape" && state.mode === "reader") setMode("workspace");
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
    const record = await new Promise((resolve, reject) => {
      const request = db.transaction("state", "readonly").objectStore("state").get("workspace");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    db.close();
    if (!record?.docs?.length) return false;
    state.docs = record.docs.map((doc) => ({ ...doc, id: doc.id || uid(), handle: doc.handle || null }));
    state.activeId = state.docs.some((doc) => doc.id === record.activeId) ? record.activeId : state.docs[0].id;
    return true;
  } catch { return false; }
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
