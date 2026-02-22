# Estrategia de Sincronización de Archivos USTER en Contenedor Podman

## 📋 Resumen Ejecutivo

**Problema**: El USTER está en una red antigua y restrictiva. No se puede conectar directo.  
**Solución**: PC puente en la red del laboratorio sincroniza archivos `.PAR` y `.TBL` hacia carpeta compartida SMB.  
**Beneficio**: El contenedor accede a archivos "normalizados" sin complicaciones de red.

---

## ❌ Limitación Principal

Los contenedores **Podman/Docker NO pueden acceder directamente** a carpetas de otras máquinas en la red. Solo pueden montar rutas del servidor donde corren.

---

## ✅ Solución Recomendada: Híbrida

### 1️⃣ Para archivos `.PAR` y `.TBL` (USTER/TENSORAPID)
**Enfoque: Carpeta compartida SMB/CIFS montada en el servidor**

#### Por qué:
- Son muchos archivos generados automáticamente
- No es práctico subirlos uno por uno
- La PC del laboratorio puede compartir la carpeta
- El servidor Linux/Windows monta esa carpeta compartida
- El contenedor accede a esa carpeta montada

#### Ventajas:
✅ No copias manualmente los `.PAR`/`.TBL` al servidor  
✅ El USTER sigue aislado (no rompes políticas de red)  
✅ El host Windows controla permisos y auditoría  
✅ El contenedor solo lee archivos ya "normalizados"

---

## 📐 Arquitectura Propuesta

```
┌─────────────────────────────────────────────────────────────┐
│ PC Laboratorio (misma red que USTER)                        │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Sistema USTER/TENSORAPID                            │   │
│  │ (genera .PAR y .TBL)                                │   │
│  └────────────────┬────────────────────────────────────┘   │
│                   │                                         │
│                   │ copia archivos (robocopy)              │
│                   ▼                                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Carpeta Compartida SMB                              │   │
│  │ \\pc-laboratorio\uster_share                        │   │
│  └─────────────────────────────────────────────────────┘   │
└────────────────────────┬──────────────────────────────────────┘
                         │
                         │ montaje SMB (credenciales)
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ Windows Server                                              │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Ruta Local: D:\stc\uster_share                      │   │
│  │ (montada desde SMB)                                 │   │
│  └────────────────┬────────────────────────────────────┘   │
│                   │                                         │
│                   │ volumen Podman                          │
│                   ▼                                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Contenedor Podman                                   │   │
│  │                                                     │   │
│  │  /data/uster_files (contiene .PAR y .TBL)          │   │
│  │  /data/uploads (CSVs subidas por web)              │   │
│  │                                                     │   │
│  │  ▶ App Node.js lee archivos localmente             │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔧 Detalles Prácticos: Windows Server + Podman

### Paso 1: En la PC del Laboratorio

#### 1.1 Crear Carpeta Compartida SMB
```powershell
# En Windows (PC del laboratorio)
$folder = "D:\uster_share"
New-Item -ItemType Directory -Path $folder -Force

# Compartir carpeta (desde Explorador o PS admin)
# Clic derecho en carpeta → Propiedades → Compartir → Uso compartido avanzado
# Agregar regla: Usuarios del servidor con permisos de lectura
```

#### 1.2 Script de Sincronización (robocopy)
```powershell
# archivo: sync-uster-to-share.ps1
# Ejecutar como tarea programada cada hora o cada 15 min

$usterSource = "\\USTER-PC\GeneratedFiles"  # Ruta en USTER (ajustar)
$shareTarget = "D:\uster_share"
$logFile = "D:\logs\uster-sync-$(Get-Date -Format 'yyyyMMdd_HHmmss').log"

# robocopy: copia solo archivos .PAR y .TBL modificados
robocopy $usterSource $shareTarget *.PAR *.TBL /MIR /LOG:$logFile /TEE

# Validar resultado
if ($LASTEXITCODE -le 1) {
    Write-Output "Sincronización exitosa: $(Get-Date)" | Out-File -Append -Path "D:\logs\sync-success.log"
} else {
    Write-Output "Error en sincronización: $(Get-Date) - Code: $LASTEXITCODE" | Out-File -Append -Path "D:\logs\sync-error.log"
}
```

#### 1.3 Tarea Programada en Windows (PC Laboratorio)
```powershell
# Ejecutar como admin
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-File D:\Scripts\sync-uster-to-share.ps1"
$trigger = New-ScheduledTaskTrigger -RepetitionInterval (New-TimeSpan -Minutes 15) -Once
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries

Register-ScheduledTask -Action $action -Trigger $trigger -Principal $principal -Settings $settings -TaskName "uster-share-sync" -Description "Sincroniza archivos USTER a carpeta compartida"
```

---

### Paso 2: En Windows Server

#### 2.1 Montar Carpeta SMB
```powershell
# En Windows Server (ejecutar como Admin)
$username = "usuario_lectura"
$password = ConvertTo-SecureString "PASSWORD_AQUI" -AsPlainText -Force
$credential = New-Object System.Management.Automation.PSCredential($username, $password)

# Montar compartida
New-PSDrive -Name "Z" -PSProvider FileSystem -Root "\\pc-laboratorio\uster_share" -Credential $credential -Persist

# Alternativa: usar net use
net use Z: \\pc-laboratorio\uster_share /user:DOMINIO\usuario_lectura PASSWORD_AQUI /persistent:yes
```

#### 2.2 Verificar Montaje y Permisos
```powershell
# Validar que la ruta es accesible
Get-Item D:\stc\uster_share -ErrorAction Stop
Get-ChildItem D:\stc\uster_share | Select-Object Name, LastWriteTime

# Si usas Z: directamente
Get-ChildItem Z:\ | Select-Object Name, LastWriteTime
```

#### 2.3 Crear Tarea Verificación en Server
```powershell
# Validar que el share sigue montado (opcional pero recomendado)
# Ejecutar cada hora
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-Command 'if (-not (Test-Path Z:\)) { net use Z: \\pc-laboratorio\uster_share /user:DOMINIO\usuario /persistent:yes }'"
$trigger = New-ScheduledTaskTrigger -RepetitionInterval (New-TimeSpan -Hours 1) -Once
Register-ScheduledTask -Action $action -Trigger $trigger -TaskName "validate-uster-mount" -Description "Valida que carpeta USTER sigue montada"
```

---

### Paso 3: En Podman

#### 3.1 Montar Volumen en Podman (docker-compose.yml)
```yaml
version: '3.8'

services:
  app:
    image: stc-app:latest
    container_name: stc-container
    ports:
      - "3000:3000"
    volumes:
      # Montar carpeta local (que ya contiene archivos SMB sincronizados)
      - D:\stc\uster_share:/data/uster_files:ro  # read-only
      - D:\stc\uploads:/data/uploads:rw           # uploads del web
      - D:\stc\logs:/data/logs:rw
    environment:
      - NODE_ENV=production
      - USTER_FILES_PATH=/data/uster_files
      - UPLOADS_PATH=/data/uploads
    restart: unless-stopped
```

#### 3.2 En la App Node.js (backend)
```javascript
// config/paths.js
const path = require('path');

module.exports = {
  usterFilesPath: process.env.USTER_FILES_PATH || '/data/uster_files',
  uploadsPath: process.env.UPLOADS_PATH || '/data/uploads',
  logsPath: process.env.LOGS_PATH || '/data/logs',
};

// services/file-loader.js (ejemplo)
const fs = require('fs');
const path = require('path');
const { usterFilesPath } = require('../config/paths');

function getUsterFiles() {
  const files = fs.readdirSync(usterFilesPath);
  return files.filter(f => f.endsWith('.PAR') || f.endsWith('.TBL'));
}

function readParFile(filename) {
  const filePath = path.join(usterFilesPath, filename);
  return fs.readFileSync(filePath, 'utf-8');
}

module.exports = { getUsterFiles, readParFile };
```

---

## ⚠️ Consideraciones Importantes

### Seguridad
- **Carpeta SMB**: usar cuenta dedicada con permisos **solo lectura** en el server.
- **Credenciales**: evitar hardcodear en scripts; usar `net use` con contraseña almacenada de forma segura (ej. Windows Credential Manager).
- **Firewall**: asegurar que Windows Server puede alcanzar PC laboratorio en puerto 445 (SMB).

### Continuidad
- **Si cae la red**: el contenedor no falla si la app tolera "archivos no encontrados".
- **Rotación de logs**: los scripts de sincronización generan logs grandes; implementar rotación.
- **Espacio en disco**: monitorear que `D:\stc\uster_share` no se llene (`.PAR` y `.TBL` pueden ser grandes).

### Performance
- Si sincronizas cada 15 min y hay muchos archivos, usa filtros en robocopy: `/XD` (excluir directorios), `/M` (solo nuevos/modificados).
- Considera usar `/MON:n` (monitoreo continuo) en lugar de tarea cada N minutos.

---

## 2️⃣ Para archivos CSV (Usuarios Dispersos)

**Enfoque: Upload mediante interfaz web**

### Por qué:
- Usuarios ya los tienen en Descargas
- Son archivos ocasionales (no cientos)
- Más fácil: abrir web, drag & drop, listo
- Funciona desde cualquier PC/red
- No requiere configurar permisos de red

### Implementación básica (Node + multer + Vue):

**Backend (Express + multer)**
```javascript
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(process.env.UPLOADS_PATH || '/data/uploads'));
  },
  filename: (req, file, cb) => {
    const now = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    cb(null, `${now}_${file.originalname}`);
  },
});

const fileFilter = (req, file, cb) => {
  if (file.originalname.endsWith('.csv')) {
    cb(null, true);
  } else {
    cb(new Error('Solo se aceptan archivos CSV'), false);
  }
};

const upload = multer({ storage, fileFilter });

app.post('/api/upload/csv', upload.single('file'), (req, res) => {
  res.json({ message: 'Archivo subido', filename: req.file.filename });
});
```

**Frontend (Vue)**
```vue
<template>
  <div class="upload-zone" @dragover="onDragOver" @drop="onDrop">
    <input type="file" ref="fileInput" @change="onFileSelect" accept=".csv" hidden />
    <p @click="$refs.fileInput.click()" style="cursor: pointer;">
      🖱️ Haz clic o arrastra archivos CSV aquí
    </p>
  </div>
</template>

<script>
export default {
  methods: {
    async onFileSelect(event) {
      const file = event.target.files[0];
      if (file) await this.uploadFile(file);
    },
    onDragOver(e) {
      e.preventDefault();
      e.target.style.background = '#e0e0e0';
    },
    async onDrop(e) {
      e.preventDefault();
      const files = e.dataTransfer.files;
      for (let f of files) {
        if (f.name.endsWith('.csv')) await this.uploadFile(f);
      }
    },
    async uploadFile(file) {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload/csv', { method: 'POST', body: formData });
      const data = await res.json();
      console.log('Subido:', data);
    },
  },
};
</script>
```

---

## 🎯 Flujo Completo: Usuarios y Archivos

```
┌────────────────────────────────────────────┐
│ Usuario 1: Necesita importar CSV           │
├────────────────────────────────────────────┤
│ 1. Abre aplicación web                     │
│ 2. Va a sección "Importar CSV"             │
│ 3. Arrastra archivo desde Descargas        │
│ 4. Archivo se sube y procesa               │
│ 5. Resultado: datos en BD                  │
└────────────────────────────────────────────┘

┌────────────────────────────────────────────┐
│ Sistema Automático: USTER .PAR/.TBL        │
├────────────────────────────────────────────┤
│ 1. Script de PC laboratorio se ejecuta     │
│ 2. Detecta nuevos/modificados              │
│ 3. Copia a \\pc-lab\uster_share            │
│ 4. Windows Server monta como D:\...        │
│ 5. Contenedor ve archivos locales          │
│ 6. App los procesa cuando sea necesario    │
└────────────────────────────────────────────┘
```

---

## 📋 Checklist de Implementación

- [ ] Crear carpeta compartida en PC laboratorio (`D:\uster_share`)
- [ ] Testear acceso SMB desde Windows Server
- [ ] Crear y programar script `robocopy` en PC laboratorio
- [ ] Montar compartida en Windows Server (unidad Z: o D:\stc\uster_share)
- [ ] Crear tarea verificación en server
- [ ] Configurar `docker-compose.yml` con volúmenes
- [ ] Agregar variables de entorno en contenedor
- [ ] Validar permisos (lectura .PAR/.TBL, escritura uploads)
- [ ] Testear sincronización manual primero
- [ ] Instrumentar logs de sincronización
- [ ] Monitorear espacio en disco
- [ ] Documentar credenciales (en gestor seguro, no en script)

---

## 🚀 Preguntas Frecuentes

### ¿Qué pasa si falla la sincronización?
- Los archivos antiguos siguen disponibles en la carpeta SMB.
- El script registra error en log.
- La tarea de Windows Server intenta reconectar cada hora.

### ¿Cómo sé si el script está funcionando?
```powershell
Get-ChildItem D:\logs\uster-sync-*.log | Sort-Object LastWriteTime -Descending | Select-Object -First 5
```

### ¿Puedo sincronizar en tiempo real?
Sí, usa `robocopy /MON:5` (monitorea cada 5 segundos) en lugar de tarea programada. Pero consume más recursos.

### ¿Y si los archivos son muy grandes?
- Usa `/MOD` en robocopy (solo modificados desde la última sincronización).
- Comprime `.PAR`/`.TBL` antes de copiar (opcional).
- Sincroniza en horarios off-peak.

---

## 📞 Soporte

Si necesitas ajustar tiempos de sincronización, rutas, o validaciones, modifica:
- `sync-uster-to-share.ps1` en PC laboratorio
- `docker-compose.yml` en Windows Server
- Variables de entorno en contenedor

Mantén logs de sincronización para auditoría.
