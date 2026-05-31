param(
  [string]$csvPath = 'c:\stc-produccion-v2\db_schema.csv',
  [string]$xlsxPath = 'c:\stc-produccion-v2\db_schema.xlsx'
)

if (-not (Test-Path $csvPath)) {
  Write-Error "CSV no encontrado: $csvPath"
  exit 2
}

try {
  $excel = New-Object -ComObject Excel.Application -ErrorAction Stop
} catch {
  Write-Error "Excel COM no disponible. No se pudo convertir a .xlsx. CSV generado en: $csvPath"
  exit 3
}

$excel.Visible = $false
$excel.DisplayAlerts = $false

$workbook = $null
try {
  $workbook = $excel.Workbooks.Open($csvPath)
  $workbook.SaveAs($xlsxPath, 51) # 51 = xlOpenXMLWorkbook (xlsx)
  $workbook.Close($false)
  Write-Output "Saved $xlsxPath"
} catch {
  Write-Error "Error al convertir CSV a XLSX: $_"
  exit 4
} finally {
  if ($workbook -ne $null) { [System.Runtime.Interopservices.Marshal]::ReleaseComObject($workbook) | Out-Null }
  $excel.Quit()
  [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
  [GC]::Collect()
  [GC]::WaitForPendingFinalizers()
}
