# PixiFinanzas v1

Implementación de PixiFinanzas a partir del handoff de diseño (`../README-handoff.md`,
`../chats/chat1.md` y `../project/PixiFinanzas.dc.html`). Gestión personal de finanzas —
módulo Gastos completo, módulo Inversiones como stub "Próximamente".

## Stack

React 19 + Vite + Tailwind + ECharts (frontend) · Cloudflare Workers + Hono (API) · Cloudflare
Workers Static Assets (sirve `dist/`, con fallback SPA) · Cloudflare D1/SQLite (datos) · JWT en
cookie httpOnly + PBKDF2 (auth) · SheetJS (export/import .xlsx en el browser) — según
`README-handoff.md` §1, adaptado de "Cloudflare Pages" a Workers Builds (ver nota más abajo).

## Estructura

```
src/            Frontend (React + Tailwind + ECharts)
worker/index.ts Entrypoint del Worker (main de wrangler.toml) — reexporta la app Hono
functions/_lib/ App Hono, queries SQL, auth (PBKDF2 + JWT), tipos
migrations/     Esquema D1 + seed (catálogos, ~840 gastos históricos, usuario inicial)
scripts/        build-seed.mjs — parsea uploads/Gastos_modelo_v3.md a SQL
tests/unit/     Vitest — API completa contra D1 en memoria (node:sqlite)
tests/e2e/      Playwright — flujo de usuario end-to-end contra wrangler dev
```

## Correr en desarrollo

```bash
npm install
node scripts/build-seed.mjs                              # regenera migrations/000{2,3}_*.sql si cambian los uploads
npx wrangler d1 migrations apply pixifinanzas --local     # aplica esquema + seed a D1 local
cp .dev.vars.example .dev.vars                            # JWT_SECRET, PASSWORD_PEPPER locales
npm run worker:dev                                        # build + sirve frontend/assets + API en http://localhost:8788
```

Para desarrollo con hot-reload del frontend solamente: `npm run dev` (proxea `/api` a
`http://127.0.0.1:8788`, así que corré `worker:dev` en paralelo si necesitás la API).

Usuario inicial (Especificaciones_Funcionales.md §"Identidad del primer usuario"):
`lgiancare` / `Li$aClo91` — rol Rolemaster.

## Tests

```bash
npm test        # Vitest — 29 casos: auth, roles, home, costos, altas (incl. cuotas),
                 # consultas retroactivas + validación + historial, maestros CRUD, usuarios, cotización
npm run e2e      # Playwright — flujo real de browser contra wrangler dev (requiere D1 local migrado)
npx tsc --noEmit # type-check de src/, functions/ y worker/
```

Todo lo anterior corrió en limpio antes de este commit (29/29 unit + 10/10 e2e + build + typecheck).

## Deploy a Cloudflare

**Nota sobre la arquitectura**: el handoff original asumía Cloudflare Pages (routing por
`functions/api/[[route]].ts`). El proyecto que se creó en el dashboard es en realidad un
**Worker moderno con "Workers Builds"** (deploy command `npx wrangler deploy`, no Pages) — un
`wrangler.toml` pensado para Pages no sirve ahí, así que se adaptó a la convención de Workers:
`main = "worker/index.ts"` + `[assets]` (Workers Static Assets, sirviendo `dist/` con
`not_found_handling = "single-page-application"` para el ruteo del SPA) en vez de
`pages_build_output_dir`. Verificado en local con `wrangler dev` (assets, fallback SPA y API
los tres funcionando) antes de este commit.

Ya hecho vía la integración de Cloudflare + GitHub de esta sesión:

- ✅ D1 `pixifinanzas` creada y con el `database_id` real en `wrangler.toml`.
- ✅ Esquema + seed completo aplicado en la base remota (catálogos, ~840 gastos históricos,
  usuario inicial), incluida la corrección de `FECHA_CARGA`.
- ✅ Secrets `JWT_SECRET` y `PASSWORD_PEPPER` configurados en el proyecto (confirmado por vos).
- ✅ `wrangler.toml` corregido al modelo Worker real y pusheado — el próximo build debería
  levantar `main` + `[assets]` + el binding `DB` automáticamente, sin pasos manuales de binding.

Pendiente de tu lado: disparar un nuevo build (push, o "Retry build" sobre el último commit) y
probar `https://pixifinanzas.<tu-subdominio>.workers.dev` con `lgiancare` / `Li$aClo91`. Si el
build vuelve a fallar, pegame el log — esta sesión no tiene acceso al dashboard de builds.

## Decisiones sobre pendientes del modelo (`README-handoff.md` §2)

- `ID_TIPO_GASTO` en `GASTOS_TARJETA`: ya viene en `Gastos_modelo_v3.md`, no fue necesario agregarlo.
- Agrupador de cuotas: se agregó `ID_COMPRA` (UUID) en `GASTOS_TARJETA`.
- Nombre de cotización: unificado a `CAT_COTIZACION_USD`.
- El seed original trae ~64 filas de `GASTOS_TRANSFERENCIA` con `ID_CATEGORIA`/`ID_CUENTA`
  en `NaN` (datos representativos, no reales); `scripts/build-seed.mjs` las resuelve a una
  categoría razonable por `DETALLE` (ej. "Spotify" → Suscripciones) en vez de romper el insert.

## Limitación conocida

El dataset histórico no incluye gastos con `MES_ABONO` futuro (tiene sentido: son gastos ya
cargados, no proyecciones). Por eso "Próximos vencimientos" y el gauge de "Salud financiera"
en Home muestran $0 / -100% hasta que se cargan gastos reales para esos períodos desde "Alta
de Gastos" — el cálculo es correcto, simplemente no hay datos futuros sembrados.
