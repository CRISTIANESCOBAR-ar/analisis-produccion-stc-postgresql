# 🌐 Solución: Acceso a Archivos en Red

## 📋 Análisis del Escenario

### Situación Planteada

1. **Archivos USTER (.PAR, .TBL)**
   - Ubicación: PC en laboratorio de hilandería (red separada)
   - Problema: No es práctico copiarlos manualmente
   - Necesidad: Leerlos directamente desde donde están

2. **Archivos CSV**
   - Ubicación: Carpeta Descargas de usuarios
   - Problema: Necesitan copiarse al servidor
   - Necesidad: Simplificar el proceso de carga

### ❌ Limitación Principal de Contenedores

**Los contenedores Docker/Podman SOLO pueden acceder a:**
- Rutas del sistema host donde corren
- Volúmenes montados en ese host
- NO pueden acceder directamente a carpetas de otras máquinas

**Arquitectura actual:**
```
Usuario PC (red A) → Servidor Linux (red B) → Contenedor Podman
                          ↑
                   Solo aquí puede montar carpetas
```

---

## 💡 Soluciones Propuestas

### **Opción 1: Carpeta Compartida SMB/CIFS** ⭐ (Recomendada)

#### Arquitectura

```
┌──────────────────────────────────────────────────────────────┐
│  SERVIDOR DE ARCHIVOS (Windows/Samba)                       │
│  \\servidor-archivos\stc-data\                               │
│     ├── csv\          (CSVs de usuarios)                     │
│     └── uster\        (.PAR, .TBL de hilandería)             │
└──────────────────────────────────────────────────────────────┘
                          ↓ (montado en)
┌──────────────────────────────────────────────────────────────┐
│  SERVIDOR LINUX (Podman)                                     │
│  /mnt/stc-shared/                                            │
│     ├── csv/   → montado en contenedor como /data/csv        │
│     └── uster/ → montado en contenedor como /data/uster      │
└──────────────────────────────────────────────────────────────┘
                          ↓ (acceso desde)
┌──────────────────────────────────────────────────────────────┐
│  Usuarios finales → Copian archivos a \\servidor-archivos\  │
│  Lab hilandería → Copia .PAR/.TBL a \\servidor-archivos\    │
└──────────────────────────────────────────────────────────────┘
```

#### Configuración Paso a Paso

##### 1. Crear Carpeta Compartida (Windows Server o Samba)

**En Windows Server:**

```powershell
# Crear carpetas
New-Item -Path "D:\STC-Data\csv" -ItemType Directory -Force
New-Item -Path "D:\STC-Data\uster" -ItemType Directory -Force

# Compartir en la red
New-SmbShare -Name "stc-data" -Path "D:\STC-Data" -FullAccess "Todos"

# Establecer permisos NTFS
icacls "D:\STC-Data" /grant "Users:(OI)(CI)M"
```

**En Linux (Samba):**

```bash
# Instalar Samba
sudo apt install -y samba

# Configurar
sudo nano /etc/samba/smb.conf

# Agregar al final:
[stc-data]
    path = /srv/stc-data
    browseable = yes
    read only = no
    guest ok = no
    valid users = stc-user
    create mask = 0664
    directory mask = 0775

# Crear usuario Samba
sudo smbpasswd -a stc-user

# Reiniciar Samba
sudo systemctl restart smbd
```

##### 2. Montar en el Servidor Linux (donde corre Podman)

```bash
# Instalar utilidades CIFS
sudo apt install -y cifs-utils

# Crear directorio de montaje
sudo mkdir -p /mnt/stc-shared

# Crear archivo de credenciales (seguro)
sudo nano /etc/stc-credentials
# Contenido:
username=stc-user
password=contraseña_segura
domain=WORKGROUP

sudo chmod 600 /etc/stc-credentials

# Montar automáticamente al arrancar
sudo nano /etc/fstab

# Agregar línea:
//servidor-archivos/stc-data  /mnt/stc-shared  cifs  credentials=/etc/stc-credentials,uid=1000,gid=1000,file_mode=0644,dir_mode=0755  0  0

# Montar ahora
sudo mount -a

# Verificar
ls -lh /mnt/stc-shared/csv
ls -lh /mnt/stc-shared/uster
```

##### 2b. Montar en Servidor Windows (alternativa)

**💡 Ventaja de Windows Server:** Las carpetas compartidas son nativas, ¡no requieren montaje!

```powershell
# Si el servidor ES Windows Server, simplemente:
# 1. Crear carpeta compartida local o mapear unidad de red

# Opción A: Carpeta compartida local
New-Item -Path "C:\stc-data\csv" -ItemType Directory -Force
New-Item -Path "C:\stc-data\uster" -ItemType Directory -Force

# Compartir en la red para que usuarios copien archivos
New-SmbShare -Name "stc-csv" -Path "C:\stc-data\csv" -FullAccess "Todos"
New-SmbShare -Name "stc-uster" -Path "C:\stc-data\uster" -FullAccess "Lab-Hilanderia"

# Opción B: Mapear carpeta de otra máquina
# Esto mapea permanentemente, sobrevive reinicios
net use Z: \\pc-hilanderia\uster-data /persistent:yes /user:usuario contraseña

# Verificar
Get-ChildItem Z:\
Get-ChildItem C:\stc-data\csv

# Nota: En docker-compose.yml usar rutas Windows:
# - C:/stc-data/csv:/data/csv:ro
# - Z:/:/data/uster:ro
```

**🎯 En Windows es MUCHO más fácil:** No necesitas CIFS, Samba, ni montajes complejos. SMB es nativo.

##### 3. Modificar docker-compose.yml

```yaml
version: '3.9'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: stc_app
    environment:
      NODE_ENV: production
      PORT: 3001
      FRONTEND_DIST: /app/frontend/dist
      CSV_FOLDER: /data/csv
      USTER_FOLDER: /data/uster        # Nueva variable
      PG_HOST: postgres
      PG_PORT: 5432
      PG_DATABASE: stc_produccion
      PG_USER: stc_user
      PG_PASSWORD: stc_password_2026
    ports:
      - "3001:3001"
    volumes:
      # CSVs desde carpeta compartida
      - /mnt/stc-shared/csv:/data/csv:ro          # read-only
      
      # Archivos USTER (.PAR, .TBL) desde carpeta compartida
      - /mnt/stc-shared/uster:/data/uster:ro      # read-only
    depends_on:
      - postgres
    restart: unless-stopped
    networks:
      - stc_network

  postgres:
    # ... resto de configuración ...
```

##### 4. Verificar Acceso desde el Contenedor

```bash
# Entrar al contenedor
docker compose exec app sh

# Verificar carpetas
ls -lh /data/csv
ls -lh /data/uster

# Probar lectura
cat /data/csv/fichaArtigo.csv | head -5
cat /data/uster/archivo.PAR | head -5

# Salir
exit
```

#### Flujo de Trabajo

**Para CSVs:**
1. Usuario descarga CSV de sistema
2. Usuario abre Explorador de Windows
3. Usuario copia archivo a `\\servidor-archivos\stc-data\csv\`
4. Usuario abre aplicación web → Importar → Selecciona archivo de lista
5. Aplicación lee directamente desde `/data/csv`

**Para USTER (.PAR, .TBL):**
1. Usuario en hilandería exporta datos de USTER
2. Usuario copia archivos a `\\servidor-archivos\stc-data\uster\`
3. Usuario abre aplicación web → Importar USTER → Selecciona archivos
4. Aplicación lee directamente desde `/data/uster`

#### ✅ Ventajas
- ✅ No requiere copiar archivos manualmente al servidor
- ✅ Usuarios usan Explorador de Windows (familiar)
- ✅ Centralizado: un solo lugar para todos los archivos
- ✅ Permisos controlados por AD/Samba
- ✅ Múltiples usuarios pueden trabajar simultáneamente
- ✅ Backups más fáciles (una sola carpeta)

#### ⚠️ Desventajas
- ⚠️ Requiere servidor de archivos o PC siempre encendida
- ⚠️ Dependencia de red (si cae, no hay acceso)
- ⚠️ Configuración inicial más compleja
- ⚠️ Latencia de red al leer archivos grandes

---

### **Opción 2: Upload via Web** 🌐 (Más Simple)

#### Arquitectura

```
Usuario → Navegador Web → Upload HTTP → Backend API → Guarda en /data/csv
```

#### Ventajas de Upload Web

**Para el usuario:**
- No necesita acceso a carpetas de red
- Funciona desde cualquier PC/tablet/móvil
- Drag & drop moderno
- Progreso de upload visible

**Para IT:**
- Más seguro (solo puerto 443 abierto)
- No requiere permisos de red
- Funciona incluso con VPN
- Logs de quién sube qué

#### Implementación Backend

```javascript
// backend/server.js
import multer from 'multer'
import path from 'path'

// Configurar multer para uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const csvFolder = process.env.CSV_FOLDER || '/data/csv'
    cb(null, csvFolder)
  },
  filename: (req, file, cb) => {
    // Mantener nombre original o agregar timestamp
    const uniqueName = `${Date.now()}-${file.originalname}`
    cb(null, file.originalname) // o uniqueName
  }
})

const upload = multer({ 
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024 // Límite 100MB
  },
  fileFilter: (req, file, cb) => {
    // Aceptar solo CSV, PAR, TBL
    const allowedExt = ['.csv', '.par', '.tbl']
    const ext = path.extname(file.originalname).toLowerCase()
    
    if (allowedExt.includes(ext)) {
      cb(null, true)
    } else {
      cb(new Error('Tipo de archivo no permitido'))
    }
  }
})

// Endpoint para subir archivos
app.post('/api/upload/csv', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se recibió archivo' })
    }
    
    res.json({
      success: true,
      filename: req.file.filename,
      size: req.file.size,
      path: req.file.path
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Endpoint para subir múltiples archivos
app.post('/api/upload/uster', upload.array('files', 10), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No se recibieron archivos' })
    }
    
    const uploadedFiles = req.files.map(f => ({
      filename: f.filename,
      size: f.size,
      originalname: f.originalname
    }))
    
    res.json({
      success: true,
      files: uploadedFiles,
      count: req.files.length
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Endpoint para listar archivos disponibles
app.get('/api/files/list', (req, res) => {
  const csvFolder = process.env.CSV_FOLDER || '/data/csv'
  const files = fs.readdirSync(csvFolder)
    .filter(f => f.endsWith('.csv') || f.endsWith('.par') || f.endsWith('.tbl'))
    .map(f => {
      const stats = fs.statSync(path.join(csvFolder, f))
      return {
        name: f,
        size: stats.size,
        modified: stats.mtime
      }
    })
  
  res.json({ files })
})
```

#### Implementación Frontend (Vue)

```vue
<template>
  <div class="upload-container">
    <h2>Subir Archivos</h2>
    
    <!-- Drag & Drop Area -->
    <div 
      class="dropzone"
      @dragover.prevent
      @drop.prevent="handleDrop"
      @click="$refs.fileInput.click()"
    >
      <input 
        ref="fileInput"
        type="file"
        multiple
        accept=".csv,.par,.tbl"
        @change="handleFileSelect"
        style="display: none"
      />
      
      <div v-if="!uploading">
        <svg class="upload-icon">...</svg>
        <p>Arrastra archivos aquí o haz clic para seleccionar</p>
        <p class="text-sm">CSV, PAR, TBL (máx 100MB)</p>
      </div>
      
      <div v-else>
        <div class="spinner"></div>
        <p>Subiendo {{ currentFile }}...</p>
        <progress :value="uploadProgress" max="100"></progress>
      </div>
    </div>
    
    <!-- Lista de archivos seleccionados -->
    <div v-if="selectedFiles.length" class="file-list">
      <h3>Archivos Seleccionados ({{ selectedFiles.length }})</h3>
      <ul>
        <li v-for="(file, i) in selectedFiles" :key="i">
          {{ file.name }} ({{ formatSize(file.size) }})
          <button @click="removeFile(i)">×</button>
        </li>
      </ul>
      
      <button @click="uploadFiles" class="btn-upload">
        Subir Archivos
      </button>
    </div>
    
    <!-- Archivos ya subidos -->
    <div class="uploaded-files">
      <h3>Archivos Disponibles</h3>
      <ul>
        <li v-for="file in uploadedFiles" :key="file.name">
          {{ file.name }} ({{ formatSize(file.size) }})
          <span class="date">{{ formatDate(file.modified) }}</span>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'

const selectedFiles = ref([])
const uploadedFiles = ref([])
const uploading = ref(false)
const uploadProgress = ref(0)
const currentFile = ref('')

const handleFileSelect = (event) => {
  addFiles(event.target.files)
}

const handleDrop = (event) => {
  addFiles(event.dataTransfer.files)
}

const addFiles = (files) => {
  for (let file of files) {
    // Validar tipo
    if (!file.name.match(/\.(csv|par|tbl)$/i)) {
      alert(`${file.name}: Tipo no permitido`)
      continue
    }
    
    // Validar tamaño
    if (file.size > 100 * 1024 * 1024) {
      alert(`${file.name}: Demasiado grande (>100MB)`)
      continue
    }
    
    selectedFiles.value.push(file)
  }
}

const removeFile = (index) => {
  selectedFiles.value.splice(index, 1)
}

const uploadFiles = async () => {
  uploading.value = true
  
  for (let file of selectedFiles.value) {
    try {
      currentFile.value = file.name
      const formData = new FormData()
      formData.append('file', file)
      
      await axios.post('/api/upload/csv', formData, {
        onUploadProgress: (e) => {
          uploadProgress.value = Math.round((e.loaded * 100) / e.total)
        }
      })
      
      console.log(`✓ ${file.name} subido`)
    } catch (error) {
      console.error(`✗ Error al subir ${file.name}:`, error)
      alert(`Error: ${file.name}`)
    }
  }
  
  selectedFiles.value = []
  uploading.value = false
  uploadProgress.value = 0
  loadUploadedFiles()
}

const loadUploadedFiles = async () => {
  const { data } = await axios.get('/api/files/list')
  uploadedFiles.value = data.files
}

const formatSize = (bytes) => {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1024 / 1024).toFixed(1) + ' MB'
}

const formatDate = (date) => {
  return new Date(date).toLocaleString('es-ES')
}

onMounted(() => {
  loadUploadedFiles()
})
</script>

<style scoped>
.dropzone {
  border: 2px dashed #ccc;
  border-radius: 8px;
  padding: 40px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s;
}

.dropzone:hover {
  border-color: #4F46E5;
  background: #F9FAFB;
}

.file-list {
  margin-top: 20px;
}
</style>
```

#### Actualizar package.json

```json
{
  "dependencies": {
    "express": "^4.18.2",
    "multer": "^1.4.5-lts.1",
    // ... otras dependencias
  }
}
```

#### ✅ Ventajas
- ✅ Más simple de implementar
- ✅ No requiere configurar carpetas de red
- ✅ Funciona desde cualquier dispositivo
- ✅ Interfaz moderna (drag & drop)
- ✅ Más seguro (solo HTTPS)
- ✅ Logs de quién sube qué archivo
- ✅ Funciona con VPN

#### ⚠️ Desventajas
- ⚠️ Requiere subir archivos (ancho de banda)
- ⚠️ Para archivos muy grandes puede ser lento
- ⚠️ Duplica archivos (origen + servidor)

---

### **Opción 3: Híbrida (Ambas)** 🎯 (Máxima Flexibilidad)

Combinar ambas opciones:

1. **Carpeta compartida** para archivos pequeños y uso frecuente
2. **Upload web** para usuarios remotos o archivos ocasionales

**En backend:**
```javascript
// Leer desde carpeta compartida O desde uploads
const csvFolder = process.env.CSV_FOLDER || '/data/csv'
const uploadsFolder = process.env.UPLOADS_FOLDER || '/data/uploads'

app.get('/api/files/available', (req, res) => {
  const sharedFiles = listFiles(csvFolder)
  const uploadedFiles = listFiles(uploadsFolder)
  
  res.json({
    shared: sharedFiles,
    uploaded: uploadedFiles
  })
})
```

---

## 🎯 Recomendación Final

### Para tu caso específico:

**Para CSVs (usuarios con acceso web):**
→ **Opción 2: Upload Web** ⭐
- Los usuarios ya los tienen en Descargas
- Subirlos es más fácil que copiar a carpeta de red
- Funciona desde cualquier PC

**Para USTER .PAR/.TBL (laboratorio con PC dedicada):**
→ **Opción 1: Carpeta Compartida** ⭐
- Archivos generados automáticamente en una ubicación
- No es práctico subirlos uno por uno
- Puede haber cientos de archivos

### Implementación Sugerida

```yaml
# docker-compose.yml
services:
  app:
    volumes:
      # Carpeta compartida para USTER (laboratorio)
      - /mnt/stc-shared/uster:/data/uster:ro
      
      # Carpeta local para uploads web (CSVs)
      - ./uploads:/data/uploads
      
    environment:
      USTER_FOLDER: /data/uster
      UPLOADS_FOLDER: /data/uploads
```

**Flujo de trabajo:**
1. **CSVs**: Usuario → Web Upload → `/data/uploads`
2. **USTER**: Lab → Carpeta compartida → `/data/uster`

---

## 📝 Resumen de Decisiones

| Tipo de Archivo | Método Recomendado | Razón |
|-----------------|-------------------|-------|
| CSVs | Upload Web | Archivos ocasionales, usuarios dispersos |
| .PAR/.TBL | Carpeta Compartida | Generación automática, muchos archivos |
| Backups | Carpeta Compartida | Automatización, tamaño grande |

---

## 🚀 Próximos Pasos

1. Decidir qué opción(es) implementar
2. Configurar servidor de archivos (si Opción 1)
3. Agregar funcionalidad de upload (si Opción 2)
4. Actualizar docker-compose.yml
5. Documentar proceso para usuarios
6. Capacitar al personal

---

¿Quieres que implemente alguna de estas opciones en el código?
