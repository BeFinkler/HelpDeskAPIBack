/** Erro conhecido que pode ser comunicado ao cliente sem detalhes internos. */
export class AppError extends Error {
  constructor(status, code, message, fields) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

export const notFound = () => new AppError(404, 'NOT_FOUND', 'Chamado não encontrado.');
export const forbidden = () =>
  new AppError(403, 'FORBIDDEN', 'Você não tem permissão para esta ação.');
export const conflict = (
  message = 'O chamado foi atualizado. Recarregue os dados e tente novamente.',
) => new AppError(409, 'CONFLICT', message);
