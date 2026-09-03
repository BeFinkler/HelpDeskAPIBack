const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const string = (maxLength, minLength = 1) => ({ type: 'string', minLength, maxLength });
const id = { type: 'integer', minimum: 1 };
const date = { type: 'string', format: 'date-time' };
const nullableId = { ...id, nullable: true };
const object = (properties, required = Object.keys(properties)) => ({
  type: 'object',
  additionalProperties: false,
  properties,
  required,
});
const user = object({
  id,
  nome: string(100, 2),
  email: { type: 'string', format: 'email' },
  perfil: { type: 'string', enum: ['cliente', 'tecnico'] },
  criado_em: date,
  atualizado_em: date,
});
const ticketFields = {
  titulo: string(160, 3),
  descricao: string(5000, 10),
  categoria: { type: 'string', enum: ['acesso', 'hardware', 'software', 'rede', 'outros'] },
  prioridade: { type: 'string', enum: ['baixa', 'media', 'alta'] },
};
const status = {
  type: 'string',
  enum: ['ABERTO', 'EM_ATENDIMENTO', 'CONCLUIDO'],
  description: 'Aberto, Em Atendimento e Concluído (encerrado), respectivamente.',
};
const ticket = object({
  id,
  ...ticketFields,
  status,
  cliente_id: id,
  tecnico_id: nullableId,
  resolucao: { type: 'string', nullable: true },
  versao: id,
  criado_em: date,
  atualizado_em: date,
  iniciado_em: { ...date, nullable: true },
  concluido_em: { ...date, nullable: true },
  cliente_nome: string(100),
  tecnico_nome: { type: 'string', nullable: true },
});
const comment = object({
  id,
  chamado_id: id,
  usuario_id: id,
  mensagem: string(2000),
  criado_em: date,
  usuario_nome: string(100),
  usuario_perfil: { type: 'string', enum: ['cliente', 'tecnico'] },
});
const pagination = object({
  pagina: id,
  limite: { type: 'integer', minimum: 1, maximum: 100 },
  total: { type: 'integer', minimum: 0 },
  totalPaginas: { type: 'integer', minimum: 0 },
});
const envelope = (schema) => object({ data: schema });
const paginated = (schema) =>
  object({ data: { type: 'array', items: schema }, meta: ref('Paginacao') });
const response = (description, schema) => ({
  description,
  content: { 'application/json': { schema } },
});
const errors = Object.fromEntries(
  [
    [400, 'JSON malformado.'],
    [401, 'JWT ausente, inválido ou expirado; no login, credenciais inválidas.'],
    [403, 'Perfil, ação ou origem sem permissão.'],
    [404, 'Recurso inexistente ou invisível ao usuário.'],
    [409, 'E-mail já cadastrado ou conflito de estado/versão.'],
    [413, 'Corpo excede 32 KB.'],
    [415, 'Tipo de conteúdo não suportado.'],
    [422, 'Campos inválidos ou não permitidos.'],
    [429, 'Muitas tentativas de autenticação/cadastro.'],
    [500, 'Erro interno sem detalhes sensíveis.'],
    [503, 'Serviço temporariamente indisponível.'],
  ].map(([code, description]) => [code, response(description, ref('Erro'))]),
);
const jsonBody = (schema) => ({ required: true, content: { 'application/json': { schema } } });
const pathId = {
  name: 'id',
  in: 'path',
  required: true,
  schema: { ...id, maximum: 4294967295 },
  description: 'Identificador do chamado.',
};
const paging = [
  {
    name: 'pagina',
    in: 'query',
    schema: { type: 'integer', minimum: 1, maximum: 1000000, default: 1 },
  },
  {
    name: 'limite',
    in: 'query',
    schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
  },
];
function operation(
  operationId,
  summary,
  tag,
  schema,
  { created = false, body, parameters, publicRoute = false, description } = {},
) {
  return {
    operationId,
    summary,
    tags: [tag],
    ...(description ? { description } : {}),
    ...(publicRoute ? { security: [] } : {}),
    ...(parameters ? { parameters } : {}),
    ...(body ? { requestBody: jsonBody(body) } : {}),
    responses: { [created ? 201 : 200]: response('Operação concluída.', schema), ...errors },
  };
}

export const openapi = {
  openapi: '3.0.3',
  info: {
    title: 'HelpDesk API',
    version: '1.0.0',
    description:
      'API independente de suporte técnico. Cadastre um cliente, faça login e cole o campo token em Authorize. Técnicos são criados pelo comando setup:technician. Concluído representa o encerramento; não há exclusão nem reabertura. Logout remove a sessão no cliente, e JWTs emitidos expiram conforme expiresIn.',
  },
  servers: [{ url: '/', description: 'Mesma origem desta documentação' }],
  security: [{ bearerAuth: [] }],
  tags: [
    { name: 'Autenticação' },
    { name: 'Chamados' },
    { name: 'Comentários' },
    { name: 'Operação' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description:
          'Cole somente o JWT. O Swagger acrescentará Bearer ao cabeçalho Authorization.',
      },
    },
    schemas: {
      Usuario: user,
      Chamado: ticket,
      Comentario: comment,
      Paginacao: pagination,
      Erro: object({
        error: object(
          {
            code: string(100),
            message: string(1000),
            fields: { type: 'array', items: object({ field: string(200), message: string(1000) }) },
          },
          ['code', 'message'],
        ),
      }),
      Cadastro: object({
        nome: string(100, 2),
        email: { type: 'string', format: 'email', maxLength: 254 },
        senha: {
          ...string(72, 8),
          format: 'password',
          writeOnly: true,
          description: 'Mínimo 8 caracteres; máximo 72 bytes em UTF-8.',
        },
      }),
      Login: object({
        email: { type: 'string', format: 'email', maxLength: 254 },
        senha: { ...string(72, 8), format: 'password', writeOnly: true },
      }),
      NovoChamado: object(ticketFields),
      EdicaoChamado: { ...object({ ...ticketFields, versao: id }, ['versao']), minProperties: 2 },
      AlteracaoStatus: {
        oneOf: [
          object({ status: { type: 'string', enum: ['EM_ATENDIMENTO'] }, versao: id }),
          object({
            status: { type: 'string', enum: ['CONCLUIDO'] },
            versao: id,
            resolucao: string(5000, 10),
          }),
        ],
      },
      NovoComentario: object({ mensagem: string(2000) }),
      RespostaUsuario: envelope(ref('Usuario')),
      RespostaLogin: envelope(
        object({
          token: string(4096),
          expiresIn: { type: 'integer', minimum: 1, maximum: 86400 },
          user: ref('Usuario'),
        }),
      ),
      RespostaChamado: envelope(ref('Chamado')),
      RespostaComentario: envelope(ref('Comentario')),
      ListaChamados: paginated(ref('Chamado')),
      ListaComentarios: paginated(ref('Comentario')),
      Resumo: envelope(
        object(
          Object.fromEntries(
            ['ABERTO', 'EM_ATENDIMENTO', 'CONCLUIDO', 'total'].map((key) => [
              key,
              { type: 'integer', minimum: 0 },
            ]),
          ),
        ),
      ),
    },
  },
  paths: {
    '/api/v1/auth/cadastro': {
      post: operation(
        'cadastrarCliente',
        'Cadastrar cliente',
        'Autenticação',
        ref('RespostaUsuario'),
        { body: ref('Cadastro'), created: true, publicRoute: true },
      ),
    },
    '/api/v1/auth/login': {
      post: operation('autenticar', 'Entrar e obter JWT', 'Autenticação', ref('RespostaLogin'), {
        body: ref('Login'),
        publicRoute: true,
      }),
    },
    '/api/v1/auth/me': {
      get: operation(
        'consultarUsuario',
        'Consultar usuário autenticado',
        'Autenticação',
        ref('RespostaUsuario'),
      ),
    },
    '/api/v1/chamados/resumo': {
      get: operation(
        'resumirChamados',
        'Contar chamados visíveis por status',
        'Chamados',
        ref('Resumo'),
      ),
    },
    '/api/v1/chamados': {
      get: operation(
        'listarChamados',
        'Listar chamados com filtros',
        'Chamados',
        ref('ListaChamados'),
        {
          description:
            'Clientes veem somente os próprios chamados; técnicos veem a fila da central. Ordem: mais recentes primeiro. Busca por título ou protocolo HD-000123.',
          parameters: [
            ...paging,
            ...['status', 'categoria', 'prioridade'].map((name) => ({
              name,
              in: 'query',
              schema: name === 'status' ? status : ticketFields[name],
            })),
            { name: 'busca', in: 'query', schema: { type: 'string', maxLength: 160 } },
            {
              name: 'meus',
              in: 'query',
              schema: { type: 'string', enum: ['true', 'false'] },
              description: 'Para técnicos, filtra atendimentos atribuídos a si.',
            },
          ],
        },
      ),
      post: operation(
        'abrirChamado',
        'Abrir chamado como cliente',
        'Chamados',
        ref('RespostaChamado'),
        { body: ref('NovoChamado'), created: true },
      ),
    },
    '/api/v1/chamados/{id}': {
      get: operation(
        'consultarChamado',
        'Consultar detalhes do chamado',
        'Chamados',
        ref('RespostaChamado'),
        { parameters: [pathId] },
      ),
      patch: operation(
        'editarChamado',
        'Editar chamado próprio ainda aberto',
        'Chamados',
        ref('RespostaChamado'),
        {
          parameters: [pathId],
          body: ref('EdicaoChamado'),
          description:
            'Envie a versao recebida no GET e pelo menos um campo de conteúdo. Dados desatualizados retornam 409.',
        },
      ),
    },
    '/api/v1/chamados/{id}/status': {
      patch: operation(
        'alterarStatus',
        'Assumir ou concluir atendimento',
        'Chamados',
        ref('RespostaChamado'),
        {
          parameters: [pathId],
          body: ref('AlteracaoStatus'),
          description:
            'Somente técnicos. ABERTO → EM_ATENDIMENTO atribui o usuário autenticado. EM_ATENDIMENTO → CONCLUIDO exige o responsável e resolucao. As operações são atômicas.',
        },
      ),
    },
    '/api/v1/chamados/{id}/comentarios': {
      get: operation(
        'listarComentarios',
        'Listar comentários do chamado',
        'Comentários',
        ref('ListaComentarios'),
        { parameters: [pathId, ...paging] },
      ),
      post: operation(
        'comentarChamado',
        'Publicar comentário',
        'Comentários',
        ref('RespostaComentario'),
        {
          parameters: [pathId],
          body: ref('NovoComentario'),
          created: true,
          description:
            'Permitido ao cliente proprietário ou técnico responsável, enquanto o chamado não estiver concluído. Conteúdo tratado como texto simples.',
        },
      ),
    },
    '/health': {
      get: {
        operationId: 'verificarProcesso',
        tags: ['Operação'],
        summary: 'Verificar processo',
        security: [],
        responses: {
          200: response('Processo ativo.', object({ status: { type: 'string', enum: ['ok'] } })),
        },
      },
    },
    '/health/ready': {
      get: {
        operationId: 'verificarBanco',
        tags: ['Operação'],
        summary: 'Verificar disponibilidade do banco',
        security: [],
        responses: {
          200: response('Banco acessível.', object({ status: { type: 'string', enum: ['ok'] } })),
          503: response(
            'Banco indisponível.',
            object({ status: { type: 'string', enum: ['unavailable'] } }),
          ),
        },
      },
    },
  },
};
