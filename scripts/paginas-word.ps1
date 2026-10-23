# Arnés de desarrollo: abre cada DOCX en una instancia propia y oculta de Word, en solo lectura; lee la
# página de cada título (nivel de esquema 1 y 2), las páginas totales y el texto del índice antes y
# después de actualizarlo en memoria. Cierra sin guardar. Si se conecta a una Word ya abierta, aborta
# sin tocarla. Lo usa scripts/verificar-indice-word.ts; no forma parte de npm run test.
# Uso: powershell -NoProfile -File scripts/paginas-word.ps1 <salida.json> <docx...>
param(
  [Parameter(Mandatory = $true)][string]$Salida,
  [Parameter(ValueFromRemainingArguments = $true)][string[]]$Archivos
)
$ErrorActionPreference = 'Stop'
$antes = @(Get-Process WINWORD -ErrorAction SilentlyContinue | ForEach-Object Id)
$word = New-Object -ComObject Word.Application
$nuevos = @(Get-Process WINWORD -ErrorAction SilentlyContinue | Where-Object { $antes -notcontains $_.Id } | ForEach-Object Id)
$propia = ($nuevos.Count -eq 1 -and $word.Documents.Count -eq 0)
if (-not $propia) {
  [void][Runtime.InteropServices.Marshal]::ReleaseComObject($word)
  Write-Error 'Se conectó a una instancia existente de Word: se aborta sin tocarla.'
  exit 2
}
$word.Visible = $false
$word.DisplayAlerts = 0
$resultado = @()
try {
  foreach ($a in $Archivos) {
    $doc = $word.Documents.Open([ref]$a, [ref]$false, [ref]$true, [ref]$false)
    $doc.Repaginate()
    $titulos = @()
    foreach ($p in $doc.Paragraphs) {
      if ($p.OutlineLevel -le 2) {
        $titulos += [pscustomobject]@{
          nivel  = $p.OutlineLevel
          texto  = $p.Range.ListFormat.ListString + $p.Range.Text.Trim()
          pagina = $p.Range.Information(3)
        }
      }
    }
    $paginas = $doc.ComputeStatistics(2)
    $tocAntes = $doc.TablesOfContents.Item(1).Range.Text
    $doc.TablesOfContents.Item(1).Update()
    $tocDespues = $doc.TablesOfContents.Item(1).Range.Text
    $doc.Close([ref]0)
    $resultado += [pscustomobject]@{
      archivo    = [IO.Path]::GetFileName($a)
      paginas    = $paginas
      titulos    = $titulos
      tocAntes   = $tocAntes
      tocDespues = $tocDespues
    }
  }
}
finally {
  $version = $word.Version + '.' + $word.Build
  $word.Quit([ref]0)
  [void][Runtime.InteropServices.Marshal]::ReleaseComObject($word)
}
[pscustomobject]@{ versionWord = $version; documentos = $resultado } |
  ConvertTo-Json -Depth 6 | Out-File -FilePath $Salida -Encoding utf8
