param(
  [Parameter(Mandatory = $true)][string]$ManifestPath,
  [Parameter(Mandatory = $true)][string]$ResultPath,
  [int]$MaxSize = 160,
  [long]$JpegQuality = 72
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$items = Get-Content -Raw -LiteralPath $ManifestPath | ConvertFrom-Json
$results = New-Object System.Collections.Generic.List[object]

$codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq "image/jpeg" } | Select-Object -First 1
$encoder = [System.Drawing.Imaging.Encoder]::Quality
$encoderParams = New-Object System.Drawing.Imaging.EncoderParameters(1)
$encoderParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter($encoder, $JpegQuality)

foreach ($item in $items) {
  $source = [string]$item.source
  $target = [string]$item.target
  try {
    if (-not (Test-Path -LiteralPath $source)) {
      $results.Add([pscustomobject]@{ id = $item.id; ok = $false; error = "source_missing" })
      continue
    }

    New-Item -ItemType Directory -Force -Path ([System.IO.Path]::GetDirectoryName($target)) | Out-Null

    $image = [System.Drawing.Image]::FromFile($source)
    try {
      $scale = [Math]::Min($MaxSize / [double]$image.Width, $MaxSize / [double]$image.Height)
      if ($scale -gt 1) { $scale = 1 }
      $width = [Math]::Max(1, [int][Math]::Round($image.Width * $scale))
      $height = [Math]::Max(1, [int][Math]::Round($image.Height * $scale))

      $thumb = New-Object System.Drawing.Bitmap($width, $height)
      try {
        $graphics = [System.Drawing.Graphics]::FromImage($thumb)
        try {
          $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
          $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
          $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
          $graphics.DrawImage($image, 0, 0, $width, $height)
        } finally {
          $graphics.Dispose()
        }
        $thumb.Save($target, $codec, $encoderParams)
      } finally {
        $thumb.Dispose()
      }

      $file = Get-Item -LiteralPath $target
      $results.Add([pscustomobject]@{
        id = $item.id
        ok = $true
        width = $width
        height = $height
        size = $file.Length
      })
    } finally {
      $image.Dispose()
    }
  } catch {
    $results.Add([pscustomobject]@{ id = $item.id; ok = $false; error = $_.Exception.Message })
  }
}

$json = $results | ConvertTo-Json -Depth 5
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($ResultPath, $json, $utf8NoBom)
