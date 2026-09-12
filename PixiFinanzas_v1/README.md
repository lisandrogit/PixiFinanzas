# PixiFinanzas v1

Implementación de PixiFinanzas a partir del handoff de diseño (`../README-handoff.md`,
`../chats/chat1.md` y `../project/PixiFinanzas.dc.html`). Gestión personal de finanzas —
módulo Gastos completo, módulo Inversiones como stub "Próximamente".

## Stack

React 19 + Vite + Tailwind + ECharts (frontend) · Cloudflare Pages Functions + Hono (API)
· Cloudflare D1/SQLite (datos) · JWT en cookie httpOnly + PBKDF2 (auth) · SheetJS (export/import
.xlsx en el browser) — tal como quedó definido en `README-handoff.md` §1.

## Estructura

```
src/            Frontend (React + Tailwind + ECharts)
functions/api/  Cloudflare Pages Functions — entrypoint Hono
functions/_lib/ App Hono, queries SQL, auth (PBKDF2 + JWT), tipos
migrations/     Esquema D1 + seed (catálogos, ~840 gastos históricos, usuario inicial)
scripts/        build-seed.mjs — parsea uploads/Gastos_modelo_v3.md a SQL
tests/unit/     Vitest — API completa contra D1 en memoria (node:sqlite)
tests/e2e/      Playwright — flujo de usuario end-to-end contra wrangler pages dev
```

## Correr en desarrollo

```bash
npm install
node scripts/build-seed.mjs                              # regenera migrations/000{2,3}_*.sql si cambian los uploads
npx wrangler d1 migrations apply pixifinanzas --local     # aplica esquema + seed a D1 local
cp .dev.vars.example .dev.vars                            # JWT_SECRET, PASSWORD_PEPPER locales
npm run build && npm run pages:dev                        # sirve frontend + API en http://localhost:8788
```

Para desarrollo con hot-reload del frontend solamente: `npm run dev` (proxea `/api` a
`http://127.0.0.1:8788`, así que corré `pages:dev` en paralelo si necesitás la API).

Usuario inicial (Especificaciones_Funcionales.md §"Identidad del primer usuario"):
`lgiancare` / `Li$aClo91` — rol Rolemaster.

## Tests

```bash
npm test        # Vitest — 28 casos: auth, roles, home, costos, altas (incl. cuotas),
                 # consultas retroactivas + validación + historial, maestros CRUD, usuarios, cotización
npm run e2e      # Playwright — flujo real de browser contra wrangler pages dev (requiere D1 local migrado)
npx tsc --noEmit # type-check de src/ + functions/
```

Todo lo anterior corrió en limpio antes de este commit (28/28 unit + 10/10 e2e + build + typecheck).

## Deploy a Cloudflare

Este entorno solo tiene acceso a GitHub, no a una cuenta de Cloudflare — el deploy de este
commit fue únicamente a GitHub. Para conectar Cloudflare Pages (según `README-handoff.md`):

1. `wrangler login`, `wrangler d1 create pixifinanzas`, pegar el `database_id` real en
   `wrangler.toml` (hoy tiene un placeholder).
2. `wrangler d1 migrations apply pixifinanzas --remote`.
3. `wrangler pages secret put JWT_SECRET` y `wrangler pages secret put PASSWORD_PEPPER`.
4. Conectar el repo de GitHub en el dashboard de Cloudflare Pages (build command `npm run
   build`, output `dist`) — cada `git push` a la rama configurada dispara build + deploy
   automático, sin GitHub Actions (según quedó validado en `chats/chat1.md`).

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
