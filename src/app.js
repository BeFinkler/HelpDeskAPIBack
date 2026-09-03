import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import { randomUUID } from 'node:crypto';
import { createUsuarioModel } from './models/usuario-model.js';
import { createChamadoModel } from './models/chamado-model.js';
import { createComentarioModel } from './models/comentario-model.js';
import { createAuthService } from './services/auth-service.js';
import { createChamadoService } from './services/chamado-service.js';
import { createAuthController } from './controllers/auth-controller.js';
import { createChamadoController } from './controllers/chamado-controller.js';
import { createComentarioController } from './controllers/comentario-controller.js';
import { authenticate } from './middlewares/authenticate.js';
import { errorHandler } from './middlewares/errors.js';
import { authRoutes } from './routes/auth-routes.js';
import { chamadoRoutes } from './routes/chamado-routes.js';
import { AppError } from './errors/app-error.js';
import { openapi } from './docs/openapi.js';

/** Monta a aplicação com dependências explícitas, sem abrir portas. */
export function createApp({ pool, config, logger = console, authLimitMax = 30 }) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);
  app.set('query parser', 'simple');
  app.use((req, res, next) => { req.id = randomUUID(); res.set('X-Request-Id', req.id); next(); });
  app.use(helmet({
    strictTransportSecurity: config.production ? { maxAge: 31536000 } : false,
    contentSecurityPolicy: { directives: { 'upgrade-insecure-requests': config.production ? [] : null } },
  }));
  app.use((req, _res, next) => {
    const origin = req.get('origin');
    if (origin && origin !== config.frontendUrl && origin !== config.apiPublicUrl) {
      return next(new AppError(403, 'ORIGIN_NOT_ALLOWED', 'Origem não permitida.'));
    }
    next();
  });
  app.use(cors({
    origin: (origin, callback) => callback(null, origin === config.frontendUrl ? origin : false),
    methods: ['GET', 'POST', 'PATCH', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['X-Request-Id', 'Location'], maxAge: 600,
  }));
  app.use(express.json({ limit: '32kb' }));
  app.get('/', (_req, res) => res.json({ data: { name: 'HelpDesk API', version: '1.0.0', docs: '/api-docs' } }));
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  app.get('/health/ready', async (_req, res) => {
    try { await pool.execute('SELECT 1'); res.json({ status: 'ok' }); }
    catch { res.status(503).json({ status: 'unavailable' }); }
  });
  app.get('/api-docs.json', (_req, res) => res.json(openapi));
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(null, {
    customSiteTitle: 'HelpDesk API — Documentação',
    swaggerOptions: { url: '/api-docs.json', validatorUrl: null, persistAuthorization: false },
  }));
  app.use('/api/v1', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (['POST', 'PATCH'].includes(req.method)) {
      if (!req.is('application/json')) return next(new AppError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Envie Content-Type: application/json.'));
      if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) return next(new AppError(400, 'INVALID_JSON', 'Envie um objeto JSON.'));
    }
    next();
  });
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, limit: authLimitMax, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { error: { code: 'RATE_LIMITED', message: 'Muitas tentativas. Aguarde 15 minutos e tente novamente.' } },
  });
  const users = createUsuarioModel(pool);
  const tickets = createChamadoService(createChamadoModel(pool), createComentarioModel(pool));
  const guard = authenticate(users, config);
  app.use('/api/v1/auth', authRoutes(createAuthController(createAuthService(users, config)), guard, limiter));
  app.use('/api/v1/chamados', chamadoRoutes(createChamadoController(tickets), createComentarioController(tickets), guard));
  app.use((_req, _res, next) => next(new AppError(404, 'NOT_FOUND', 'Rota não encontrada.')));
  app.use(errorHandler(logger));
  return app;
}
