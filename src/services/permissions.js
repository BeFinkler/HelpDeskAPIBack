import { conflict, forbidden, notFound } from '../errors/app-error.js';

export function ensureVisible(user, ticket) {
  if (!ticket || (user.perfil === 'cliente' && ticket.cliente_id !== user.id)) throw notFound();
}

export function ensureVersion(ticket, version) {
  if (ticket.versao !== version) throw conflict();
}

export function ensureEditable(user, ticket, version) {
  ensureVisible(user, ticket);
  if (user.perfil !== 'cliente') throw forbidden();
  ensureVersion(ticket, version);
  if (ticket.status !== 'ABERTO')
    throw conflict('A edição é permitida somente enquanto o chamado está aberto.');
}

export function ensureTransition(user, ticket, input) {
  ensureVisible(user, ticket);
  if (user.perfil !== 'tecnico') throw forbidden();
  ensureVersion(ticket, input.versao);
  if (input.status === 'EM_ATENDIMENTO') {
    if (ticket.status !== 'ABERTO' || ticket.tecnico_id !== null)
      throw conflict('Este chamado não está mais disponível para assumir.');
  } else if (input.status === 'CONCLUIDO') {
    if (ticket.status !== 'EM_ATENDIMENTO')
      throw conflict('Somente chamados em atendimento podem ser concluídos.');
    if (ticket.tecnico_id !== user.id) throw forbidden();
    if (!input.resolucao?.trim()) throw conflict('Informe a solução para concluir o chamado.');
  } else {
    throw conflict('Transição de status inválida.');
  }
}

export function ensureCanComment(user, ticket) {
  ensureVisible(user, ticket);
  if (ticket.status === 'CONCLUIDO')
    throw conflict('Chamados concluídos não recebem novos comentários.');
  if (user.perfil === 'tecnico' && ticket.tecnico_id !== user.id) throw forbidden();
}
