#Requires AutoHotkey v2.0
#SingleInstance Force

; Ask before closing an entire Chrome window. Ctrl+W is intentionally untouched.

#HotIf WinActive("ahk_exe chrome.exe")
^+w::RequestChromeWindowClose()
!F4::RequestChromeWindowClose()
#HotIf

#HotIf GetChromeCloseButtonUnderMouse()
LButton::RequestChromeWindowClose(GetChromeCloseButtonUnderMouse())
#HotIf

GetChromeCloseButtonUnderMouse() {
    static GA_ROOT := 2
    static WM_NCHITTEST := 0x0084
    static HTCLOSE := 20

    CoordMode("Mouse", "Screen")
    MouseGetPos(&x, &y, &hoveredHwnd)
    if !hoveredHwnd
        return 0

    hwnd := DllCall("GetAncestor", "Ptr", hoveredHwnd, "UInt", GA_ROOT, "Ptr")
    if !hwnd || WinGetProcessName("ahk_id " hwnd) != "chrome.exe"
        return 0

    point := ((y & 0xFFFF) << 16) | (x & 0xFFFF)
    try hit := SendMessage(WM_NCHITTEST, 0, point, , "ahk_id " hwnd)
    catch
        return 0
    return hit = HTCLOSE ? hwnd : 0
}

RequestChromeWindowClose(hwnd := 0) {
    static WM_SYSCOMMAND := 0x0112
    static SC_CLOSE := 0xF060

    if !hwnd
        hwnd := WinExist("A")
    if !hwnd || WinGetProcessName("ahk_id " hwnd) != "chrome.exe"
        return

    result := MsgBox(
        "Close this entire Google Chrome window?",
        "Confirm Chrome window close",
        "YesNo Icon! Default2 Owner" hwnd
    )
    if result != "Yes"
        return

    if WinExist("ahk_id " hwnd) {
        try PostMessage(WM_SYSCOMMAND, SC_CLOSE, 0, , "ahk_id " hwnd)
    }
}
