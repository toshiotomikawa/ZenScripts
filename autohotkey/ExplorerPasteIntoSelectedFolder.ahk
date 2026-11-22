#Requires AutoHotkey v2.0
#SingleInstance Force
; Ctrl+V in File Explorer: when exactly one file-system folder is selected in the
; main pane, pastes INTO it through the Shell's own "paste" verb.
; Otherwise Ctrl+V works as usual. Affects Explorer windows only.

#HotIf WinActive("ahk_class CabinetWClass") or WinActive("ahk_class ExploreWClass")
^v::PasteIntoSelectedFolderOrDefault()
#HotIf

PasteIntoSelectedFolderOrDefault() {
    try {
        hwnd := WinExist("A")
        shellApp := ComObject("Shell.Application")
        for win in shellApp.Windows() {
            try {
                if (win.HWND != hwnd)
                    continue
                doc := win.Document
                sel := doc.SelectedItems
                if (sel.Count = 1) {
                    item := sel.Item(0)
                    if (item.IsFolder && item.IsFileSystem) {
                        path := item.Path
                        if (FileExist(path) && InStr(FileExist(path), "D")) {
                            item.InvokeVerb("paste")
                            return
                        }
                    }
                }
            }
        }
    } catch {
        ; any COM inspection failure falls back to the normal paste below
    }
    Send("^v")
}
