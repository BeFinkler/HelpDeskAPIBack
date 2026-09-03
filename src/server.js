import { readEnv } from './config/env.js';
import { createPool } from './config/database.js';
import { createApp } from './app.js';

let pool;
try {
  const config = readEnv();
  pool = createPool(config.db);
  await pool.execute('SELECT 1');
  const app = createApp({ pool, config });
  const server = app.listen(config.port, '0.0.0.0', () => {
    console.log(`HelpDesk API pronta na porta ${config.port}. Documentação: /api-docs`);
  });
  server.on('error', async (error) => {
    console.error(`Não foi possível iniciar o servidor: ${error.code || 'erro desconhecido'}.`);
    await pool.end();
    process.exitCode = 1;
  });
  let closing = false;
  const shutdown = () => {
    if (closing) return;
    closing = true;
    const deadline = setTimeout(() => process.exit(1), 10000).unref();
    server.close(async () => {
      await pool.end();
      clearTimeout(deadline);
      process.exit(0);
    });
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
} catch (error) {
  console.error(`Inicialização interrompida: ${error.code || error.message}`);
  await pool?.end();
  process.exitCode = 1;
}
