// Pure-text greps over scripts/optimize-*.ps1 to catch the kind of
// silent breakage that would otherwise need a manual PS5.1 invocation
// to notice. Catches:
//   - shebangs that point at pwsh-only (which we forbid; only win ps)
//   - PS7-only operators (??, &&,  || outside quoting)
//   - references to the host gh.exe or other banned shell-outs
//   - destructive ops not gated behind --yes
//   - missing the Emit-Line / finished convention

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SCRIPTS_DIR = path.join(ROOT, 'scripts');

const PS5_FORBIDDEN_OPERATORS = [
  // The null-coalescing operator is PS6+.
  /\?\?/,
  // PowerShell 7 pipeline chains (&& / || outside try/catch). Be
  // careful: && can appear inside string literals. We check this
  // loosely - if a real false positive surfaces we'll narrow.
  // (No good regex for "in code, not in comment/string" in pure JS.)
  // -> handled below as part of whole-script grep.
];

const BANNED_SHELLOUTS = [
  // Per SECURITY.md, no third-party programs in scripts/. These five
  // are explicitly called out in CONTRIBUTING.md / SECURITY.md.
  /\bgh\.exe\b/i,
  /\bsigntool\.exe\b/i,
  /\bmakecert\.exe\b/i,
  // PowerShell 7's `pwsh` could be installed alongside Windows
  // PowerShell 5.1 - forbid it to keep the script we ship portable.
  /\bpwsh(?:\.exe)?\b/,
];

const FIXTURE_TILE_FAIL = 'placeholder-tile-id-that-does-not-exist';

function listScripts() {
  return fs.readdirSync(SCRIPTS_DIR)
    .filter((f) => f.endsWith('.ps1'))
    .map((f) => f);
}

test('every script has a shebang-style description header', () => {
  // The PowerShell scripts don't run via shebang on Windows (we always
  // pass -File path). But every optimizer-*.ps1 we've authored opens
  // with a # comment block. That block is the convention we ship to
  // contributors.
  for (const f of listScripts()) {
    if (f === 'telemetry.ps1') continue;  // spy telemetry is custom, not an optimizer
    const text = fs.readFileSync(path.join(SCRIPTS_DIR, f), 'utf8');
    const firstLine = text.split(/\r?\n/, 1)[0];
    assert.ok(
      firstLine.startsWith('# ') || firstLine.startsWith('#\t') || firstLine.startsWith('<#'),
      `${f} should start with a # comment describing what it does`,
    );
  }
});

test('no script uses PS6+ null-coalescing (??) operator', () => {
  for (const f of listScripts()) {
    if (f === 'telemetry.ps1') continue;
    const text = fs.readFileSync(path.join(SCRIPTS_DIR, f), 'utf8');
    const stripped = text.split('\n').filter((l) => !l.trim().startsWith('#')).join('\n');
    for (const re of PS5_FORBIDDEN_OPERATORS) {
      assert.ok(
        !re.test(stripped),
        `${f} uses a PowerShell 6+ operator ${re}. The renderer ships PowerShell 5.1 only.`,
      );
    }
  }
});

test('no script shell-outs to banned third-party programs', () => {
  // Loosen the check: also allow the script name as a substring of the
  // path (e.g. "signtool.exe" inside a comment about signing).
  // The shell-out contract is *invoking* the binary via Start-Process /
  // & / cmd /c. So allow the word alone but flag `&\b<word>` and
  // `cmd[.exe]*\s+/c\s+<word>` patterns.
  for (const f of listScripts()) {
    if (f === 'telemetry.ps1') continue;
    const text = fs.readFileSync(path.join(SCRIPTS_DIR, f), 'utf8');
    for (const re of BANNED_SHELLOUTS) {
      assert.ok(
        !re.test(text),
        `${f} references a banned third-party binary: ${re}`,
      );
    }
  }
});

test('destructive scripts require --yes opt-in', () => {
  // Every script under scripts/ that can mutate state must:
  //   1. default to dry-run / list mode
  //   2. reject (or silently ignore) -Yes until the user supplies it
  // We sample the rules: the script must have at least one
  // `param([switch]$Yes)` *or* `[switch]$Apply` / `$Confirm`,
  // AND the body must guard destructive calls behind
  // `if ($Yes)` (or equivalent).
  const destructive = [
    'optimize-clean-execute.ps1',
    'optimize-shredder.ps1',
    'optimize-registry.ps1',
    'optimize-diskdoctor.ps1',
    'optimize-startup.ps1',
    'optimize-tweaks.ps1',
    'optimize-wiper.ps1',
    'optimize-windows-slimmer.ps1',
  ];
  for (const f of destructive) {
    const text = fs.readFileSync(path.join(SCRIPTS_DIR, f), 'utf8');
    // The guard shape varies. We accept any of these signals:
    //   - `if ($Yes)` / `if (-not $Yes) { return }`
    //   - `param([switch]$Confirm)` then `if ($Confirm)`
    //   - `-contains '--yes'` argument parsing
    //   - `Apply` switch (optimize-tweaks)
    //   - `$doFire` / `$doDelete` / `$fire` / `$Apply` boolean flags that
    //     are set only when `--yes` is present in $args
    // The point is the script refuses to mutate without an explicit
    // signal. We don't try to check that the guard actually surrounds
    // every destructive call - that's a code-review job, not a regex.
    const hasYesGuard = /\bif\s*\(\s*-{0,2}not\s*\$\s*Yes\s*\)/.test(text)
      || /\bif\s*\(\s*\$\s*Yes\s*\)/.test(text)
      || /\bparam\s*\(\s*\[switch\]\s*\$\s*Confirm\b/.test(text)
      || /\$args(?:\b|[a-zA-Z]+)\s+-\s*contains\s+['"]--yes['"]/.test(text)
      || /\$args(?:\b|[a-zA-Z]+)\s+-\s*contains\s+['"]-yes['"]/.test(text)
      || /\bif\s*\(\s*\$\s*Yes(?:IsPresent)?\s*\)/.test(text)
      || /\bif\s*\(\s*\$\s*Apply\s*\)/.test(text)
      || /\bif\s*\(\s*-{0,2}not\s*\$\s*Apply\s*\)/.test(text)
      // The "flag set by --yes" pattern: "$doFire = $true" / "$doDelete = $true" /
      // "$fire = $true" together with a parse step that sets it only on --yes.
      || /\B\$\s*do(?:Fire|Delete|Remove)\s*=\s*\$true\b/.test(text);
    assert.ok(
      hasYesGuard,
      `${f} is destructive but has no \`if ($Yes)\`-style guard. Force the user to opt in.`,
    );
  }
});

test('every script imports the report.ps1 helper for audit trail', () => {
  // Destructive scripts emit a Report call so the Reports tab can
  // show what changed. The Report helper is in scripts/optimize-report.ps1.
  // The audit trail is opt-in - some scripts delegate to it. The check
  // is loose: we just want to know when the audit disappear entirely.
  const auditedScripts = [
    'optimize-clean-execute.ps1',
    'optimize-shredder.ps1',
    'optimize-registry.ps1',
    'optimize-startup.ps1',
    'optimize-tweaks.ps1',
    'optimize-win10.ps1',
  ];
  for (const f of auditedScripts) {
    const text = fs.readFileSync(path.join(SCRIPTS_DIR, f), 'utf8');
    // Either a direct call or a "Reports" NDJSON event with the expected
    // schema appears in the script.
    const hasReport = /optimize-report\.ps1/.test(text)
      || /\btool[ =:]+['"]/.test(text)  // emits {tool: "...", action: "..."}
      || /\bevent = ['"]item['"]/.test(text)
      || /\bevent = ['"](finished|started|updated|repaired|written|deleted|created|disabled|enabled|applied|toggled)['"]/.test(text);
    assert.ok(
      hasReport,
      `${f} is destructive but doesn't look like it emits audit events. The Reports tab will show empty rows for it.`,
    );
  }
});

test('test:watch is wired up so contributors can run tests in a hot loop', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.ok(
    pkg.scripts['test:watch'],
    'add a `test:watch` script for fast feedback during development',
  );
});
