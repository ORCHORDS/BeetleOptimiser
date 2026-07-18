// Example 2 in examples/README.md: drive scripts/optimize-cleanup.ps1
// from Node.js as the engine, parse each NDJSON line it emits, and
// print a one-line summary.
//
// Why this is useful: the same NDJSON contract that the renderer uses
// (over Electron's IPC) is reusable from any Node script. You can write
// your own UI, your own batch jobs, or your own cron-driven cleanup
// reports just by parsing the lines this script prints.
//
// Run: node examples/run-cleanup-scan.js

const { spawn } = require('node:child_process');
const path = require('node:path');

const script = path.resolve(__dirname, '..', 'scripts', 'optimize-cleanup.ps1');

const proc = spawn(
  'powershell',
  ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script, 'list'],
  { stdio: ['ignore', 'pipe', 'pipe'] }
);

const results = [];
let buf = '';
proc.stdout.on('data', (chunk) => {
  buf += chunk.toString();
  let idx;
  while ((idx = buf.indexOf('\n')) !== -1) {
    const line = buf.slice(0, idx).trim();
    buf = buf.slice(idx + 1);
    if (!line) continue;
    try {
      const obj = JSON.parse(line);
      // Category rows have an `id` + `files`/`bytes` shape; the renderer
      // knows them as scan results and displays them as cards. Items that
      // don't have those fields (e.g. an explicit `{"event":"finished"}`)
      // are dropped because they don't carry survey data.
      if (obj && typeof obj.id === 'string' && typeof obj.files !== 'undefined') {
        results.push(obj);
      }
    } catch (_) { /* skip malformed line */ }
  }
});
proc.stderr.on('data', (c) => process.stderr.write(c));
proc.on('close', (code) => {
  if (code !== 0) {
    console.error(`cleanup-scan exited with code ${code}`);
    process.exit(code || 1);
  }
  // Print a one-line per-category summary in plain English.
  if (results.length === 0) {
    console.log('No junk categories reported (script emitted no category rows).');
    return;
  }
  console.log('Junk survey:');
  let totalBytes = 0;
  let totalFiles = 0;
  for (const r of results) {
    const mb = (Number(r.bytes) / 1024 / 1024).toFixed(1);
    totalBytes += Number(r.bytes) || 0;
    totalFiles += Number(r.files) || 0;
    console.log(`  ${String(r.label).padEnd(28)} ${String(r.files).padStart(6)} files  ${mb.padStart(8)} MB   ${r.path}`);
  }
  const totalMb = (totalBytes / 1024 / 1024).toFixed(1);
  console.log(`  ${'TOTAL'.padEnd(28)} ${String(totalFiles).padStart(6)} files  ${totalMb.padStart(8)} MB`);
});
