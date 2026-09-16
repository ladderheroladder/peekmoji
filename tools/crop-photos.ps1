# Crops out captions, watermarks and mounts that would give answers away.
# Rects are x,y,w,h on the compressed 1280px images; each only applies if the file still has its pre-crop size.
Add-Type -AssemblyName System.Drawing
$dir = Join-Path $PSScriptRoot '..\timescope\photos'
$crops = @{
  'cape-town-1897'     = @(851, 1280, 55, 688, 730, 515)    # handwritten "Cape Town ... 1897"
  'delhi-durbar-1903'  = @(1280, 970, 30, 30, 1220, 830)    # LIFE watermark
  'chicago-fair-1893'  = @(1280, 1035, 124, 120, 1017, 800) # printed "COURT OF HONOR"
  'colosseum-1846'     = @(1280, 1063, 45, 15, 1215, 960)   # handwritten "Colosseo"
  'moscow-1893'        = @(1280, 944, 0, 0, 1280, 838)      # handwritten Moscow caption
  'nihonbashi-1911'    = @(1280, 827, 38, 32, 1205, 735)    # postcard "NIHON BASHI TOKYO"
  'havana-1903'        = @(1280, 822, 0, 105, 1122, 717)    # postcard "PRADO AVENUE, HAVANA"
  'amsterdam-1895'     = @(1280, 940, 0, 0, 1280, 895)      # photochrom "P.Z. AMSTERDAM"
  'hagia-sophia-1897'  = @(1280, 932, 0, 0, 1280, 893)      # photochrom "CONSTANTINOPLE"
  'taj-mahal-1865'     = @(1280, 1035, 0, 0, 1280, 1005)    # "Bourne" negative number
  'johnstown-1889'     = @(1280, 931, 15, 15, 1250, 843)    # "JOHNSTOWN FLOOD No 26" + copyright
  'sphinx-1876'        = @(1280, 975, 0, 0, 1280, 915)      # handwritten "Le Sphynx..."
  'jerusalem-1900'     = @(981, 1280, 0, 20, 981, 1175)     # "AMERICAN COLONY JERUSALEM"
  'sydney-bridge-1930' = @(1280, 979, 20, 28, 1238, 920)    # black border + corner note
  'tower-bridge-1892'  = @(1024, 766, 0, 0, 1024, 722)      # "TOWER BRIDGE WORKS 1892"
  'chicago-fire-1871'  = @(916, 1280, 40, 45, 836, 1190)    # album mount
}
$codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$params = New-Object System.Drawing.Imaging.EncoderParameters 1
$params.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality), 85L

foreach ($id in $crops.Keys) {
  $path = Join-Path $dir "$id.jpg"
  $c = $crops[$id]
  $img = [System.Drawing.Image]::FromFile($path)
  if ($img.Width -ne $c[0] -or $img.Height -ne $c[1]) { "skip $id (already $($img.Width)x$($img.Height))"; $img.Dispose(); continue }
  $bmp = New-Object System.Drawing.Bitmap $c[4], $c[5]
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.DrawImage($img, (New-Object System.Drawing.Rectangle 0, 0, $c[4], $c[5]), (New-Object System.Drawing.Rectangle $c[2], $c[3], $c[4], $c[5]), [System.Drawing.GraphicsUnit]::Pixel)
  $g.Dispose(); $img.Dispose()
  $tmp = "$path.tmp"
  $bmp.Save($tmp, $codec, $params); $bmp.Dispose()
  Move-Item $tmp $path -Force
  "cropped $id -> $($c[4])x$($c[5])"
}
