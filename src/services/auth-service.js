import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AppError } from '../errors/app-error.js';

export function createAuthService(users, config) {
  // Mesmo custo de comparação quando o e-mail não existe, evitando saída antecipada.
  const dummyHash = bcrypt.hash('comparacao-interna-sem-conta', config.bcryptRounds);
  return {
    async register(input) {
      const senha_hash = await bcrypt.hash(input.senha, config.bcryptRounds);
      return users.create({ nome: input.nome, email: input.email, senha_hash, perfil: 'cliente' });
    },
    async login({ email, senha }) {
      const user = await users.findByEmail(email);
      const valid = await bcrypt.compare(senha, user?.senha_hash ?? await dummyHash);
      if (!user || !valid) throw new AppError(401, 'INVALID_CREDENTIALS', 'E-mail ou senha inválidos.');
      const token = jwt.sign({}, config.jwt.secret, {
        algorithm: 'HS256', subject: String(user.id), issuer: config.jwt.issuer,
        audience: config.jwt.audience, expiresIn: config.jwt.expiresIn,
      });
      const publicUser = { id: user.id, nome: user.nome, email: user.email, perfil: user.perfil, criado_em: user.criado_em, atualizado_em: user.atualizado_em };
      return { token, expiresIn: config.jwt.expiresIn, user: publicUser };
    },
  };
}
