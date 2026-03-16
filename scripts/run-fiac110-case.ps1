$ErrorActionPreference = 'Stop'

$base = 'http://localhost:3001'
$mix = Invoke-RestMethod -Uri "$base/api/dashboard/mezcla-lotes?lotes=110" -Method GET -TimeoutSec 60

$payloadLocal = @{ rows = $mix.rows; loteActual = 110; proveedores = $mix.proveedores; modo = 'local' } | ConvertTo-Json -Depth 12
$local = Invoke-RestMethod -Uri "$base/api/dashboard/narrativa-lotes" -Method POST -ContentType 'application/json' -Body $payloadLocal -TimeoutSec 180

$payloadGem = @{ rows = $mix.rows; loteActual = 110; proveedores = $mix.proveedores } | ConvertTo-Json -Depth 12
$gem = Invoke-RestMethod -Uri "$base/api/dashboard/narrativa-lotes" -Method POST -ContentType 'application/json' -Body $payloadGem -TimeoutSec 240

New-Item -ItemType Directory -Path 'exports' -Force | Out-Null
Set-Content -Path 'exports/caso_fiac110_local.txt' -Value $local.narrativa -Encoding UTF8
Set-Content -Path 'exports/caso_fiac110_gemini.txt' -Value $gem.narrativa -Encoding UTF8

Write-Output '=== RESULTADOS ==='
Write-Output "Fuente local: $($local.fuente)"
Write-Output "Fuente gemini: $($gem.fuente)"
Write-Output "Local chars: $($local.narrativa.Length)"
Write-Output "Gemini chars: $($gem.narrativa.Length)"
Write-Output ''

Write-Output '=== EXTRACTO LOCAL (CORRELACION OE) ==='
$ln = $local.narrativa -split "`n"
$idx = ($ln | Select-String -Pattern 'CORRELACIÓN CON PRODUCCIÓN OE' -SimpleMatch).LineNumber
if ($idx) {
  $start = [Math]::Max(1, $idx - 1)
  $end = [Math]::Min($ln.Count, $idx + 14)
  for ($i = $start; $i -le $end; $i++) {
    Write-Output ("{0}`t{1}" -f $i, $ln[$i-1])
  }
} else {
  Write-Output 'No se encontro bloque de correlacion OE en narrativa local.'
}
Write-Output ''

Write-Output '=== EXTRACTO GEMINI (CORRELACION OE) ==='
$lg = $gem.narrativa -split "`n"
$idxg = ($lg | Select-String -Pattern 'CORRELACIÓN CON PRODUCCIÓN OE|correlación con tb_PRODUCCION_OE|sin evidencia de correlación').LineNumber | Select-Object -First 1
if ($idxg) {
  $startg = [Math]::Max(1, $idxg - 1)
  $endg = [Math]::Min($lg.Count, $idxg + 14)
  for ($i = $startg; $i -le $endg; $i++) {
    Write-Output ("{0}`t{1}" -f $i, $lg[$i-1])
  }
} else {
  Write-Output 'No se encontro bloque explicito de correlacion OE en narrativa Gemini.'
}
