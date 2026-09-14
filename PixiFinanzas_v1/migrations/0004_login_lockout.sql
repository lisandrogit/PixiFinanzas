-- Contador de intentos fallidos de login y bloqueo temporal, para mitigar
-- fuerza bruta contra /api/auth/login (no había ningún freno antes de esto).
ALTER TABLE USUARIOS ADD COLUMN INTENTOS_FALLIDOS INTEGER NOT NULL DEFAULT 0;
ALTER TABLE USUARIOS ADD COLUMN BLOQUEADO_HASTA TEXT;
