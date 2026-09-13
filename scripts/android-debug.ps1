<#
.SYNOPSIS
    Android debugging & device helper script for Form.
.DESCRIPTION
    Sets up Java 21 / Android SDK environment, connects to Google Pixel, builds,
    installs, captures screenshots, dumps UI hierarchy, and manages app lifecycle.
.EXAMPLE
    .\scripts\android-debug.ps1 -Action Devices
    .\scripts\android-debug.ps1 -Action Pair -Ip 192.168.0.152 -Port 40293 -Code 143816
    .\scripts\android-debug.ps1 -Action Connect -Ip 192.168.0.152 -Port 40749
    .\scripts\android-debug.ps1 -Action BuildAndInstall
    .\scripts\android-debug.ps1 -Action Launch
    .\scripts\android-debug.ps1 -Action Screenshot -OutputPath .\pixel_screen.png
    .\scripts\android-debug.ps1 -Action DumpUi -OutputPath .\pixel_ui.xml
    .\scripts\android-debug.ps1 -Action GrantHealth
    .\scripts\android-debug.ps1 -Action Logcat
#>
param (
    [Parameter(Mandatory = $true)]
    [ValidateSet('Env', 'Devices', 'Pair', 'Connect', 'Build', 'Install', 'BuildAndInstall', 'Launch', 'Stop', 'Clear', 'Screenshot', 'DumpUi', 'GrantHealth', 'Logcat')]
    [string]$Action,

    [string]$Ip = "192.168.0.152",
    [int]$Port = 0,
    [string]$Code = "",
    [string]$DeviceId = "",
    [string]$OutputPath = ""
)

$ErrorActionPreference = "Stop"

# 1. Environment initialization
$env:JAVA_HOME = "$HOME\scoop\apps\openjdk21\current"
$env:ANDROID_HOME = "$HOME\scoop\apps\android-clt\current"
$env:Path = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\cmdline-tools\latest\bin;$env:ANDROID_HOME\platform-tools;$env:Path"

function Get-TargetDevice {
    if ($DeviceId) { return $DeviceId }
    $devs = & adb devices | Select-String -Pattern "(\S+)\s+device$"
    if ($devs.Count -eq 0) {
        Write-Warning "No connected Android devices found. Run -Action Connect or check USB."
        return $null
    }
    return $devs[0].Matches[0].Groups[1].Value
}

switch ($Action) {
    'Env' {
        Write-Host "Environment configured:"
        Write-Host "JAVA_HOME:    $env:JAVA_HOME"
        Write-Host "ANDROID_HOME: $env:ANDROID_HOME"
        & adb version
    }

    'Devices' {
        & adb devices -l
    }

    'Pair' {
        if (-not $Port -or -not $Code) {
            Write-Error "Usage: -Action Pair -Ip <ip> -Port <port> -Code <code>"
        }
        Write-Host "Pairing with $Ip`:$Port code $Code..."
        & adb pair "$Ip`:$Port" $Code
    }

    'Connect' {
        if (-not $Port) {
            Write-Error "Usage: -Action Connect -Ip <ip> -Port <port>"
        }
        Write-Host "Connecting to $Ip`:$Port..."
        & adb connect "$Ip`:$Port"
        & adb devices
    }

    'Build' {
        Push-Location c:\Projects\Form\android
        try {
            .\gradlew.bat assembleDebug
        } finally {
            Pop-Location
        }
    }

    'Install' {
        $dev = Get-TargetDevice
        if (-not $dev) { exit 1 }
        $apk = "c:\Projects\Form\android\app\build\outputs\apk\debug\app-debug.apk"
        if (-not (Test-Path $apk)) {
            Write-Error "APK not found at $apk. Run -Action Build first."
        }
        Write-Host "Installing $apk to $dev..."
        & adb -s $dev install -r $apk
    }

    'BuildAndInstall' {
        Push-Location c:\Projects\Form\android
        try {
            .\gradlew.bat assembleDebug
        } finally {
            Pop-Location
        }
        $dev = Get-TargetDevice
        if (-not $dev) { exit 1 }
        $apk = "c:\Projects\Form\android\app\build\outputs\apk\debug\app-debug.apk"
        Write-Host "Installing $apk to $dev..."
        & adb -s $dev install -r $apk
    }

    'Launch' {
        $dev = Get-TargetDevice
        if (-not $dev) { exit 1 }
        Write-Host "Launching com.evgarct.form on $dev..."
        & adb -s $dev shell am start -n com.evgarct.form/.MainActivity
    }

    'Stop' {
        $dev = Get-TargetDevice
        if (-not $dev) { exit 1 }
        Write-Host "Stopping com.evgarct.form on $dev..."
        & adb -s $dev shell am force-stop com.evgarct.form
    }

    'Clear' {
        $dev = Get-TargetDevice
        if (-not $dev) { exit 1 }
        Write-Host "Clearing app data for com.evgarct.form on $dev..."
        & adb -s $dev shell pm clear com.evgarct.form
    }

    'Screenshot' {
        $dev = Get-TargetDevice
        if (-not $dev) { exit 1 }
        if (-not $OutputPath) { $OutputPath = "screenshot_$(Get-Date -Format 'yyyyMMdd_HHmmss').png" }
        Write-Host "Capturing screenshot to $OutputPath..."
        & adb -s $dev shell screencap -p /data/local/tmp/screen.png
        & adb -s $dev pull /data/local/tmp/screen.png $OutputPath
        & adb -s $dev shell rm /data/local/tmp/screen.png
        Write-Host "Saved screenshot: $OutputPath"
    }

    'DumpUi' {
        $dev = Get-TargetDevice
        if (-not $dev) { exit 1 }
        if (-not $OutputPath) { $OutputPath = "ui_dump_$(Get-Date -Format 'yyyyMMdd_HHmmss').xml" }
        Write-Host "Dumping UI hierarchy to $OutputPath..."
        & adb -s $dev shell uiautomator dump /data/local/tmp/window_dump.xml
        & adb -s $dev pull /data/local/tmp/window_dump.xml $OutputPath
        & adb -s $dev shell rm /data/local/tmp/window_dump.xml
        Write-Host "Saved UI dump: $OutputPath"
    }

    'GrantHealth' {
        $dev = Get-TargetDevice
        if (-not $dev) { exit 1 }
        Write-Host "Granting Health Connect permissions to com.evgarct.form..."
        & adb -s $dev shell pm grant com.evgarct.form android.permission.health.READ_STEPS
        & adb -s $dev shell pm grant com.evgarct.form android.permission.health.READ_EXERCISE
        Write-Host "Health permissions granted."
    }

    'Logcat' {
        $dev = Get-TargetDevice
        if (-not $dev) { exit 1 }
        Write-Host "Streaming Logcat for FormApp..."
        & adb -s $dev logcat -v time -s FormApp:* ActivityDetail:* HealthConnect:* AndroidRuntime:E
    }
}
