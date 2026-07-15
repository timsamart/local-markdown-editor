# Local Markdown Studio

A private, fully local Markdown reader and multi-document editor with Mermaid support. The distributable is one self-contained HTML file with no CDN, server, account, telemetry, or runtime installation.

## Use it

Open [`markdown-studio.html`](./markdown-studio.html) in a modern browser, then drop one or more Markdown files onto the window.

- **Workspace:** sidebar document rail with multi-select, bulk close/download/archive, auto-naming from headings, double-click rename, CodeMirror editing, live preview, outline chapter editing, recovery drafts, direct save where supported, and download fallback
- **Reader:** focused typography, reading progress, outline, printing, rendered Mermaid diagrams, and drop-to-read at any time
- **Theme Studio:** ten document presets—including a serene Folio reading theme and an embedded R+V brand style—plus custom font, size, line height, width, and color controls
- **Local-first:** Markdown and Mermaid output are sanitized; sanitized raw HTML is enabled by default and can be disabled; remote images are blocked

Useful shortcuts:

| Action | Shortcut |
|---|---|
| Open files | `Ctrl/Cmd + O` |
| New document | `Ctrl/Cmd + N` |
| Save | `Ctrl/Cmd + S` |
| Commands | `Ctrl/Cmd + K` |
| Reader mode | `Ctrl/Cmd + Shift + R` |
| Toggle preview | `Ctrl/Cmd + Shift + V` |

## Build it

The source remains modular while the release is compiled into a single portable file.

```sh
npm install
npm run build
```

The build writes `markdown-studio.html`. End users only need that file.

## Publish it

The repository includes a GitHub Pages workflow that builds the app, copies the generated `markdown-studio.html` to `index.html`, and deploys that static artifact.

To enable it, open the repository on GitHub, go to **Settings -> Pages**, and set **Build and deployment** to **GitHub Actions**. After that, every push to `main` publishes the latest build, and the workflow can also be run manually from the **Actions** tab.

## Security posture

- No network calls are required or initiated by the application during normal use.
- Raw Markdown HTML is rendered by default after sanitization and can be disabled in Theme Studio.
- Remote images are rejected before insertion into the document.
- Rendered Markdown and Mermaid SVG are sanitized.
- Mermaid runs with strict security settings.
- External links require confirmation before opening.
- Sessions, preferences, and recovery drafts stay in browser-local storage.

Review the complete product decisions in [CONCEPT.md](./CONCEPT.md).
