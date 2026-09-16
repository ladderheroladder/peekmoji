# Resizes timescope/photos/* to max 1280px and re-encodes as JPEG (quality 82). Windows PowerShell 5.1, no installs.
# Run: powershell -File tools/compress-photos.ps1   then: node tools/fetch-photos.mjs (to refresh photos.js)
Add-Type -AssemblyName System.Drawing
$dir = Join-Path $PSScriptRoot '..\timescope\photos'
$codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$params = New-Object System.Drawing.Imaging.EncoderParameters 1
$params.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality), 82L
$max = 1280

Get-ChildItem $dir -File | Where-Object { $_.Extension -in '.jpg', '.png' } | ForEach-Object {
  $before = $_.Length
  $img = [System.Drawing.Image]::FromFile($_.FullName)
  $scale = [Math]::Min(1.0, $max / [Math]::Max($img.Width, $img.Height))
  $w = [int]($img.Width * $scale); $h = [int]($img.Height * $scale)
  $bmp = New-Object System.Drawing.Bitmap $w, $h
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = 'HighQualityBicubic'; $g.SmoothingMode = 'HighQuality'; $g.PixelOffsetMode = 'HighQuality'
  $g.Clear([System.Drawing.Color]::White)
  $g.DrawImage($img, 0, 0, $w, $h)
  $g.Dispose(); $img.Dispose()
  $tmp = Join-Path $dir ($_.BaseName + '.tmp')
  $bmp.Save($tmp, $codec, $params); $bmp.Dispose()
  Remove-Item $_.FullName
  $final = Join-Path $dir ($_.BaseName + '.jpg')
  Move-Item $tmp $final -Force
  '{0,-24} {1,5}KB -> {2,4}KB  {3}x{4}' -f $_.BaseName, [int]($before / 1KB), [int]((Get-Item $final).Length / 1KB), $w, $h
}
