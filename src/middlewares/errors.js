import { AppError } from '../errors/app-error.js';

export function errorHandler(logger = console) {
  return (error, req, res, _next) => {
    let known = error;
    if (error.type === 'entity.parse.failed') known = new AppError(400, 'INVALID_JSON', 'O corpo da requisição deve ser um JSON válido.');
    if (error.type === 'entity.too.large') known = new AppError(413, 'PAYLOAD_TOO_LARGE', 'O conteúdo enviado excede o limite permitido.');
    if (error.code === 'ER_DUP_ENTRY') known = new AppError(409, 'EMAIL_EXISTS', 'Este e-mail já está cadastrado.');
    if (['ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT'].includes(error.code)) known = new AppError(409, 'CONFLICT', 'Outro atendimento está atualizando o chamado. Recarregue e tente novamente.');
    if (['ECONNREFUSED', 'ETIMEDOUT', 'PROTOCOL_CONNECTION_LOST', 'ER_CON_COUNT_ERROR'].includes(error.code)) known = new AppError(503, 'SERVICE_UNAVAILABLE', 'Serviço temporariamente indisponível. Tente novamente.');
    if (!(known instanceof AppError)) {
      logger.error({ event: 'request_failed', requestId: req.id, method: req.method, code: error.code || error.name || 'UNKNOWN' });
      known = new AppError(500, 'INTERNAL_ERROR', 'Não foi possível concluir a operação. Tente novamente.');
    }
    if (known.status === 401) res.set('WWW-Authenticate', 'Bearer');
    res.status(known.status).json({ error: { code: known.code, message: known.message, ...(known.fields ? { fields: known.fields } : {}) } });
  };
}
