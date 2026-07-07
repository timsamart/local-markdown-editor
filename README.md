# Local Markdown Studio

A private, fully local Markdown reader and multi-document editor with Mermaid support. The distributable is one self-contained HTML file with no CDN, server, account, telemetry, or runtime installation.

## Use it

Open [`markdown-studio.html`](./markdown-studio.html) in a modern browser, then drop one or more Markdown files onto the window.

- **Workspace:** multi-file tabs, CodeMirror editing, live preview, document outline, recovery drafts, direct save where supported, and download fallback
- **Reader:** focused typography, reading progress, outline, printing, and rendered Mermaid diagrams
- **Theme Studio:** eight document presets plus custom font, size, line height, width, and color controls
- **Local-first:** Markdown and Mermaid output are sanitized; raw HTML and remote images are disabled

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

## Security posture

- No network calls are required or initiated by the application during normal use.
- Raw Markdown HTML is disabled.
- Remote images are rejected before insertion into the document.
- Rendered Markdown and Mermaid SVG are sanitized.
- Mermaid runs with strict security settings.
- External links require confirmation before opening.
- Sessions, preferences, and recovery drafts stay in browser-local storage.

Review the complete product decisions in [CONCEPT.md](./CONCEPT.md).
