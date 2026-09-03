# Homologação local — HelpDesk

Data: 03/09/2026.

## Resultado

API e front-end implementados e verificados localmente, com MySQL 8.0.46 real. A aplicação utiliza bancos separados para desenvolvimento e testes, sem alterar o banco do EventHub.

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

São **27 testes/cenários automatizados aprovados** entre os dois repositórios.

Os testes de integração cobrem hash, JWT inválido/expirado, e-mail duplicado, proibição de elevação de perfil, acesso ao chamado de outro cliente, edição por versão, transições de status, comentários, concorrência, filtros, CORS, documentação, erros e limite de autenticação.

O teste de navegador usa duas sessões distintas e dados reais: cliente cadastra e abre → técnico assume e responde → técnico conclui → cliente consulta a solução. Também verifica recarga, texto semelhante a script exibido sem execução, visualização em celular, menu fechado e sessão expirada. A resposta de expiração é simulada no navegador; o JWT expirado é verificado de verdade nos testes HTTP.

## Como acessar

- Front-end: `http://localhost:5173`.
- API: `http://localhost:3000`.
- Swagger: `http://localhost:3000/api-docs`.
- MySQL local exclusivo: `127.0.0.1:3307`.
- Credenciais do técnico: arquivo privado `.local/ACESSO_LOCAL.txt` no back-end.
- Clientes: cadastro pela interface.

Após reiniciar a máquina, execute `npm run db:local` e `npm run dev` no back-end, e `npm run dev` no front-end. A origem do front-end deve ser `localhost`, exatamente como definida em `FRONTEND_URL`.

## Git e publicação

O histórico usa `feature/implementacao-api` e `feature/implementacao-web`, com commits em português e integração em `develop` nos respectivos repositórios. Os commits são locais; a publicação no GitHub e a integração em main fazem parte da preparação do deploy.

Os serviços em nuvem ainda não foram criados ou homologados nesta entrega local. A configuração real de TLS com a Aiven, os domínios públicos, o CORS entre os serviços e a disponibilidade do Render devem ser conferidos durante a publicação. A validação local não representa certificação de ausência de qualquer defeito nem prova de disponibilidade em nuvem.

## Guias

- API e banco: [DEPLOY_API.md](DEPLOY_API.md).
- Versionamento: [FLUXO_GIT.md](FLUXO_GIT.md).
- Vercel: `docs/HOSPEDAGEM_VERCEL.md` no repositório do front-end.
