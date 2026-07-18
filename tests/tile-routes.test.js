// Cross-checks every dashboard tile id declared in src/data/bottomTiles.js
// against the App.jsx dispatcher. A new tile that the renderer doesn't
// route becomes a dead click - this test makes that impossible to land.
//
// Also asserts the tile inventory line-up with the README count (22 tiles).

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function tileIdsFromDataFile() {
  const text = read('src/data/bottomTiles.js');
  const ids = [];
  for (const m of text.matchAll(/id:\s*'([^']+)'/g)) ids.push(m[1]);
  return ids;
}

test('bottomTiles inventory declares 22 tiles (7 row-1 + 15 row-2)', () => {
  const ids = tileIdsFromDataFile();
  assert.equal(ids.length, 22, `expected 22 tiles, got ${ids.length}: ${JSON.stringify(ids)}`);
});

test('every tile has a unique id', () => {
  const ids = tileIdsFromDataFile();
  const uniq = new Set(ids);
  assert.equal(uniq.size, ids.length, `duplicate tile ids: ${ids.filter((id, i) => ids.indexOf(id) !== i).join(', ')}`);
});

test('App.jsx dispatches every tile id', () => {
  const ids = tileIdsFromDataFile();
  const appText = read('src/App.jsx');
  for (const id of ids) {
    const re = new RegExp(`case\\s+['"\`]${escapeRegExp(id)}['"\`]\\s*:`);
    assert.ok(
      re.test(appText),
      `App.jsx has no \`case '${id}':\` dispatcher for the tile. Clicking it would no-op.`,
    );
  }
});

test('every tile id appears once-and-only-once in the dispatcher', () => {
  const ids = tileIdsFromDataFile();
  const appText = read('src/App.jsx');
  for (const id of ids) {
    const re = new RegExp(`case\\s+['"\`]${escapeRegExp(id)}['"\`]\\s*:`, 'g');
    const matches = appText.match(re) || [];
    assert.ok(matches.length >= 1, `tile "${id}" missing from App.jsx dispatcher`);
    const caseLines = (appText.match(new RegExp(
      `case\\s+['"\`]${escapeRegExp(id)}['"\`]\\s*:\\s*[\\s\\S]*?break`, 'g'
    )) || []);
    assert.ok(caseLines.length <= 1, `duplicate case statements for tile "${id}"`);
  }
});

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
