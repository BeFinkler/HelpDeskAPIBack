import bcrypt from 'bcryptjs';
import { readEnv } from '../src/config/env.js';
import { createPool } from '../src/config/database.js';
import { createUsuarioModel } from '../src/models/usuario-model.js';

let pool;
try {
  const config = readEnv();
  const nome = process.env.SETUP_TECHNICIAN_NAME?.trim();
  const email = process.env.SETUP_TECHNICIAN_EMAIL?.trim().toLowerCase();
  const senha = process.env.SETUP_TECHNICIAN_PASSWORD;
  if (
    !nome ||
    nome.length < 2 ||
    nome.length > 100 ||
    !email ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    email.length > 254 ||
    !senha ||
    [...senha].length < 8 ||
    Buffer.byteLength(senha) > 72
  ) {
    throw new Error(
      'Preencha SETUP_TECHNICIAN_NAME, SETUP_TECHNICIAN_EMAIL e SETUP_TECHNICIAN_PASSWORD com dados válidos.',
    );
  }
  pool = createPool(config.db);
  const users = createUsuarioModel(pool);
  if (await users.findByEmail(email))
    throw new Error('E-mail já cadastrado. Nenhuma conta ou senha foi alterada.');
  await users.create({
    nome,
    email,
    senha_hash: await bcrypt.hash(senha, config.bcryptRounds),
    perfil: 'tecnico',
  });
  console.log('Conta de técnico criada. Remova a senha de configuração do ambiente após o uso.');
} catch (error) {
  console.error(`Não foi possível criar o técnico: ${error.code || error.message}`);
  process.exitCode = 1;
} finally {
  await pool?.end();
}
