import { readEnv } from '../../src/config/env.js';

export function testConfig() {
  const database = process.env.TEST_DB_NAME;
  if (!database || !/^[a-zA-Z0-9_]+_test$/.test(database) || database === process.env.DB_NAME) {
    throw new Error(
      'Configure TEST_DB_NAME com sufixo _test, diferente de DB_NAME. Testes nunca usam o banco principal.',
    );
  }
  return readEnv({ ...process.env, NODE_ENV: 'test', DB_NAME: database, BCRYPT_ROUNDS: '10' });
}
