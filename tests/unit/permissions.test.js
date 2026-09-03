import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ensureVisible,
  ensureEditable,
  ensureTransition,
  ensureCanComment,
} from '../../src/services/permissions.js';

const client = { id: 1, perfil: 'cliente' };
const anotherClient = { id: 2, perfil: 'cliente' };
const technician = { id: 3, perfil: 'tecnico' };
const anotherTechnician = { id: 4, perfil: 'tecnico' };
const open = { id: 10, cliente_id: 1, tecnico_id: null, status: 'ABERTO', versao: 1 };
const attending = { ...open, tecnico_id: 3, status: 'EM_ATENDIMENTO', versao: 2 };
const closed = { ...attending, status: 'CONCLUIDO', versao: 3 };
const status = (value) => (error) => error.status === value;

test('cliente vê o próprio chamado e técnico consulta a fila', () => {
  assert.doesNotThrow(() => ensureVisible(client, open));
  assert.doesNotThrow(() => ensureVisible(technician, open));
});
test('chamado de outro cliente é indistinguível de um inexistente', () => {
  assert.throws(() => ensureVisible(anotherClient, open), status(404));
  assert.throws(() => ensureVisible(client, undefined), status(404));
});
test('cliente pode editar somente chamado aberto com versão atual', () => {
  assert.doesNotThrow(() => ensureEditable(client, open, 1));
  assert.throws(() => ensureEditable(client, open, 2), status(409));
  assert.throws(() => ensureEditable(client, attending, 2), status(409));
  assert.throws(() => ensureEditable(technician, open, 1), status(403));
});
test('assumir exige técnico e chamado disponível', () => {
  assert.doesNotThrow(() =>
    ensureTransition(technician, open, { status: 'EM_ATENDIMENTO', versao: 1 }),
  );
  assert.throws(
    () => ensureTransition(client, open, { status: 'EM_ATENDIMENTO', versao: 1 }),
    status(403),
  );
  assert.throws(
    () => ensureTransition(anotherTechnician, attending, { status: 'EM_ATENDIMENTO', versao: 2 }),
    status(409),
  );
});
test('concluir exige responsável, estado correto e solução', () => {
  const input = { status: 'CONCLUIDO', versao: 2, resolucao: 'Conexão restabelecida.' };
  assert.doesNotThrow(() => ensureTransition(technician, attending, input));
  assert.throws(() => ensureTransition(anotherTechnician, attending, input), status(403));
  assert.throws(() => ensureTransition(technician, open, { ...input, versao: 1 }), status(409));
  assert.throws(
    () => ensureTransition(technician, attending, { ...input, resolucao: '' }),
    status(409),
  );
});
test('chamado concluído não reabre nem aceita novas conclusões', () => {
  assert.throws(
    () => ensureTransition(technician, closed, { status: 'ABERTO', versao: 3 }),
    status(409),
  );
  assert.throws(
    () =>
      ensureTransition(technician, closed, {
        status: 'CONCLUIDO',
        versao: 3,
        resolucao: 'Outra solução.',
      }),
    status(409),
  );
});
test('comentários exigem proprietário ou técnico responsável e chamado não concluído', () => {
  assert.doesNotThrow(() => ensureCanComment(client, open));
  assert.doesNotThrow(() => ensureCanComment(technician, attending));
  assert.throws(() => ensureCanComment(technician, open), status(403));
  assert.throws(() => ensureCanComment(anotherTechnician, attending), status(403));
  assert.throws(() => ensureCanComment(anotherClient, attending), status(404));
  assert.throws(() => ensureCanComment(client, closed), status(409));
});
