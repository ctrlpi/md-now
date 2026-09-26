#!/usr/bin/env node
'use strict';

/*
 * MD Viewer: a tiny local Markdown browser.
 *
 * Scans folders for Markdown files and displays them with metadata.
 * The server uses Node built-ins; the browser loads marked from a CDN.
 *
 * Usage:
 *   node server.js [root-dir] [--port 8080] [--no-open]
 *   ROOT and PORT environment variables provide defaults.
 */

const http = require('http');
const fs   = require('fs');
const os   = require('os');
const path = require('path');
const { URL } = require('url');
const { execFile } = require('child_process');
const { randomBytes } = require('crypto');
const ACTION_TOKEN = randomBytes(32).toString('hex');

function openBrowser(target) {
  if (process.platform === 'darwin') execFile('open', [target], () => {});
  else if (process.platform === 'win32') execFile('cmd.exe', ['/c', 'start', '""', target], () => {});
  else execFile('xdg-open', [target], () => {});
}

// Config
const args = process.argv.slice(2);
let rootArg = null;
let portArg = null;
let noOpen = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--help' || args[i] === '-h') {
    console.log('Usage: md-viewer [root-dir] [--port PORT] [--no-open]');
    console.log('\nOptions:');
    console.log('  -p, --port <PORT>  Port to listen on (default: $PORT or 8181)');
    console.log('  --no-open          Start without opening a browser');
    console.log('  -v, --version      Show version');
    console.log('  -h, --help         Show help');
    process.exit(0);
  } else if (args[i] === '--version' || args[i] === '-v') {
    console.log(require('./package.json').version);
    process.exit(0);
  } else if (args[i] === '--port' || args[i] === '-p') portArg = args[++i] ?? '';
  else if (args[i] === '--no-open') noOpen = true;
  else if (!rootArg) rootArg = args[i];
}

// Home anchors presets and relative paths supplied to the root-switch route.
const HOME = os.homedir();
const isDir = (p) => { try { return fs.statSync(p).isDirectory(); } catch { return false; } };
// Start in the user's Documents folder (falling back to home if it's missing).
const DEFAULT_ROOT = isDir(path.join(HOME, 'Documents')) ? path.join(HOME, 'Documents') : HOME;
let currentRoot = path.resolve(rootArg || process.env.ROOT || DEFAULT_ROOT);
const portValue = portArg ?? process.env.PORT ?? '8181';
const PORT = Number(portValue);
if (!/^\d+$/.test(portValue) || !Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  console.error('Invalid port: use a number from 1 to 65535.');
  process.exit(1);
}
if (!isDir(currentRoot)) {
  console.error('Scan folder does not exist: ' + currentRoot);
  process.exit(1);
}

// Quick-switch folders shown as buttons in the UI.
function presets() {
  const list = [
    { label: 'Documents', path: path.join(HOME, 'Documents') },
  ];
  return list.map(p => ({ ...p, available: isDir(p.path), active: p.path === currentRoot }));
}

function withinHome(full) { return full === HOME || full.startsWith(HOME + path.sep); }
// Switch to a folder within home; return an error string on failure.
function setRoot(rel) {
  if (typeof rel !== 'string' || !rel) return 'No folder given';
  const full = path.resolve(HOME, rel); // absolute input is used as-is; relative is taken from HOME
  if (!withinHome(full)) return 'Folder must be inside your home directory';
  if (!isDir(full)) return 'Folder not found';
  currentRoot = full;
  return null;
}

const MD_EXT = new Set(['.md', '.markdown', '.mdown', '.mkd']);
const SKIP_DIRS = new Set(['node_modules', '.git', '.svn', '.hg', 'dist', 'build', '.next', '.cache', 'venv']);

// Helpers
function humanSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  const units = ['KB', 'MB', 'GB'];
  let n = bytes / 1024, i = 0;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return (n < 10 ? n.toFixed(1) : Math.round(n)) + ' ' + units[i];
}

function timeAgo(ms) {
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);   if (m < 60) return m + 'm ago';
  const h = Math.round(m / 60);   if (h < 24) return h + 'h ago';
  const d = Math.round(h / 24);   if (d < 30) return d + 'd ago';
  const mo = Math.round(d / 30);  if (mo < 12) return mo + 'mo ago';
  return Math.round(mo / 12) + 'y ago';
}

// Use the first non-empty line as the title and count words and lines.
function inspect(content) {
  const lines = content.split(/\r?\n/);
  let title = '';
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    const h = t.match(/^#{1,6}\s+(.*)$/);
    title = (h ? h[1] : t).replace(/[#*`_>~]/g, '').trim();
    if (title) break;
  }
  const words = (content.match(/\S+/g) || []).length;
  return { title, words, lines: lines.length };
}

// Collect Markdown files recursively, skipping excluded directories.
function walk(dir, out) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch { return; }
  for (const ent of entries) {
    if (ent.name.startsWith('.') && ent.isDirectory()) continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (SKIP_DIRS.has(ent.name)) continue;
      walk(full, out);
    } else if (ent.isFile() && MD_EXT.has(path.extname(ent.name).toLowerCase())) {
      out.push(full);
    }
  }
}

function listFiles() {
  const files = [];
  walk(currentRoot, files);
  const result = [];
  for (const full of files) {
    let stat, content;
    try {
      stat = fs.statSync(full);
      content = fs.readFileSync(full, 'utf8');
    } catch { continue; }
    const rel = path.relative(currentRoot, full);
    const meta = inspect(content);
    result.push({
      path: rel.split(path.sep).join('/'),
      name: path.basename(full),
      dir: path.dirname(rel) === '.' ? '' : path.dirname(rel).split(path.sep).join('/'),
      size: stat.size,
      sizeHuman: humanSize(stat.size),
      mtime: stat.mtimeMs,
      mtimeAgo: timeAgo(stat.mtimeMs),
      title: meta.title,
      words: meta.words,
      lines: meta.lines,
    });
  }
  result.sort((a, b) => b.mtime - a.mtime); // most recently modified first
  return result;
}

// Require a Markdown extension and a resolved path within the current scan root.
function safeResolve(rel) {
  if (typeof rel !== 'string' || !rel) return null;
  const full = path.resolve(currentRoot, rel);
  const within = full === currentRoot || full.startsWith(currentRoot + path.sep);
  if (!within) return null;
  if (!MD_EXT.has(path.extname(full).toLowerCase())) return null;
  try {
    const realRoot = fs.realpathSync(currentRoot);
    const realParent = fs.realpathSync(path.dirname(full));
    let realFile;
    try { realFile = fs.realpathSync(full); }
    catch (error) {
      if (error.code !== 'ENOENT') return null;
      realFile = path.join(realParent, path.basename(full));
    }
    return realFile.startsWith(realRoot + path.sep) ? realFile : null;
  } catch { return null; }
}

// Routing
const server = http.createServer((req, res) => {
  const allowedHosts = ['localhost:' + PORT, '127.0.0.1:' + PORT];
  if (!allowedHosts.includes(req.headers.host)) {
    res.writeHead(403); res.end('Forbidden host'); return;
  }
  if (req.headers.origin && req.headers.origin !== 'http://' + req.headers.host) {
    res.writeHead(403); res.end('Forbidden origin'); return;
  }
  const parsed = new URL(req.url, 'http://localhost');
  const pathname = parsed.pathname;
  const action = ['/api/root', '/api/pick', '/api/open', '/api/edit'].includes(pathname);
  if (action && req.method !== 'POST') {
    res.writeHead(405, { Allow: 'POST' }); res.end('Use POST'); return;
  }
  if (action && req.headers['x-md-viewer-token'] !== ACTION_TOKEN) {
    res.writeHead(403); res.end('Forbidden request'); return;
  }

  if (pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(PAGE);
    return;
  }

  if (pathname === '/api/files') {
    try {
      const data = JSON.stringify({ root: currentRoot, home: HOME, presets: presets(), files: listFiles() });
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(data);
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: String(e) }));
    }
    return;
  }

  if (pathname === '/api/root') {
    const err = setRoot(parsed.searchParams.get('path'));
    if (err) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: err }));
      return;
    }
    console.log(`switched root → ${currentRoot}`);
    const data = JSON.stringify({ root: currentRoot, home: HOME, presets: presets(), files: listFiles() });
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(data);
    return;
  }

  // The native picker permits folders outside home and waits for user selection.
  if (pathname === '/api/pick') {
    const script =
      'POSIX path of (choose folder with prompt "Select a folder to browse" ' +
      'default location (POSIX file ' + JSON.stringify(currentRoot) + '))';
    execFile('osascript', ['-e', script], (err, stdout) => {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      if (err) { res.end(JSON.stringify({ canceled: true })); return; } // includes "User canceled"
      // Normalize the picker's trailing slash before storing the scan root.
      const dir = path.resolve(stdout.trim());
      if (!isDir(dir)) { res.end(JSON.stringify({ error: 'Folder not found' })); return; }
      currentRoot = dir;
      console.log(`switched root → ${currentRoot}`);
      res.end(JSON.stringify({ root: currentRoot, home: HOME, presets: presets(), files: listFiles() }));
    });
    return;
  }

  // Open the active scan folder in Finder.
  if (pathname === '/api/open') {
    execFile('open', [currentRoot], err => { if (err) console.error('open folder failed:', err); });
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  // Open a file in the user's editor. $MD_EDITOR overrides; otherwise try VS Code
  // (`code`) and fall back to the default text editor (`open -t`).
  if (pathname === '/api/edit') {
    const full = safeResolve(parsed.searchParams.get('path'));
    if (!full) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Bad path' }));
      return;
    }
    if (process.env.MD_EDITOR) {
      execFile(process.env.MD_EDITOR, [full], err => { if (err) console.error('edit failed:', err); });
    } else {
      execFile('code', [full], err => {
        if (err) execFile('open', ['-t', full], e2 => { if (e2) console.error('edit failed:', e2); });
      });
    }
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (pathname === '/api/raw') {
    const full = safeResolve(parsed.searchParams.get('path'));
    if (!full) { res.writeHead(400); res.end('Bad path'); return; }
    fs.readFile(full, 'utf8', (err, data) => {
      if (err) { res.writeHead(404); res.end('Not found'); return; }
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(data);
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
});

server.on('error', error => {
  console.error(error.code === 'EADDRINUSE'
    ? 'Port ' + PORT + ' is already in use. Choose another with --port.'
    : 'Could not start MD Viewer: ' + error.message);
  process.exitCode = 1;
});
server.listen(PORT, '127.0.0.1', () => {
  const addr = `http://localhost:${PORT}`;
  const bar = '-'.repeat(addr.length);
  console.log('MD Viewer started on → ');
  console.log(bar);
  console.log(addr);
  console.log(bar);
  console.log(`scanning: ${currentRoot}`);
  if (!noOpen) openBrowser(addr);
});

// Load the viewer relative to the executable, regardless of the working directory.
const PAGE = fs.readFileSync(path.join(__dirname, 'page.html'), 'utf8')
  .replace('{{ACTION_TOKEN}}', ACTION_TOKEN);
