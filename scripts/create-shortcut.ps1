$WshShell = New-Object -ComObject WScript.Shell
$DesktopPath = [Environment]::GetFolderPath("Desktop")
$ShortcutPath = Join-Path $DesktopPath "Open Al Raziq POS.lnk"

# Remove existing shortcut if any
if (Test-Path $ShortcutPath) { Remove-Item $ShortcutPath }

# Get the absolute path to the project root directory dynamically
$ProjectDir = Split-Path -Parent $PSScriptRoot

$Shortcut = $WshShell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = Join-Path $ProjectDir "Launch_App.bat"
$Shortcut.WorkingDirectory = $ProjectDir
$Shortcut.Description = "Launch Al Raziq POS System"

# Use Al Raziq logo ICO
$IconPath = Join-Path $ProjectDir "public\favicon.ico"
$Shortcut.IconLocation = $IconPath

$Shortcut.Save()
Write-Host "SUCCESS: Shortcut created on Desktop at $ShortcutPath"
