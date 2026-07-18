// Cross-checks the tabs data file against the App.jsx renderer's
// routing switch and the docs. Catches the kind of regression where
// someone renames a tab id in `src/data/tabs.js` without updating
// either the renderer's view-switch or the README list.
//
// Runs under plain Node (no jsdom, no React). Parses the two source
// files as text - cheap and fast.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

// Pull every tab id declared in src/data/tabs.js. The data file uses
// { id: 'Dashboard', label: '...', Icon: ... } so we match `{ id: 'X'`.
function tabIdsFromDataFile() {
  const text = read('src/data/tabs.js');
  const ids = [];
  for (const m of text.matchAll(/id:\s*'([^']+)'/g)) ids.push(m[1]);
  return ids;
}

// Pull every label from the same file (for sanity).
function tabLabelsFromDataFile() {
  const text = read('src/data/tabs.js');
  const labels = [];
  for (const m of text.matchAll(/label:\s*'([^']+)'/g)) labels.push(m[1]);
  return labels;
}

// README asserts a 12-tab product. We don't tie that count to the
// data file directly (README prose shouldn't be a hard dep of tests),
// we just confirm the data file declares the documented count.
test('tab inventory declares 12 tabs', () => {
  const ids = tabIdsFromDataFile();
  assert.equal(ids.length, 12, `expected 12 tabs, got ${ids.length}: ${JSON.stringify(ids)}`);
});

test('every tab has a unique id and unique label', () => {
  const ids = tabIdsFromDataFile();
  const labels = tabLabelsFromDataFile();
  assert.equal(new Set(ids).size, ids.length, 'duplicate tab id(s): ' + JSON.stringify(ids));
  assert.equal(new Set(labels).size, labels.length, 'duplicate tab label(s): ' + JSON.stringify(labels));
});

test('every tab id is non-empty + matches a sane pattern', () => {
  // Allow ASCII letters, digits, spaces (for "Ask a Question"), and
  // the standard punctuation we use in labels ("Win10 Protector").
  // We do NOT allow leading/trailing whitespace, leading digits, etc.
  const re = /^[A-Za-z][A-Za-z0-9 .&]*$/;
  for (const id of tabIdsFromDataFile()) {
    assert.match(id, re, `tab id "${id}" doesn't match the canonical pattern`);
  }
});

// App.jsx routing check: every tab id should appear in the route
// either as a string literal inside activeTab === 'X' or in a switch
// case '<tab name>'. If we ever rename a tab, this test breaks.
test('App.jsx routes all 12 tab ids', () => {
  const ids = tabIdsFromDataFile();
  const appText = read('src/App.jsx');
  for (const id of ids) {
    // Active-tab matching: "activeTab === '<id>'"
    // or fall-through comments / strings inside JSX.
    const pattern = new RegExp(
      `activeTab === ['"\`]${escapeRegExp(id)}['"\`]`,
    );
    const found = pattern.test(appText)
      // Some tabs route via "tab:<id>" (sidebar nav) instead of activeTab
      || new RegExp(`tab:${escapeRegExp(id)}`).test(appText);
    assert.ok(found, `App.jsx has no render route for tab "${id}". Add a "<${id}/>" branch.`);
  }
});

test('README lists every tab id', () => {
  const ids = tabIdsFromDataFile();
  const readme = read('README.md');
  // README may serialize "Win10 Protector" as a numbered item line.
  // We just verify each id appears at least once in the readme body.
  for (const id of ids) {
    assert.ok(
      readme.includes(id),
      `README.md does not mention tab id "${id}"`,
    );
  }
});

// Helper
function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
