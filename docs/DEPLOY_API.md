# Hospedagem da API — Aiven e Render

O front-end será hospedado na Vercel. A API Express permanece como serviço independente no Render, conectada ao MySQL gerenciado na Aiven.

## 1. Preparar a versão

Confirme os testes, o lockfile versionado e a integração da feature em develop. Para produção, publique os commits no GitHub e faça a integração de develop em main por pull request. O Render deve acompanhar a branch que contém a versão validada, preferencialmente main.

Nunca envie `.env`, `.local`, certificados privados ou arquivos de credenciais ao GitHub.

## 2. Criar o MySQL na Aiven

1. Crie um serviço MySQL e um banco dedicado, por exemplo `helpdesk`.
2. Anote host, porta, usuário e senha fornecidos pelo painel.
3. Baixe a CA de conexão do serviço. A aplicação exige TLS verificado em produção.
4. Use um usuário com permissões no banco HelpDesk. Migrações precisam de DDL; a aplicação precisa das operações de dados utilizadas pelos models.
5. Considere o limite de conexões do plano ao definir `DB_POOL_LIMIT`; inicialmente 5.

Para transformar a CA em Base64, no PowerShell, substitua o caminho pelo arquivo baixado:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes('C:\caminho\ca.pem'))
```

Copie o resultado para `DB_SSL_CA_BASE64`, sem aspas adicionais. Base64 é uma codificação de transporte; a verificação TLS continua obrigatória. [Conexão segura com a Aiven](https://aiven.io/docs/products/mysql/howto/connect-from-mysql-workbench).

## 3. Aplicar migrações sem alterar o ambiente local

Crie um arquivo privado `.env.production` no back-end, que já é ignorado pelo Git, com a configuração do banco remoto, `NODE_ENV=production`, as origens HTTPS, JWT e CA. Não substitua o `.env` usado no desenvolvimento.

```powershell
node --env-file=.env.production scripts/migrate.js
node --env-file=.env.production scripts/setup-technician.js
```

O segundo comando exige as variáveis `SETUP_TECHNICIAN_*` nesse arquivo. Ele cria a conta técnica uma única vez. Remova a senha de provisionamento depois e guarde a credencial de acesso com segurança. Não migre as senhas ou os dados de teste locais para produção.

## 4. Criar Web Service no Render

Conecte o repositório HelpDeskAPIBack e configure:

| Configuração      | Valor                                  |
| ----------------- | -------------------------------------- |
| Tipo              | Web Service                            |
| Runtime           | Node                                   |
| Branch            | main, após integrar a versão validada  |
| Root Directory    | Raiz do repositório                    |
| Build Command     | `npm ci`                               |
| Start Command     | `npm start`                            |
| Health Check Path | `/health/ready`                        |
| Node              | 24, conforme `.node-version` e engines |

O servidor escuta `0.0.0.0` e a porta `process.env.PORT`. Não fixe a porta pública no código. [Guia de Express no Render](https://render.com/docs/deploy-node-express-app).

Defina as variáveis:

```dotenv
NODE_ENV=production
FRONTEND_URL=https://DOMINIO-ESTAVEL-DO-FRONT.vercel.app
API_PUBLIC_URL=https://DOMINIO-DA-API.onrender.com
DB_HOST=HOST_FORNECIDO_PELA_AIVEN
DB_PORT=PORTA_FORNECIDA_PELA_AIVEN
DB_NAME=helpdesk
DB_USER=USUARIO_DO_BANCO
DB_PASSWORD=SENHA_PRIVADA
DB_SSL=true
DB_SSL_CA_BASE64=CA_CODIFICADA_EM_BASE64
DB_POOL_LIMIT=5
JWT_SECRET=SEGREDO_ALEATORIO_GERADO_PARA_PRODUCAO
JWT_EXPIRES_IN=1h
JWT_ISSUER=helpdesk-api
JWT_AUDIENCE=helpdesk-web
BCRYPT_ROUNDS=12
TRUST_PROXY=1
```

Os valores em maiúsculas são marcadores, não credenciais prontas. Preencha as URLs reais sem barra final. `API_PUBLIC_URL` deve corresponder ao endereço do serviço. Confirme a quantidade de proxies confiáveis se a topologia for alterada.

Se ainda não houver domínio Vercel, reserve/defina o nome do projeto do front-end e finalize `FRONTEND_URL` assim que a Vercel confirmar o domínio estável. A API pode ser validada pela própria documentação enquanto isso; não libere CORS com `*`.

As migrações devem ocorrer antes do deploy que usa o novo esquema. Se o plano oferecer pre-deploy, configure `npm run db:migrate`; caso contrário, use o comando local com `.env.production`, como acima. Nunca use o helper `setup:local` no Render.

## 5. Verificar a API publicada

- `/health` responde com processo ativo.
- `/health/ready` responde 200, confirmando conexão com o banco.
- `/api-docs` carrega o Swagger.
- Cadastro e login funcionam na documentação; **Authorize** permite criar/consultar chamados.
- Uma rota privada sem token responde 401.
- O front-end da Vercel, após configurar a origem exata, consome a API sem erro de CORS.

O serviço gratuito do Render suspende após 15 minutos sem tráfego, e a retomada pode demorar aproximadamente um minuto. O front-end informa demora/indisponibilidade e permite tentar novamente. Um plano gratuito não oferece disponibilidade contínua sem suspensão. [Limites do Render](https://render.com/docs/free).

## 6. Manutenção

Publique mudanças por feature → develop → main. Execute testes antes da integração final, aplique migrações compatíveis e confira o deploy. Não altere migrações aplicadas, não execute testes no banco principal e não inclua segredos nos logs.

O roteiro completo do front-end está em `docs/HOSPEDAGEM_VERCEL.md` no repositório HelpDeskAPIFront.
