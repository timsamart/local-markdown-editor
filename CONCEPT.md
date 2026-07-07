# Local Markdown Studio — Product Concept

## Product promise

**Open one HTML file, drop in Markdown, and immediately read or edit it—beautifully, privately, and without a server.**

Local Markdown Studio is a portable, enterprise-ready Markdown workspace delivered as a single self-contained HTML file. It combines a calm document reader, a fast multi-document editor, live preview, Mermaid diagrams, and a powerful but approachable rendering theme studio.

The product should feel closer to a polished native writing tool than a browser demo.

## Design principles

1. **Local means local.** No CDN, accounts, telemetry, remote fonts, network requests, or cloud dependency.
2. **The document comes first.** Controls recede when reading and stay close at hand when editing.
3. **Simple immediately, powerful progressively.** Dropping a file requires no setup; advanced controls appear only when requested.
4. **Reading and editing are different jobs.** Each gets a purpose-built mode instead of sharing a cluttered compromise.
5. **Never make file state ambiguous.** Saved, changed, recovered, read-only, and externally modified states are always explicit.
6. **Keyboard and pointer are equal citizens.** Every important action is available through both.
7. **Customization remains safe.** Most styling happens through constrained design tokens, with guarded advanced CSS as an optional escape hatch.

## The three product surfaces

### 1. Welcome / Drop surface

The initial screen is quiet and useful rather than promotional.

- Large drop target: **Drop Markdown to open**
- Two primary actions: **Open files** and **New document**
- A secondary choice beneath the drop target: **Open in Reader** / **Open in Workspace**
- Recent local sessions shown only when browser storage contains them
- Clear privacy label: **Runs entirely on this device**
- Small sample document for first-time exploration

Dragging one or several `.md`, `.markdown`, or `.txt` files anywhere over the window reveals a full-window drop overlay. The overlay lets the user choose Reader or Workspace before releasing, while remembering the last choice.

### 2. Workspace mode

Workspace mode is for writing, comparing, and managing several Markdown documents.

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Logo  Files  Edit  View     Search / Command…    Reader  Theme  ••• │
├───────────────┬──────────────────────────────────────────────────────┤
│ DOCUMENTS     │  guide.md  ×   api.md •  ×   notes.md  ×           │
│               ├────────────────────────┬─────────────────────────────┤
│ ▾ Open (3)    │ EDITOR                 │ PREVIEW                     │
│   guide.md    │ # Getting started      │ Getting started             │
│   api.md   •  │                        │                             │
│   notes.md    │ ```mermaid             │   rendered diagram          │
│               │ graph LR               │                             │
│ OUTLINE       │ ```                    │                             │
│   Intro       │                        │                             │
│   Install     │                        │                             │
│   Usage       │                        │                             │
├───────────────┴────────────────────────┴─────────────────────────────┤
│ Markdown   Ln 18, Col 7     1,284 words     Saved locally      100% │
└──────────────────────────────────────────────────────────────────────┘
```

#### Layout

- **Top command bar:** global actions, mode switch, search/command palette, appearance controls.
- **Document rail:** open documents, drag-to-reorder, saved/unsaved state, outline, and optional recent files.
- **Tab strip:** familiar multi-file switching with unsaved dots and close controls.
- **Main canvas:** Editor, Split, or Preview layout. The split divider is draggable and remembered.
- **Status bar:** syntax, cursor position, word count, save state, zoom, and Mermaid/error status.
- Sidebars and preview can collapse, giving the editor the full canvas without entering a different mode.

#### Editing behavior

- Fast syntax-aware Markdown editor with line numbers, bracket pairing, current-line highlight, find/replace, undo history, and indentation support.
- Markdown shortcuts and continuations: lists, task lists, blockquotes, fenced code, tables, links, and images.
- Live preview is debounced and scroll-synchronized by source block, not by fragile percentage matching.
- Clicking a preview block focuses the corresponding source. A subtle gutter marker shows the linked block.
- Mermaid blocks show a compact inline status: rendered, rendering, or error. Errors point to the relevant source line and never break the rest of the document.
- Image references resolve from embedded data or user-selected local assets where browser permissions allow; missing assets receive a readable placeholder.
- Autosave preserves a recovery draft in browser storage. It does not silently overwrite the source file.

#### Multi-document behavior

- Opening or dropping multiple files creates tabs in one action.
- `Ctrl/Cmd+P` opens a document switcher; `Ctrl/Cmd+Shift+P` opens the command palette.
- Tabs can be reordered, pinned, closed to the right, or closed in bulk.
- Closing a changed document presents **Save**, **Discard**, and **Keep recovery copy**.
- A session restores open tabs, active document, cursor positions, layout, and drafts after an accidental close.
- Duplicate filenames are disambiguated by a compact parent-path hint when path access is available.

### 3. Reader mode

Reader mode is a first-class experience, not merely “preview without the editor.”

- The document opens on a centered, responsive reading canvas with generous rhythm and an adjustable measure.
- UI chrome becomes a slim floating header and fades during scrolling; moving the pointer or pressing `Alt` restores it.
- A collapsible outline shows reading progress and highlights the current section.
- Reader controls: theme, text size, line height, content width, zoom, and diagram zoom.
- Mermaid diagrams support pan, zoom, fit-to-view, full-screen inspection, and copy as SVG where possible.
- Code blocks offer wrap, copy, and horizontal scroll without disturbing the page width.
- Links display their destination before opening; external links require a deliberate action in hardened enterprise mode.
- Dropping a new file while reading replaces the current document or opens it in a new tab via a small drop-choice card.
- `Esc` returns to the previous surface; `E` enters Workspace mode for the current document.

## Rendering and theme system

App appearance and document appearance are separate systems.

### App themes

- **Light:** neutral, crisp, high-contrast workspace
- **Dark:** deep graphite rather than pure black
- **System:** follows the operating-system preference

### Built-in document themes

1. **Editorial** — warm paper, serif body, refined long-form reading
2. **Modern** — clean sans-serif, restrained blue accent, excellent default for business documents
3. **Technical** — compact sans-serif, strong code treatment, diagram-friendly
4. **Graphite** — dark neutral canvas for extended screen reading
5. **Nordic** — cool muted palette with soft contrast
6. **Solarized** — familiar low-fatigue light and dark variants
7. **Terminal** — monospaced, high-contrast, intentionally utilitarian
8. **Accessible High Contrast** — maximum clarity with non-color state cues
9. **R+V Brand** — bundled R+V Sans and Slab typography with navy, orange, teal, and cream brand tokens

The default is **Modern**, using bundled system-font stacks so the file makes no network requests.

### Theme Studio

The studio opens as a right-side panel with a live miniature document preview.

- Typography: body, heading, and code font stacks
- Type scale, body size, line height, letter spacing, paragraph spacing
- Reading width and page padding
- Background, surface, text, muted text, heading, link, border, accent, selection, and focus colors
- Heading, blockquote, table, inline code, fenced code, callout, and horizontal-rule styles
- Code theme and Mermaid light/dark theme mapping
- Save as new preset, duplicate, rename, reset, import, and export
- Import/export uses a human-readable JSON theme file
- Contrast warnings appear inline and explain which pairing fails

Advanced users may enable **Custom CSS**. The editor validates and scopes it to the rendered document, blocks remote imports and URLs by default, and offers a one-click safe reset. Custom CSS is never allowed to restyle the application controls.

## Core interaction details

### Command palette

All actions are searchable in plain language: “open files,” “toggle outline,” “use Editorial theme,” “export HTML,” or “fit Mermaid diagram.” Results show keyboard shortcuts and current state.

### Save and export

- **Save** writes back through an existing file handle when supported and permission remains valid.
- **Save As** downloads a Markdown file as a universal fallback.
- Export current document as self-contained HTML, sanitized HTML fragment, or print/PDF through the browser.
- Optional export of all open documents as individual downloads, with a clear browser limitation notice when necessary.
- The app never claims a file is saved until the write or download action succeeds.

### Responsive behavior

- **Desktop:** resizable sidebar and editor/preview split.
- **Tablet:** one primary pane at a time, with preview available as a swipe-free explicit tab.
- **Phone:** Reader-first experience; editor remains available with a bottom mode switcher and sheet-based document list.
- No essential action depends on hover.

### Accessibility

- WCAG 2.2 AA contrast target across all default themes.
- Visible `:focus-visible` treatment, logical tab order, skip links, landmarks, and accessible labels for icon buttons.
- Complete keyboard operation with no traps.
- State is never communicated by color alone; unsaved/error states use shape, icon, and text.
- Zoom works to at least 200% without horizontal page scrolling outside intentionally scrollable code or diagrams.
- Reduced-motion and increased-contrast preferences are respected.
- Preview updates and Mermaid errors are announced politely without interrupting typing.

## Privacy, security, and enterprise posture

- One auditable HTML artifact with all JavaScript, CSS, icons, and fonts/runtime assets embedded.
- Zero required network access and no network calls during normal operation.
- No accounts, analytics, tracking, cookies, or cloud synchronization.
- Markdown HTML is sanitized before insertion into the preview.
- Raw HTML is disabled by default and can be enabled only as an explicit setting.
- Mermaid uses a strict security configuration; rendered output is sanitized.
- Remote images, remote fonts, `@import`, external embeds, and executable URLs are blocked by default.
- A hardened mode can disable raw HTML, custom CSS, external links, and all remote resources permanently for a distributed build.
- Content Security Policy is embedded where compatible with single-file execution.
- Settings, themes, sessions, and recovery drafts live only in browser-local storage and can be cleared from one privacy panel.
- The About panel exposes build version, bundled dependency versions, licenses, and a content hash for auditability.

## Proposed technical shape

The distributable remains one `markdown-studio.html` file.

- **Editor:** embedded CodeMirror-based editor bundle
- **Markdown:** CommonMark/GFM-capable parser with tables, task lists, footnotes, and heading anchors
- **Diagrams:** embedded Mermaid bundle, rendered on demand and isolated from document failure
- **Sanitization:** embedded allowlist sanitizer applied after Markdown and Mermaid rendering
- **Icons:** small inline SVG icon set; no emoji UI icons
- **Persistence:** IndexedDB for sessions/drafts and local storage for lightweight preferences
- **File access:** progressive enhancement through browser file handles, with file input and downloads as the universal fallback
- **Styling:** authored CSS with design tokens, bundled and minified into the final HTML; no runtime CDN or Tailwind dependency

The source can remain modular for maintainability, but the release process compiles it into the single portable HTML artifact.

## Supported Markdown experience

- CommonMark and GitHub-Flavored Markdown conventions
- Tables, task lists, strikethrough, autolinks, footnotes, definition lists, and fenced code
- Mermaid fences using ` ```mermaid `
- YAML front matter shown in the editor and optionally summarized in Reader mode
- Heading anchors, table of contents, safe raw HTML option, and print-friendly rendering
- Graceful unknown syntax: preserve source and render a readable fallback

## Keyboard model

| Action | Windows/Linux | macOS |
|---|---:|---:|
| Open files | `Ctrl+O` | `Cmd+O` |
| Save | `Ctrl+S` | `Cmd+S` |
| New document | `Ctrl+N` | `Cmd+N` |
| Document switcher | `Ctrl+P` | `Cmd+P` |
| Command palette | `Ctrl+Shift+P` | `Cmd+Shift+P` |
| Find in document | `Ctrl+F` | `Cmd+F` |
| Toggle Reader | `Ctrl+Shift+R` | `Cmd+Shift+R` |
| Toggle preview | `Ctrl+Shift+V` | `Cmd+Shift+V` |
| Close document | `Ctrl+W` | `Cmd+W` |

Shortcuts are discoverable beside commands and can be disabled when they conflict with browser or enterprise policies.

## Product states that must be designed, not improvised

- Empty workspace
- Dragging valid, mixed, oversized, or unsupported files
- Loading a large document
- Mermaid rendering and Mermaid syntax error
- Raw HTML blocked
- Missing local image
- Read-only file or revoked file permission
- Unsaved changes, recovery available, and recovery conflict
- External file changed after opening
- Storage quota exceeded
- Print layout and offline browser restrictions

## Delivery priorities

### Release 1 — Excellent core

Single/multi-file open and drop, tabs, editor/split/preview, Reader mode, Mermaid, recovery drafts, save/download, outline, command palette, built-in themes, Theme Studio tokens, sanitization, responsive behavior, and keyboard accessibility.

### Release 1.1 — Power features

Theme JSON import/export, guarded custom CSS, HTML export, diagram export/inspection, external-file change detection, richer Markdown extensions, and session management.

### Later, only if still compatible with the local-first promise

Opt-in folder workspace, document-to-document wiki links, search across open documents, and a side-by-side comparison view.

## Acceptance bar

The concept succeeds when a first-time user can drop a file and begin reading in under five seconds, a power user can manage several documents without losing state, a security reviewer can verify that nothing leaves the device, and a design-conscious user can make the rendered document feel unmistakably theirs without needing to understand CSS.
