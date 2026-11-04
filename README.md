# MD Now

[![Node 20+](https://img.shields.io/badge/node-20%2B-blue.svg)](https://nodejs.org/)
[![Version 0.9.20](https://img.shields.io/badge/version-0.9.20-blue.svg)](https://github.com/ctrlpi/md-now/tags)
![Dependencies: 0](https://img.shields.io/badge/dependencies-0-brightgreen.svg)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
![Status: Beta](https://img.shields.io/badge/status-Beta-red.svg)
[![CI](https://github.com/ctrlpi/md-now/actions/workflows/ci.yml/badge.svg)](https://github.com/ctrlpi/md-now/actions/workflows/ci.yml)

A tiny, **zero-dependency** local Markdown browser. Point it at a folder, and it scans
that folder (and all sub-folders) for Markdown, JSON, and text files, lists them in a
sidebar with handy metadata, and renders the selected file.

## Requirements

- Node.js 20 or newer is recommended. The server uses only Node built-ins.

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

## Features

- **File list & viewer**: Browse files in a resizable sidebar and read the rendered content on the right.
- **Faithful rendering**: Supports headings, code blocks with copy buttons, tables, blockquotes, task lists, and more. JSON is pretty-printed and text files are shown as-is.
- **In-browser editing**: Edit a file with a live side-by-side preview. Double-click a file to start editing.
- **External editor**: Open the selected file in your editor (see `MD_EDITOR`).
- **Delete**: Delete the selected file after confirmation. Deletion is permanent; the file is not moved to the Trash.
- **Sidebar metadata & search**: Each file shows its title, word count (fields for JSON), size, and modification time, newest first. The search box filters by path and title.
- **File filters**: Show or hide Markdown files, LLM instruction files (`CLAUDE.md`, `AGENTS.md`), `.json`, `.txt`, `.html`, and hidden folders. Markdown and LLM files are shown by default. HTML files render as pages in a sandboxed frame.
- **Favorites & folder switcher**: Save folders as clickable pills, reorder them by dragging, or pick a folder with the native macOS picker (elsewhere, pass it on the command line).
- **Subfolder view**: Hide files in subfolders and show folder rows with file counts instead.
- **Auto-refresh**: Reload the open file every 3/5/10/30s to watch a document update as you edit it elsewhere.
- **Recursive scan**: Finds `.md`, `.markdown`, `.mdown`, `.mkd`, `.json`, `.txt`, `.html`, and `.htm` files, skipping `node_modules`, `.git`, `dist`, `build`, `venv`, and similar folders.
- **iCloud support**: Lists iCloud files that are not downloaded as "In the cloud" without reading them.
- **Dark mode**: Follows the system theme, with a toggle in the top bar.
- **Reconnect**: Shows a banner when the server stops and reloads the page when it returns.

Favorites and filter settings are stored in `~/.ctrlpi/md-now.json`. If that file
cannot be read, it is copied to `md-now.json.bak` and replaced with defaults.

## Usage

```bash
npx md-now [root-dir | file] [--port PORT] [--skip-open]
```

- **`root-dir` / `file`**: folder to scan, or a supported file to open immediately (its
  parent folder becomes the root). Defaults to `$ROOT`, else your first saved favorite
  (initially `~/Documents`), else your home directory.
- **`--port` / `-p`**: port to listen on. Defaults to `$PORT`, else `8181`.
- **`--skip-open`**: start without opening a browser. `npm run dev` uses this option.
- **`--help` / `-h`**: show help.
- **`--version` / `-v`**: show version.

Environment variables:

- **`ROOT`**: default folder to scan.
- **`PORT`**: default port.
- **`MD_EDITOR`**: editor executable used by Edit, for example `subl`. It receives the
  file path as its only argument, so it cannot include extra flags. Without it, Edit
  tries VS Code (`code`), then the default text editor on macOS or the default app for
  the file elsewhere.

For development, `npm run dev` restarts the server when `server.js` or `page.html` changes.

The server opens the viewer in your default browser and prints its URL on startup.
Examples:

```bash
npx md-now ~/notes               # scan ~/notes
npx md-now ~/notes/meeting.md    # view meeting.md (scans ~/notes)
npx md-now --port 9000           # scan ~/Documents on port 9000
ROOT=~/wiki PORT=3000 npx md-now
```

## Security

The server listens on `127.0.0.1` for local access only. The folder-switching API
accepts folders within your home directory, within the current folder, or saved as
favorites. The native macOS picker and startup root argument can select folders
elsewhere. File requests require a supported extension and a real filesystem path
within the active scan root, including symlink targets. The viewer can save and delete
files within the scan root. Every route that changes state requires a POST request with
a per-session token, and the server checks request hosts and origins. DOMPurify
sanitizes rendered Markdown HTML. marked and DOMPurify load from CDNs (internet required),
pinned with SRI hashes.

## Tests

Run `npm test` or `node test.js` from the source checkout. The single-file suite
covers 30 areas using temporary fixtures and mocked HTTP dispatch, system commands,
DOM elements, and timers. It does not launch applications or verify browser layout.
GitHub Actions runs the suite on Linux, Windows, and macOS with Node 22, 24, and 26.

## License

[MIT](LICENSE)
