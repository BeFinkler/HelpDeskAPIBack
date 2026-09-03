import { mkdir, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { testConfig } from '../tests/helpers/test-config.js';
import { createPool } from '../src/config/database.js';
import { createUsuarioModel } from '../src/models/usuario-model.js';
import { migrate } from './migrate.js';

let pool;
try {
  const config = testConfig();
  pool = createPool(config.db);
  await migrate(pool);
  const users = createUsuarioModel(pool);
  const senha = randomBytes(18).toString('base64url');
  const email = `tecnico-e2e-${Date.now()}@example.com`;
  await users.create({
    nome: 'Técnico de homologação',
    email,
    perfil: 'tecnico',
    senha_hash: await bcrypt.hash(senha, 10),
  });
  const env = [
    'NODE_ENV=test',
    'PORT=3001',
    'FRONTEND_URL=http://localhost:5174',
    'API_PUBLIC_URL=http://localhost:3001',
    ...['host', 'port', 'user', 'password'].map(
      (key) => `DB_${key.toUpperCase()}=${config.db[key]}`,
    ),
    `DB_NAME=${config.db.database}`,
    `DB_SSL=${Boolean(config.db.ssl)}`,
    `DB_SSL_CA_BASE64=${process.env.DB_SSL_CA_BASE64 || ''}`,
    `JWT_SECRET=${config.jwt.secret}`,
    `JWT_ISSUER=${config.jwt.issuer}`,
    `JWT_AUDIENCE=${config.jwt.audience}`,
    'JWT_EXPIRES_IN=1h',
    'BCRYPT_ROUNDS=10',
    'TRUST_PROXY=0',
  ].join('\n');
  await mkdir(new URL('../.local/', import.meta.url), { recursive: true });
  await writeFile(new URL('../.local/e2e-api.env', import.meta.url), env, { mode: 0o600 });
  await writeFile(
    new URL('../.local/e2e-user.json', import.meta.url),
    JSON.stringify({ email, senha }),
    { mode: 0o600 },
  );
  console.log(
    'Banco e técnico de teste preparados. Configuração em .local/e2e-api.env e .local/e2e-user.json.',
  );
} catch (error) {
  console.error(error.code || error.message);
  process.exitCode = 1;
} finally {
  await pool?.end();
}
