# Homologação local e de produção — HelpDesk

Data: 03/09/2026.

## Resultado

API e front-end implementados e verificados localmente, com MySQL 8.0.46 real. A versão pública foi homologada com MySQL 8.4 na Aiven, API no Render e front-end na Vercel. A aplicação utiliza bancos separados e não altera o banco do EventHub.

## Verificações executadas

| Verificação                                      | Resultado                                                     |
| ------------------------------------------------ | ------------------------------------------------------------- |
| Lint da API                                      | Aprovado, sem erros.                                          |
| Testes de regras, contrato e configuração da API | 13 aprovados.                                                 |
| Testes HTTP com MySQL real                       | 9 aprovados.                                                  |
| Migrações no banco local                         | Aplicadas e reexecutadas sem duplicar esquema/dados.          |
| Lint do front-end                                | Aprovado, sem erros.                                          |
| Testes de utilitários do front-end               | 3 aprovados.                                                  |
| Build de produção                                | Gerado com Vite e CSP para a origem da API.                   |
| Playwright no build de produção                  | 2 cenários aprovados.                                         |
| Capturas desktop e celular                       | Conferidas; menu móvel fechado fica oculto e não recebe foco. |
| Auditoria na instalação npm                      | Nenhuma vulnerabilidade reportada nos dois projetos.          |
| Health e readiness em produção                   | HTTP 200; conexão do Render com a Aiven confirmada.            |
| Swagger UI em produção                           | HTTP 200 em `/api-docs`.                                      |
| CORS em produção                                 | Preflight HTTP 204 para a origem exata da Vercel.             |
| Fluxo público completo                           | Cadastro 201; chamado assumido, comentado e concluído.        |
| Navegador no front-end público                   | Login, listagem e selo `Concluído` verificados.               |

São **27 testes/cenários automatizados aprovados** entre os dois repositórios.

Os testes de integração cobrem hash, JWT inválido/expirado, e-mail duplicado, proibição de elevação de perfil, acesso ao chamado de outro cliente, edição por versão, transições de status, comentários, concorrência, filtros, CORS, documentação, erros e limite de autenticação.

O teste de navegador usa duas sessões distintas e dados reais: cliente cadastra e abre → técnico assume e responde → técnico conclui → cliente consulta a solução. Também verifica recarga, texto semelhante a script exibido sem execução, visualização em celular, menu fechado e sessão expirada. A resposta de expiração é simulada no navegador; o JWT expirado é verificado de verdade nos testes HTTP.

## Como acessar

- Front-end público: `https://helpdesk-befinkler.vercel.app`.
- API pública: `https://helpdesk-api-befinkler.onrender.com`.
- Swagger público: `https://helpdesk-api-befinkler.onrender.com/api-docs`.
- Credenciais de demonstração: arquivo privado `.local/ACESSO_PRODUCAO.txt` no back-end.
- Front-end: `http://localhost:5173`.
- API: `http://localhost:3000`.
- Swagger: `http://localhost:3000/api-docs`.
- MySQL local exclusivo: `127.0.0.1:3307`.
- Credenciais do técnico: arquivo privado `.local/ACESSO_LOCAL.txt` no back-end.
- Clientes: cadastro pela interface.

Após reiniciar a máquina, execute `npm run db:local` e `npm run dev` no back-end, e `npm run dev` no front-end. A origem do front-end deve ser `localhost`, exatamente como definida em `FRONTEND_URL`.

## Git e publicação

O histórico usa `feature/implementacao-api` e `feature/implementacao-web`, com commits em português, integração em `develop` e promoção para `main` nos respectivos repositórios. As três branches foram publicadas no GitHub; Render e Vercel acompanham `main`.

O banco Aiven usa TLS com CA verificada e o Render aceita CORS somente do domínio estável da Vercel. O plano gratuito do Render pode suspender a instância por inatividade e atrasar a primeira requisição; após a inicialização, o fluxo funciona normalmente.

## Guias

- API e banco: [DEPLOY_API.md](DEPLOY_API.md).
- Versionamento: [FLUXO_GIT.md](FLUXO_GIT.md).
- Vercel: `docs/HOSPEDAGEM_VERCEL.md` no repositório do front-end.
