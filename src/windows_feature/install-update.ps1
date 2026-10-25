param([switch]$VerifyOnly, [string]$Package, [string]$Current, [string]$Version, [string]$Config)
$ErrorActionPreference = 'Stop'
$env:PSModulePath = Join-Path $PSHOME 'Modules'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
function Assert-Package([string]$File, [string]$Existing, [string]$ExpectedVersion) {
  $info = (Get-Item -LiteralPath $File).VersionInfo
  $actual = [Version]$info.ProductVersion
  $expected = [Version]$ExpectedVersion
  if ($info.ProductName -ne 'Limits' -or $actual.Major -ne $expected.Major -or $actual.Minor -ne $expected.Minor -or $actual.Build -ne $expected.Build) { throw 'Invalid package identity/version' }
  $oldSignature = Get-AuthenticodeSignature -LiteralPath $Existing
  if ($oldSignature.SignerCertificate) {
    $signature = Get-AuthenticodeSignature -LiteralPath $File
    if ($oldSignature.Status -ne 'Valid' -or $signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -ne $oldSignature.SignerCertificate.Subject) { throw 'Invalid package signature' }
  }
}
if ($VerifyOnly) { Assert-Package $Package $Current $Version; exit 0 }
$job = Get-Content -LiteralPath $Config -Raw | ConvertFrom-Json
$backup = $null
$stage = $null
try {
  $process = Get-Process -Id $job.pid -ErrorAction SilentlyContinue
  if ($process) { $process | Wait-Process -Timeout 120 }
  if ((Get-FileHash -LiteralPath $job.package -Algorithm SHA256).Hash.ToLowerInvariant() -ne $job.sha256) { throw 'Checksum mismatch' }
  Assert-Package $job.package $job.target $job.version
  if ($job.portable) {
    $suffix = [Guid]::NewGuid().ToString('N')
    $stage = $job.target + '.' + $suffix + '.new'
    $candidateBackup = $job.target + '.' + $suffix + '.bak'
    Copy-Item -LiteralPath $job.package -Destination $stage
    if ((Get-FileHash -LiteralPath $stage -Algorithm SHA256).Hash.ToLowerInvariant() -ne $job.sha256) { throw 'Staged checksum mismatch' }
    # The portable launcher may release its executable after the Electron child exits.
    for ($attempt = 0; $attempt -lt 60; $attempt++) {
      try { Move-Item -LiteralPath $job.target -Destination $candidateBackup; $backup = $candidateBackup; break }
      catch { if ($attempt -eq 59) { throw }; Start-Sleep -Milliseconds 500 }
    }
    Move-Item -LiteralPath $stage -Destination $job.target
  } else {
    $directory = Split-Path -Parent $job.target
    $installer = Start-Process -FilePath $job.package -ArgumentList @('/S', '--updated', "/D=$directory") -Wait -PassThru -WindowStyle Hidden
    if ($installer.ExitCode -ne 0) { throw 'Installer failed' }
  }
  $started = Start-Process -FilePath $job.target -ArgumentList '--hidden' -WorkingDirectory (Split-Path -Parent $job.target) -PassThru -WindowStyle Hidden
  Start-Sleep -Seconds 2
  if ($started.HasExited -and $started.ExitCode -ne 0) { throw 'Launch failed' }
  if ($backup) { Remove-Item -LiteralPath $backup -Force; $backup = $null }
  @{ status = 'success' } | ConvertTo-Json | Set-Content -LiteralPath $job.result -Encoding UTF8
} catch {
  [Console]::Error.WriteLine($_.Exception.Message)
  if ($backup -and (Test-Path -LiteralPath $backup)) {
    Move-Item -LiteralPath $backup -Destination $job.target -Force
  }
  @{ status = 'failed' } | ConvertTo-Json | Set-Content -LiteralPath $job.result -Encoding UTF8
  try { Start-Process -FilePath $job.target -ArgumentList '--hidden' -WindowStyle Hidden } catch { }
  exit 1
} finally {
  if ($stage -and (Test-Path -LiteralPath $stage)) { Remove-Item -LiteralPath $stage -Force }
  $jobDirectory = [IO.Path]::GetFullPath((Split-Path -Parent $Config))
  if ((Split-Path -Leaf $jobDirectory).StartsWith('download-') -and
      [IO.Path]::GetFullPath((Split-Path -Parent $job.package)) -eq $jobDirectory -and
      [IO.Path]::GetFullPath($PSScriptRoot) -eq $jobDirectory) {
    foreach ($file in @($job.package, $Config, (Join-Path $jobDirectory 'SHA256SUMS.txt'), $PSCommandPath)) {
      Remove-Item -LiteralPath $file -Force -ErrorAction SilentlyContinue
    }
    Remove-Item -LiteralPath $jobDirectory -ErrorAction SilentlyContinue
  }
}
