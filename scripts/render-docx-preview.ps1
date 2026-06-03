param(
  [Parameter(Mandatory = $true)][string]$InputPath
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.IO.Compression.FileSystem

function Escape-Html([string]$Value) {
  if ($null -eq $Value) { return "" }
  return $Value.Replace("&", "&amp;").Replace("<", "&lt;").Replace(">", "&gt;").Replace('"', "&quot;").Replace("'", "&#039;")
}

$zip = [System.IO.Compression.ZipFile]::OpenRead($InputPath)
try {
  $entry = $zip.GetEntry("word/document.xml")
  if ($null -eq $entry) {
    throw "word_document_missing"
  }

  $stream = $entry.Open()
  try {
    $reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::UTF8)
    try {
      [xml]$xml = $reader.ReadToEnd()
    } finally {
      $reader.Dispose()
    }
  } finally {
    $stream.Dispose()
  }

  $paragraphs = New-Object System.Collections.Generic.List[string]
  $pNodes = $xml.GetElementsByTagName("w:p")
  foreach ($p in $pNodes) {
    $parts = New-Object System.Collections.Generic.List[string]
    foreach ($node in $p.ChildNodes) {
      foreach ($textNode in $node.GetElementsByTagName("w:t")) {
        $parts.Add($textNode.InnerText)
      }
      foreach ($tabNode in $node.GetElementsByTagName("w:tab")) {
        $parts.Add("    ")
      }
      foreach ($brNode in $node.GetElementsByTagName("w:br")) {
        $parts.Add("`n")
      }
    }
    $text = ($parts -join "")
    if ($text.Trim().Length -gt 0) {
      $paragraphs.Add("<p>$(Escape-Html $text)</p>")
    }
  }

  if ($paragraphs.Count -eq 0) {
    throw "word_text_empty"
  }

  $body = $paragraphs -join "`n"
  $html = @"
<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { margin: 0; padding: 22px 18px 40px; font-family: "Microsoft YaHei", Arial, sans-serif; color: #16221b; background: #fbfbf8; line-height: 1.72; font-size: 16px; }
    p { margin: 0 0 14px; white-space: pre-wrap; overflow-wrap: anywhere; }
  </style>
</head>
<body>
$body
</body>
</html>
"@
  [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
  [Console]::Write($html)
} finally {
  $zip.Dispose()
}
