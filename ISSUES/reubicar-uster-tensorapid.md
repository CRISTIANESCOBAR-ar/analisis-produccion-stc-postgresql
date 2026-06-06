# Issue: Reubicación de vistas Uster / Tenso / Uster Cardas

**Fecha:** 2026-06-06
**Autor:** Automático (Copilot)

## Resumen
Las vistas de UI `Uster`, `Uster Cardas` y `Tenso/Tensorapid` fueron trasladadas a otra aplicación. Hay que auditar la documentación, rutas, service worker y cualquier referencia pública o interna que siga apuntando a estas vistas para evitar confusión y accesos rotos.

## Objetivos
- Actualizar documentación y README para reflejar la reubicación.
- Crear redirecciones/guards para prevenir acceso directo a rutas obsoletas.
- Coordinar con el equipo de la App externa que ahora sirve estas vistas.

## Archivos actualizados
- `ARCHIVOS_USTER_EN_CONTENEDOR.md` — nota añadida
- `docs/db-normalization.md` — nota añadida
- `README.md` — nota añadida
- `frontend/src/router.js` — redirecciones `/uster`, `/uster-cardas`, `/tenso` → `/resumen`; `/inventario` → `/resumen`
- `frontend/src/components/SidebarCompact.vue` — menú Uster/Tenso/Uster Cardas eliminado; Inventarios oculto

## Acciones sugeridas pendientes
- [ ] Verificar `service worker` precache en cliente final y limpiar caché si es necesario.
- [ ] Notificar al equipo responsable de la App externa que los endpoints API del backend siguen activos.

---

Por favor confirma si quieres que:
- Abra este issue directamente en el repo remoto (requiere permisos y nombre de proveedor/repo), o
- Solo deja este issue local como registro.
