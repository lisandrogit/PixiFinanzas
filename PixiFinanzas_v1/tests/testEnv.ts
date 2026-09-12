import { freshDb } from './d1-shim';
import type { Env } from '../functions/_lib/types';

export function makeEnv(): Env {
  return {
    DB: freshDb() as unknown as Env['DB'],
    JWT_SECRET: 'test-secret-not-for-prod',
    PASSWORD_PEPPER: '',
    SESSION_TIMEOUT_MIN: '60',
    DOLAR_API_URL: 'https://dolarapi.com/v1/dolares/oficial',
  };
}

export function extractCookie(res: Response): string {
  const setCookie = res.headers.get('set-cookie') || '';
  return setCookie.split(';')[0];
}

export async function login(app: any, env: Env, usuario = 'lgiancare', clave = 'Li$aClo91') {
  const res = await app.fetch(
    new Request('http://test/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ usuario, clave }),
    }),
    env
  );
  return { res, cookie: extractCookie(res) };
}
