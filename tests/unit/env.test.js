import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readEnv } from '../../src/config/env.js';

const local = {
  NODE_ENV: 'test',
  FRONTEND_URL: 'http://localhost:5173',
  API_PUBLIC_URL: 'http://localhost:3000',
  DB_HOST: '127.0.0.1',
  DB_NAME: 'helpdesk_test',
  DB_USER: 'test_user',
  DB_PASSWORD: randomBytes(16).toString('hex'),
  JWT_SECRET: randomBytes(48).toString('hex'),
  JWT_ISSUER: 'helpdesk-api',
  JWT_AUDIENCE: 'helpdesk-web',
};
test('ambiente exige segredo forte e não aceita origens com caminho ou barra final', () => {
  assert.throws(() => readEnv({ ...local, JWT_SECRET: '' }), /JWT_SECRET/);
  assert.throws(() => readEnv({ ...local, JWT_SECRET: 'curto' }), /32 bytes/);
  assert.throws(
    () => readEnv({ ...local, FRONTEND_URL: 'http://localhost:5173/' }),
    /origem exata/,
  );
  assert.throws(
    () => readEnv({ ...local, FRONTEND_URL: 'http://localhost:5173/login' }),
    /origem exata/,
  );
});
test('produção exige TLS verificado no banco e HTTPS nas origens', () => {
  assert.throws(() => readEnv({ ...local, NODE_ENV: 'production' }), /DB_SSL=true/);
  assert.throws(
    () =>
      readEnv({
        ...local,
        DB_SSL: 'true',
        DB_SSL_CA_BASE64: Buffer.from('não é um certificado').toString('base64'),
      }),
    /Certificado/,
  );
});
test('configuração local aplica limites de pool, hash, porta e expiração', () => {
  const config = readEnv(local);
  assert.equal(config.port, 3000);
  assert.equal(config.db.connectionLimit, 5);
  assert.equal(config.bcryptRounds, 12);
  assert.equal(config.jwt.expiresIn, 3600);
  assert.throws(() => readEnv({ ...local, JWT_EXPIRES_IN: '25h' }), /24 horas/);
  assert.throws(() => readEnv({ ...local, BCRYPT_ROUNDS: '4' }), /BCRYPT_ROUNDS/);
  assert.throws(() => readEnv({ ...local, PORT: 'abc' }), /PORT/);
});
