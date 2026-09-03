import jwt from 'jsonwebtoken';
import { AppError } from '../errors/app-error.js';

export function authenticate(users, config) {
  return async (req, _res, next) => {
    try {
      const match = req.get('authorization')?.match(/^Bearer ([^\s]+)$/i);
      if (!match) throw new AppError(401, 'UNAUTHORIZED', 'Entre na sua conta para continuar.');
      let payload;
      try {
        payload = jwt.verify(match[1], config.jwt.secret, {
          algorithms: ['HS256'],
          issuer: config.jwt.issuer,
          audience: config.jwt.audience,
        });
      } catch {
        throw new AppError(
          401,
          'UNAUTHORIZED',
          'Sua sessão expirou ou é inválida. Entre novamente.',
        );
      }
      if (!/^\d+$/.test(payload.sub) || !Number.isSafeInteger(Number(payload.sub))) {
        throw new AppError(401, 'UNAUTHORIZED', 'Sessão inválida.');
      }
      const user = await users.findById(Number(payload.sub));
      if (!user) throw new AppError(401, 'UNAUTHORIZED', 'Sessão inválida.');
      req.user = user;
      next();
    } catch (error) {
      next(error);
    }
  };
}
