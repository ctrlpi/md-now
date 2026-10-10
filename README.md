# MD Now

[![Node 20+](https://img.shields.io/badge/node-20%2B-blue.svg)](https://nodejs.org/)
[![Version 0.9.18](https://img.shields.io/badge/version-0.9.18-blue.svg)](https://github.com/ctrlpi/md-now/tags)
![Dependencies: 0](https://img.shields.io/badge/dependencies-0-brightgreen.svg)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
![Status: Beta](https://img.shields.io/badge/status-Beta-red.svg)
[![CI](https://github.com/ctrlpi/md-now/actions/workflows/ci.yml/badge.svg)](https://github.com/ctrlpi/md-now/actions/workflows/ci.yml)

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
npx md-now [root-dir | file.md] [--port PORT] [--skip-open]
```

- **`root-dir` / `file.md`**: folder to scan, or a specific markdown file to open immediately (which sets its parent folder as the root). Defaults to `$ROOT`, else your `~/Documents`
  (falling back to your home directory if that doesn't exist).
- **`--port` / `-p`**: port to listen on. Defaults to `$PORT`, else `8181`.
- **`--skip-open`**: start without opening a browser. `npm run dev` uses this option.
- **`--help` / `-h`**: show help.
- **`--version` / `-v`**: show version.

For development, `npm run dev` restarts the server when `server.js` or `page.html` changes.

The server opens the viewer in your default browser and prints its URL on startup.
Examples:

```bash
npx md-now ~/notes               # scan ~/notes
npx md-now ~/notes/meeting.md    # view meeting.md (scans ~/notes)
npx md-now --port 9000           # scan ~/Documents on port 9000
ROOT=~/wiki PORT=3000 npx md-now
```

## Features

- **File list & Viewer**: Instantly browse Markdown files with a clean layout showing a file list on the left and beautifully rendered content on the right.
- **Online Edit**: A built-in split-screen editor for quick changes with live side-by-side preview.
- **Faithful rendering**: Supports headings, code blocks, tables, blockquotes, task lists, and more.
- **Sidebar metadata & filtering**: Each file shows its title, size, modification time, and word count. A lightning-fast search box lets you narrow down your file list instantly.
- **Favorites & Folder switcher**: Save your favorite folders (stored in `~/.ctrlpi/md-now.json`) for quick access as clickable pills, alongside a native macOS folder picker.
- **Subfolder filter**: Toggle to hide deeply nested subfolders and cleanly display folder summaries.
- **Auto-refresh**: Reload the open file every 3/5/10/30s to watch a document update as you edit it in your favorite external editor.
- **Recursive scan**: Automatically finds all `.md` and `.markdown` files, intelligently skipping noise like `node_modules`, `.git`, `dist`, and dotfile directories.
- **iCloud optimization**: Safely skips dataless iCloud placeholder files without freezing, marking them seamlessly as "In the cloud".

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
GitHub Actions runs the suite and package preview on Linux and macOS with Node.

## License

[MIT](LICENSE)
