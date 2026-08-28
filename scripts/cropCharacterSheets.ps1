<#
.SYNOPSIS
  Crops character sheets in public/character_sheets into individual frames.

.DESCRIPTION
  Source sheets are left untouched under public/character_sheets/ (reference masters).

  Layout is a single horizontal row of four full-height figures (1x4):

    [ front_clothed | rear_clothed | front_unclothed | rear_unclothed ]

  Each figure spans approximately the full sheet height. Cells are equal width
  (sheetWidth / 4) and full height.

  Output:
    public/characters/{name}/{pose}/{variant}.jpg

  Pose folder is `static`, `feminine`, or `masculine` from the source filename.
#>

[CmdletBinding()]
param(
  [string]$SourceDir = "",
  [string]$OutDir = ""
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$scriptDir = if ($PSScriptRoot) {
  $PSScriptRoot
}
elseif ($MyInvocation.MyCommand.Path) {
  Split-Path -Parent $MyInvocation.MyCommand.Path
}
else {
  Join-Path (Get-Location) "scripts"
}

if (-not $SourceDir) {
  $SourceDir = Join-Path $scriptDir "..\public\character_sheets"
}
if (-not $OutDir) {
  $OutDir = Join-Path $scriptDir "..\public\characters"
}

$SourceDir = [System.IO.Path]::GetFullPath($SourceDir)
$OutDir = [System.IO.Path]::GetFullPath($OutDir)

if (-not (Test-Path $SourceDir)) {
  throw "Source directory not found: $SourceDir"
}

# Remove previous crops so stale 2x2 frames cannot linger
if (Test-Path $OutDir) {
  Remove-Item -Recurse -Force $OutDir
}
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

# Left → right across one row (full sheet height)
$variants = @(
  @{ File = "front_clothed.jpg"; Index = 0 },
  @{ File = "rear_clothed.jpg"; Index = 1 },
  @{ File = "front_unclothed.jpg"; Index = 2 },
  @{ File = "rear_unclothed.jpg"; Index = 3 }
)

$sheets = Get-ChildItem -Path $SourceDir -File | Where-Object {
  $_.Name -match '^(?<name>[A-Za-z]+)_(?<pose>Static|Feminine|Masculine)\.(jpg|jpeg|png)$'
}

if (-not $sheets -or $sheets.Count -eq 0) {
  throw "No character sheets matched in $SourceDir"
}

$encoder = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
  Where-Object { $_.MimeType -eq "image/jpeg" } |
  Select-Object -First 1
$encoderParams = New-Object System.Drawing.Imaging.EncoderParameters(1)
$encoderParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter(
  [System.Drawing.Imaging.Encoder]::Quality,
  92L
)

$written = 0
Write-Output "Layout=1x4 (full-height strips)  Source=$SourceDir  Out=$OutDir"

foreach ($sheet in $sheets) {
  if ($sheet.Name -notmatch '^(?<name>[A-Za-z]+)_(?<pose>Static|Feminine|Masculine)\.(jpg|jpeg|png)$') {
    Write-Warning "Skipping unrecognized filename: $($sheet.Name)"
    continue
  }

  $charName = $Matches["name"].ToLowerInvariant()
  $pose = $Matches["pose"].ToLowerInvariant()
  $charDir = Join-Path $OutDir (Join-Path $charName $pose)
  New-Item -ItemType Directory -Force -Path $charDir | Out-Null

  $img = [System.Drawing.Image]::FromFile($sheet.FullName)
  try {
    $cellW = [int][math]::Floor($img.Width / 4)
    $cellH = $img.Height

    foreach ($v in $variants) {
      $x = $v.Index * $cellW
      $rect = New-Object System.Drawing.Rectangle $x, 0, $cellW, $cellH
      $crop = New-Object System.Drawing.Bitmap $cellW, $cellH
      $g = [System.Drawing.Graphics]::FromImage($crop)
      try {
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $g.DrawImage(
          $img,
          (New-Object System.Drawing.Rectangle 0, 0, $cellW, $cellH),
          $rect,
          [System.Drawing.GraphicsUnit]::Pixel
        )
      }
      finally {
        $g.Dispose()
      }

      $outPath = Join-Path $charDir $v.File
      if ($encoder) {
        $crop.Save($outPath, $encoder, $encoderParams)
      }
      else {
        $crop.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Jpeg)
      }
      $crop.Dispose()
      $written++
      Write-Output "wrote $charName/$pose/$($v.File) (${cellW}x${cellH}) from $($sheet.Name)"
    }
  }
  finally {
    $img.Dispose()
  }
}

$encoderParams.Dispose()
Write-Output ""
Write-Output "Done. Wrote $written frames under $OutDir"
Write-Output "Sources unchanged in $SourceDir"
