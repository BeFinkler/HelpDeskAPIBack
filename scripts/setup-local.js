import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { startLocalDatabase } from './local-db.js';

const root = fileURLToPath(new URL('../', import.meta.url));
try {
  const saved = await startLocalDatabase();
  const envPath = path.join(root, '.env');
  let existing = false;
  try {
    await readFile(envPath);
    existing = true;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  if (existing) {
    console.log(
      '.env já existe e foi preservado. Execute db:migrate e setup:technician quando necessário.',
    );
  } else {
    const password = randomBytes(15).toString('base64url');
    const template = await readFile(path.join(root, '.env.example'), 'utf8');
    const values = {
      DB_PASSWORD: saved.appPassword,
      JWT_SECRET: randomBytes(48).toString('base64url'),
      SETUP_TECHNICIAN_NAME: 'Técnico local',
      SETUP_TECHNICIAN_EMAIL: 'tecnico@helpdesk.local',
      SETUP_TECHNICIAN_PASSWORD: password,
    };
    const env = template.replace(/^(\w+)=(.*)$/gm, (line, key) =>
      key in values ? `${key}=${values[key]}` : line,
    );
    await writeFile(envPath, env, { flag: 'wx', mode: 0o600 });
    for (const script of ['migrate.js', 'setup-technician.js']) {
      const result = spawnSync(process.execPath, [path.join(root, 'scripts', script)], {
        cwd: root,
        stdio: 'inherit',
        windowsHide: true,
      });
      if (result.status !== 0)
        throw new Error(`A configuração parou em ${script}. Consulte a mensagem acima.`);
    }
    await mkdir(path.join(root, '.local'), { recursive: true });
    await writeFile(
      path.join(root, '.local', 'ACESSO_LOCAL.txt'),
      `Conta técnica de desenvolvimento\nE-mail: tecnico@helpdesk.local\nSenha: ${password}\n\nCrie a conta de cliente na tela de cadastro. Não publique este arquivo.\n`,
      { mode: 0o600 },
    );
    console.log(
      'Ambiente local configurado. Credenciais do técnico em .local/ACESSO_LOCAL.txt (ignorado pelo Git).',
    );
  }
} catch (error) {
  console.error(`Configuração não concluída: ${error.code || error.message}`);
  process.exitCode = 1;
}
