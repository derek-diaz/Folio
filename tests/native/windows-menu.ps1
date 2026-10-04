param([Parameter(Mandatory = $true)][int]$ProcessId, [string]$Action, [int]$Width, [int]$Height, [switch]$Metrics)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
Add-Type @'
using System;
using System.Text;
using System.Runtime.InteropServices;
public static class FolioMenu {
  [DllImport("user32.dll")] public static extern IntPtr SetThreadDpiAwarenessContext(IntPtr context);
  [DllImport("user32.dll")] public static extern uint GetDpiForWindow(IntPtr window);
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr window, IntPtr after, int x, int y, int width, int height, uint flags);
  [DllImport("user32.dll")] public static extern IntPtr GetMenu(IntPtr window);
  [DllImport("user32.dll")] public static extern IntPtr GetSubMenu(IntPtr menu, int position);
  [DllImport("user32.dll")] public static extern int GetMenuItemCount(IntPtr menu);
  [DllImport("user32.dll")] public static extern uint GetMenuItemID(IntPtr menu, int position);
  [DllImport("user32.dll")] public static extern uint GetMenuState(IntPtr menu, uint position, uint flags);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetMenuString(IntPtr menu, uint position, StringBuilder text, int count, uint flags);
  [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr window, uint message, UIntPtr wparam, IntPtr lparam);
}
'@
$process = Get-Process -Id $ProcessId
$window = $process.MainWindowHandle
if ($window -eq [IntPtr]::Zero) { throw 'Folio window not found.' }
# Match Folio's per-monitor awareness so SetWindowPos receives physical pixels,
# rather than having the host PowerShell process virtualize them a second time.
[void][FolioMenu]::SetThreadDpiAwarenessContext([IntPtr]::new(-4))
$dpi = [FolioMenu]::GetDpiForWindow($window)
if ($Metrics) { ConvertTo-Json -InputObject @{ dpi = $dpi } -Compress; return }
if ($Width -gt 0 -and $Height -gt 0) {
    if (-not [FolioMenu]::SetWindowPos($window, [IntPtr]::Zero, 0, 0, [int]($Width * $dpi / 96), [int]($Height * $dpi / 96), 0x16)) { throw 'Could not resize the test window.' }
}
$menu = [FolioMenu]::GetMenu($window)
if ($menu -eq [IntPtr]::Zero) { throw 'Folio has no native menu.' }
$items = @()
for ($group = 0; $group -lt [FolioMenu]::GetMenuItemCount($menu); $group++) {
    $groupText = [Text.StringBuilder]::new(256)
    [void][FolioMenu]::GetMenuString($menu, $group, $groupText, 256, 0x400)
    $submenu = [FolioMenu]::GetSubMenu($menu, $group)
    for ($index = 0; $index -lt [FolioMenu]::GetMenuItemCount($submenu); $index++) {
        $label = [Text.StringBuilder]::new(256)
        [void][FolioMenu]::GetMenuString($submenu, $index, $label, 256, 0x400)
        $text = ($label.ToString() -replace '&', '').Split("`t")[0]
        if (-not $text) { continue }
        $id = [FolioMenu]::GetMenuItemID($submenu, $index)
        $enabled = ([FolioMenu]::GetMenuState($submenu, $index, 0x400) -band 3) -eq 0
        $items += [PSCustomObject]@{ group = $groupText.ToString().Replace('&', ''); text = $text; enabled = $enabled }
        if ($Action -and $text -eq $Action) {
            if (-not $enabled) { throw "Menu action is disabled: $Action" }
            if (-not [FolioMenu]::PostMessage($window, 0x111, [UIntPtr]::new($id), [IntPtr]::Zero)) { throw 'Menu dispatch failed.' }
        }
    }
}
if ($Action -and $Action -notin $items.text) { throw "Menu action not found: $Action" }
ConvertTo-Json -InputObject $items -Compress
