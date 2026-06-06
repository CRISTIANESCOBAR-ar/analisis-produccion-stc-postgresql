# Diccionario de Normalizacion de Datos

Documento centralizado para reglas de normalizacion de lotes, fechas y formulas de negocio en `stc-produccion-v2`.

> **Nota:** Las vistas de interfaz para `Uster`, `Uster Cardas` y `Tenso/Tensorapid` ahora se gestionan desde otra App. En esta base de código se mantienen las reglas de normalización y los endpoints necesarios, pero la UI del frontend redirige a `Resumen Ensayos`.

## Alcance y fuentes revisadas

Fuentes principales del codigo:

- `frontend/src/components/ensayos/DashboardMezclaHilo.vue`
- `frontend/src/components/ensayos/InformeAuditoriaLote.vue`
- `frontend/src/components/ensayos/ResumenSemanalHilanderia.vue`
- `frontend/src/components/ensayos/ResumenEnsayos.vue`
- `shared/qualityMatrix.js`
- `backend/server.js`
- `backend/routes/eficiencias-tecelaje.mjs`
- `backend/import-manager.js`
- `backend/scripts/import_metas_monthly.mjs`

---

## 1) Normalizacion de lotes

### 1.1 Regla canonica de relacion entre formato comercial y secuencial

Regla unificada observada en frontend y backend:

1. Extraer digitos del lote.
2. Convertir a entero para quitar ceros a la izquierda.
3. Usar ese entero como clave de relacion entre fuentes.

Ejemplo:

- Comercial: `HD-119-26` -> `119`
- Secuencial: `0000000119` -> `119`

Equivalente de referencia:

```js
canonicalLote = String(parseInt(String(lote).replace(/\D/g, ''), 10))
```

### 1.2 Normalizacion en componentes Vue

#### `InformeAuditoriaLote.vue`

Funciones:

- `normalizeLote(value)`:
  - Intenta `raw.match(/[\s-](\d+)[\s-]/)` para capturar el bloque medio.
  - Si no encuentra, usa `raw.replace(/\D/g, '')`.
  - Devuelve `String(parseInt(..., 10))`.
- `formatLote(value)`:
  - Retorna el resultado de `normalizeLote`.

Efecto: tolera entradas tipo `HD-119-26`, `HD 119-26`, `119`, etc.

#### `ResumenSemanalHilanderia.vue`

Funcion:

- `formatLote(lote)`:
  - Usa `str.match(/[\s-](\d+)[\s-]/)`.
  - Si hay match devuelve el bloque medio (`119`).
  - Si no, devuelve el string original.

#### `ResumenEnsayos.vue`

Funcion:

- `formatLote(lote)`:
  - Igual enfoque de bloque medio con regex `[\s-](\d+)[\s-]`.
  - Fallback al valor original.

Adicionalmente, en la interpretacion de texto libre:

- `const loteMatch = text.match(/(?:lote|fiac)\s*#?\s*(\d{1,4})\b/i)`
- `const lote = loteMatch ? String(parseInt(loteMatch[1], 10)) : ''`

Esto normaliza lote pedido por el usuario en preguntas tipo "lote 109".

### 1.3 Normalizacion en backend

#### `backend/server.js` - endpoint `GET /api/dashboard/mezcla-lotes`

- Entrada `lotes` (query):
  - `lotes.split(',').map(parseInt).filter(n > 0)`
  - Deduplica con `Set`.
- SQL para llave numerica:
  - `CAST(NULLIF(regexp_replace("LOTE_FIAC", '[^0-9]', '', 'g'), '') AS INTEGER) AS mistura`
- Tambien calcula `mistura_real` desde `MISTURA` con la misma estrategia de digitos.

#### `backend/server.js` - comparacion por lote fiac

- En varias consultas se fuerza comparacion logica por entero de `LOTE_FIAC`:
  - `CAST(NULLIF(regexp_replace("LOTE_FIAC", '[^0-9]', '', 'g'), '') AS INTEGER)`
- Para claves en JS:
  - `String(row.LOTE_FIAC || '').replace(/^0+/, '').trim()`

#### `backend/server.js` - conversion a formato secuencial (10 digitos)

- `const loteFiacFormateado = String(loteFiac).padStart(10, '0')`
- `const mistura = misturaRaw.padStart(10, '0')`

Uso: consultas donde la tabla guarda `LOTE_FIAC` con ceros a izquierda.

### 1.4 Regla recomendada para SQL futuro

Para joins robustos entre fuentes heterogeneas:

```sql
CAST(NULLIF(regexp_replace(campo_lote, '[^0-9]', '', 'g'), '') AS INTEGER)
```

Y para presentar secuencial de 10 digitos:

```sql
LPAD(canonical_lote::text, 10, '0')
```

---

## 2) Normalizacion de fechas

### 2.1 Patrones de fecha identificados

El sistema mezcla estos formatos:

- `Date` nativo JS
- Epoch en segundos o milisegundos
- `YYYY-MM-DD` (ISO fecha)
- `DD/MM/YYYY`
- `DD/MM/YY`
- `DD/MM/YYYY HH:mm[:ss]`
- Firestore/Firebase `Timestamp` con `toDate()`

### 2.2 Frontend: conversion y comparacion

#### `DashboardMezclaHilo.vue` - `toDateKey(value)`

Normaliza a clave `YYYY-MM-DD`:

1. Si es `Date` valido -> `toISOString().slice(0, 10)`.
2. Si string ISO `YYYY-MM-DD...` -> toma ese prefijo.
3. Si string BR `DD/MM/YY` o `DD/MM/YYYY` -> convierte a `YYYY-MM-DD`.
4. Fallback `new Date(raw)` -> `YYYY-MM-DD`.

Uso central:

- `dateKey = toDateKey(row.fecha) || toDateKey(row.fecha_txt)`
- Comparacion con `corteKey = toDateKey(fechaCorte)`.

#### `InformeAuditoriaLote.vue` - `parseDateValue(value)`

Flujo:

1. `Date` valido.
2. Objeto con `toDate()` (compatibilidad Firestore `Timestamp`).
3. Numerico epoch (ms o sec).
4. Regex `DD/MM/(YY|YYYY) [HH:mm[:ss]]`.
5. Fallback `new Date(raw)`.

#### `ResumenSemanalHilanderia.vue` - `parseRowDate(row)` y parse manual de `timeStampRaw`

- Soporta `TIME_STAMP`, `TIME`, `TIMESTAMP`, `Fecha`, etc.
- Convierte strings BR a `Date`.
- Fallback ISO/JS date parser.

#### `ResumenEnsayos.vue` - soporte explicito Firebase

- `getPreferredFecha(row)`:
  - Prioriza `TIME_STAMP`, `TIME`, `TIMESTAMP`, etc.
  - Si hay objeto con `toDate`, lo convierte (Firestore Timestamp).
- `displayFecha(fecha)`:
  - Acepta `Date`, epoch y string.
  - Renderiza `dd/mm/yy`.

### 2.3 Backend: conversion SQL y procesos de importacion

#### `backend/server.js` - `sqlParseDate(colIdent)`

Regla SQL compartida:

```sql
CASE
  WHEN col IS NULL OR col = '' THEN NULL
  WHEN col ~ '^[0-3][0-9]/[0-1][0-9]/[0-9]{4}' THEN to_date(substring(col from 1 for 10), 'DD/MM/YYYY')
  WHEN col ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN substring(col from 1 for 10)::date
  ELSE NULL
END
```

Uso: filtros `BETWEEN`, `GROUP BY` diario y comparacion entre tablas con formatos distintos.

#### `backend/import-manager.js` - `parseDateToISO(value)`

Normaliza `DD/MM/YYYY`, `DD/MM/YY` y `YYYY-MM-DD` a `YYYY-MM-DD`.

Tambien, para limpieza por fecha, arma expresion SQL segun tipo de columna:

- Si `date`: usa columna directa.
- Si `timestamp`: `DATE(col)`.
- Si `text`: CASE con deteccion BR/ISO.

#### `backend/scripts/import_metas_monthly.mjs` - `parseFecha(value)`

Acepta:

- `DD/MM/YYYY`
- `dia DD-mon-YY` (mes textual espanol)

Salida: `YYYY-MM-DD`.

### 2.4 Regla operativa para comparaciones

Para comparar fechas entre colecciones/vistas/queries:

1. Convertir todo a `date` (backend SQL) o `YYYY-MM-DD` (frontend).
2. Evitar comparar strings crudos con formato mixto.
3. En frontend, usar `toDateKey`/`parseDateValue` antes de agrupar u ordenar.

---

## 3) Formulas del proyecto (matematicas y negocio)

## 3.1 Titulos, desvio y dispersion (Uster/Tensorapid)

### A) Desvio porcentual de titulo vs Ne

Archivos:

- `InformeAuditoriaLote.vue`
- `ResumenEnsayos.vue`

Formula:

```text
Desvio% = ((Ne - Titulo_promedio) / Ne) * 100
```

Interpretacion:

- `> 0`: hilo mas grueso que el Ne nominal.
- `< 0`: hilo mas delgado que el Ne nominal.

Variables:

- `Ne`: `NOMCOUNT`/`Ne` del ensayo.
- `Titulo_promedio`: promedio de `TITULO` en tabla Uster por `testnr`.

### B) Promedio simple de variable

Archivos:

- `InformeAuditoriaLote.vue` (`avg`)
- `ResumenSemanalHilanderia.vue` (`calcAvg`)
- `ResumenEnsayos.vue` (`calcAvg`)

Formula:

```text
promedio = sum(x_i) / n
```

### C) Estadistica por huso (modal)

Archivo:

- `ResumenEnsayos.vue`

Formulas:

```text
varianza = sum((x_i - promedio)^2) / n
sd = sqrt(varianza)
CV% = (sd / promedio) * 100
Q95 = percentil 95 de la serie ordenada
```

## 3.2 Formula de "caida" en tecelaje

Archivo:

- `backend/routes/eficiencias-tecelaje.mjs`

Formula implementada en codigo y comentario:

```text
denominador = (((RPM * 1440) / (BATIDAS_FIO * 100)) * 0.90 / 90) * (EFIC_TURNO + 0.1)
dias_restantes = (MT_A_BATER / denominador) + 0.25
fecha_caida = now + dias_restantes
```

Interpretacion:

- Estima fecha/hora de agotamiento de metraje restante de la pieza/lote.

## 3.3 Metros ajustados por encogimiento

Archivo:

- `backend/routes/eficiencias-tecelaje.mjs` (SQL)

Formula:

```text
metros_ajustados = MT_PREVISTA * ((100 - ENC_ACAB_URD) / 100)
```

Variables:

- `MT_PREVISTA`: metraje planificado.
- `ENC_ACAB_URD`: encogimiento de acabado urdimbre.

## 3.4 Eficiencias promedio por turno

Archivo:

- `backend/routes/eficiencias-tecelaje.mjs`

Formula SQL:

```text
EFIC_TX = ROUND(AVG(EFIC_TX), 1)
```

Para columnas `EFIC_TA`, `EFIC_TB`, `EFIC_TC`, `EFIC_DIA`.

## 3.5 Promedio ponderado HVI por peso de fardo

Archivo:

- `ResumenSemanalHilanderia.vue` (`calcHviWeightedAvg`)

Formula:

```text
promedio_ponderado_hvi = sum(valor_hvi_i * peso_i) / sum(peso_i)
```

Se aplica a `SCI`, `MIC`, `STR`, `UHML`, etc.

## 3.6 Desvio semanal contra baseline

Archivo:

- `ResumenSemanalHilanderia.vue`

Formulas:

```text
DesvioTitulo% = ((Titulo_ref - Titulo_semana) / Titulo_ref) * 100
DesvioMetrica% = ((Metrica_semana - Baseline_metrica) / Baseline_metrica) * 100
```

## 3.7 Matriz de calidad y reglas umbral

Archivo:

- `shared/qualityMatrix.js`

### A) Evaluacion por umbral (`evalUmbral`)

Tipo `min`:

- `ok` si `valor >= ok`
- `warn` si `valor >= warn` y `< ok`
- `crit` en caso contrario

Tipo `max`:

- `ok` si `valor <= ok`
- `warn` si `valor <= warn` y `> ok`
- `crit` en caso contrario

### B) Indice eta (eficiencia de transformacion fibra->hilo)

Formula (`computeEta`):

```text
eta = (tenacidad_hilo / str_fibra) * 100
```

### C) Caida de eta vs ventana de referencia

Archivo: `shared/qualityMatrix.js` (`evaluateEtaAgainstWindow`)

Formulas:

```text
baseline_eta = promedio(etas_referencia)
drop_pts = baseline_eta - eta_actual
```

Estados:

- `ok` si `drop_pts <= warn`
- `warn` si `warn < drop_pts <= crit`
- `crit` si `drop_pts > crit`

### D) Aptitud Benninger (regla compuesta)

Archivo: `shared/qualityMatrix.js` (`evaluateBenningerAptitude`)

Bloqueo:

```text
blocked = (tenacidad < bloqueo.tenacidad) AND (trabajo_b < bloqueo.trabajo_b)
```

Estado final:

- `crit` si bloqueo o algun subestado critico (`tenacidad`, `trabajo_b`, `eta`)
- `warn` si algun subestado warn
- `ok` caso contrario

### E) Desbalance LI/LP

Archivo: `shared/qualityMatrix.js` (`evaluateSideImbalance`)

Formulas:

```text
delta_abs = abs(thin30_LP - thin30_LI)
delta_pct = (delta_abs / min(thin30_LP, thin30_LI)) * 100
neps140_delta_pct = abs(neps140_LP - neps140_LI) / min(neps140_LP, neps140_LI) * 100
tenacidad_delta_abs = tenacidad_LP - tenacidad_LI
```

Estado principal se evalua con `delta_pct` contra umbral `thin_30_delta_pct`.

## 3.8 Reglas de semaforo operativo por lote

Archivo:

- `DashboardMezclaHilo.vue` (`semaforo`)

Reglas clave (ademas de la matriz):

- CVm critico dinamico:
  - `cvmWarn = matriz.cvm.warn` (fallback segun flame/no-flame)
  - `cvmCrit = cvmWarn + 0.8` (flame) o `+ 0.6` (liso)
- Neps:
  - `rojo` si `neps_200 > 700` (liso) o `> 850` (flame)
- MIC:
  - alerta si `MIC > 4.5` o `MIC < 3.8`
- STR sin datos de hilo:
  - rojo si `STR < 25`
  - amarillo si `25 <= STR < 27`

---

## 4) Mapa de transformaciones recomendadas para SQL y desarrollo

## 4.1 Llaves de join recomendadas

- `lote_canonico_int = CAST(NULLIF(regexp_replace(lote, '[^0-9]', '', 'g'), '') AS INTEGER)`
- `fecha_canonica = DATE` (en SQL) o `YYYY-MM-DD` (en frontend)

## 4.2 Pipeline sugerido

1. Normalizar lote a entero canonico.
2. Normalizar fecha a `date`/`YYYY-MM-DD`.
3. Ejecutar joins y comparaciones.
4. Solo al presentar, re-formatear:
   - lote secuencial: `LPAD(lote::text, 10, '0')`
   - fecha UI: `DD/MM/YYYY`.

---

## 5) Notas de consistencia

- En frontend conviven varios normalizadores de lote (`formatLote`/`normalizeLote`) con la misma idea general, pero distinta estrategia de fallback.
- En backend, para analytics y joins, domina la extraccion por regex + cast a integer.
- Para datos historicos con `LOTE_FIAC` secuencial, se usa `padStart(10, '0')` en endpoints puntuales.
- Para fechas, la estrategia robusta es: parseo tolerante de formatos mixtos y comparacion solo con claves canonicas.
