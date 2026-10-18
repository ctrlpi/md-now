# CLAUDE.md

This file provides guidance to Claude Code when working in this repository.

**`README.md` is done.** Do not edit it without the user's explicit confirmation first, even for small wording/formatting fixes.

MD Now is a local Markdown browser. Its npm package is `md-now`,
with `md-now` and `mdv` commands.

## Development

```bash
node server.js [root-dir | file] [--port PORT] [--skip-open]
npm run dev
npm test
```

Normal startup opens the default browser unless `--skip-open` is supplied.
Development mode restarts on edits without opening a browser. The port defaults to
`$PORT`, then `8181`. The scan root defaults to `$ROOT`, then the first saved
favorite, then Documents, then home. A file argument opens that file once and scans
its folder. The server binds to `127.0.0.1`.

The server uses Node built-ins with no build step. The browser loads `marked`
and DOMPurify from CDNs, so Markdown rendering needs network access. Both script tags
pin an exact version with an SRI `integrity` hash; recompute the hash whenever a version
changes. The native picker requires macOS. `$MD_EDITOR` selects an editor executable;
otherwise Edit tries `code` and falls back to `open -t`, `explorer`, or `xdg-open`.

Favorites and filters are stored in `~/.ctrlpi/md-now.json`. `loadConfig` fills
missing filters from defaults and copies an unreadable file to `md-now.json.bak`
before replacing it.

## Files

- `server.js`: HTTP routes and startup logic.
- `page.html`: viewer HTML, CSS, and JavaScript. The server replaces
  `{{ACTION_TOKEN}}` with the per-session token when loading the page.
- `test.js`: 30 tests with temporary fixtures and mocked HTTP dispatch, system
  commands, DOM elements, and timers. Browser layout is not tested.
- `README.md`: installation, usage, features, and test instructions.

Development mode watches both `server.js` and `page.html`.

The package includes `server.js`, `page.html`, `README.md`, and `LICENSE`. Keep `server.js`
executable and update the version in `package.json` before publishing.

## Routes

- `/`: serves the viewer.
- `/api/ping`: returns `ok` for the reconnect check.
- `/api/files`: returns the scan root, home, presets, filters, file metadata, and the
  startup file.
- `/api/root?path=<dir>`: switches to a folder within home, within the current root,
  or saved as a favorite.
- `/api/pick`: opens the native picker and accepts the selected folder, including
  locations outside home. Cancellation leaves the root unchanged.
- `/api/open`: opens the active scan folder in Finder, Explorer, or `xdg-open`.
- `/api/edit?path=<rel>`: opens the selected file in the editor.
- `/api/save?path=<rel>`: saves content to the selected file.
- `/api/delete?path=<rel>`: permanently deletes the selected file.
- `/api/raw?path=<rel>`: returns file text with `Cache-Control: no-store`.
- `/api/filters`: saves filter settings, keeping only known boolean keys.
- `/api/favorite?path=<dir>&label=<name>`: adds or removes a favorite.
- `/api/favorites/reorder?from=<i>&to=<j>`: moves a favorite.

Root switching, picking, opening, editing, saving, deleting, filters, and favorites
require POST with the per-session `X-MD-Now-Token` header. Other routes use GET.
Validate hosts and origins before dispatching routes.

`currentRoot` changes when a folder is selected. File requests use `safeResolve`
to check real filesystem paths, including symlink targets, against this root and
require a supported extension (`FILE_EXT`). Sanitize rendered Markdown with DOMPurify
before assigning it to the DOM; never fall back to unsanitized HTML.
Normalize picker results with `path.resolve` before storing the root.

## Viewer behavior

The top bar contains the MD Now brand, favorite folder pills (Documents by default),
folder picker, root path, favorite toggle, Open button, files filter menu, subfolder
toggle, and theme toggle. Open is enabled once a folder loads. The filter menu toggles
Markdown, LLM files (`CLAUDE.md`, `AGENTS.md`, case-insensitive), `.json`, `.txt`, and
hidden folders (folders starting with `.`). Markdown and LLM files are shown by default.

The file toolbar shows the file name or file count, then Edit in browser, Edit, Delete
(red trash icon with a confirmation popup), Refresh, and Auto-refresh. These controls
require a selected file. The countdown shows `now` at zero and reserves fixed space only
while auto-refresh is enabled.

The sidebar starts at 22% width and supports resizing and search. File metadata
uses the first non-empty line as the title, strips Markdown formatting, and sorts
files newest first. Preserve standard Markdown rendering and keep comments
short, describing current behavior and constraints.
