# Documentación Técnica: Motor de Correlación "Golden Batch"

Este documento detalla la lógica de extracción de datos, filtros, cálculos de eficiencia ajustada (OEE) y las relaciones entre tablas utilizadas en el módulo "Golden Batch".

## 1. Fuentes de Datos (Tablas)

El análisis integra información de tres áreas productivas principales:

| Tabla | Área | Descripción | Función en el Modelo |
| :--- | :--- | :--- | :--- |
| **`tb_produccion`** | Tejeduría | Producción real y teórica por turno/rolada. | Base para el cálculo de eficiencia y volumen. |
| **`tb_paradas`** | Mantenimiento | Registro de tiempos muertos y motivos. | Fundamental para el "Ajuste OEE" (descuento de paradas exógenas). |
| **`tb_calidad_fibra`** | Laboratorio (HVI) | Parámetros de calidad del algodón (SCI, STR, MIC). | Variable independiente para correlacionar con el éxito/fracaso. |
| **`tb_produccion`** | Urdidora | Proceso intermedio. | Puente de trazabilidad: `Rolada (Tejido)` $\leftrightarrow$ `Lote (Fibra)`. |

---

## 2. Filtros y Alcance de Datos

Para asegurar la integridad del análisis, se aplican los siguientes filtros estrictos en la vista SQL (`view_golden_batch_data`):

1.  **Filtro de Planta y Proceso**:
    *   **Fuente de Producción**: `SELETOR = 'TECELAGEM'` (Los datos de eficiencia vienen estrictamente de Tejeduría).
    *   `FILIAL = '05'`
2.  **Validación de Intención de Producción**:
    *   Se descartan registros "basura" o turnos vacíos.
    *   **Condición**: El turno debe tener `METROS > 0` **O** `PUNTOS > 0` **O** tener registrada una `PARADA EXÓGENA` (justificando así la falta de producción).
3.  **Integridad de Calidad**:
    *   Se excluyen lotes de fibra que no posean valor de **SCI** (null o vacío), ya que es la métrica principal de correlación.

---

## 3. Algoritmo de Cálculo: "Eficiencia Ajustada (OEE)"

El modelo **NO** utiliza la eficiencia bruta reportada por la máquina. Calcula una **Eficiencia Neta** que aísla el desempeño del material, descontando factores externos.

### Paso A: Identificación de Paradas Exógenas
Se suman los minutos de paro registrados en `tb_paradas` para la máquina/fecha/turno específicos, filtrando solo motivos ajenos a la calidad del hilo:
*   **401**: Falta de Energía
*   **352**: Falta de Aire Comprimido
*   **301**: Logística / Espera de Urdimbre
*   **202**: Mantenimiento Preventivo Programado

### Paso B: Ajuste de Disponibilidad
$$ \text{Factor Disponibilidad} = \frac{\text{Tiempo Turno (480 min)} - \text{Minutos Exógenos}}{\text{Tiempo Turno (480 min)}} $$

### Paso C: Cálculo de Eficiencia
$$ \text{Eficiencia Ajustada} = \frac{\sum(\text{Puntos Reales})}{\sum(\text{Puntos Teóricos} \times \text{Factor Disponibilidad})} \times 100 $$

> **Interpretación**: Si una máquina estuvo sin energía el 50% del turno, su "meta" de puntos se reduce a la mitad. Si cumple esa meta reducida, su eficiencia será del 100%, evitando castigar al lote por problemas de planta.

---

## 4. Trazabilidad y Relaciones (Joins)

La ruta crítica para vincular un tejido con su materia prima es la siguiente:

1.  **Tejeduría** (`ROLADA`)
    *   Se parte de la rolada producida en el telar.
2.  **$\downarrow$ JOIN con Urdidora**
    *   Se busca en `tb_produccion` donde `SELETOR = 'URDIDORA'` coincidiendo por numero de `ROLADA`.
    *   Se extrae el campo `LOTE FIACAO`.
3.  **$\downarrow$ Limpieza de Datos**
    *   El código del lote se limpia de caracteres no numéricos (ej: "L-1025 A" $\rightarrow$ "1025").
4.  **$\downarrow$ JOIN con Calidad** (`LOTE_FIAC`)
    *   Se busca este número limpio en `tb_calidad_fibra`.
5.  **Agregación (Promedios)**
    *   Como un lote físico puede tener múltiples análisis de laboratorio, se promedian los valores de **SCI, STR, MIC, UHML, SF** para obtener un perfil único del lote.

---

## 5. Guía para Pruebas de Escritorio (Validación Manual)

Para validar la veracidad de los datos mostrados en el dashboard, siga este procedimiento con un caso de prueba:

1.  **Selección**: Elija una `ROLADA` específica que aparezca en el reporte.
2.  **Verificación de Paradas**:
    *   Consulte `tb_paradas` filtrando por la fecha y turno de producción de esa rolada.
    *   Sume los minutos de los códigos **401, 352, 301, 202**.
3.  **Recálculo de Eficiencia**:
    *   Tome los `PUNTOS_100%` (Teóricos) originales.
    *   Aplique el descuento: $NuevoTeorico = TeoricoOriginal * \frac{480 - MinutosParos}{480}$
    *   Verifique: $Eficiencia = \frac{PuntosReales}{NuevoTeorico} * 100$
4.  **Verificación de HVI**:
    *   Identifique el Lote de Hilo usado en la Urdidora para esa Rolada.
    *   Busque ese lote en los reportes de Calidad de Fibra.
    *   El promedio de SCI de esos registros debe coincidir con el dato en pantalla.
