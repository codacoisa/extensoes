# GitHub Tools

Userscripts para melhorar pequenos fluxos no GitHub.

## Fork Finder

Adiciona um botão **Fork Finder** ao lado do botão **Fork** nas páginas de
repositórios. O botão abre o repositório atual em uma nova guia no
[Fork Finder](https://forkfinder.getinfotoyou.com/), usando exatamente as
mesmas cores e o mesmo estilo dos botões originais do GitHub (Unwatch, Fork,
Star), acompanhando os temas claro e escuro.

Exemplo:

```text
https://github.com/alienator88/Pearcleaner
→ https://forkfinder.getinfotoyou.com/repo/alienator88/pearcleaner
```

## Tamanho do repositório

Exibe o tamanho do repositório ao lado do nome do repositório no cabeçalho da
página (ex.: `15.2 MB`), usando a API pública do GitHub. O valor é armazenado
em cache por 24 horas para não exceder o limite de requisições da API
(60/h sem autenticação). Repositórios privados não têm o tamanho exibido,
pois exigiriam um token de acesso.

Semelhante ao script
[🤠 Github enhanced assistant warehouse display size](https://greasyfork.org/scripts/502291).

### Instalação

1. Instale um gerenciador de userscripts compatível com seu navegador, como
   Tampermonkey ou Userscripts.
2. Abra o arquivo
   [`github-tools.user.js`](https://raw.githubusercontent.com/codacoisa/github-tools/main/github-tools.user.js).
3. Confirme a instalação no gerenciador de userscripts.

Versão atual: `2026-08-01-14:30`.
