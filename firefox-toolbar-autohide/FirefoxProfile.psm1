Set-StrictMode -Version 2.0

function Get-ZenQolFirefoxRoots {
    param([string] $FirefoxRoot)

    if ($FirefoxRoot) {
        return ,([IO.Path]::GetFullPath($FirefoxRoot))
    }

    $roots = New-Object System.Collections.Generic.List[string]
    $desktopRoot = Join-Path $env:APPDATA 'Mozilla\Firefox'
    if (Test-Path -LiteralPath (Join-Path $desktopRoot 'profiles.ini')) {
        $roots.Add($desktopRoot)
    }

    $packagesRoot = Join-Path $env:LOCALAPPDATA 'Packages'
    if (Test-Path -LiteralPath $packagesRoot) {
        Get-ChildItem -LiteralPath $packagesRoot -Directory -Filter 'Mozilla.Firefox_*' -ErrorAction SilentlyContinue |
            ForEach-Object {
                $root = Join-Path $_.FullName 'LocalCache\Roaming\Mozilla\Firefox'
                if (Test-Path -LiteralPath (Join-Path $root 'profiles.ini')) {
                    $roots.Add($root)
                }
            }
    }

    return @($roots | Select-Object -Unique)
}

function Get-ZenQolRegisteredProfilePaths {
    param([Parameter(Mandatory = $true)][string] $Root)

    $relativePaths = New-Object System.Collections.Generic.List[string]
    $installsIni = Join-Path $Root 'installs.ini'
    $profilesIni = Join-Path $Root 'profiles.ini'

    if (Test-Path -LiteralPath $installsIni) {
        foreach ($line in [IO.File]::ReadAllLines($installsIni)) {
            if ($line -match '^Default=(.+)$') {
                $relativePaths.Add($Matches[1].Trim())
            }
        }
    }

    if ($relativePaths.Count -eq 0 -and (Test-Path -LiteralPath $profilesIni)) {
        $section = ''
        foreach ($line in [IO.File]::ReadAllLines($profilesIni)) {
            if ($line -match '^\[(.+)\]$') {
                $section = $Matches[1]
            }
            elseif ($section -like 'Install*' -and $line -match '^Default=(.+)$') {
                $relativePaths.Add($Matches[1].Trim())
            }
        }
    }

    if ($relativePaths.Count -eq 0 -and (Test-Path -LiteralPath $profilesIni)) {
        $profiles = @()
        $current = $null
        foreach ($line in [IO.File]::ReadAllLines($profilesIni) + '[END]') {
            if ($line -match '^\[(.+)\]$') {
                if ($current -and $current.Path -and $current.Default -eq '1') {
                    $profiles += $current
                }
                $current = @{ Path = $null; IsRelative = '1'; Default = '0' }
            }
            elseif ($current -and $line -match '^([^=]+)=(.*)$') {
                $current[$Matches[1]] = $Matches[2]
            }
        }
        foreach ($entry in $profiles) {
            if ($entry.IsRelative -eq '1') {
                $relativePaths.Add($entry.Path)
            }
            else {
                $relativePaths.Add([IO.Path]::GetFullPath($entry.Path))
            }
        }
    }

    foreach ($entry in @($relativePaths | Select-Object -Unique)) {
        $candidate = if ([IO.Path]::IsPathRooted($entry)) {
            [IO.Path]::GetFullPath($entry)
        }
        else {
            [IO.Path]::GetFullPath((Join-Path $Root ($entry -replace '/', '\')))
        }
        if (Test-Path -LiteralPath $candidate -PathType Container) {
            $candidate
        }
    }
}

function Resolve-ZenQolFirefoxProfile {
    param(
        [string] $ProfilePath,
        [string] $FirefoxRoot
    )

    if ($ProfilePath) {
        $resolved = [IO.Path]::GetFullPath($ProfilePath)
        if (-not (Test-Path -LiteralPath $resolved -PathType Container)) {
            throw "Firefox profile does not exist: $resolved"
        }
        return $resolved
    }

    $candidates = @(@(
        foreach ($root in Get-ZenQolFirefoxRoots -FirefoxRoot $FirefoxRoot) {
            Get-ZenQolRegisteredProfilePaths -Root $root
        }
    ) | Select-Object -Unique)

    if ($candidates.Count -eq 0) {
        throw 'No registered Firefox default profile was found. Start Firefox once, then rerun this command.'
    }
    if ($candidates.Count -eq 1) {
        return $candidates[0]
    }

    $locked = @($candidates | Where-Object {
        (Test-Path -LiteralPath (Join-Path $_ 'parent.lock')) -or
        (Test-Path -LiteralPath (Join-Path $_ '.parentlock'))
    })
    if ($locked.Count -eq 1) {
        return $locked[0]
    }

    throw "Multiple registered Firefox default profiles were found. Rerun with -ProfilePath and the intended profile:`n$($candidates -join "`n")"
}

function Read-ZenQolTextFile {
    param([Parameter(Mandatory = $true)][string] $Path)

    $bytes = [IO.File]::ReadAllBytes($Path)
    $encoding = $null
    $preambleLength = 0
    if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
        $encoding = New-Object Text.UTF8Encoding($true)
        $preambleLength = 3
    }
    elseif ($bytes.Length -ge 2 -and $bytes[0] -eq 0xFF -and $bytes[1] -eq 0xFE) {
        $encoding = New-Object Text.UnicodeEncoding($false, $true)
        $preambleLength = 2
    }
    elseif ($bytes.Length -ge 2 -and $bytes[0] -eq 0xFE -and $bytes[1] -eq 0xFF) {
        $encoding = New-Object Text.UnicodeEncoding($true, $true)
        $preambleLength = 2
    }
    else {
        $encoding = New-Object Text.UTF8Encoding($false)
    }

    [pscustomobject]@{
        Content = $encoding.GetString($bytes, $preambleLength, $bytes.Length - $preambleLength)
        Encoding = $encoding
    }
}

function Write-ZenQolTextAtomic {
    param(
        [Parameter(Mandatory = $true)][string] $Path,
        [Parameter(Mandatory = $true)][string] $Content,
        [Parameter(Mandatory = $true)][Text.Encoding] $Encoding
    )

    $directory = Split-Path -Parent $Path
    [IO.Directory]::CreateDirectory($directory) | Out-Null
    $temporary = Join-Path $directory ('.zenqol-' + [Guid]::NewGuid().ToString('N') + '.tmp')
    $replaceBackup = Join-Path $directory ('.zenqol-' + [Guid]::NewGuid().ToString('N') + '.replace-backup')
    try {
        [IO.File]::WriteAllText($temporary, $Content, $Encoding)
        [IO.File]::Replace($temporary, $Path, $replaceBackup)
        [IO.File]::Delete($replaceBackup)
    }
    catch [IO.FileNotFoundException] {
        [IO.File]::Move($temporary, $Path)
    }
    finally {
        if (Test-Path -LiteralPath $temporary) { Remove-Item -LiteralPath $temporary -Force }
        if (Test-Path -LiteralPath $replaceBackup) { Remove-Item -LiteralPath $replaceBackup -Force }
    }
}

function New-ZenQolBackup {
    param(
        [Parameter(Mandatory = $true)][string] $ProfilePath,
        [Parameter(Mandatory = $true)][string[]] $Paths,
        [string] $Operation = 'change'
    )

    $backupRoot = Join-Path $ProfilePath '.zenqol-backups\firefox-toolbar-autohide'
    $backupDirectory = Join-Path $backupRoot (Get-Date -Format 'yyyyMMdd-HHmmss-fff')
    [IO.Directory]::CreateDirectory($backupDirectory) | Out-Null
    $manifest = @{ profile = $ProfilePath; operation = $Operation; createdAt = (Get-Date).ToString('o'); files = @() }

    foreach ($path in $Paths) {
        $relative = $path.Substring($ProfilePath.Length).TrimStart('\')
        $existed = Test-Path -LiteralPath $path -PathType Leaf
        if ($existed) {
            $backupPath = Join-Path $backupDirectory $relative
            [IO.Directory]::CreateDirectory((Split-Path -Parent $backupPath)) | Out-Null
            Copy-Item -LiteralPath $path -Destination $backupPath
        }
        $manifest.files += @{ path = $relative; existed = $existed }
    }
    $manifest | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $backupDirectory 'manifest.json') -Encoding UTF8
    return $backupDirectory
}

$script:ActiveImportPattern = '(?im)^[ \t]*@import[ \t]+(?:url\([ \t]*)?["'']?autohide_toolbox\.css["'']?[ \t]*\)?[ \t]*;[^\r\n]*'
$script:DisabledMarkerPattern = '(?im)^[ \t]*/\*[ \t]*ZenQOL Firefox ToolbarAutoHide: disabled[ \t]*\*/[ \t]*(?=\r?$)'
$script:CanonicalImport = '@import url("autohide_toolbox.css");'
$script:DisabledMarker = '/* ZenQOL Firefox ToolbarAutoHide: disabled */'

function Get-ZenQolToolbarAutoHideState {
    param([Parameter(Mandatory = $true)][string] $Content)

    $activeCount = [regex]::Matches($Content, $script:ActiveImportPattern).Count
    $disabledCount = [regex]::Matches($Content, $script:DisabledMarkerPattern).Count
    if ($activeCount -gt 0) { return 'Enabled' }
    if ($disabledCount -gt 0) { return 'Disabled' }
    return 'NotInstalled'
}

function Set-ZenQolToolbarAutoHideContent {
    param(
        [Parameter(Mandatory = $true)][string] $Content,
        [Parameter(Mandatory = $true)][ValidateSet('Enabled', 'Disabled')][string] $State
    )

    $current = Get-ZenQolToolbarAutoHideState -Content $Content
    $activeCount = [regex]::Matches($Content, $script:ActiveImportPattern).Count
    $disabledCount = [regex]::Matches($Content, $script:DisabledMarkerPattern).Count
    if ($current -eq $State -and ($activeCount + $disabledCount) -eq 1) {
        return $Content
    }

    $replacement = if ($State -eq 'Enabled') { $script:CanonicalImport } else { $script:DisabledMarker }
    $firstPattern = if ($activeCount -gt 0) { $script:ActiveImportPattern } elseif ($disabledCount -gt 0) { $script:DisabledMarkerPattern } else { $null }
    if (-not $firstPattern) {
        return $replacement + "`r`n" + $Content
    }

    $result = (New-Object Text.RegularExpressions.Regex($firstPattern)).Replace($Content, $replacement, 1)
    $removePattern = if ($State -eq 'Enabled') { $script:DisabledMarkerPattern } else { $script:ActiveImportPattern }
    $result = [regex]::Replace($result, $removePattern, '')

    # Collapse duplicate managed lines without changing unrelated line content.
    $targetPattern = if ($State -eq 'Enabled') { $script:ActiveImportPattern } else { $script:DisabledMarkerPattern }
    $targetMatches = [regex]::Matches($result, $targetPattern)
    for ($index = $targetMatches.Count - 1; $index -ge 1; $index--) {
        $match = $targetMatches[$index]
        $result = $result.Remove($match.Index, $match.Length)
    }
    return $result
}

Export-ModuleMember -Function Resolve-ZenQolFirefoxProfile, Read-ZenQolTextFile, Write-ZenQolTextAtomic, New-ZenQolBackup, Get-ZenQolToolbarAutoHideState, Set-ZenQolToolbarAutoHideContent
