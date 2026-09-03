import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createPool } from '../src/config/database.js';
import { readEnv } from '../src/config/env.js';

export async function migrate(pool) {
  const connection = await pool.getConnection();
  let locked = false;
  try {
    const [[result]] = await connection.execute(
      "SELECT GET_LOCK(CONCAT(DATABASE(), ':migrations'), 20) AS acquired",
    );
    if (result.acquired !== 1) throw new Error('Outra migração está em execução. Tente novamente.');
    locked = true;
    await connection.execute(`CREATE TABLE IF NOT EXISTS schema_migrations (
      nome VARCHAR(255) NOT NULL PRIMARY KEY, checksum CHAR(64) NOT NULL,
      aplicada_em DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
    ) ENGINE=InnoDB`);
    const directory = new URL('../database/migrations/', import.meta.url);
    const files = (await readdir(directory)).filter((name) => /^\d+_.+\.sql$/.test(name)).sort();
    for (const name of files) {
      const sql = await readFile(new URL(name, directory), 'utf8');
      const checksum = createHash('sha256').update(sql.replaceAll('\r\n', '\n')).digest('hex');
      const [[applied]] = await connection.execute(
        'SELECT checksum FROM schema_migrations WHERE nome = ?',
        [name],
      );
      if (applied) {
        if (applied.checksum !== checksum)
          throw new Error(`Migração ${name} já aplicada foi modificada. Crie uma nova migração.`);
        continue;
      }
      // Arquivos internos com DDL simples. O driver permanece com multipleStatements=false.
      for (const statement of sql
        .split(';')
        .map((part) => part.trim())
        .filter(Boolean)) {
        await connection.execute(statement);
      }
      await connection.execute('INSERT INTO schema_migrations (nome, checksum) VALUES (?, ?)', [
        name,
        checksum,
      ]);
      console.log(`Migração aplicada: ${name}`);
    }
  } finally {
    if (locked) await connection.execute("SELECT RELEASE_LOCK(CONCAT(DATABASE(), ':migrations'))");
    connection.release();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let pool;
  try {
    pool = createPool(readEnv().db);
    await migrate(pool);
    console.log('Banco atualizado.');
  } catch (error) {
    console.error(`Migração não concluída: ${error.code || error.message}`);
    process.exitCode = 1;
  } finally {
    await pool?.end();
  }
}
