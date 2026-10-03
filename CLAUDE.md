# CLAUDE.md

This file provides guidance to Claude Code when working in this repository.

MD Now is a local Markdown browser. Its npm package is `md-now`,
with `md-now` and `mdv` commands.

## Development

```bash
node server.js [root-dir] [--port PORT] [--skip-open]
npm run dev
npm test
```

Normal startup opens the default browser unless `--skip-open` is supplied.
Development mode restarts on edits without opening a browser. The port defaults to
`$PORT`, then `8181`. The scan root defaults
to `$ROOT`, then Documents, then home. The server binds to `127.0.0.1`.

The server uses Node built-ins with no build step. The browser loads `marked`
and DOMPurify from CDNs, so Markdown rendering needs network access. The native picker and
Finder actions require macOS. `$MD_EDITOR` selects an editor command; otherwise
Edit tries `code` and falls back to `open -t`.

## Files

- `server.js`: HTTP routes and startup logic.
- `page.html`: viewer HTML, CSS, and JavaScript. The server replaces
  `{{ACTION_TOKEN}}` with the per-session token when loading the page.
- `test.js`: 17 tests with temporary fixtures and mocked HTTP dispatch, system
  commands, DOM elements, and timers. Browser layout is not tested.
- `README.md`: installation, usage, features, and test instructions.

Development mode watches both `server.js` and `page.html`.

The package includes `server.js`, `page.html`, `README.md`, and `LICENSE`. Keep `server.js`
executable and update the version in `package.json` before publishing.

## Routes

- `/`: serves the viewer.
- `/api/files`: returns the scan root, home, presets, and file metadata.
- `/api/root?path=<dir>`: switches to a folder within home.
- `/api/pick`: opens the native picker and accepts the selected folder, including
  locations outside home. Cancellation leaves the root unchanged.
- `/api/open`: opens the active scan folder in Finder.
- `/api/edit?path=<rel>`: opens the selected Markdown file in the editor.
- `/api/raw?path=<rel>`: returns Markdown text with `Cache-Control: no-store`.

Root switching, picking, opening, and editing require POST with the per-session
token. Other routes use GET. Validate hosts and origins before dispatching routes.

`currentRoot` changes when a folder is selected. File requests use `safeResolve`
to check real filesystem paths, including symlink targets, against this root and
require a Markdown extension. Sanitize rendered Markdown with DOMPurify before
assigning it to the DOM; never fall back to unsanitized HTML.
Normalize picker results with `path.resolve` before storing the root.

## Viewer behavior

The top bar contains the MD Now brand, Documents preset, folder picker, root
path, Open button, file count, and instruction-file toggle. Open is enabled once
a folder loads. The toggle hides both `CLAUDE.md` and `AGENTS.md` by default,
matching filenames case-insensitively.

The file toolbar places Edit immediately before Refresh and Auto-refresh.
These controls require a selected file. The countdown shows `now` at zero and
reserves fixed space only while auto-refresh is enabled.

The sidebar starts at 22% width and supports resizing and search. File metadata
uses the first non-empty line as the title, strips Markdown formatting, and sorts
files newest first. Preserve standard Markdown rendering and keep comments
short, describing current behavior and constraints.
