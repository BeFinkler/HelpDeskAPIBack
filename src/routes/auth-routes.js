import { Router } from 'express';
import { registerValidation, loginValidation } from '../validators/index.js';

export function authRoutes(controller, authenticate, limiter) {
  const router = Router();
  router.post('/cadastro', limiter, registerValidation(), controller.register);
  router.post('/login', limiter, loginValidation(), controller.login);
  router.get('/me', authenticate, controller.me);
  return router;
}
