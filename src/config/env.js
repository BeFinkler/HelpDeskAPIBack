import dotenv from 'dotenv';

dotenv.config({ quiet: true });

function integer(env, key, fallback, min, max) {
  const raw = env[key] ?? String(fallback);
  const value = Number(raw);
  if (!/^\d+$/.test(raw) || !Number.isInteger(value) || value < min || value > max) {
    throw new Error(`Configuração inválida: ${key}.`);
  }
  return value;
}

function required(env, key) {
  if (!env[key]?.trim()) throw new Error(`Variável obrigatória não configurada: ${key}.`);
  return env[key];
}

function origin(env, key, production) {
  const value = required(env, key);
  let url;
  try { url = new URL(value); } catch { throw new Error(`URL inválida: ${key}.`); }
  if (!['http:', 'https:'].includes(url.protocol) || url.origin !== value || url.username || url.password) {
    throw new Error(`${key} deve ser uma origem exata, sem caminho ou barra final.`);
  }
  if (production && (url.protocol !== 'https:' || ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) {
    throw new Error(`${key} deve usar um domínio público HTTPS em produção.`);
  }
  return value;
}

/** Carrega e valida a configuração; não oferece segredo de autenticação padrão. */
export function readEnv(env = process.env) {
  const mode = env.NODE_ENV || 'development';
  if (!['development', 'production', 'test'].includes(mode)) throw new Error('NODE_ENV inválido.');
  const production = mode === 'production';
  const secret = required(env, 'JWT_SECRET');
  if (Buffer.byteLength(secret) < 32) throw new Error('JWT_SECRET deve ter pelo menos 32 bytes.');
  const expiresIn = env.JWT_EXPIRES_IN || '1h';
  if (!/^([1-9]\d*)(s|m|h)$/.test(expiresIn)) throw new Error('JWT_EXPIRES_IN inválido. Use, por exemplo, 1h.');
  const [, amount, unit] = expiresIn.match(/^(\d+)(s|m|h)$/);
  const ttl = Number(amount) * { s: 1, m: 60, h: 3600 }[unit];
  if (ttl > 86400) throw new Error('JWT_EXPIRES_IN não pode ultrapassar 24 horas.');
  if (!['true', 'false'].includes(env.DB_SSL ?? 'false')) throw new Error('DB_SSL deve ser true ou false.');
  const sslEnabled = env.DB_SSL === 'true';
  if (production && !sslEnabled) throw new Error('DB_SSL=true é obrigatório em produção.');
  const database = required(env, 'DB_NAME');
  if (!/^[a-zA-Z0-9_]+$/.test(database)) throw new Error('DB_NAME inválido.');
  let ca;
  if (sslEnabled) {
    ca = Buffer.from(required(env, 'DB_SSL_CA_BASE64'), 'base64').toString('utf8');
    if (!ca.includes('-----BEGIN CERTIFICATE-----')) throw new Error('Certificado DB_SSL_CA_BASE64 inválido.');
  }
  return {
    mode, production,
    port: integer(env, 'PORT', 3000, 1, 65535),
    frontendUrl: origin(env, 'FRONTEND_URL', production),
    apiPublicUrl: origin(env, 'API_PUBLIC_URL', production),
    trustProxy: integer(env, 'TRUST_PROXY', 0, 0, 3),
    bcryptRounds: integer(env, 'BCRYPT_ROUNDS', 12, 10, 15),
    jwt: { secret, expiresIn: ttl, issuer: required(env, 'JWT_ISSUER'), audience: required(env, 'JWT_AUDIENCE') },
    db: {
      host: required(env, 'DB_HOST'), port: integer(env, 'DB_PORT', 3306, 1, 65535),
      database, user: required(env, 'DB_USER'), password: required(env, 'DB_PASSWORD'),
      connectionLimit: integer(env, 'DB_POOL_LIMIT', 5, 1, 30),
      ...(sslEnabled ? { ssl: { ca, rejectUnauthorized: true } } : {}),
    },
  };
}
