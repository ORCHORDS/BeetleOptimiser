#!/usr/bin/env node
// Cross-platform test runner wrapper.
// Discovers tests/*.test.js via fs and invokes the Node test runner.
// Avoids shell-glob issues on Windows CI (where pwsh/cmd do not
// expand globs the way bash does).
const { readdirSync } = require('node:fs');
const { join, resolve } = require('node:path');
const { spawnSync } = require('node:child_process');

const here = __dirname;
const files = readdirSync(here)
  .filter(f => f.endsWith('.test.js'))
  .sort()
  .map(f => join(here, f));

if (files.length === 0) {
  console.error('No test files found in', here);
  process.exit(1);
}

const args = ['--test', ...files];
const r = spawnSync(process.execPath, args, { stdio: 'inherit' });
process.exit(r.status ?? 1);
