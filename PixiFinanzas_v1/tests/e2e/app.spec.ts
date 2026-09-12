import { test, expect } from '@playwright/test';

async function login(page: any) {
  await page.goto('/login');
  await page.getByLabel('Usuario').fill('lgiancare');
  await page.getByLabel('Clave').fill('Li$aClo91');
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await page.waitForURL('http://localhost:8788/');
}

test('redirects unauthenticated users to /login', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);
});

test('rejects a wrong password with a visible error', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Usuario').fill('lgiancare');
  await page.getByLabel('Clave').fill('wrong');
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page.getByText('Usuario o clave incorrectos.')).toBeVisible();
});

test('logs in and shows the Home dashboard with vencimientos, gauge and charts', async ({ page }) => {
  await login(page);
  await expect(page).toHaveURL('http://localhost:8788/');
  await expect(page.getByText('Próximos vencimientos')).toBeVisible();
  await expect(page.getByText('Salud financiera')).toBeVisible();
  await expect(page.getByText('Visa Macro')).toBeVisible();
  await expect(page.locator('canvas, svg').first()).toBeVisible();
});

test('navigates to Costos Fijos y Variables and shows all three charts', async ({ page }) => {
  await login(page);
  await page.getByRole('link', { name: /Costos Fijos y Variables/i }).click();
  await expect(page).toHaveURL(/\/costos$/);
  await expect(page.getByText('Detalle de costos fijos', { exact: false })).toBeVisible();
  await expect(page.getByText('Participación de costos fijos', { exact: false })).toBeVisible();
  await expect(page.getByText('Detalle de costos variables', { exact: false })).toBeVisible();
});

test('registers a variable expense and previews the impacted record', async ({ page }) => {
  await login(page);
  await page.getByRole('link', { name: /Alta de Gastos/i }).click();
  await expect(page).toHaveURL(/\/altas$/);
  await expect(page.getByLabel('MES_ABONO')).not.toHaveValue('');
  await page.getByLabel('Detalle').fill('Compra e2e');
  await page.getByLabel('Importe (ARS)').fill('12345.67');
  await page.getByLabel('Cotización dólar').fill('1500');
  await expect(page.getByText('Registros que se van a impactar')).toBeVisible();
  await page.getByRole('button', { name: 'Guardar gasto' }).click();
  await expect(page.getByText('Gasto guardado')).toBeVisible();
});

test('switches to gasto fijo (lote) tab and shows the preloaded batch table', async ({ page }) => {
  await login(page);
  await page.getByRole('link', { name: /Alta de Gastos/i }).click();
  await page.getByRole('button', { name: 'Gasto fijo (lote)' }).click();
  await expect(page.getByText('MES_ABONO del lote')).toBeVisible();
  await expect(page.getByRole('button', { name: /Confirmar lote/ })).toBeVisible();
});

test('runs a consulta retroactiva search and sees results', async ({ page }) => {
  await login(page);
  await page.getByRole('link', { name: /Consultas Retroactivas/i }).click();
  await expect(page).toHaveURL(/\/consultas$/);
  await page.getByRole('button', { name: 'Buscar' }).click();
  await expect(page.locator('table').first()).toBeVisible();
});

test('Configuraciones lists a maestro catalog', async ({ page }) => {
  await login(page);
  await page.getByRole('link', { name: /Configuraciones/i }).click();
  await expect(page).toHaveURL(/\/configuraciones$/);
  await expect(page.getByText('Vacaciones')).toBeVisible();
});

test('Inversiones shows the "próximamente" stub', async ({ page }) => {
  await login(page);
  await page.getByRole('link', { name: /Inversiones/i }).click();
  await expect(page.getByText('Módulo Inversiones')).toBeVisible();
  await expect(page.getByText('documentado como pendiente', { exact: false })).toBeVisible();
});

test('logs out via the sidebar with confirmation and returns to /login', async ({ page }) => {
  await login(page);
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).last().click();
  await expect(page).toHaveURL(/\/login$/);
});
