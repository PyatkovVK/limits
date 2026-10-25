param([Parameter(Mandatory=$true)][string]$ConfigFile)
$ErrorActionPreference = 'Stop'
$config = Get-Content -LiteralPath $ConfigFile -Raw | ConvertFrom-Json
$backup = $null
$staged = $null
$success = $false
try {
  $parent = Split-Path -Parent $config.target
  if ($config.portable) {
    $staged = Join-Path $parent ('.Limits-update-' + [guid]::NewGuid().ToString() + '.exe')
    Copy-Item -LiteralPath $config.source -Destination $staged
  }
  $deadline = (Get-Date).AddSeconds(60)
  while (Get-Process -Id $config.pid -ErrorAction SilentlyContinue) {
    if ((Get-Date) -gt $deadline) { throw 'Application did not exit' }
    Start-Sleep -Milliseconds 250
  }
  if ($config.portable) {
    $backup = Join-Path $parent ('.Limits-previous-' + [guid]::NewGuid().ToString() + '.exe')
    Move-Item -LiteralPath $config.target -Destination $backup
    Move-Item -LiteralPath $staged -Destination $config.target
    $staged = $null
  } else {
    # NSIS /D is deliberately last: it accepts the remainder including spaces.
    $installer = Start-Process -FilePath $config.source -ArgumentList ('/S /D=' + $parent) -PassThru -Wait
    if ($installer.ExitCode -ne 0) { throw 'Installer failed' }
  }
  $launched = Start-Process -FilePath $config.target -ArgumentList '--hidden' -PassThru
  Start-Sleep -Seconds 1
  if ($launched.HasExited) { throw 'Updated application did not stay running' }
  $success = $true
} catch {
  if ($backup -and (Test-Path -LiteralPath $backup)) {
    Remove-Item -LiteralPath $config.target -Force -ErrorAction SilentlyContinue
    Move-Item -LiteralPath $backup -Destination $config.target
    $backup = $null
  }
} finally {
  if ($staged) { Remove-Item -LiteralPath $staged -Force -ErrorAction SilentlyContinue }
  if ($backup -and $success) { Remove-Item -LiteralPath $backup -Force -ErrorAction SilentlyContinue }
  @{ status = $(if ($success) { 'installed' } else { 'failed' }) } | ConvertTo-Json -Compress | Set-Content -LiteralPath $config.resultFile -Encoding Ascii
  if (!$success) { Start-Process -FilePath $config.target -ArgumentList '--hidden' -ErrorAction SilentlyContinue }
  Remove-Item -LiteralPath $config.job -Recurse -Force -ErrorAction SilentlyContinue
}
if (!$success) { exit 1 }
