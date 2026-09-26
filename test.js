'use strict';

// Run with node test.js. All fixtures and mocks live in this file.
// HTTP dispatch, OS commands, DOM, and timers are mocked; no applications launch.
const assert = require('assert').strict;
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');
const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'md-viewer-test-'));
const home = path.join(sandbox, 'home');
const root = path.join(home, 'Documents');
const other = path.join(home, 'other');
const outside = path.join(sandbox, 'outside');
const note = '# Hello world\nOne two three\n';
function write(dir, name, text = '# Fixture\n') {
  const file = path.join(dir, name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
  return file;
}
write(root, 'note.md', note);
for (const name of ['nested/a.markdown', 'nested/b.mdown', 'nested/c.mkd', 'upper.MD', 'CLAUDE.md', 'agents.md', 'plain.txt']) write(root, name);
for (const dir of ['.hidden', '.git', 'node_modules', 'venv', 'dist', 'build']) write(root, dir + '/ignored.md');
write(other, 'other.md');
write(outside, 'outside.md');
fs.utimesSync(path.join(root, 'note.md'), new Date('2020-01-01'), new Date('2020-01-01'));

function backend(env = {}, args = [root, '--port', '9234']) {
  let handler, listen, listenHost, ready, onError, token;
  const calls = [];
  const errors = [];
  const fakeProcess = { argv: ['node', 'server.js', ...args], env, platform: 'darwin',
    exit(code) { throw new Error('Exit ' + code + ': ' + errors.join(' ')); } };
  const context = vm.createContext({
    __dirname,
    console: { log() {}, error(message) { errors.push(message); } },
    process: fakeProcess,
    require(name) {
      if (name === 'http') return { createServer(fn) {
        handler = fn;
        return { on(event, fn) { onError = fn; },
          listen(port, host, callback) { listen = port; listenHost = host; ready = callback; } };
      } };
      if (name === 'os') return { homedir: () => home };
      if (name === 'child_process') return { execFile(command, args, callback) {
        calls.push({ command, args: Array.from(args) });
        const result = api.commandResult(command, args) || {};
        callback(result.error || null, result.stdout || '');
      } };
      return require(name);
    },
  });
  const api = {
    calls, errors, process: fakeProcess, commandResult: () => ({}),
    request(url, options = {}) {
      return new Promise((resolve, reject) => {
        const response = { status: 200, headers: {} };
        try {
          const action = /^\/api\/(root|pick|open|edit)(\?|$)/.test(url);
          const headers = { host: 'localhost:9234', 'x-md-viewer-token': token };
          for (const [key, value] of Object.entries(options.headers || {})) headers[key.toLowerCase()] = value;
          handler({ url, method: options.method || (action ? 'POST' : 'GET'), headers }, {
            writeHead(status, headers = {}) { response.status = status; response.headers = headers; },
            end(body = '') { resolve({ ...response, body, json: () => JSON.parse(body) }); },
          });
        } catch (error) { reject(error); }
      });
    },
  };
  vm.runInContext(source, context, { filename: 'server.js' });
  token = vm.runInContext('ACTION_TOKEN', context);
  ready();
  api.fail = error => onError(error);
  api.port = listen;
  api.host = listenHost;
  return api;
}

async function frontend(api) {
  const html = (await api.request('/')).body;
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  const elements = new Map();
  function element(id) {
    if (!elements.has(id)) elements.set(id, {
      value: '', textContent: '', innerHTML: '', style: {}, disabled: true, scrollTop: 0,
      classList: { add() {}, remove() {}, toggle() {} },
      addEventListener() {}, querySelectorAll: () => [],
    });
    return elements.get(id);
  }
  const timers = new Map();
  let timerId = 0, now = 0;
  const requests = [];
  const context = vm.createContext({
    document: { getElementById: element, querySelectorAll: () => [], title: '' },
    marked: { parse: text => text },
    DOMPurify: { sanitize: text => text }, // Integration is checked separately in a real browser.
    console,
    fetch: async (url, options = {}) => {
      requests.push(url);
      const res = await api.request(url, { ...options, method: options.method || 'GET' });
      return { ok: res.status === 200, json: res.json, text: async () => res.body };
    },
    setInterval(fn, delay) { const id = ++timerId; timers.set(id, { fn, delay, next: now + delay }); return id; },
    clearInterval(id) { timers.delete(id); },
    setTimeout() {},
    alert(message) { throw new Error(message); },
  });
  vm.runInContext(script, context, { filename: 'viewer-inline.js' });
  const settle = () => new Promise(resolve => setImmediate(resolve));
  await settle();
  return {
    element, timers, requests,
    run: code => vm.runInContext(code, context),
    async tick(seconds) {
      for (let i = 0; i < seconds; i++) {
        now += 1000;
        for (const timer of timers.values()) if (timer.next <= now) { timer.next += timer.delay; timer.fn(); }
        await settle();
      }
    },
  };
}

const tests = [
  ['Startup and viewer page', async () => {
    const api = backend();
    assert.equal(api.port, 9234);
    assert.equal(api.host, '127.0.0.1');
    assert.deepEqual(api.calls, [{ command: 'open', args: ['http://localhost:9234'] }]);
    const res = await api.request('/');
    assert.equal(res.status, 200);
    assert.match(res.headers['Content-Type'], /text\/html/);
    assert.match(res.body, /<title>MD Viewer<\/title>/);
    assert.equal((await api.request('/unknown')).status, 404);
  }],
  ['Recursive Markdown scanning', async () => {
    const files = (await backend().request('/api/files')).json().files;
    assert.deepEqual(files.map(f => f.path).sort(), ['CLAUDE.md', 'agents.md', 'nested/a.markdown', 'nested/b.mdown', 'nested/c.mkd', 'note.md', 'upper.MD'].sort());
  }],
  ['Excluded directories', async () => {
    const files = (await backend().request('/api/files')).json().files;
    assert(!files.some(f => f.name === 'ignored.md'));
    assert(files.some(f => f.path === 'nested/a.markdown'));
  }],
  ['Metadata and newest-first ordering', async () => {
    const files = (await backend().request('/api/files')).json().files;
    const file = files.find(f => f.name === 'note.md');
    assert.equal(file.title, 'Hello world');
    assert.equal(file.words, 6);
    assert.equal(file.lines, 3);
    assert.equal(file.size, Buffer.byteLength(note));
    assert.equal(file.sizeHuman, Buffer.byteLength(note) + ' B');
    assert.equal(files[files.length - 1].name, 'note.md');
    assert(files.every((f, i) => i === 0 || files[i - 1].mtime >= f.mtime));
  }],
  ['Raw Markdown and cache headers', async () => {
    const res = await backend().request('/api/raw?path=note.md');
    assert.equal(res.status, 200);
    assert.equal(res.body, note);
    assert.equal(res.headers['Cache-Control'], 'no-store');
  }],
  ['Invalid file requests', async () => {
    const api = backend();
    for (const route of ['/api/raw', '/api/edit']) {
      for (const value of ['', '../other/other.md', outside + '/outside.md', 'plain.txt']) {
        assert.equal((await api.request(route + '?path=' + encodeURIComponent(value))).status, 400);
      }
    }
    assert.equal((await api.request('/api/raw?path=missing.md')).status, 404);
    assert.equal(api.calls.length, 1, 'Invalid edit requests must not launch an editor');
  }],
  ['Folder switching and rejection', async () => {
    const api = backend();
    let res = await api.request('/api/root?path=' + encodeURIComponent(other));
    assert.equal(res.status, 200);
    assert.equal(res.json().root, other);
    assert.deepEqual(res.json().files.map(f => f.name), ['other.md']);
    for (const dir of [outside, home + '/missing', '']) {
      res = await api.request('/api/root?path=' + encodeURIComponent(dir));
      assert.equal(res.status, 400);
      assert.equal((await api.request('/api/files')).json().root, other);
    }
  }],
  ['Native picker selection and cancellation', async () => {
    const api = backend();
    api.commandResult = () => ({ stdout: outside + '/\n' });
    assert.equal((await api.request('/api/pick')).json().root, outside);
    assert.equal((await api.request('/api/raw?path=outside.md')).status, 200);
    api.commandResult = () => ({ error: new Error('Canceled') });
    assert.equal((await api.request('/api/pick')).json().canceled, true);
    api.commandResult = () => ({ stdout: outside + '/missing' });
    assert.equal((await api.request('/api/pick')).json().error, 'Folder not found');
    assert.equal((await api.request('/api/files')).json().root, outside);
  }],
  ['Open folder without selecting a file', async () => {
    const api = backend();
    const ui = await frontend(api);
    assert.equal(ui.element('rootopen').disabled, false);
    assert.equal(ui.element('rootedit').disabled, true);
    ui.run('openFolder()');
    assert.deepEqual(api.calls[api.calls.length - 1], { command: 'open', args: [root] });
    await ui.run('switchRoot(' + JSON.stringify(other) + ')');
    ui.run('openFolder()');
    assert.equal(ui.element('rootopen').disabled, false);
    assert.deepEqual(api.calls[api.calls.length - 1], { command: 'open', args: [other] });
  }],
  ['Editor selection and fallback', async () => {
    const full = fs.realpathSync(path.join(root, 'note.md'));
    const api = backend();
    await api.request('/api/edit?path=note.md');
    assert.deepEqual(api.calls[1], { command: 'code', args: [full] });
    api.commandResult = command => ({ error: command === 'code' ? new Error('Unavailable') : null });
    await api.request('/api/edit?path=note.md');
    assert.deepEqual(api.calls.slice(-2), [{ command: 'code', args: [full] }, { command: 'open', args: ['-t', full] }]);
    const custom = backend({ MD_EDITOR: '/custom/editor' });
    await custom.request('/api/edit?path=note.md');
    assert.deepEqual(custom.calls[1], { command: '/custom/editor', args: [full] });
  }],
  ['Instruction-file toggle and search', async () => {
    const ui = await frontend(backend());
    assert(!ui.element('filelist').innerHTML.includes('CLAUDE.md'));
    assert(!ui.element('filelist').innerHTML.includes('agents.md'));
    assert.equal(ui.element('count').textContent, '5 files');
    ui.run('toggleClaude()');
    assert(ui.element('filelist').innerHTML.includes('CLAUDE.md'));
    assert(ui.element('filelist').innerHTML.includes('agents.md'));
    assert.equal(ui.element('count').textContent, '7 files');
    ui.element('search').value = 'HELLO WORLD';
    ui.run('applyFilter()');
    assert(ui.element('filelist').innerHTML.includes('note.md'));
    assert(!ui.element('filelist').innerHTML.includes('upper.MD'));
    ui.element('search').value = 'agents';
    ui.run('toggleClaude()');
    assert.match(ui.element('filelist').innerHTML, /No markdown files found/);
  }],
  ['Auto-refresh cadence, countdown, and cleanup', async () => {
    const ui = await frontend(backend());
    await ui.run("openFile('note.md')");
    assert.equal(ui.element('refresh-btn').disabled, false);
    assert.equal(ui.element('auto-select').disabled, false);
    for (const seconds of [3, 5, 10, 30]) {
      ui.run('setAutoRefresh(' + seconds + ')');
      assert.equal(ui.timers.size, 2);
      assert.equal(ui.element('countdown').textContent, seconds + 's');
      const before = ui.requests.length;
      await ui.tick(seconds - 1);
      assert.equal(ui.requests.length, before);
      assert.equal(ui.element('countdown').textContent, '1s');
      await ui.tick(1);
      assert.equal(ui.element('countdown').textContent, 'now');
      assert.equal(ui.requests.length, before + 1);
      assert.equal(ui.requests[before], '/api/raw?path=note.md');
    }
    ui.run('setAutoRefresh(0)');
    assert.equal(ui.timers.size, 0);
    assert.equal(ui.element('countdown').textContent, '');
    const before = ui.requests.length;
    await ui.tick(30);
    assert.equal(ui.requests.length, before);
    ui.run('setAutoRefresh(3)');
    await ui.run('switchRoot(' + JSON.stringify(other) + ')');
    assert.equal(ui.timers.size, 0);
    assert.equal(ui.element('countdown').textContent, '');
    assert.equal(ui.element('refresh-btn').disabled, true);
  }],
  ['Symlink confinement for reads and edits', async () => {
    const api = backend();
    const link = path.join(root, 'escape.md');
    const dirLink = path.join(root, 'escape-dir');
    fs.symlinkSync(path.join(outside, 'outside.md'), link);
    fs.symlinkSync(outside, dirLink, 'dir');
    try {
      for (const route of ['/api/raw', '/api/edit']) {
        for (const name of ['escape.md', 'escape-dir/outside.md']) {
          assert.equal((await api.request(route + '?path=' + name)).status, 400);
        }
      }
      assert.equal(api.calls.length, 1);
      fs.unlinkSync(link);
      fs.symlinkSync(path.join(root, 'note.md'), link);
      assert.equal((await api.request('/api/raw?path=escape.md')).body, note);
    } finally { fs.unlinkSync(link); fs.unlinkSync(dirLink); }
  }],
  ['Action methods, tokens, hosts, and origins', async () => {
    const api = backend();
    for (const route of ['/api/root?path=' + encodeURIComponent(other), '/api/pick', '/api/open', '/api/edit?path=note.md']) {
      assert.equal((await api.request(route, { method: 'GET' })).status, 405);
      for (const headers of [
        { 'x-md-viewer-token': undefined }, { 'x-md-viewer-token': 'wrong' },
        { origin: 'http://example.com' }, { origin: 'null' }, { host: 'example.com:9234' },
      ]) assert.equal((await api.request(route, { headers })).status, 403);
    }
    assert.equal(api.calls.length, 1);
    assert.equal((await api.request('/api/files')).json().root, root);
    assert.equal((await api.request('/api/open', { headers: { origin: 'http://localhost:9234' } })).status, 200);
  }],
  ['Folder changes clear search before rendering', async () => {
    const api = backend();
    const ui = await frontend(api);
    ui.element('search').value = 'no match';
    await ui.run('switchRoot(' + JSON.stringify(other) + ')');
    assert.equal(ui.element('search').value, '');
    assert(ui.element('filelist').innerHTML.includes('other.md'));
    ui.element('search').value = 'no match';
    api.commandResult = () => ({ stdout: root });
    await ui.run('openPicker()');
    assert.equal(ui.element('search').value, '');
    assert(ui.element('filelist').innerHTML.includes('note.md'));
  }],
  ['Startup errors and browser suppression', async () => {
    for (const port of ['', 'abc', '8181oops', '0', '65536', '-1', '1.5']) {
      assert.throws(() => backend({}, [root, '--port', port]), /Invalid port/);
    }
    assert.throws(() => backend({}, [root, '--port']), /Invalid port/);
    const api = backend({}, [root, '--port', '9234', '--no-open']);
    assert.equal(api.calls.length, 0);
    api.fail({ code: 'EADDRINUSE' });
    assert.equal(api.process.exitCode, 1);
    assert.match(api.errors[0], /already in use/);
  }],
  ['Rendering uses sanitizer and fails closed if unavailable', async () => {
    const ui = await frontend(backend());
    ui.run("DOMPurify.sanitize = (html, options) => { if (!options.USE_PROFILES.html) throw Error('Missing HTML profile'); return 'sanitized content'; }");
    await ui.run("openFile('note.md')");
    assert.equal(ui.element('content').innerHTML, 'sanitized content');
    ui.run('DOMPurify = undefined');
    await ui.run("openFile('note.md')");
    assert.match(ui.element('content').textContent, /could not load/);
  }],
];

(async () => {
  let passed = 0;
  try {
    for (const [name, run] of tests) {
      try { await run(); passed++; console.log('PASS ' + name); }
      catch (error) { process.exitCode = 1; console.error('FAIL ' + name + '\n' + error.stack); }
    }
    console.log('\n' + passed + '/' + tests.length + ' tests passed');
  } finally {
    fs.rmSync(sandbox, { recursive: true, force: true });
  }
})();
