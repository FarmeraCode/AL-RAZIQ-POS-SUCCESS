Add-Type -AssemblyName System.Drawing

$srcPath = 'C:\Users\HP\Desktop\al-raziq-pos-main\src\assets\al-raziq-logo.png'
$icoPath = 'C:\Users\HP\Desktop\al-raziq-pos-main\public\favicon.ico'

# Load image (works with JPEG or PNG)
$img = [System.Drawing.Image]::FromFile($srcPath)

# Resize to 256x256 with high quality
$bmp = New-Object System.Drawing.Bitmap(256, 256)
$g   = [System.Drawing.Graphics]::FromImage($bmp)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.DrawImage($img, 0, 0, 256, 256)
$g.Dispose()
$img.Dispose()

# Save the bitmap as PNG bytes (modern ICO supports embedded PNG)
$ms = New-Object System.IO.MemoryStream
$bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
$pngBytes = $ms.ToArray()
$ms.Dispose()
$bmp.Dispose()

# Manually write ICO format
$fs = [System.IO.File]::Open($icoPath, [System.IO.FileMode]::Create)
$bw = New-Object System.IO.BinaryWriter($fs)

# ICO header (6 bytes)
$bw.Write([uint16]0)   # reserved = 0
$bw.Write([uint16]1)   # type     = 1 (ICO)
$bw.Write([uint16]1)   # count    = 1

# ICO directory entry (16 bytes)
$bw.Write([byte]0)     # width  (0 means 256)
$bw.Write([byte]0)     # height (0 means 256)
$bw.Write([byte]0)     # color palette count
$bw.Write([byte]0)     # reserved
$bw.Write([uint16]1)   # planes
$bw.Write([uint16]32)  # bits per pixel
$bw.Write([uint32]$pngBytes.Length)  # size of image data
$bw.Write([uint32]22)  # offset = 6 (header) + 16 (dir entry)

# Write the PNG data
$bw.Write($pngBytes)
$bw.Flush()
$bw.Close()
$fs.Close()

Write-Host "SUCCESS: favicon.ico created -> $icoPath"
