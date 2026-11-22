# ZenScripts

Userscripts and small Windows tools for calmer, cleaner computing.

## Userscripts

| Script | Site | What it does |
|---|---|---|
| [Wikipedia: seamless background](https://raw.githubusercontent.com/toshiotomikawa/ZenScripts/main/wikipedia-background/wikipedia-background.user.js) | Wikimedia projects | One background colour, without grey margins, in light and night modes |
| [X: download tweet images](https://raw.githubusercontent.com/toshiotomikawa/ZenScripts/main/x-image-download/x-image-download.user.js) | X | Adds a download button that saves a post's images at original quality |
| [X: hide What's happening](https://raw.githubusercontent.com/toshiotomikawa/ZenScripts/main/x-hide-whats-happening/x-hide-whats-happening.user.js) | X | Hides the trending box in the sidebar |

Install [Tampermonkey](https://www.tampermonkey.net/) or [Violentmonkey](https://violentmonkey.github.io/), then click a script's name. Installed scripts update from this repository.

## AutoHotkey

Run with [AutoHotkey v2](https://www.autohotkey.com/).

- [`ExplorerPasteIntoSelectedFolder.ahk`](autohotkey/ExplorerPasteIntoSelectedFolder.ahk) pastes into the selected folder in File Explorer; `Ctrl+V` works as usual otherwise.
- [`ConfirmChromeWindowClose.ahk`](autohotkey/ConfirmChromeWindowClose.ahk) asks before closing a whole Chrome window; closing tabs is unaffected.

## Firefox

- [Toolbar auto-hide](firefox-toolbar-autohide/README.md) hides Firefox's top bars until the pointer reaches the top edge, without fullscreen.

## License

[MIT](LICENSE), except `firefox-toolbar-autohide/assets/autohide_toolbox.css`, which is MPL-2.0 from MrOtherGuy/firefox-csshacks (see its [SOURCE.md](firefox-toolbar-autohide/SOURCE.md)).
