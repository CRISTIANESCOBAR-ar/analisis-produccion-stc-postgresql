# 📋 Checklist Rápido - Demostración para Personal de IT

**Proyecto:** STC Producción V2  
**Fecha:** _________________  
**Personal IT:** _________________

---

## ✅ Antes de la Reunión

- [ ] Contenedores corriendo: `podman-compose ps` o `docker compose ps`
- [ ] PostgreSQL accesible: `podman exec stc_postgres pg_isready`
- [ ] API funcionando: Abrir http://localhost:3001
- [ ] Tener abiertos: `docker-compose.yml`, `Dockerfile`, `README.md`
- [ ] Opcional: Ejecutar `.\mostrar-configuracion-it.ps1` y guardar output

---

## 📊 Puntos Clave a Mostrar

### 1. Stack Tecnológico (2 min)
```
Frontend: Vue 3 + Vite + TailwindCSS
Backend:  Node.js 20 + Express  
BD:       PostgreSQL 16
Deploy:   Podman/Docker Compose
```

### 2. Arquitectura de Contenedores (3 min)
```powershell
# Ver servicios
podman-compose ps

# Mostrar docker-compose.yml
code docker-compose.yml
```

**Explicar:**
- 3 servicios: app, postgres, pgadmin
- Volúmenes persistentes
- Red interna (stc_network)

### 3. Puertos y Acceso (2 min)
```
3001 → Aplicación (Frontend + Backend API)
5433 → PostgreSQL (solo desarrollo, NO en prod)
5050 → pgAdmin (opcional)
```

### 4. Variables de Entorno (3 min)
```powershell
# Mostrar .env o docker-compose.yml
cat .env

# Ver dentro del contenedor
podman exec stc_app env | grep -E "PG_|NODE_ENV|PORT|CSV"
```

**⚠️ Importante:** En producción cambiar contraseñas

### 5. PostgreSQL (5 min)
```powershell
# Conectar
podman exec -it stc_postgres psql -U stc_user -d stc_produccion

# Dentro de psql:
\dt                    # Listar tablas
SELECT version();      # Versión
\d produccion          # Ver estructura de una tabla
\q                     # Salir
```

**Mostrar:**
- Scripts en `init-db/*.sql`
- Tamaño de BD
- Número de tablas

### 6. Importación de CSV (3 min)
```powershell
# Listar CSVs
ls csv/*.csv | ft Name, Length, LastWriteTime

# Mostrar carpeta montada en contenedor
podman exec stc_app ls -lh /data/csv
```

**Explicar:**
- CSV se importan desde interfaz web o API
- Ruta en servidor: `/opt/stc-data/csv`
- Proceso puede tardar 5-15 min para archivos grandes

### 7. Dockerfile y Build (3 min)
```powershell
# Mostrar Dockerfile
cat Dockerfile
```

**Explicar Multi-Stage Build:**
1. Compilar frontend (Vite)
2. Preparar backend (npm ci --omit=dev)
3. Imagen runtime (~200MB vs ~1GB)

### 8. Logs y Debugging (2 min)
```powershell
# Ver logs en tiempo real
podman-compose logs -f app

# Últimas 50 líneas
podman-compose logs --tail=50 app
```

### 9. Backups (3 min)
```powershell
# Mostrar script
cat backup-database.ps1

# Listar backups
ls backups/*.sql | sort LastWriteTime -desc | select -first 5
```

**Explicar:**
- Backup diario automático (cron)
- Retención 30 días
- Guardar fuera del servidor

### 10. Recursos y Rendimiento (2 min)
```powershell
# Ver uso actual
podman stats --no-stream
```

---

## 🖥️ Requisitos del Servidor

### Hardware Mínimo
- ✅ CPU: 4 cores
- ✅ RAM: 8 GB
- ✅ Disco: 100 GB SSD
- ✅ OS: Ubuntu 22.04 LTS

### Software Necesario
- ✅ Docker o Podman + compose
- ✅ Nginx (reverse proxy)
- ✅ Git
- ✅ certbot (SSL con Let's Encrypt)

### Red y Seguridad
- ✅ Puertos: 80 (HTTP), 443 (HTTPS), 22 (SSH)
- ✅ Firewall configurado
- ✅ PostgreSQL NO expuesto públicamente
- ✅ Dominio y DNS configurados
- ✅ SSL/TLS obligatorio

---

## 🔐 Seguridad (Enfatizar)

- [ ] Cambiar TODAS las contraseñas por defecto
- [ ] PostgreSQL solo en red interna/VPN
- [ ] SSL con Let's Encrypt
- [ ] Firewall: solo puertos 80, 443, 22
- [ ] Backups cifrados fuera del servidor
- [ ] Variables de entorno en archivo protegido
- [ ] No exponer puertos de desarrollo (5433, 5050)

---

## 📦 Datos a Migrar/Preparar

### Al Servidor
- [ ] Código fuente (git clone o rsync)
- [ ] Archivos CSV en `/opt/stc-data/csv`
- [ ] Variables de entorno (`.env`)
- [ ] Scripts de backup
- [ ] Configuración de Nginx

### Persistencia (Backups)
- [ ] Base de datos PostgreSQL (~500MB-2GB)
- [ ] Archivos CSV importados (~100MB-1GB)
- [ ] Logs de aplicación

---

## 🚀 Proceso de Deployment

### Opción Recomendada: Docker Compose
1. Instalar Docker/Podman en servidor Ubuntu
2. Clonar repositorio
3. Configurar `.env` con contraseñas de producción
4. Crear directorio para CSV: `/opt/stc-data/csv`
5. `docker compose build`
6. `docker compose up -d`
7. Configurar Nginx como reverse proxy
8. Obtener certificado SSL (Let's Encrypt)
9. Configurar backups automáticos (cron)
10. Probar y monitorear

---

## 📞 Contacto y Documentación

### Documentos a Entregar
- [ ] `GUIA_IMPLEMENTACION_SERVIDOR.md` (completa)
- [ ] `docker-compose.yml`
- [ ] `Dockerfile`
- [ ] `README.md`
- [ ] Scripts de backup (`.ps1` o `.sh`)
- [ ] Output de `mostrar-configuracion-it.ps1`

### Para Soporte
- Ver logs: `docker compose logs app`
- Documentación: Archivos `.md` en el proyecto
- Contacto: _________________________

---

## ❓ Preguntas Frecuentes de IT

**Q: ¿Docker o Podman?**  
A: Ambos funcionan. Podman es gratuito para empresas. Comandos casi idénticos.

**Q: ¿Node.js en el servidor?**  
A: NO necesario si usa Docker. Todo está en contenedores.

**Q: ¿Tiempo de deployment?**  
A: ~30-60 min (con experiencia en Docker + Nginx + SSL)

**Q: ¿Downtime para actualizaciones?**  
A: ~2-5 min (git pull + rebuild + restart)

**Q: ¿Cómo hacer rollback?**  
A: Git checkout versión anterior + rebuild

**Q: ¿Base de datos externa?**  
A: Sí, cambiar `PG_HOST` en variables de entorno

**Q: ¿Monitoreo?**  
A: Logs con `docker logs`, métricas con `docker stats`, uptime con herramientas externas

**Q: ¿Backup automático?**  
A: Cron job ejecuta `pg_dump` diario, retención 30 días

---

## 📝 Notas de la Reunión

**Decisiones:**

_____________________________________________________________

_____________________________________________________________

_____________________________________________________________


**Acción Items:**

- [ ] _________________________________________________ (responsable: ________)
- [ ] _________________________________________________ (responsable: ________)
- [ ] _________________________________________________ (responsable: ________)


**Fecha de Deployment Planificada:** _________________

**Follow-up:** _________________

---

## ✅ Post-Reunión

- [ ] Enviar documentación completa por email
- [ ] Compartir credenciales de forma segura
- [ ] Coordinar acceso al servidor
- [ ] Agendar sesión de deployment
- [ ] Planificar pruebas post-deployment
- [ ] Definir plan de rollback si hay problemas

---

**Firma IT:** ____________________  **Fecha:** ____/____/____

**Firma Dev:** ___________________  **Fecha:** ____/____/____
