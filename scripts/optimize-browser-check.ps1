# optimize-browser-check.ps1 - Browser Protection check. Companion to the
# optimizer:browser-check IPC handler.
#
# READ-ONLY. Checks three classic hijack indicators:
#   1. HOSTS file - any active (non-comment) entry for a well-known domain
#      is suspicious, since that file is normally empty of such entries by
#      default. A hijacked HOSTS file is a common way to silently redirect
#      "google.com" etc. to a malicious server.
#   2. Chrome / Edge homepage + startup URLs, read directly from each
#      browser's own Preferences JSON file (%LOCALAPPDATA%\...\User
#      Data\Default\Preferences) - flags a homepage/startup URL that isn't
#      the browser's own new-tab page.
#   3. Default browser identity, via the UserChoice registry key.
#
# Output protocol: NDJSON. {event:'hosts_entry', ...} per suspicious HOSTS
# line, {event:'browser', ...} per browser checked, {event:'default_browser',
# ...}, then {event:'finished'}.

$ErrorActionPreference = 'SilentlyContinue'

function Emit-Line($obj) {
  [Console]::Out.WriteLine(($obj | ConvertTo-Json -Compress))
  [Console]::Out.Flush()
}

Emit-Line @{ event = 'started' }

# --- 1. HOSTS file ---
$watchedDomains = @(
  'google.com', 'facebook.com', 'youtube.com', 'microsoft.com', 'bing.com',
  'yahoo.com', 'amazon.com', 'twitter.com', 'apple.com', 'wikipedia.org'
)
$hostsPath = Join-Path $env:SystemRoot 'System32\drivers\etc\hosts'
if (Test-Path $hostsPath) {
  Get-Content $hostsPath | ForEach-Object {
    $line = $_.Trim()
    if ($line -and -not $line.StartsWith('#')) {
      foreach ($domain in $watchedDomains) {
        if ($line -match [regex]::Escape($domain)) {
          Emit-Line @{ event = 'hosts_entry'; item = @{ line = $line; domain = $domain } }
        }
      }
    }
  }
}

# --- 2. Chrome / Edge homepage + startup URLs ---
function Check-ChromiumPrefs($name, $prefsPath) {
  if (-not (Test-Path $prefsPath)) {
    Emit-Line @{ event = 'browser'; item = @{ name = $name; installed = $false } }
    return
  }
  try {
    $json = Get-Content -LiteralPath $prefsPath -Raw | ConvertFrom-Json -ErrorAction Stop
    $homepage = $json.homepage
    $homepageIsNewTab = $json.homepage_is_newtabpage
    $startupUrls = @()
    if ($json.session -and $json.session.startup_urls) { $startupUrls = @($json.session.startup_urls) }
    $suspicious = (-not $homepageIsNewTab -and $homepage -and $homepage -ne '') -or ($startupUrls.Count -gt 0)
    Emit-Line @{
      event = 'browser'
      item = @{
        name = $name; installed = $true
        homepage = $homepage; homepage_is_newtab = $homepageIsNewTab
        startup_urls = $startupUrls; suspicious = [bool]$suspicious
      }
    }
  } catch {
    Emit-Line @{ event = 'browser'; item = @{ name = $name; installed = $true; error = 'could not read preferences (browser may be running - close it and retry)' } }
  }
}

Check-ChromiumPrefs 'Google Chrome' (Join-Path $env:LOCALAPPDATA 'Google\Chrome\User Data\Default\Preferences')
Check-ChromiumPrefs 'Microsoft Edge' (Join-Path $env:LOCALAPPDATA 'Microsoft\Edge\User Data\Default\Preferences')

# --- 3. Default browser ---
try {
  $assoc = Get-ItemProperty -LiteralPath 'HKCU:\Software\Microsoft\Windows\Shell\Associations\UrlAssociations\http\UserChoice' -ErrorAction SilentlyContinue
  Emit-Line @{ event = 'default_browser'; prog_id = $assoc.ProgId }
} catch {
  Emit-Line @{ event = 'default_browser'; prog_id = $null }
}

Emit-Line @{ event = 'finished' }
