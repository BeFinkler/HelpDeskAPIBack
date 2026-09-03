import { Router } from 'express';
import { idValidation, listValidation, createTicketValidation, editTicketValidation, transitionValidation, commentValidation, paginationValidation } from '../validators/index.js';

export function chamadoRoutes(controller, comments, authenticate) {
  const router = Router();
  router.use(authenticate);
  router.get('/resumo', controller.summary);
  router.get('/', listValidation(), controller.list);
  router.post('/', createTicketValidation(), controller.create);
  router.get('/:id', idValidation(), controller.get);
  router.patch('/:id', idValidation(), editTicketValidation(), controller.edit);
  router.patch('/:id/status', idValidation(), transitionValidation(), controller.transition);
  router.get('/:id/comentarios', idValidation(), paginationValidation(), comments.list);
  router.post('/:id/comentarios', idValidation(), commentValidation(), comments.create);
  return router;
}
