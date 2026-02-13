[CmdletBinding()]
param(
    [switch]$Force,
    [switch]$SkipUninstall,
    [switch]$SkipFolderCleanup,
    [switch]$SkipRegistryCleanup,
    [switch]$WhatIfOnly
)

$ErrorActionPreference = 'Stop'

function Write-Section {
    param([string]$Message)
    Write-Host "`n=== $Message ===" -ForegroundColor Cyan
}

function Write-Step {
    param([string]$Message)
    Write-Host "[OK] $Message" -ForegroundColor Green
}

function Test-IsAdmin {
    $currentIdentity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentIdentity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Remove-PathSafe {
    param(
        [Parameter(Mandatory = $true)]
        [string]$TargetPath
    )

    if (-not (Test-Path -LiteralPath $TargetPath)) {
        Write-Host "[SKIP] No existe: $TargetPath" -ForegroundColor DarkYellow
        return
    }

    if ($WhatIfOnly) {
        Write-Host "[WHATIF] Eliminaría: $TargetPath" -ForegroundColor Yellow
        return
    }

    Remove-Item -LiteralPath $TargetPath -Recurse -Force -ErrorAction SilentlyContinue

    if (Test-Path -LiteralPath $TargetPath) {
        Write-Host "[WARN] No se pudo eliminar completamente: $TargetPath" -ForegroundColor Yellow
    } else {
        Write-Step "Eliminado: $TargetPath"
    }
}

function Get-VSCodeUninstallEntries {
    $registryRoots = @(
        'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*',
        'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*',
        'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*'
    )

    $entries = foreach ($root in $registryRoots) {
        Get-ItemProperty -Path $root -ErrorAction SilentlyContinue |
            Where-Object {
                ($_.DisplayName -match 'Visual Studio Code|Microsoft Visual Studio Code|VS Code') -or
                ($_.Publisher -match 'Microsoft') -and ($_.DisplayName -match 'Code')
            }
    }

    $entries | Sort-Object DisplayName -Unique
}

function Invoke-UninstallEntry {
    param(
        [Parameter(Mandatory = $true)]
        $Entry
    )

    $display = $Entry.DisplayName
    $uninstallString = $Entry.UninstallString

    if ([string]::IsNullOrWhiteSpace($uninstallString)) {
        Write-Host "[SKIP] Sin comando de desinstalación: $display" -ForegroundColor DarkYellow
        return
    }

    if ($WhatIfOnly) {
        Write-Host "[WHATIF] Ejecutaría desinstalación de: $display" -ForegroundColor Yellow
        return
    }

    Write-Host "Desinstalando: $display" -ForegroundColor White

    $command = $uninstallString.Trim('"')

    if ($command -match 'unins\d*\.exe') {
        Start-Process -FilePath $command -ArgumentList '/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART' -Wait -ErrorAction SilentlyContinue
        Write-Step "Desinstalación completada (Inno Setup): $display"
        return
    }

    if ($command -match 'MsiExec\.exe') {
        $guidMatch = [regex]::Match($uninstallString, '\{[A-Z0-9\-]+\}', 'IgnoreCase')
        if ($guidMatch.Success) {
            Start-Process -FilePath 'msiexec.exe' -ArgumentList '/x', $guidMatch.Value, '/qn', '/norestart' -Wait -ErrorAction SilentlyContinue
            Write-Step "Desinstalación completada (MSI): $display"
            return
        }
    }

    try {
        Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', $uninstallString -Wait -ErrorAction SilentlyContinue
        Write-Step "Comando ejecutado: $display"
    } catch {
        Write-Host "[WARN] Falló desinstalación automática de: $display" -ForegroundColor Yellow
    }
}

Write-Section "Limpieza completa de Visual Studio Code"
Write-Host "Este script desinstala VS Code y elimina configuraciones, extensiones y caché." -ForegroundColor White
Write-Host "Si tienes snippets, settings o perfiles importantes, respáldalos antes." -ForegroundColor Yellow

if (-not $Force) {
    $confirmation = Read-Host "Escribe SI para continuar"
    if ($confirmation -ne 'SI') {
        Write-Host "Operación cancelada por el usuario." -ForegroundColor Yellow
        exit 1
    }
}

if (-not (Test-IsAdmin)) {
    Write-Host "[WARN] No estás en PowerShell como Administrador." -ForegroundColor Yellow
    Write-Host "Algunas rutas de sistema o desinstalaciones globales pueden no eliminarse." -ForegroundColor Yellow
}

Write-Section "Cerrando procesos"
if ($WhatIfOnly) {
    Write-Host "[WHATIF] Cerraría procesos code/code-insiders" -ForegroundColor Yellow
} else {
    Get-Process -Name 'Code', 'Code - Insiders', 'code', 'code-insiders' -ErrorAction SilentlyContinue |
        Stop-Process -Force -ErrorAction SilentlyContinue
    Write-Step "Procesos de VS Code cerrados"
}

if (-not $SkipUninstall) {
    Write-Section "Desinstalando VS Code"
    $entries = Get-VSCodeUninstallEntries
    if (-not $entries) {
        Write-Host "[SKIP] No se encontraron entradas de desinstalación en el registro." -ForegroundColor DarkYellow
    } else {
        foreach ($entry in $entries) {
            Invoke-UninstallEntry -Entry $entry
        }
    }

    if (Get-Command winget -ErrorAction SilentlyContinue) {
        if ($WhatIfOnly) {
            Write-Host "[WHATIF] Ejecutaría winget uninstall para VS Code" -ForegroundColor Yellow
        } else {
            winget uninstall --id Microsoft.VisualStudioCode -e --silent --accept-source-agreements --accept-package-agreements | Out-Null
            winget uninstall --id Microsoft.VisualStudioCode.Insiders -e --silent --accept-source-agreements --accept-package-agreements | Out-Null
            Write-Step "Intento de desinstalación adicional con winget completado"
        }
    }
}

if (-not $SkipFolderCleanup) {
    Write-Section "Eliminando carpetas de VS Code"
    $pathsToRemove = @(
        "$env:APPDATA\Code",
        "$env:APPDATA\Code - Insiders",
        "$env:LOCALAPPDATA\Code",
        "$env:LOCALAPPDATA\Programs\Microsoft VS Code",
        "$env:LOCALAPPDATA\Programs\Microsoft VS Code Insiders",
        "$env:USERPROFILE\.vscode",
        "$env:USERPROFILE\.vscode-insiders"
    )

    foreach ($path in $pathsToRemove) {
        Remove-PathSafe -TargetPath $path
    }
}

if (-not $SkipRegistryCleanup) {
    Write-Section "Limpieza de claves de registro"
    $registryPaths = @(
        'HKCU:\Software\Classes\vscode',
        'HKCU:\Software\Microsoft\VSCommon',
        'HKCU:\Software\Microsoft\Windows\CurrentVersion\App Paths\Code.exe'
    )

    foreach ($regPath in $registryPaths) {
        if ($WhatIfOnly) {
            Write-Host "[WHATIF] Eliminaría clave: $regPath" -ForegroundColor Yellow
            continue
        }

        if (Test-Path $regPath) {
            Remove-Item -Path $regPath -Recurse -Force -ErrorAction SilentlyContinue
            Write-Step "Clave eliminada: $regPath"
        } else {
            Write-Host "[SKIP] No existe clave: $regPath" -ForegroundColor DarkYellow
        }
    }
}

Write-Section "Sugerencia de extensiones esenciales (instalar luego de reinstalar VS Code)"
$essentialExtensions = @(
    'ms-python.python           # Python',
    'ms-python.vscode-pylance   # Pylance',
    'dbaeumer.vscode-eslint     # ESLint',
    'esbenp.prettier-vscode     # Prettier',
    'Vue.volar                  # Vue 3 (Volar)',
    'bradlc.vscode-tailwindcss  # Tailwind CSS IntelliSense',
    'eamodio.gitlens            # Productividad Git',
    'ms-azuretools.vscode-docker # Contenedores Docker/Podman',
    'redhat.vscode-yaml         # YAML',
    'streetsidesoftware.code-spell-checker # Spell check técnico'
)

$essentialExtensions | ForEach-Object { Write-Host " - $_" -ForegroundColor White }

$extensionsFile = Join-Path -Path (Get-Location) -ChildPath 'vscode-essential-extensions.txt'
if (-not $WhatIfOnly) {
    $essentialExtensions | Set-Content -Path $extensionsFile -Encoding UTF8
    Write-Step "Lista guardada en: $extensionsFile"
}

Write-Section "Finalizado"
Write-Host "Si acabas de limpiar todo, reinicia Windows antes de reinstalar VS Code." -ForegroundColor Cyan
Write-Host "Instalación sugerida: winget install --id Microsoft.VisualStudioCode -e" -ForegroundColor Cyan
