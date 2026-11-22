[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [Parameter(Position = 0)]
    [ValidateSet('Enable', 'Disable', 'Toggle', 'Status')]
    [string] $Action = 'Status',

    [Parameter()]
    [string] $ProfilePath,

    [Parameter()]
    [string] $FirefoxRoot,

    [Parameter()]
    [switch] $Interactive
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2.0
Import-Module (Join-Path $PSScriptRoot 'FirefoxProfile.psm1') -Force

function Show-Result {
    param([string] $Message, [int] $Icon = 64)
    Write-Host $Message
    if ($Interactive) {
        $shell = New-Object -ComObject WScript.Shell
        $null = $shell.Popup($Message, 0, 'ZenQOL - Firefox Toolbar Auto-Hide', $Icon)
    }
}

try {
    $targetProfile = Resolve-ZenQolFirefoxProfile -ProfilePath $ProfilePath -FirefoxRoot $FirefoxRoot
    $userChromePath = Join-Path $targetProfile 'chrome\userChrome.css'
    if (-not (Test-Path -LiteralPath $userChromePath -PathType Leaf)) {
        throw "userChrome.css was not found. Run Install.ps1 first: $userChromePath"
    }

    $file = Read-ZenQolTextFile -Path $userChromePath
    $currentState = Get-ZenQolToolbarAutoHideState -Content $file.Content
    if ($Action -eq 'Status') {
        Show-Result "Firefox toolbar auto-hide: $currentState`nProfile: $targetProfile"
        exit 0
    }

    $desiredState = switch ($Action) {
        'Enable' { 'Enabled' }
        'Disable' { 'Disabled' }
        'Toggle' { if ($currentState -eq 'Enabled') { 'Disabled' } else { 'Enabled' } }
    }
    $newContent = Set-ZenQolToolbarAutoHideContent -Content $file.Content -State $desiredState
    if ($newContent -ceq $file.Content) {
        Show-Result "Firefox toolbar auto-hide is already $($desiredState.ToLowerInvariant()). No files changed."
        exit 0
    }

    if (-not $PSCmdlet.ShouldProcess($userChromePath, "$Action Firefox toolbar auto-hide")) {
        exit 0
    }

    $backup = New-ZenQolBackup -ProfilePath $targetProfile -Paths @($userChromePath) -Operation "state-$($desiredState.ToLowerInvariant())"
    Write-ZenQolTextAtomic -Path $userChromePath -Content $newContent -Encoding $file.Encoding

    $firefoxRunning = @(Get-Process firefox -ErrorAction SilentlyContinue).Count -gt 0
    $restartMessage = if ($firefoxRunning) {
        'Restart Firefox when convenient to apply this change. Firefox was not closed.'
    }
    else {
        'The change will apply the next time Firefox starts.'
    }
    Show-Result "Firefox toolbar auto-hide is now $($desiredState.ToLowerInvariant()).`n$restartMessage`nBackup: $backup"
}
catch {
    $message = "Firefox toolbar auto-hide command failed:`n$($_.Exception.Message)"
    Write-Error $message
    if ($Interactive) {
        $shell = New-Object -ComObject WScript.Shell
        $null = $shell.Popup($message, 0, 'ZenQOL - Firefox Toolbar Auto-Hide', 16)
    }
    exit 1
}
