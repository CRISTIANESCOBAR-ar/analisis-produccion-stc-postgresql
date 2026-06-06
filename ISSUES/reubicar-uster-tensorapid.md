# Issue: Reubicación de vistas Uster / Tenso / Uster Cardas

**Fecha:** 2026-06-06
**Autor:** Automático (Copilot)

## Resumen
Las vistas de UI `Uster`, `Uster Cardas` y `Tenso/Tensorapid` fueron trasladadas a otra aplicación. Hay que auditar la documentación, rutas, service worker y cualquier referencia pública o interna que siga apuntando a estas vistas para evitar confusión y accesos rotos.

## Objetivos
- Actualizar documentación y README para reflejar la reubicación. (hecho: README.md, ARCHIVOS_USTER_EN_CONTENEDOR.md, docs/db-normalization.md)
- Detectar y actualizar enlaces en otros repositorios (stc-mezclas-poc) y en assets precache del service worker.
- Crear redirecciones/guards para prevenir acceso directo a rutas obsoletas.
- Coordinar con el equipo de la App externa que ahora sirve estas vistas.

## Archivos detectados (primer barrido)
- c:\stc-produccion-v2\ARCHIVOS_USTER_EN_CONTENEDOR.md (documentación de sincronización) — actualizado
- c:\stc-produccion-v2\docs\db-normalization.md — actualizado
- c:\stc-produccion-v2\README.md — actualizado

- c:\stc-mezclas-poc\frontend\src\views\UsterView.vue
- c:\stc-mezclas-poc\frontend\src\views\UsterCardasView.vue
- c:\stc-mezclas-poc\frontend\src\components\UsterStatsPage.vue
- c:\stc-mezclas-poc\backend\src\server.js (imports y app.use('/api/uster', ...))
- c:\stc-mezclas-poc\backend\src\routes\usterRoutes.js
- c:\stc-mezclas-poc\frontend\dist\sw.js (precache contiene assets Uster/Tenso)
- c:\stc-mezclas-poc\frontend\dist\assets\* (UsterView, TensoRapidView, UsterCardasView)

> Nota: Esta lista es un primer barrido. Recomiendo ejecutar búsquedas adicionales por `uster`, `tensorapid`, `/uster`, `/tensorapid`, `/uster-cardas` en ambos repos para obtener la cobertura completa.

## Acciones sugeridas (priorizadas)
- [x] Confirmar y documentar que las vistas fueron movidas (ya realizado en docs). 
- [ ] Actualizar enlaces externos (wiki, tickets, documentación de producto) que apunten a las rutas antiguas.
- [ ] Revisar y, si procede, eliminar/actualizar referencias en otros repositorios (stc-mezclas-poc) y coordinar despliegue conjunto.
- [ ] Verificar `service worker` precache (sw.js) y regenerar build para evitar servir assets obsoletos.
- [ ] Añadir redirecciones/guards permanentes en `frontend/src/router.js` (si no están) para `/uster`, `/uster-cardas`, `/tensorapid`, `/tenso` → `/resumen`.
- [ ] Notificar al equipo responsable de la App externa y dejar registro de endpoints API que seguirá exponiendo el backend (si aplica).

## Tareas técnicas propuestas para este repo
- Regenerar `frontend` build tras limpieza de doc y assets (si aplica).
- Añadir nota en README (hecho)
- Crear un PR en `stc-mezclas-poc` indicando rutas que deben cambiar/ser eliminadas.

## Contactos / Stakeholders
- Equipo Frontend - stc-mezclas-poc
- Equipo Producto - responsable de la nueva App que hospeda las vistas

---

Por favor confirma si quieres que:
- Abra este issue directamente en el repo remoto (requiere permisos y nombre de proveedor/repo), o
- Cree un PR con cambios en `stc-mezclas-poc` para actualizar referencias, o
- Solo deje este issue local y proceda a actualizar más documentos identificados.
