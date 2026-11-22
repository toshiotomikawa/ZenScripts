# Firefox toolbar auto-hide

This feature hides Firefox's entire top browser interface—tabs, navigation/URL bar, and the bookmarks toolbar—in a normal or maximized window. Moving the pointer to the top edge or focusing the browser UI reveals it. It does not require F11/fullscreen and does not alter the Windows taskbar.

The setup intentionally uses only Firefox's supported profile stylesheet mechanism:

- `toolkit.legacyUserProfileCustomizations.stylesheets = true` in `user.js`;
- one `@import` in `chrome/userChrome.css`;
- the vendored `chrome/autohide_toolbox.css` stylesheet.

No extension, theme, or `userChrome.js` loader is installed.

## Install or restore

Open PowerShell in this folder and run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\Install.ps1
```

The installer supports ordinary desktop Firefox and Microsoft Store/MSIX Firefox. It reads Firefox's `installs.ini`/`profiles.ini` registration rather than assuming a profile name. If more than one active default is genuinely ambiguous, it stops and lists the candidates; select one explicitly with `-ProfilePath`.

The operation is idempotent. Before changing an existing `user.js`, `userChrome.css`, or installed stylesheet, it copies that file under:

```text
<profile>\.zenqol-backups\firefox-toolbar-autohide\<timestamp>\
```

Existing `userChrome.css` rules are preserved. The installer removes duplicate imports of this stylesheet and puts its single import first, before other CSS rules and `@namespace` declarations. It updates `user.js` and never writes live `prefs.js`.

The installer also creates a per-user Start Menu shortcut named **Firefox Toolbar Auto-Hide Toggle** inside the **ZenQOL** folder. It requires no administrator privileges. Rerunning the installer updates the shortcut safely and preserves a deliberately disabled toolbar state.

Restart Firefox after installation if profile files changed.

## Enable, disable, toggle, or check status

Open Start, search for **Firefox Toolbar Auto-Hide Toggle**, and launch it. A message reports whether auto-hide is now enabled or disabled and reminds you about Firefox restart behavior. The shortcut does not close Firefox.

The same operations are available directly in PowerShell:

```powershell
.\Set-State.ps1 Enable
.\Set-State.ps1 Disable
.\Set-State.ps1 Toggle
.\Set-State.ps1 Status
```

Each state-changing command backs up `userChrome.css` before editing it. Enable and Disable are idempotent; Toggle alternates between states. Disabling comments out only the ZenQOL-managed stylesheet reference. The installed stylesheet, Firefox preference, and all unrelated `userChrome.css` content remain in place.

Firefox reads `userChrome.css` only at startup. If Firefox is open, restart it when convenient to apply the new state. The command never kills or restarts Firefox.

## Verify

With Firefox normal or maximized and F11 off:

1. Move into the webpage: the complete top browser UI should hide.
2. Touch the top screen edge: the UI should appear.
3. Press `Ctrl+L`: the URL bar should appear and receive focus.
4. Return the pointer to the webpage: the UI should hide again.
5. Confirm that the Windows taskbar still behaves normally.

## Update the vendored stylesheet

Compare upstream `chrome/autohide_toolbox.css` with `assets/autohide_toolbox.css`. If an update is needed:

1. Replace the vendored file with the unmodified upstream content.
2. Update the commit, date, and SHA-256 in [`SOURCE.md`](SOURCE.md).
3. Review the diff and test the installer against disposable desktop and MSIX profile trees.
4. Run the installer normally; it backs up the installed prior version before replacing it.

## Roll back

Close Firefox. Open the newest timestamped backup directory shown by the installer and read `manifest.json`:

- copy each backed-up file to the same relative path under the profile;
- delete a listed file when `existed` is `false` (it was created by the installer).

Restart Firefox. This restores the precise pre-install state, including any prior `userChrome.css` customizations.

## Remove the convenience shortcut

Delete this per-user shortcut; the Firefox feature itself remains installed:

```powershell
Remove-Item -LiteralPath (Join-Path ([Environment]::GetFolderPath('Programs')) 'ZenQOL\Firefox Toolbar Auto-Hide Toggle.lnk')
```

Rerunning `Install.ps1` recreates it.
