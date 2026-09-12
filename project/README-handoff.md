# PixiFinanzas — Handoff de diseño a implementación

Puente entre lo definido en la sesión de diseño (`PixiFinanzas.dc.html`) y la implementación en Claude Code Web. Todo lo que está acá ya está decidido: no re-derivar.

Fuentes: `uploads/Especificaciones_Funcionales.md` (funcional, manda), `uploads/Gastos_modelo_v3.md` (modelo de datos), `uploads/Logo_App.png`, `uploads/Logo_Home.png`.

---

## 1. Stack elegido

| Capa | Tecnología | Versión | Motivo |
|---|---|---|---|
| Frontend/PWA | React + Vite | React 19 / Vite 6 | Compatible con el output típico de Claude Code Web; build rápido y HMR sin config extra |
| PWA layer | vite-plugin-pwa (Workbox) | 0.21.x | Manifest + service worker con una línea de config; instalación mobile/desktop |
| Estilos | Tailwind CSS | 4.x | Utility-first, sin overhead de diseñar un sistema propio para una app personal |
| Gráficos | ECharts (echarts-for-react) | ECharts 5.x | Única librería liviana con gauge nativo (velocímetro) + combo line/bar; Recharts no cubre gauge sin hacks |
| Excel | SheetJS (xlsx) client-side | 0.20.x (CE) | Export/import .xlsx en el browser; el Worker solo valida JSON ya parseado |
| Backend/API | Cloudflare Workers + Hono | Hono 4.x | Framework minimalista para el runtime de Workers, routing typado |
| Validación | Zod | 3.x | Valida importaciones retroactivas y formularios antes de tocar D1 |
| Persistencia | Cloudflare D1 (SQLite) | servicio gestionado | El modelo es relacional con múltiples FKs; SQL nativo de Cloudflare |
| Auth | Hono + Web Crypto (PBKDF2/scrypt) + JWT en cookie httpOnly | — | Login usuario/clave, roles, habilitado SI/NO y timeout de 1h son lógica de aplicación |
| Restricción extra (prototipo) | Cloudflare Access | Zero Trust free (50 usuarios) | Restringe la app a emails autorizados a nivel de edge mientras se pule el auth interno |
| Hosting/Deploy | Cloudflare Pages (Functions) | — | Un solo deploy para el build de Vite + el Worker de Hono |
| Dev tools | GitHub + Wrangler CLI | Wrangler 4.x | Versionado + deploy manual, sin CI/CD propio |

**Deploy GitHub → Cloudflare.** Pages tiene integración nativa con GitHub: conectado el repo, cada `git push` a la rama configurada dispara build y deploy, sin GitHub Actions. Para deploy on-demand, `wrangler pages deploy` desde el clon local. Ambos caminos son nativos, sin configuración adicional.

**Ingesta inicial.** Las tablas markdown de `Gastos_modelo_v3.md` se parsean a `INSERT` (Node/TS con un CSV/JSON intermedio) y se cargan con `wrangler d1 execute --file=seed.sql --remote`: catálogos `CAT_*` + las ~840 filas de `GASTOS_TARJETA` / `GASTOS_TRANSFERENCIA` en una corrida. Es un one-off, no hace falta ETL.

---

## 2. Esquema de datos

Catálogos (todos con `ETIQUETA`, `ACTIVO`, `ORDEN`):

- `CAT_CATEGORIA` (`ID_CATEGORIA` 1-11) — Vacaciones, Indumentaria, Educacion, Suscripciones, Boludeces, Salud y Estilo, Ajenos, Otros, Hogar, Operacion, Gastos Extraordinarios
- `CAT_TARJETA` (1-4) — Visa Macro, Master Uala, Master MercadoPago, AMEX
- `CAT_CUENTA` (1-3) — Cta Cte Banco Macro, Mercado Pago, Uala
- `CAT_TIPO_GASTO` (1 COSTO FIJO, 2 COSTO VARIABLE)
- `CAT_CANAL` (1 Tarjeta, 2 Transferencia)
- `CAT_MES` — `ID_MES` = AAAAMM (202401…), `ETIQUETA`, `ANO`, `MES_NUM`
- `CAT_COTIZACION_DOLAR` / `CAT_COTIZACION_USD` — valor, fecha de carga, período
- `CAT_INGRESOS` — ingresos por `MES_ABONO`

Transaccionales: `GASTOS_TARJETA` (FK `ID_CATEGORIA`, `ID_TARJETA`, `ID_MES`) y `GASTOS_TRANSFERENCIA` (FK `ID_CATEGORIA`, `ID_CUENTA`, `ID_MES`). Columnas clave: `ID_GASTO` (autogenerado), `FECHA_CARGA`, `IMPORTE` (ARS, decimal), `IMPORTE_USD`, `MES_ABONO`, `TIPO_GASTO`.

Vistas desnormalizadas `VISTA_GASTOS_TARJETA` y `VISTA_GASTOS_TRANSFERENCIA`: resuelven las FK a etiquetas. Todos los reportes leen de las vistas, nunca de las tablas base.

Pendientes explícitos del modelo:

- Agregar `ID_TIPO_GASTO` a `GASTOS_TARJETA` (indicado en la especificación, sección 6.1).
- Cuotas: un registro por cuota en `GASTOS_TARJETA`, con el importe de la cuota y `MES_ABONO` correlativo desde el período de la primera. Conviene un `ID_COMPRA` para agrupar las cuotas de una misma compra (no está en el modelo original; decidir antes del seed).
- `CAT_COTIZACION_DOLAR` y `CAT_COTIZACION_USD` se usan como sinónimos en la especificación. Unificar a un nombre único.

---

## 3. Rutas de API sugeridas

```
POST   /api/auth/login                 { usuario, clave } → cookie httpOnly + rol
POST   /api/auth/logout
GET    /api/auth/me                    sesión vigente, rol, timeout restante

GET    /api/home/vencimientos          próximos 3 períodos, desglose por tarjeta + transferencia (ARS)
GET    /api/home/salud                 promedio 3 cerrados vs 3 próximos → variación %
GET    /api/home/resumen-canal         ?moneda=ARS|USD&categorias=1,2,…  (9 meses cerrados)
GET    /api/home/resumen-tipo          ?moneda=ARS|USD&categorias=1,2,…  (9 meses cerrados)
GET    /api/export/resumen             ?periodo=202608&canal=tarjeta|transferencia|ambos → payload .xlsx (ARS)

GET    /api/costos/fijos               ?moneda= (9 meses)
GET    /api/costos/participacion       fijos sobre CAT_INGRESOS (12 meses)
GET    /api/costos/variables           ?moneda= top 5 categorías (9 meses)

GET    /api/consultas                  ?desde=&hasta=&canal=&tipo=&categorias=
POST   /api/consultas/importar         valida (Zod) → 200 o 422 con detalle de errores
GET    /api/consultas/historial        fecha, usuario, motivo, registros, estado

GET    /api/maestros/:tabla
POST   /api/maestros/:tabla
PUT    /api/maestros/:tabla/:id
DELETE /api/maestros/:tabla/:id

POST   /api/gastos/variable            1 gasto, o N registros si viene en cuotas
POST   /api/gastos/fijo/preload        ?mes= costos fijos del último período cerrado
POST   /api/gastos/fijo/lote           alta masiva para el MES_ABONO indicado
GET    /api/cotizacion/oficial         proxy de https://dolarapi.com/v1/dolares/oficial
POST   /api/cotizacion                 valor ingresado por el usuario → CAT_COTIZACION_USD

GET/POST /api/usuarios                 personas + usuarios, habilitado SI/NO, rol
```

Reglas transversales: toda ruta valida rol (`Rolemaster` escribe; `Consulta` solo `GET` de home y reportes), el importe se recibe siempre en ARS y `IMPORTE_USD` lo calcula el backend con la cotización del período.

---

## 4. Componentes de UI definidos en el diseño

Shell: sidebar izquierdo de 246px con el logo arriba y el usuario/logout abajo; header con kicker + saludo dinámico + fecha, botón `ACTUALIZAR` y engranaje a su derecha; contenido con padding 28/32.

Nombres de componentes tal como quedaron:

- `AppShell` / `SidebarNav` / `TopBar`
- `VencimientosTable` — filas: total tarjeta, una por tarjeta (indentada), total transferencia, total período (con regla superior 2px)
- `SaludGauge` — semicírculo de 5 segmentos, aguja, variación % grande + nota
- `ExportPanel` — período con texto predictivo (`datalist`), canal (`select`), botón de export
- `ChartCard` — `figure` con borde 2px, caption en mayúsculas 11px, SVG/ECharts y leyenda abajo
- `CurrencyToggle` (segmented ARS/USD) y `CategoryChips` (todas activas por default)
- `AltaVariableForm` + `CuotasBlock` + `PreviewRegistros` (muestra los N registros a impactar antes de guardar)
- `AltaFijoBatch` — tabla editable con `MES_ABONO` del lote arriba, agregar/eliminar filas, total y confirmación en dialog
- `DolarBanner` — banner con borde y fondo accent-100, valor de venta, fecha y botón de actualización
- `ConfirmDialog` y `Toast` (feedback de acciones)

Orden del menú: Home · Indicadores → Costos fijos y variables → Consultas retroactivas → Alta de gastos → Configuraciones → Inversiones (PRÓXIMAMENTE).

---

## 5. Estilo visual a respetar

Sistema Modernist con el acento movido al azul del logo. Sin radios (todo 0px), reglas de 2px, todo alineado a la izquierda, tipografía Archivo (800 para títulos y labels de botón).

```
--color-bg      #f3f2f2      --color-text      #201e1d
--color-surface #eae9e9      --color-divider   ink 40%
--color-accent  #1565d8      accent-100 #eef4fe   accent-200 #d6e4fb
                             accent-600 #0f4fac   accent-700 #0b3a8c
serie secundaria (teal)  #0f8f86
serie total              #201e1d (línea punteada en el combo)
```

Velocímetro, de izquierda (baja) a derecha (sube): `#16794f`, `#5fae73`, `#e0b02c` (centro, sin variación), `#e07a3c`, `#c9372a`. Escala −30% a +30%; la aguja se posiciona con la variación entre el promedio de los 3 períodos cerrados y el de los 3 próximos.

Foco de teclado: `outline: 2px solid var(--color-accent); outline-offset: 2px`. Estado activo de nav: borde izquierdo 4px accent + fondo accent-100 + texto accent-700.

Pendientes visuales para Code Web:

- Reemplazar los SVG del prototipo por ECharts manteniendo estos colores, el grid de 5 líneas y las etiquetas de eje en 10px.
- Integrar `Logo_App.png` en el sidebar y el PWA manifest, y `Logo_Home.png` como portada del home (todavía sin ubicación definida en el layout).
- Definir el layout mobile: el prototipo está resuelto solo para desktop.

---

## 6. Alcance del prototipo

Implementado y navegable: Home · Indicadores, Costos fijos y variables, Alta de gasto variable (incluye cuotas), Alta de gasto fijo (lote).

Especificado pero no prototipado: login, usuarios/roles/permisos, consultas y actualizaciones retroactivas (con validación e historial), configuraciones de maestros, módulo Inversiones. La especificación funcional es la fuente para esas pantallas.

Los datos del prototipo son representativos, no reales.

---

## 7. Bindings y variables de entorno

```toml
# wrangler.toml
name = "pixifinanzas"
compatibility_date = "2026-09-01"
pages_build_output_dir = "dist"

[[d1_databases]]
binding = "DB"
database_name = "pixifinanzas"
database_id = "<id>"
```

Secrets (`wrangler pages secret put`): `JWT_SECRET`, `PASSWORD_PEPPER`.
Variables: `SESSION_TIMEOUT_MIN=60`, `DOLAR_API_URL=https://dolarapi.com/v1/dolares/oficial`.
KV: no requerido; si se quiere cachear la cotización del día, `KV_COTIZACION` con TTL de 1h.

Usuario inicial del seed: Lisandro Giancarelli, DNI 36444773, usuario `lgiancare`, clave `Li$aClo91` (hashear en el seed, nunca en texto plano), rol Rolemaster, `HABILITADO = SI`.
