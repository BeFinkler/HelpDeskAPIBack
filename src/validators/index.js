import { body, query, param, checkExact, validationResult, matchedData } from 'express-validator';
import { AppError } from '../errors/app-error.js';

export const statuses = ['ABERTO', 'EM_ATENDIMENTO', 'CONCLUIDO'];
export const categories = ['acesso', 'hardware', 'software', 'rede', 'outros'];
export const priorities = ['baixa', 'media', 'alta'];

const text = (field, min, max) =>
  body(field)
    .isString()
    .withMessage('Informe um texto.')
    .bail()
    .trim()
    .isLength({ min, max })
    .withMessage(`Use entre ${min} e ${max} caracteres.`);
const password = () =>
  body('senha')
    .isString()
    .withMessage('Informe uma senha.')
    .bail()
    .isLength({ min: 8 })
    .withMessage('Use pelo menos 8 caracteres.')
    .bail()
    .custom((value) => Buffer.byteLength(value, 'utf8') <= 72)
    .withMessage('A senha deve ter no máximo 72 bytes em UTF-8.');
const email = () =>
  body('email')
    .isString()
    .bail()
    .trim()
    .isLength({ max: 254 })
    .bail()
    .isEmail()
    .withMessage('Informe um e-mail válido.')
    .bail()
    .toLowerCase();
const version = () =>
  body('versao')
    .custom((value) => Number.isInteger(value) && value >= 1 && value <= 4294967295)
    .withMessage('Informe a versão atual do chamado como um número inteiro.');

function validate(chains, locations = ['body']) {
  return [
    checkExact(chains, { locations, message: 'Campo não permitido.' }),
    (req, _res, next) => {
      const result = validationResult(req);
      if (!result.isEmpty()) {
        const errors = result.array({ onlyFirstError: true }).flatMap((error) =>
          error.type === 'unknown_fields'
            ? error.fields.map((field) => ({
                field: field.path,
                message: 'Campo não permitido.',
              }))
            : [{ field: error.path || 'requisicao', message: error.msg }],
        );
        return next(new AppError(422, 'VALIDATION_ERROR', 'Revise os campos informados.', errors));
      }
      req.validated = {
        ...(req.validated || {}),
        ...matchedData(req, { locations, includeOptionals: false }),
      };
      next();
    },
  ];
}

export const registerValidation = () => validate([text('nome', 2, 100), email(), password()]);
export const loginValidation = () => validate([email(), password()]);
const ticketFields = (optional = false) => {
  const fields = [
    text('titulo', 3, 160),
    text('descricao', 10, 5000),
    body('categoria').isString().bail().isIn(categories).withMessage('Categoria inválida.'),
    body('prioridade').isString().bail().isIn(priorities).withMessage('Prioridade inválida.'),
  ];
  return optional ? fields.map((field) => field.optional()) : fields;
};
export const createTicketValidation = () => validate(ticketFields());
export const editTicketValidation = () => [
  ...validate([...ticketFields(true), version()]),
  (req, _res, next) =>
    Object.keys(req.validated).some((key) =>
      ['titulo', 'descricao', 'categoria', 'prioridade'].includes(key),
    )
      ? next()
      : next(new AppError(422, 'VALIDATION_ERROR', 'Informe ao menos um campo para editar.')),
];
export const transitionValidation = () => [
  ...validate([
    body('status')
      .isString()
      .bail()
      .isIn(['EM_ATENDIMENTO', 'CONCLUIDO'])
      .withMessage('Status de destino inválido.'),
    version(),
    text('resolucao', 10, 5000).optional(),
  ]),
  (req, _res, next) => {
    if (req.validated.status === 'CONCLUIDO' && !req.validated.resolucao)
      return next(
        new AppError(422, 'VALIDATION_ERROR', 'Informe a solução do chamado.', [
          { field: 'resolucao', message: 'Descreva a solução em pelo menos 10 caracteres.' },
        ]),
      );
    if (req.validated.status === 'EM_ATENDIMENTO' && req.validated.resolucao !== undefined)
      return next(
        new AppError(422, 'VALIDATION_ERROR', 'A solução só pode ser informada na conclusão.'),
      );
    next();
  },
];
export const commentValidation = () => validate([text('mensagem', 1, 2000)]);
export const idValidation = () =>
  validate(
    [param('id').isInt({ min: 1, max: 4294967295 }).withMessage('Identificador inválido.').toInt()],
    ['params'],
  );

const pagination = () => [
  query('pagina')
    .optional()
    .isString()
    .bail()
    .isInt({ min: 1, max: 1000000 })
    .withMessage('Página inválida.')
    .toInt(),
  query('limite')
    .optional()
    .isString()
    .bail()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limite deve estar entre 1 e 100.')
    .toInt(),
];
const defaults = (req, _res, next) => {
  req.validated.pagina ??= 1;
  req.validated.limite ??= 20;
  next();
};
export const listValidation = () => [
  ...validate(
    [
      ...pagination(),
      query('status').optional().isString().bail().isIn(statuses).withMessage('Status inválido.'),
      query('categoria')
        .optional()
        .isString()
        .bail()
        .isIn(categories)
        .withMessage('Categoria inválida.'),
      query('prioridade')
        .optional()
        .isString()
        .bail()
        .isIn(priorities)
        .withMessage('Prioridade inválida.'),
      query('meus')
        .optional()
        .isString()
        .bail()
        .isIn(['true', 'false'])
        .withMessage('Filtro inválido.'),
      query('busca')
        .optional()
        .isString()
        .bail()
        .trim()
        .isLength({ max: 160 })
        .withMessage('Busca muito longa.'),
    ],
    ['query'],
  ),
  defaults,
];
export const paginationValidation = () => [...validate(pagination(), ['query']), defaults];
