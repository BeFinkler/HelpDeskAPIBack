# Fluxo Git do HelpDesk

Cada repositório possui histórico independente. A organização desta entrega utiliza:

```text
main → develop → feature/implementacao-api  → develop   (back-end)
main → develop → feature/implementacao-web  → develop   (front-end)
```

As features recebem commits pequenos, com mensagens em português, agrupando estrutura, funcionalidades, testes e documentação. A integração em develop usa merge com `--no-ff` para preservar o marco da feature.

`main` permanece como base de produção. Após a validação local e a publicação autorizada dos commits no GitHub, a versão pode ser integrada de develop em main por pull request e conectada aos serviços de hospedagem.

## Próxima funcionalidade

Execute separadamente no repositório afetado:

```powershell
git switch develop
git switch -c feature/nome-da-funcionalidade
```

Implemente, verifique a alteração e adicione somente os arquivos pertinentes:

```powershell
git add caminho/do/arquivo
git commit -m "funcionalidade: descreve a alteração em português"
```

Depois dos testes:

```powershell
git switch develop
git merge --no-ff feature/nome-da-funcionalidade -m "integracao: adiciona a funcionalidade em develop"
```

Não versionar `.env`, `.local`, `node_modules`, dados MySQL ou senhas. Consultar `git status`, `git diff --cached` e os testes antes de cada integração.

O trabalho local não publica branches automaticamente. Para preparar a hospedagem, envie as branches desejadas ao GitHub com `git push -u origin develop` e `git push -u origin NOME_DA_FEATURE`; depois crie o pull request develop → main. A branch escolhida no serviço de deploy precisa conter o código validado.
