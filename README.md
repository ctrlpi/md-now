# MD Now

[![Node 20+](https://img.shields.io/badge/node-20%2B-blue.svg)](https://nodejs.org/)
[![Version 0.9.15](https://img.shields.io/badge/version-0.9.15-blue.svg)](https://github.com/ctrlpi/md-now/tags)
![Dependencies: 0](https://img.shields.io/badge/dependencies-0-brightgreen.svg)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
![Status: Beta](https://img.shields.io/badge/status-Beta-red.svg)

A tiny, **zero-dependency** local Markdown browser. Point it at a folder, and it scans
that folder (and all sub-folders) for Markdown files, lists them in a sidebar with handy
metadata, and renders the selected file.

## Requirements

- Node.js 20 or newer is recommended. The server uses only Node built-ins.
- A modern browser with internet access to load marked and DOMPurify from CDNs.
- macOS for the native folder picker and Finder actions. On other systems, select
  a folder through the command line; set `MD_EDITOR` to an installed editor command.

## Quick start

Run it without installing:

```bash
npx md-now
```

Or install globally for the `md-now` command:

```bash
npm install -g md-now
md-now
```

## Usage

```bash
npx md-now [root-dir] [--port PORT] [--no-open]
```

- **`root-dir`**: folder to scan. Defaults to `$ROOT`, else your `~/Documents`
  (falling back to your home directory if that doesn't exist).
- **`--port` / `-p`**: port to listen on. Defaults to `$PORT`, else `8181`.
- **`--no-open`**: start without opening a browser. `npm run dev` uses this option.
- **`--help` / `-h`**: show help.
- **`--version` / `-v`**: show version.

For development, `npm run dev` restarts the server when `server.js` or `page.html` changes.

The server opens the viewer in your default browser and prints its URL on startup.
Examples:

```bash
npx md-now ~/notes       # scan ~/notes
npx md-now --port 9000   # scan ~/Documents on port 9000
ROOT=~/wiki PORT=3000 npx md-now
```

## Features

- **Recursive scan** of `.md`, `.markdown`, `.mdown`, `.mkd` files, skipping noise like
  `node_modules`, `.git`, `dist`, `build`, and dotfile directories.
- **Sidebar metadata** per file: title (first non-empty line with Markdown formatting
  stripped), size, modified time ("3h ago"), and word count, sorted newest first.
- **Instant filter** box to narrow the file list.
- **Faithful rendering** of headings, code, tables, blockquotes, task lists, etc.
- **Favorites & Folder switcher**: Save your favorite folders (stored in `~/.ctrlpi/md-now.json`) for quick access as clickable pills, alongside a native folder picker.
- **Auto-refresh**: reload the open file every 3/5/10/30s to watch a doc as you edit it.

## Security

The server listens on `127.0.0.1` for local access only. The folder-switching API
accepts folders within your home directory. The native macOS picker and startup
root argument can select folders elsewhere. File requests require a Markdown
extension and a real filesystem path within the active scan root, including symlink
targets. Action routes require POST requests with a session token, and the server
checks request hosts and origins. DOMPurify sanitizes rendered Markdown HTML.

## Tests

Run `npm test` or `node test.js` from the source checkout. The single-file suite
covers 17 areas using temporary fixtures and mocked HTTP dispatch, system commands,
DOM elements, and timers. It does not launch applications or verify browser layout.
GitHub Actions runs the suite and package preview on Linux and macOS with Node 22 and 24.

## License

[MIT](LICENSE)
