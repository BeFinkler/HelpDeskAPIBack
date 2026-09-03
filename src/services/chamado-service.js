import { forbidden } from '../errors/app-error.js';
import {
  ensureVisible,
  ensureEditable,
  ensureTransition,
  ensureCanComment,
} from './permissions.js';

export function createChamadoService(tickets, comments) {
  return {
    list: (user, query) => tickets.list(user, query),
    summary: (user) => tickets.summary(user),
    async get(user, id) {
      const ticket = await tickets.findById(id);
      ensureVisible(user, ticket);
      return ticket;
    },
    async create(user, input) {
      if (user.perfil !== 'cliente') throw forbidden();
      return tickets.create(user.id, input);
    },
    async edit(user, id, input) {
      return tickets.transaction(async (connection) => {
        const ticket = await tickets.lock(id, connection);
        ensureEditable(user, ticket, input.versao);
        return tickets.edit(id, { ...ticket, ...input }, connection);
      });
    },
    async transition(user, id, input) {
      return tickets.transaction(async (connection) => {
        const ticket = await tickets.lock(id, connection);
        ensureTransition(user, ticket, input);
        return input.status === 'EM_ATENDIMENTO'
          ? tickets.assign(id, user.id, connection)
          : tickets.conclude(id, input.resolucao, connection);
      });
    },
    async listComments(user, id, query) {
      await this.get(user, id);
      return comments.list(id, query);
    },
    async comment(user, id, message) {
      return tickets.transaction(async (connection) => {
        const ticket = await tickets.lock(id, connection);
        ensureCanComment(user, ticket);
        return comments.create(id, user.id, message, connection);
      });
    },
  };
}
