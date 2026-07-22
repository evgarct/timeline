param(
    [ValidateSet('project', 'build-ios', 'test-ios', 'ui-test-ios', 'device-install', 'device-deliver', 'all')]
    [string]$Target = 'all',
    [string]$MacHost = $(if ($env:FORM_MAC_HOST) { $env:FORM_MAC_HOST } elseif ($env:ANQUI_MAC_HOST) { $env:ANQUI_MAC_HOST } else { 'muse-mac' }),
    [string]$Destination = $(if ($env:FORM_SIMULATOR_DESTINATION) { $env:FORM_SIMULATOR_DESTINATION } else { 'platform=iOS Simulator,name=iPhone 17 Pro' }),
    [string]$DeviceID = $(if ($env:FORM_DEVICE_ID) { $env:FORM_DEVICE_ID } else { $env:ANQUI_DEVICE_ID }),
    [string]$DevelopmentTeam = $(if ($env:FORM_DEVELOPMENT_TEAM) { $env:FORM_DEVELOPMENT_TEAM } else { $env:ANQUI_DEVELOPMENT_TEAM })
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$tempBase = [IO.Path]::GetTempPath()
$runID = [Guid]::NewGuid().ToString('N')
$tempRoot = Join-Path $tempBase "form-remote-build-$runID"
$archivePath = Join-Path $tempRoot 'snapshot.tar.gz'
$fileListPath = Join-Path $tempRoot 'files.txt'
$remoteScriptPath = Join-Path $tempRoot 'remote-build.sh'
$remoteArchive = "/tmp/form-remote-build-$runID.tar.gz"
$remoteScript = "/tmp/form-remote-build-$runID.sh"

try {
    if ($Target -in @('device-install', 'device-deliver')) {
        if (-not $DeviceID) { throw 'FORM_DEVICE_ID or ANQUI_DEVICE_ID is required.' }
        if (-not $DevelopmentTeam) { throw 'FORM_DEVELOPMENT_TEAM or ANQUI_DEVELOPMENT_TEAM is required.' }
    }
    New-Item -ItemType Directory -Path $tempRoot | Out-Null
    $files = @(& git -C $repoRoot ls-files --cached --others --exclude-standard) |
        Where-Object {
            -not [string]::IsNullOrWhiteSpace($_) -and
            (Test-Path -LiteralPath (Join-Path $repoRoot $_))
        }
    if ($LASTEXITCODE -ne 0 -or $files.Count -eq 0) { throw 'Could not enumerate the Git snapshot.' }
    [IO.File]::WriteAllLines($fileListPath, $files, [Text.UTF8Encoding]::new($false))
    & tar.exe -czf $archivePath -C $repoRoot -T $fileListPath
    if ($LASTEXITCODE -ne 0) { throw 'Could not create the remote-build archive.' }

    $makeCommands = switch ($Target) {
        'all' { "make build-ios DESTINATION='$Destination'`nmake test-ios DESTINATION='$Destination'`nmake ui-test-ios DESTINATION='$Destination'" }
        'build-ios' { "make build-ios DESTINATION='$Destination'" }
        'test-ios' { "make test-ios DESTINATION='$Destination'" }
        'ui-test-ios' { "make ui-test-ios DESTINATION='$Destination'" }
        'device-install' { "./scripts/build-install-device.sh '$DeviceID' '$DevelopmentTeam'" }
        'device-deliver' { "make test-ios DESTINATION='$Destination'`n./scripts/build-install-device.sh '$DeviceID' '$DevelopmentTeam'" }
        default { "make $Target" }
    }

    $script = @"
#!/usr/bin/env bash
set -euo pipefail
build_dir="`$HOME/Library/Caches/FormCodexBuild"
rm -rf "`$build_dir"
mkdir -p "`$build_dir"
tar -xzf '$remoteArchive' -C "`$build_dir"
rm -f '$remoteArchive'
cloud_config="`${FORM_CLOUD_CONFIG:-`$HOME/Documents/Form/Config/Form.local.xcconfig}"
if [[ -f "`$cloud_config" ]]; then
  cp "`$cloud_config" "`$build_dir/Config/Form.local.xcconfig"
fi
cd "`$build_dir"
chmod +x scripts/bootstrap-mac.sh scripts/build-install-device.sh
./scripts/bootstrap-mac.sh
$makeCommands
"@
    [IO.File]::WriteAllText($remoteScriptPath, ($script -replace "`r`n", "`n"), [Text.UTF8Encoding]::new($false))
    & scp $archivePath "${MacHost}:$remoteArchive"
    if ($LASTEXITCODE -ne 0) { throw 'Snapshot upload failed.' }
    & scp $remoteScriptPath "${MacHost}:$remoteScript"
    if ($LASTEXITCODE -ne 0) { throw 'Remote script upload failed.' }
    & ssh $MacHost "bash '$remoteScript'; exit_code=`$?; rm -f '$remoteScript'; exit `$exit_code"
    if ($LASTEXITCODE -ne 0) { throw "Remote $Target verification failed." }
}
finally {
    $resolvedTemp = [IO.Path]::GetFullPath($tempRoot)
    if ($resolvedTemp.StartsWith([IO.Path]::GetFullPath($tempBase), [StringComparison]::OrdinalIgnoreCase) -and (Test-Path $resolvedTemp)) {
        Remove-Item -LiteralPath $resolvedTemp -Recurse -Force
    }
}
