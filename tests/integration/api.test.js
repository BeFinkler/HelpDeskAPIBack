import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { createPool } from '../../src/config/database.js';
import { createApp } from '../../src/app.js';
import { createUsuarioModel } from '../../src/models/usuario-model.js';
import { migrate } from '../../scripts/migrate.js';
import { testConfig } from '../helpers/test-config.js';
import { openapi } from '../../src/docs/openapi.js';

const prefix = '/api/v1';
const suffix = randomUUID();
const password = randomBytes(20).toString('hex');
const newTicket = {
  titulo: 'Falha de conexão com a rede',
  descricao: 'A conexão não funciona desde o início do expediente.',
  categoria: 'rede',
  prioridade: 'media',
};
let pool, app, config, client, otherClient, tech, otherTech;
const usersCreated = [],
  ticketsCreated = [];
const ajv = new Ajv({ strict: false, allErrors: true });
addFormats(ajv);
const validators = {};
for (const [name, schema] of Object.entries(openapi.components.schemas)) {
  validators[name] = ajv.compile({
    ...schema,
    components: { schemas: openapi.components.schemas },
  });
}
const contract = (name, payload) =>
  assert.ok(validators[name](payload), JSON.stringify(validators[name].errors));
const auth = (method, path, user) =>
  request(app)[method](`${prefix}${path}`).set('Authorization', `Bearer ${user.token}`);

async function account(name, role = 'cliente') {
  const email = `${name.toLowerCase().replaceAll(' ', '-')}-${suffix}@example.com`;
  let user;
  if (role === 'tecnico') {
    user = await createUsuarioModel(pool).create({
      nome: name,
      email,
      perfil: role,
      senha_hash: await bcrypt.hash(password, 10),
    });
  } else {
    const response = await request(app)
      .post(`${prefix}/auth/cadastro`)
      .send({ nome: name, email, senha: password })
      .expect(201);
    contract('RespostaUsuario', response.body);
    user = response.body.data;
  }
  usersCreated.push(user.id);
  const login = await request(app)
    .post(`${prefix}/auth/login`)
    .send({ email, senha: password })
    .expect(200);
  contract('RespostaLogin', login.body);
  return { ...user, token: login.body.data.token };
}
async function ticket(user = client) {
  const response = await auth('post', '/chamados', user).send(newTicket).expect(201);
  contract('RespostaChamado', response.body);
  ticketsCreated.push(response.body.data.id);
  return response.body.data;
}

describe('API com MySQL real e contrato OpenAPI', { concurrency: false }, () => {
  before(async () => {
    config = testConfig();
    pool = createPool(config.db);
    await migrate(pool);
    app = createApp({ pool, config, authLimitMax: 200, logger: { error() {} } });
    client = await account('Cliente Um');
    otherClient = await account('Cliente Dois');
    tech = await account('Tecnico Um', 'tecnico');
    otherTech = await account('Tecnico Dois', 'tecnico');
  });
  after(async () => {
    if (!pool) return;
    try {
      for (const id of ticketsCreated) {
        await pool.execute('DELETE FROM comentarios_chamado WHERE chamado_id = ?', [id]);
        await pool.execute('DELETE FROM chamados WHERE id = ?', [id]);
      }
      for (const id of usersCreated) await pool.execute('DELETE FROM usuarios WHERE id = ?', [id]);
    } finally {
      await pool.end();
    }
  });
  test('hash de senha, e-mail duplicado e proibição de atribuir perfil', async () => {
    const [[row]] = await pool.execute('SELECT senha_hash FROM usuarios WHERE id = ?', [client.id]);
    assert.notEqual(row.senha_hash, password);
    assert.ok(await bcrypt.compare(password, row.senha_hash));
    await request(app)
      .post(`${prefix}/auth/cadastro`)
      .send({ nome: 'Duplicado', email: client.email, senha: password })
      .expect(409);
    await request(app)
      .post(`${prefix}/auth/cadastro`)
      .send({
        nome: 'Promocao',
        email: `privilegio-${suffix}@example.com`,
        senha: password,
        perfil: 'tecnico',
      })
      .expect(422);
  });
  test('rotas privadas recusam JWT ausente, adulterado e expirado', async () => {
    await request(app).get(`${prefix}/chamados`).expect(401);
    await request(app)
      .get(`${prefix}/chamados`)
      .set('Authorization', `Bearer ${client.token}x`)
      .expect(401);
    const expired = jwt.sign({}, config.jwt.secret, {
      algorithm: 'HS256',
      subject: String(client.id),
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
      expiresIn: -1,
    });
    await request(app)
      .get(`${prefix}/chamados`)
      .set('Authorization', `Bearer ${expired}`)
      .expect(401);
    const failedLogin = await request(app)
      .post(`${prefix}/auth/login`)
      .send({ email: client.email, senha: `${password}x` })
      .expect(401);
    contract('Erro', failedLogin.body);
  });
  test('cliente não acessa dados de outro cliente por nenhuma rota', async () => {
    const own = await ticket();
    for (const suffix of ['', '/comentarios'])
      await auth('get', `/chamados/${own.id}${suffix}`, otherClient).expect(404);
    await auth('post', `/chamados/${own.id}/comentarios`, otherClient)
      .send({ mensagem: 'Acesso indevido.' })
      .expect(404);
    const list = await auth('get', '/chamados', otherClient).expect(200);
    contract('ListaChamados', list.body);
    assert.ok(list.body.data.every((item) => item.cliente_id === otherClient.id));
    const summary = await auth('get', '/chamados/resumo', otherClient).expect(200);
    contract('Resumo', summary.body);
    assert.equal(summary.body.data.total, 0);
  });
  test('fluxo de edição, atendimento, conversa e conclusão', async () => {
    const own = await ticket();
    const edit = await auth('patch', `/chamados/${own.id}`, client)
      .send({ versao: 1, titulo: 'Rede indisponível na estação' })
      .expect(200);
    assert.equal(edit.body.data.versao, 2);
    await auth('patch', `/chamados/${own.id}`, client)
      .send({ versao: 1, titulo: 'Edição desatualizada' })
      .expect(409);
    await auth('patch', `/chamados/${own.id}/status`, client)
      .send({ versao: 2, status: 'EM_ATENDIMENTO' })
      .expect(403);
    await auth('patch', `/chamados/${own.id}/status`, tech)
      .send({ versao: 2, status: 'CONCLUIDO', resolucao: 'Solução fora de ordem.' })
      .expect(409);
    const assigned = await auth('patch', `/chamados/${own.id}/status`, tech)
      .send({ versao: 2, status: 'EM_ATENDIMENTO' })
      .expect(200);
    assert.equal(assigned.body.data.tecnico_id, tech.id);
    assert.equal(assigned.body.data.versao, 3);
    await auth('patch', `/chamados/${own.id}`, client)
      .send({ versao: 3, titulo: 'Não deve alterar' })
      .expect(409);
    const comment = await auth('post', `/chamados/${own.id}/comentarios`, tech)
      .send({ mensagem: 'Estou verificando a conexão.' })
      .expect(201);
    contract('RespostaComentario', comment.body);
    await auth('post', `/chamados/${own.id}/comentarios`, otherTech)
      .send({ mensagem: 'Não sou responsável.' })
      .expect(403);
    await auth('patch', `/chamados/${own.id}/status`, otherTech)
      .send({ versao: 3, status: 'CONCLUIDO', resolucao: 'Tentativa não permitida.' })
      .expect(403);
    await auth('patch', `/chamados/${own.id}/status`, tech)
      .send({ versao: 3, status: 'CONCLUIDO' })
      .expect(422);
    const closed = await auth('patch', `/chamados/${own.id}/status`, tech)
      .send({
        versao: 3,
        status: 'CONCLUIDO',
        resolucao: 'Configuração de rede corrigida e conexão validada.',
      })
      .expect(200);
    contract('RespostaChamado', closed.body);
    assert.ok(closed.body.data.concluido_em);
    await auth('post', `/chamados/${own.id}/comentarios`, client)
      .send({ mensagem: 'Comentário após encerramento.' })
      .expect(409);
    const history = await auth('get', `/chamados/${own.id}/comentarios`, client).expect(200);
    contract('ListaComentarios', history.body);
    assert.equal(history.body.meta.total, 1);
  });
  test('dois técnicos não assumem o mesmo chamado simultaneamente', async () => {
    const own = await ticket();
    const responses = await Promise.all(
      [tech, otherTech].map((user) =>
        auth('patch', `/chamados/${own.id}/status`, user).send({
          versao: 1,
          status: 'EM_ATENDIMENTO',
        }),
      ),
    );
    assert.deepEqual(responses.map((item) => item.status).sort(), [200, 409]);
    const current = await auth('get', `/chamados/${own.id}`, client).expect(200);
    assert.ok([tech.id, otherTech.id].includes(current.body.data.tecnico_id));
  });
  test('conclusão concorrente impede comentário posterior ao encerramento', async () => {
    const own = await ticket();
    await auth('patch', `/chamados/${own.id}/status`, tech)
      .send({ versao: 1, status: 'EM_ATENDIMENTO' })
      .expect(200);
    const [close, comment] = await Promise.all([
      auth('patch', `/chamados/${own.id}/status`, tech).send({
        versao: 2,
        status: 'CONCLUIDO',
        resolucao: 'Atendimento encerrado após verificação.',
      }),
      auth('post', `/chamados/${own.id}/comentarios`, client).send({
        mensagem: 'Mensagem concorrente.',
      }),
    ]);
    assert.equal(close.status, 200);
    assert.ok([201, 409].includes(comment.status));
    if (comment.status === 201)
      assert.ok(new Date(comment.body.data.criado_em) <= new Date(close.body.data.concluido_em));
  });
  test('filtros, busca parametrizada, IDs inválidos e campos privilegiados', async () => {
    const own = await ticket();
    const filtered = await auth(
      'get',
      `/chamados?busca=HD-${String(own.id).padStart(6, '0')}&limite=1`,
      client,
    ).expect(200);
    assert.equal(filtered.body.data[0].id, own.id);
    const injection = await auth(
      'get',
      `/chamados?busca=${encodeURIComponent("' OR 1=1 --")}`,
      client,
    ).expect(200);
    assert.equal(injection.body.meta.total, 0);
    await auth('get', '/chamados?limite=101', client).expect(422);
    await auth('get', '/chamados/invalido', client).expect(422);
    await auth('post', '/chamados', client)
      .send({ ...newTicket, cliente_id: otherClient.id })
      .expect(422);
    await auth('post', `/chamados/${own.id}/comentarios`, client)
      .send({ mensagem: 'Mensagem válida.', usuario_id: otherClient.id })
      .expect(422);
    const script = '<script>alert("teste")</script>';
    const comment = await auth('post', `/chamados/${own.id}/comentarios`, client)
      .send({ mensagem: script })
      .expect(201);
    assert.equal(comment.body.data.mensagem, script);
  });
  test('CORS permite a origem exata e Swagger na própria API', async () => {
    const allowed = await auth('get', '/auth/me', client)
      .set('Origin', config.frontendUrl)
      .expect(200);
    assert.equal(allowed.headers['access-control-allow-origin'], config.frontendUrl);
    const denied = await auth('get', '/auth/me', client)
      .set('Origin', 'https://origem-invalida.example')
      .expect(403);
    assert.equal(denied.headers['access-control-allow-origin'], undefined);
    await auth('get', '/auth/me', client).set('Origin', config.apiPublicUrl).expect(200);
    const preflight = await request(app)
      .options(`${prefix}/chamados`)
      .set('Origin', config.frontendUrl)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'authorization,content-type')
      .expect(204);
    assert.match(preflight.headers['access-control-allow-headers'].toLowerCase(), /authorization/);
    await request(app).get('/api-docs/').expect(200);
    const docs = await request(app).get('/api-docs.json').expect(200);
    assert.equal(docs.body.openapi, '3.0.3');
  });
  test('erros HTTP não vazam stack e login possui limitação de tentativas', async () => {
    const invalid = await request(app)
      .post(`${prefix}/auth/login`)
      .set('Content-Type', 'application/json')
      .send('{')
      .expect(400);
    contract('Erro', invalid.body);
    assert.equal(invalid.body.stack, undefined);
    await request(app)
      .post(`${prefix}/auth/login`)
      .type('form')
      .send({ email: client.email })
      .expect(415);
    const limited = createApp({ pool, config, authLimitMax: 2, logger: { error() {} } });
    for (let i = 0; i < 2; i++)
      await request(limited).post(`${prefix}/auth/login`).send({}).expect(422);
    await request(limited).post(`${prefix}/auth/login`).send({}).expect(429);
    await request(app).get('/health/ready').expect(200);
  });
});
