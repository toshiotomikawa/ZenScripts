[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [Parameter()]
    [string] $ProfilePath,

    # Primarily useful for validation or unusual portable layouts.
    [Parameter()]
    [string] $FirefoxRoot,

    # Primarily useful for validation. Defaults to the per-user Start Menu.
    [Parameter()]
    [string] $ShortcutPath
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2.0
Import-Module (Join-Path $PSScriptRoot 'FirefoxProfile.psm1') -Force

$preferenceName = 'toolkit.legacyUserProfileCustomizations.stylesheets'
$assetPath = Join-Path $PSScriptRoot 'assets\autohide_toolbox.css'

function Get-Sha256 {
    param([Parameter(Mandatory = $true)][string] $Path)
    $stream = [IO.File]::OpenRead($Path)
    $algorithm = [Security.Cryptography.SHA256]::Create()
    try {
        return ([BitConverter]::ToString($algorithm.ComputeHash($stream)) -replace '-', '').ToLowerInvariant()
    }
    finally {
        $algorithm.Dispose()
        $stream.Dispose()
    }
}

function Get-ShortcutPlan {
    $path = if ($ShortcutPath) {
        [IO.Path]::GetFullPath($ShortcutPath)
    }
    else {
        Join-Path ([Environment]::GetFolderPath('Programs')) 'ZenQOL\Firefox Toolbar Auto-Hide Toggle.lnk'
    }
    $directory = Split-Path -Parent $path
    $powerShell = (Get-Command powershell.exe -ErrorAction Stop).Source
    $stateScript = Join-Path $PSScriptRoot 'Set-State.ps1'
    $arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$stateScript`" Toggle -Interactive"
    $workingDirectory = $PSScriptRoot
    $description = 'Toggle Firefox toolbar auto-hide (restart Firefox to apply)'

    $matches = $false
    if (Test-Path -LiteralPath $path -PathType Leaf) {
        $shell = New-Object -ComObject WScript.Shell
        $existing = $shell.CreateShortcut($path)
        $matches =
            $existing.TargetPath -ieq $powerShell -and
            $existing.Arguments -ceq $arguments -and
            $existing.WorkingDirectory -ieq $workingDirectory -and
            $existing.Description -ceq $description
    }

    [pscustomobject]@{
        Path = $path
        Directory = $directory
        TargetPath = $powerShell
        Arguments = $arguments
        WorkingDirectory = $workingDirectory
        Description = $description
        Changed = -not $matches
    }
}

function Install-Shortcut {
    param([Parameter(Mandatory = $true)] $Plan)

    [IO.Directory]::CreateDirectory($Plan.Directory) | Out-Null
    if (Test-Path -LiteralPath $Plan.Path -PathType Leaf) {
        $backupDirectory = Join-Path $env:LOCALAPPDATA ('ZenQOL\Backups\FirefoxToolbarAutoHide\' + (Get-Date -Format 'yyyyMMdd-HHmmss-fff'))
        [IO.Directory]::CreateDirectory($backupDirectory) | Out-Null
        Copy-Item -LiteralPath $Plan.Path -Destination (Join-Path $backupDirectory (Split-Path -Leaf $Plan.Path))
        Write-Host "Shortcut backup: $backupDirectory"
    }

    $temporary = Join-Path $Plan.Directory ('.zenqol-' + [Guid]::NewGuid().ToString('N') + '.lnk')
    try {
        $shell = New-Object -ComObject WScript.Shell
        $shortcut = $shell.CreateShortcut($temporary)
        $shortcut.TargetPath = $Plan.TargetPath
        $shortcut.Arguments = $Plan.Arguments
        $shortcut.WorkingDirectory = $Plan.WorkingDirectory
        $shortcut.Description = $Plan.Description
        $shortcut.IconLocation = "$env:SystemRoot\System32\shell32.dll,167"
        $shortcut.Save()
        Move-Item -LiteralPath $temporary -Destination $Plan.Path -Force
    }
    finally {
        if (Test-Path -LiteralPath $temporary) { Remove-Item -LiteralPath $temporary -Force }
    }
}

if (-not (Test-Path -LiteralPath $assetPath -PathType Leaf)) {
    throw "Bundled stylesheet is missing: $assetPath"
}

$targetProfile = Resolve-ZenQolFirefoxProfile -ProfilePath $ProfilePath -FirefoxRoot $FirefoxRoot
$chromeDirectory = Join-Path $targetProfile 'chrome'
$userJsPath = Join-Path $targetProfile 'user.js'
$userChromePath = Join-Path $chromeDirectory 'userChrome.css'
$installedCssPath = Join-Path $chromeDirectory 'autohide_toolbox.css'
$utf8NoBom = New-Object Text.UTF8Encoding($false)

$userJsFile = if (Test-Path -LiteralPath $userJsPath) {
    Read-ZenQolTextFile -Path $userJsPath
}
else {
    [pscustomobject]@{ Content = ''; Encoding = $utf8NoBom }
}
$newUserJs = $userJsFile.Content
$prefPattern = '(?m)^\s*user_pref\("toolkit\.legacyUserProfileCustomizations\.stylesheets",\s*(?:true|false)\s*\);\s*(?:\r?\n)?'
$matchingPrefs = [regex]::Matches($newUserJs, $prefPattern)
$prefIsCanonical = $matchingPrefs.Count -eq 1 -and $matchingPrefs[0].Value.Trim() -eq "user_pref(`"$preferenceName`", true);"
if (-not $prefIsCanonical) {
    $newUserJs = [regex]::Replace($newUserJs, $prefPattern, '').TrimEnd("`r", "`n")
    if ($newUserJs.Length -gt 0) { $newUserJs += "`r`n`r`n" }
    $newUserJs += "// Enable profile chrome stylesheets (managed by ZenQOL Firefox ToolbarAutoHide).`r`n"
    $newUserJs += "user_pref(`"$preferenceName`", true);`r`n"
}

$userChromeFile = if (Test-Path -LiteralPath $userChromePath) {
    Read-ZenQolTextFile -Path $userChromePath
}
else {
    [pscustomobject]@{ Content = ''; Encoding = $utf8NoBom }
}
$installedState = Get-ZenQolToolbarAutoHideState -Content $userChromeFile.Content
$desiredInstallState = if ($installedState -eq 'Disabled') { 'Disabled' } else { 'Enabled' }
$newUserChrome = Set-ZenQolToolbarAutoHideContent -Content $userChromeFile.Content -State $desiredInstallState

$userJsChanged = -not (Test-Path -LiteralPath $userJsPath) -or ($userJsFile.Content -cne $newUserJs)
$userChromeChanged = -not (Test-Path -LiteralPath $userChromePath) -or ($userChromeFile.Content -cne $newUserChrome)
$cssChanged = -not (Test-Path -LiteralPath $installedCssPath) -or ((Get-Sha256 $installedCssPath) -ne (Get-Sha256 $assetPath))
$shortcutPlan = Get-ShortcutPlan

$profileChanges = @()
if ($userJsChanged) { $profileChanges += $userJsPath }
if ($userChromeChanged) { $profileChanges += $userChromePath }
if ($cssChanged) { $profileChanges += $installedCssPath }

Write-Host "Firefox profile: $targetProfile"
if ($profileChanges.Count -eq 0 -and -not $shortcutPlan.Changed) {
    Write-Host "Firefox toolbar auto-hide is already installed and $($installedState.ToLowerInvariant())."
    Write-Host "Start Menu shortcut: $($shortcutPlan.Path)"
    Write-Host 'No files changed.'
    exit 0
}

if (-not $PSCmdlet.ShouldProcess($targetProfile, 'install Firefox toolbar auto-hide and its Start Menu toggle')) {
    if ($profileChanges.Count -gt 0) {
        Write-Host 'Would change profile files:'
        $profileChanges | ForEach-Object { Write-Host "  $_" }
    }
    if ($shortcutPlan.Changed) { Write-Host "Would install shortcut: $($shortcutPlan.Path)" }
    exit 0
}

if ($profileChanges.Count -gt 0) {
    $backupDirectory = New-ZenQolBackup -ProfilePath $targetProfile -Paths $profileChanges -Operation 'install'
    Write-Host "Profile backup: $backupDirectory"
}
if ($userJsChanged) { Write-ZenQolTextAtomic -Path $userJsPath -Content $newUserJs -Encoding $userJsFile.Encoding }
if ($userChromeChanged) { Write-ZenQolTextAtomic -Path $userChromePath -Content $newUserChrome -Encoding $userChromeFile.Encoding }
if ($cssChanged) {
    [IO.Directory]::CreateDirectory($chromeDirectory) | Out-Null
    [IO.File]::WriteAllBytes($installedCssPath, [IO.File]::ReadAllBytes($assetPath))
}
if ($shortcutPlan.Changed) { Install-Shortcut -Plan $shortcutPlan }

Write-Host "Start Menu shortcut: $($shortcutPlan.Path)"
Write-Host 'Installed successfully. Restart Firefox if profile files changed.'
