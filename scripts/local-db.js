import { mkdir, readFile, writeFile, access, unlink } from 'node:fs/promises';
import { openSync, closeSync, existsSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import mysql from 'mysql2/promise';

const root = fileURLToPath(new URL('../', import.meta.url));
const directory = path.join(root, '.local', 'mysql');
const statePath = path.join(directory, 'state.json');
const random = () => randomBytes(32).toString('hex');

async function state() {
  try {
    return JSON.parse(await readFile(statePath, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    const value = { port: 3307, adminPassword: random(), appPassword: random() };
    await mkdir(directory, { recursive: true });
    await writeFile(statePath, JSON.stringify(value, null, 2), { flag: 'wx', mode: 0o600 });
    return value;
  }
}

const connectionOptions = (saved) => ({
  host: '127.0.0.1',
  port: saved.port,
  user: 'root',
  password: saved.adminPassword,
  connectTimeout: 1500,
});

export async function startLocalDatabase() {
  if (process.env.NODE_ENV === 'production')
    throw new Error('O banco local não pode ser iniciado em produção.');
  const saved = await state();
  let existing;
  try {
    existing = await mysql.createConnection(connectionOptions(saved));
  } catch (error) {
    if (!['ECONNREFUSED', 'ETIMEDOUT'].includes(error.code))
      throw new Error(
        'A porta 3307 está ocupada por outro banco ou a configuração local mudou. Nenhum banco existente foi modificado.',
      );
  }
  if (existing) {
    await existing.end();
    return saved;
  }
  const windowsBinary = 'C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysqld.exe';
  const binary =
    process.env.MYSQLD_PATH ||
    (process.platform === 'win32' && existsSync(windowsBinary) ? windowsBinary : 'mysqld');
  const data = path.join(directory, 'data');
  await mkdir(data, { recursive: true });
  const marker = path.join(data, 'mysql');
  if (!existsSync(marker)) {
    console.log('Inicializando MySQL isolado em .local/mysql (pode levar alguns segundos)...');
    const init = spawnSync(
      binary,
      ['--no-defaults', '--initialize-insecure', `--datadir=${data}`],
      { windowsHide: true, encoding: 'utf8' },
    );
    if (init.status !== 0)
      throw new Error(
        'Não foi possível inicializar MySQL. Instale MySQL Server 8 ou defina MYSQLD_PATH; confira o log em .local/mysql/data.',
      );
  }
  const initFile = path.join(directory, 'init.sql');
  // Credenciais aleatórias hexadecimais internas; nenhum valor vem de entrada HTTP.
  await writeFile(
    initFile,
    `ALTER USER 'root'@'localhost' IDENTIFIED BY '${saved.adminPassword}';\n`,
    { mode: 0o600 },
  );
  const descriptor = openSync(path.join(directory, 'process.log'), 'a');
  const processHandle = spawn(
    binary,
    [
      '--no-defaults',
      `--datadir=${data}`,
      '--bind-address=127.0.0.1',
      `--port=${saved.port}`,
      '--mysqlx=OFF',
      `--init-file=${initFile}`,
      `--log-error=${path.join(directory, 'mysql.log')}`,
      `--pid-file=${path.join(directory, 'mysql.pid')}`,
      '--default-time-zone=+00:00',
    ],
    { detached: true, windowsHide: true, stdio: ['ignore', descriptor, descriptor] },
  );
  processHandle.on('error', () => {});
  processHandle.unref();
  closeSync(descriptor);
  let connection;
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      connection = await mysql.createConnection(connectionOptions(saved));
      break;
    } catch {
      await delay(500);
    }
  }
  if (!connection)
    throw new Error(
      'MySQL não iniciou. Confira .local/mysql/mysql.log e se a porta 3307 está disponível.',
    );
  try {
    await connection.execute(
      'CREATE DATABASE IF NOT EXISTS helpdesk CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci',
    );
    await connection.execute(
      'CREATE DATABASE IF NOT EXISTS helpdesk_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci',
    );
    // Comandos administrativos do MySQL não aceitam bind em todas as posições de DDL.
    // mysql.escape é aplicado ao segredo gerado; consultas da aplicação usam execute com bind.
    await connection.query(
      `CREATE USER IF NOT EXISTS 'helpdesk_app'@'127.0.0.1' IDENTIFIED BY ${mysql.escape(saved.appPassword)}`,
    );
    await connection.execute("GRANT ALL PRIVILEGES ON helpdesk.* TO 'helpdesk_app'@'127.0.0.1'");
    await connection.execute(
      "GRANT ALL PRIVILEGES ON helpdesk_test.* TO 'helpdesk_app'@'127.0.0.1'",
    );
  } finally {
    await connection.end();
    await unlink(initFile);
  }
  return saved;
}

async function stopLocalDatabase() {
  await access(statePath);
  const saved = JSON.parse(await readFile(statePath, 'utf8'));
  const connection = await mysql.createConnection(connectionOptions(saved));
  try {
    await connection.query('SHUTDOWN');
  } finally {
    await connection.end();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv[2] === 'stop') {
      await stopLocalDatabase();
      console.log('MySQL local do HelpDesk encerrado.');
    } else {
      await startLocalDatabase();
      console.log('MySQL isolado pronto em 127.0.0.1:3307.');
    }
  } catch (error) {
    console.error(error.code || error.message);
    process.exitCode = 1;
  }
}
