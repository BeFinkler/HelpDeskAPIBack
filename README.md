# HelpDesk API — Back-end

API REST de abertura e atendimento de chamados, com JavaScript, Node.js, Express e MySQL. O cliente Web está no repositório independente [HelpDeskAPIFront](https://github.com/BeFinkler/HelpDeskAPIFront).

Implementação validada localmente com MySQL real, testes de integração e fluxo completo no navegador. Consulte [as evidências e os limites da homologação](docs/STATUS_IMPLEMENTACAO.md).

## Funcionalidades

- Cadastro público de clientes, hash bcrypt e login JWT Bearer.
- Cliente acessa somente seus chamados e comentários; técnico consulta a fila.
- Abertura, edição enquanto aberto, atribuição ao técnico, comentários e conclusão com solução.
- Ciclo Aberto → Em Atendimento → Concluído, com versão e transações contra concorrência.
- Busca, filtros, paginação e indicadores por status.
- Swagger em `/api-docs`, especificação em `/api-docs.json` e health checks.

## Requisitos

- Node.js 24 e npm.
- MySQL Server 8.0.16 ou superior, ou MySQL gerenciado na Aiven.
- Portas 3000 para API, 3307 para o banco local isolado e 5173 para o front-end.

## Instalação local

```powershell
npm install
npm run setup:local
npm run dev
```

`setup:local` usa o executável MySQL instalado para criar uma instância exclusiva em `.local/mysql`, na porta **3307**, sem alterar o serviço MySQL existente na 3306. Gera senhas aleatórias, cria `.env`, aplica migrações e cria um técnico. O processo fica em segundo plano, vinculado somente a `127.0.0.1`.

E-mail e senha do técnico ficam em `.local/ACESSO_LOCAL.txt`, ignorado pelo Git. Crie o cliente na tela de cadastro. Não publique esse arquivo ou o `.env`.

Se o executável estiver fora do caminho padrão do Windows, defina `MYSQLD_PATH` antes do comando. Em outros sistemas, deixe `mysqld` no PATH. Um `.env` existente é preservado; nesse caso, confira a configuração e execute as migrações explicitamente.

Após reiniciar a máquina:

```powershell
npm run db:local
npm run dev
```

Para parar somente o banco deste projeto: `npm run db:local:stop`.

API: [http://localhost:3000](http://localhost:3000). Swagger: [http://localhost:3000/api-docs](http://localhost:3000/api-docs).

### Banco existente ou Aiven

1. Crie um banco dedicado ao HelpDesk.
2. Copie `.env.example` para `.env` e preencha a conexão e as origens.
3. Gere `JWT_SECRET` com `node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"`; salve o resultado somente no ambiente privado.
4. No banco em nuvem, configure `DB_SSL=true` e `DB_SSL_CA_BASE64` com a CA fornecida pelo provedor.
5. Execute `npm run db:migrate` e `npm run setup:technician`.
6. Execute `npm run dev`.

O comando de técnico exige as três variáveis `SETUP_TECHNICIAN_*`, não modifica contas existentes e não registra a senha no terminal. Remova a senha de configuração do ambiente depois do uso.

## Variáveis de ambiente

| Variável                    | Exemplo/padrão          | Finalidade                                                                    |
| --------------------------- | ----------------------- | ----------------------------------------------------------------------------- |
| `NODE_ENV`                  | `development`           | `development`, `test` ou `production`.                                        |
| `PORT`                      | `3000`                  | Porta HTTP; usar a fornecida pelo Render.                                     |
| `FRONTEND_URL`              | `http://localhost:5173` | Origem exata do cliente, sem barra final.                                     |
| `API_PUBLIC_URL`            | `http://localhost:3000` | Origem da própria API para o Swagger.                                         |
| `DB_HOST`                   | `127.0.0.1`             | Host MySQL.                                                                   |
| `DB_PORT`                   | `3307`                  | Porta local; Aiven informa sua própria porta.                                 |
| `DB_NAME`                   | `helpdesk`              | Banco da aplicação.                                                           |
| `DB_USER`                   | `helpdesk_app`          | Usuário da aplicação.                                                         |
| `DB_PASSWORD`               | Sem padrão              | Senha privada obrigatória.                                                    |
| `DB_SSL`                    | `false` local           | Obrigatoriamente `true` em produção.                                          |
| `DB_SSL_CA_BASE64`          | Sem padrão              | CA em Base64; obrigatória com TLS.                                            |
| `DB_POOL_LIMIT`             | `5`                     | Limite de conexões, ajustado ao plano do banco.                               |
| `JWT_SECRET`                | Sem padrão              | Segredo aleatório com pelo menos 32 bytes.                                    |
| `JWT_EXPIRES_IN`            | `1h`                    | Duração com sufixo `s`, `m` ou `h`; máximo 24 horas.                          |
| `JWT_ISSUER`                | `helpdesk-api`          | Emissor aceito no token.                                                      |
| `JWT_AUDIENCE`              | `helpdesk-web`          | Audiência aceita no token.                                                    |
| `BCRYPT_ROUNDS`             | `12`                    | Custo do hash, entre 10 e 15.                                                 |
| `TRUST_PROXY`               | `0` local               | Número de proxies confiáveis; conferir a topologia no Render, inicialmente 1. |
| `TEST_DB_NAME`              | `helpdesk_test`         | Banco com sufixo `_test`, diferente de `DB_NAME`.                             |
| `SETUP_TECHNICIAN_NAME`     | Sem padrão              | Nome para o comando de criação do técnico.                                    |
| `SETUP_TECHNICIAN_EMAIL`    | Sem padrão              | E-mail para o comando de criação do técnico.                                  |
| `SETUP_TECHNICIAN_PASSWORD` | Sem padrão              | Senha para provisionamento; remover depois.                                   |
| `MYSQLD_PATH`               | Opcional                | Executável usado somente pelo helper local.                                   |

`dotenv` carrega `.env` sem sobrescrever variáveis já definidas pelo processo/provedor.

## Comandos

| Comando                                      | Finalidade                                                             |
| -------------------------------------------- | ---------------------------------------------------------------------- |
| `npm install`                                | Instalação no desenvolvimento.                                         |
| `npm ci`                                     | Instalação do lockfile em CI/deploy, depois de gerado.                 |
| `npm run dev` / `npm start`                  | Servidor com/sem observação de arquivos.                               |
| `npm run setup:local`                        | Preparar banco, ambiente e técnico locais.                             |
| `npm run db:local` / `npm run db:local:stop` | Iniciar/parar o MySQL exclusivo do projeto.                            |
| `npm run db:migrate`                         | Aplicar migrações e conferir checksums.                                |
| `npm run setup:technician`                   | Criar técnico de forma controlada.                                     |
| `npm run lint`                               | Verificar código com ESLint.                                           |
| `npm run format` / `npm run format:check`    | Formatar/verificar a apresentação do código e documentação.            |
| `npm test`                                   | Testar permissões e contrato sem banco.                                |
| `npm run test:integration`                   | Testar HTTP, autenticação, SQL, concorrência e schemas com MySQL real. |
| `npm run setup:e2e`                          | Preparar banco e técnico para testes de navegador.                     |

## Arquitetura e segurança

`routes → middlewares → controllers → services → models → MySQL`

As dependências são montadas em `src/app.js`; `src/server.js` gerencia inicialização e encerramento. Os controllers possuem JSDoc. Consultas usam `execute(sql, parametros)`; transições e comentários bloqueiam a linha do chamado durante a transação. Os scripts administrativos usam somente nomes internos e segredos gerados/escapados para DDL que não aceita bind em todas as posições.

As tabelas obrigatórias estão em `database/migrations/001_inicial.sql`. `schema_migrations` é uma tabela técnica. Não edite uma migração aplicada: crie outro arquivo numerado. MySQL pode realizar commits implícitos em DDL; uma falha exige revisão explícita, sem apagar os dados.

O cadastro público nunca aceita perfil técnico. O JWT identifica o autor e a API verifica propriedade e responsabilidade em cada operação. Não há exclusão nem reabertura nesta versão.

O front-end envia `Authorization: Bearer <token>`. No Swagger, clique em **Authorize** e cole apenas o JWT obtido no login. Logout remove o token no navegador; tokens emitidos continuam válidos até expirar. Esta versão não oferece revogação individual de JWT.

CORS permite a origem exata configurada; o Swagger usa a própria origem da API. CORS não substitui autenticação e autorização para ferramentas HTTP externas.

## Verificação local

```powershell
npm test
npm run lint
npm run test:integration
```

`TEST_DB_NAME` deve existir e ser diferente do banco principal. O helper local cria `helpdesk_test`. Os testes geram suas próprias contas e chamados e removem somente esses registros; não fazem reset do banco principal.

Para o fluxo no navegador, execute `npm run setup:e2e` aqui. Depois, no front-end, execute `npx playwright install chromium` e `npm run test:e2e`. A suíte usa API na porta 3001 e cliente na 5174, com banco de testes. As instâncias usuais das portas 3000/5173 podem permanecer ativas.

## Documentação e publicação

- [Guia da API e banco em nuvem](docs/DEPLOY_API.md).
- [Plano de implementação](docs/PLANO_IMPLEMENTACAO.md).
- [Fluxo Git planejado](docs/FLUXO_GIT.md).
- [Estado e verificações executadas](docs/STATUS_IMPLEMENTACAO.md).
- No front-end: `docs/HOSPEDAGEM_VERCEL.md`, com a sequência integrada Aiven → Render → Vercel.

Preencha as URLs de produção no relatório somente após verificá-las em janela anônima. O EventHub permanece como aplicação independente já realizada.
