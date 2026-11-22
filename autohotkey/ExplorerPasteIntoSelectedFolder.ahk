#Requires AutoHotkey v2.0
#SingleInstance Force
; Ctrl+V no File Explorer: se exatamente 1 pasta (filesystem) estiver selecionada
; no painel principal, cola DENTRO dela via verbo nativo do Shell ("paste").
; Caso contrario, Ctrl+V funciona normalmente. So afeta janelas do Explorer.

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
        ; qualquer falha na inspecao via COM -> cai no comportamento padrao abaixo
    }
    Send("^v")
}
