// ==UserScript==
// @name         GitHub Tools
// @namespace    https://github.com/codacoisa/github-tools
// @version      2026-08-01-16:15
// @description  Adiciona customizações ao GitHub.
// @author       codacoisa
// @match        https://github.com/*/*
// @icon         https://github.githubassets.com/favicons/favicon.svg
// @grant        none
// @run-at       document-idle
// @downloadURL  https://raw.githubusercontent.com/codacoisa/github-tools/main/github-tools.user.js
// @updateURL    https://raw.githubusercontent.com/codacoisa/github-tools/main/github-tools.user.js
// ==/UserScript==

(function () {
  'use strict';

  const BUTTON_MARKER = 'data-fork-finder-button';
  const SIZE_MARKER = 'data-repo-size-label';
  // v2 invalida resultados nulos gravados pela implementação anterior, que
  // podia esconder o tamanho mesmo depois de o cabeçalho ser encontrado.
  const SIZE_CACHE_KEY = 'github-tools:repo-size-cache:v2';
  const SIZE_CACHE_TTL = 24 * 60 * 60 * 1000;
  const SIZE_RATE_LIMIT_TTL = 60 * 60 * 1000;
  const FORK_FINDER_URL = 'https://forkfinder.getinfotoyou.com/repo';

  // Octicon "database", usado pelo GitHub para indicar tamanho/armazenamento.
  const DATABASE_ICON =
    'M1 3.5c0-.626.292-1.165.7-1.59.406-.422.956-.767 1.579-1.041C4.525.32 6.195 0 8 0c1.805 0 3.475.32 4.722.869.622.274 1.172.62 1.578 1.04.408.426.7.965.7 1.591v9c0 .626-.292 1.165-.7 1.59-.406.422-.956.767-1.579 1.041C11.476 15.68 9.806 16 8 16c-1.805 0-3.475-.32-4.721-.869-.623-.274-1.173-.62-1.579-1.04C1.292 13.665 1 13.126 1 12.5v-9Zm1.5 0c0 .133.058.318.282.551.227.237.591.483 1.101.707C4.898 5.205 6.353 5.5 8 5.5c1.646 0 3.101-.295 4.118-.742.508-.224.873-.471 1.1-.708.224-.232.282-.417.282-.55 0-.133-.058-.318-.282-.551-.227-.237-.591-.483-1.101-.707C11.102 1.795 9.647 1.5 8 1.5c-1.646 0-3.101.295-4.118.742-.508.224-.873.471-1.1.708-.224.232-.282.417-.282.55Zm0 4.5c0 .133.058.318.282.551.227.237.591.483 1.101.707C4.898 9.705 6.353 10 8 10c1.646 0 3.101-.295 4.118-.742.508-.224.873-.471 1.1-.708.224-.232.282-.417.282-.55V5.724c-.241.15-.503.286-.778.407C11.475 6.68 9.805 7 8 7c-1.805 0-3.475-.32-4.721-.869a6.15 6.15 0 0 1-.779-.407v2.276Zm0 2.225V12.5c0 .133.058.318.282.55.227.233.592.484 1.1.708 1.016.447 2.471.742 4.118.742 1.647 0 3.102-.295 4.117-.742.51-.224.874-.475 1.101-.707.224-.233.282-.418.282-.551v-2.275c-.241.15-.503.285-.778.406C11.475 11.18 9.805 11.5 8 11.5c-1.805 0-3.475-.32-4.721-.869a6.327 6.327 0 0 1-.779-.406Z';

  // Usa os tokens atuais do Primer e mantém os tokens antigos como fallback.
  // Isso acompanha os temas claro e escuro sem fixar uma cor específica.
  const style = document.createElement('style');
  style.textContent = [
    `a[${BUTTON_MARKER}] {`,
    `  background-color: var(--button-default-bgColor-rest, var(--color-btn-bg, #f6f8fa));`,
    `  color: var(--button-default-fgColor-rest, var(--color-btn-text, #24292f));`,
    `  border-color: var(--button-default-borderColor-rest, var(--color-btn-border, rgba(27, 31, 36, 0.15)));`,
    `  box-shadow: var(--button-default-shadow-resting, none), var(--button-default-shadow-inset, var(--color-btn-shadow-inset, inset 0 1px 0 rgba(255, 255, 255, 0.25)));`,
    `  font-family: var(--fontStack-sansSerif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);`,
    `  font-size: var(--text-body-size-medium, 14px);`,
    `  font-weight: var(--base-text-weight-medium, 500);`,
    `  line-height: var(--text-body-lineHeight-medium, 1.5);`,
    `  text-decoration: none;`,
    `  white-space: nowrap;`,
    `  transition: 80ms cubic-bezier(0.33, 1, 0.68, 1);`,
    `  transition-property: color, background-color, box-shadow, border-color;`,
    `}`,
    `a[${BUTTON_MARKER}]:hover {`,
    `  background-color: var(--button-default-bgColor-hover, var(--color-btn-hover-bg, #f3f4f6));`,
    `  border-color: var(--button-default-borderColor-hover, var(--color-btn-hover-border, rgba(27, 31, 36, 0.15)));`,
    `  text-decoration: none;`,
    `}`,
    `a[${BUTTON_MARKER}]:active {`,
    `  background-color: var(--button-default-bgColor-active, var(--color-btn-active-bg, hsla(220, 14%, 94%, 1)));`,
    `  border-color: var(--button-default-borderColor-active, var(--color-btn-active-border, rgba(27, 31, 36, 0.15)));`,
    `}`,
  ].join('\n');
  document.head.appendChild(style);

  function getRepository() {
    const [owner, repository] = location.pathname.split('/').filter(Boolean);

    if (!owner || !repository) return null;

    return {
      owner: owner.toLowerCase(),
      repository: repository.toLowerCase(),
    };
  }

  function findForkControl() {
    const candidates = document.querySelectorAll([
      '#fork-button',
      '[data-testid="fork-button"]',
      'button[aria-label*="fork" i]',
      'a[href$="/fork"]',
      'a[href$="/forks"]',
    ].join(','));

    const matches = [...candidates].filter((element) => {
      const label = `${element.textContent || ''} ${element.getAttribute('aria-label') || ''}`;
      return /\bfork\b/i.test(label);
    });

    if (matches.length === 0) return null;

    // Prefere controles que são botões de verdade do GitHub (evita, por
    // exemplo, o link "51 forks" da barra lateral, que não é um botão).
    const buttonLike = matches.find((element) => {
      const className = element.className || '';
      return element.matches('button, summary') || /(^|\s)(Button|btn)(\s|$)/.test(className);
    });

    return buttonLike || matches[0];
  }

  function createButton(forkControl, repository) {
    const link = document.createElement('a');
    link.setAttribute(BUTTON_MARKER, '');
    link.href = `${FORK_FINDER_URL}/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.repository)}`;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.className = forkControl.className;
    [...link.classList].forEach((className) => {
      if (/^(?:ButtonGroup|BtnGroup)-item/.test(className)) {
        link.classList.remove(className);
      }
    });
    link.setAttribute('aria-label', `Abrir ${repository.owner}/${repository.repository} no Fork Finder`);
    link.textContent = 'Fork Finder';
    link.style.whiteSpace = 'nowrap';
    copyButtonTypography(forkControl, link);

    if (forkControl.hasAttribute('data-view-component')) {
      link.setAttribute('data-view-component', 'true');
    }

    return link;
  }

  // O GitHub aplica a tipografia do botão nativo com regras que podem variar
  // entre componentes e tamanhos. Copiar os valores calculados evita que um
  // link herde uma fonte, peso ou altura de linha diferentes.
  function copyButtonTypography(source, target) {
    if (!source || !target) return;

    const computed = window.getComputedStyle(source);
    ['font-family', 'font-size', 'font-weight', 'font-style', 'line-height', 'letter-spacing'].forEach((property) => {
      target.style.setProperty(property, computed.getPropertyValue(property));
    });
  }

  function addButton() {
    const existingButton = document.querySelector(`a[${BUTTON_MARKER}]`);
    const repository = getRepository();

    if (!repository) {
      existingButton?.remove();
      return;
    }

    const expectedUrl = `${FORK_FINDER_URL}/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.repository)}`;
    if (existingButton) {
      if (existingButton.href !== expectedUrl) existingButton.href = expectedUrl;
      const forkControl = findForkControl();
      if (forkControl) copyButtonTypography(forkControl, existingButton);
      return;
    }

    const forkControl = findForkControl();
    if (!forkControl) return;

    const link = createButton(forkControl, repository);
    const forkGroup = forkControl.closest('.ButtonGroup, .BtnGroup');
    const details = forkControl.closest('details');
    const insertionTarget = details || forkGroup || forkControl;
    const listItem = insertionTarget.closest('li');

    if (listItem) {
      const newListItem = document.createElement('li');
      newListItem.setAttribute('data-fork-finder-container', '');
      newListItem.append(link);
      listItem.after(newListItem);
      return;
    }

    link.style.marginInlineStart = 'var(--base-size-8, 8px)';
    insertionTarget.after(link);
  }

  // ---- Tamanho do repositório ----

  function formatRepositorySize(sizeInKB) {
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const size = sizeInKB * 1024;

    if (size < 1024) return `${size} B`;

    const index = Math.min(Math.floor(Math.log(size) / Math.log(1024)), sizes.length - 1);
    return `${(size / Math.pow(1024, index)).toFixed(1)} ${sizes[index]}`;
  }

  function readSizeCache(key) {
    try {
      const data = JSON.parse(localStorage.getItem(SIZE_CACHE_KEY) || '{}');
      const entry = data[key];

      if (!entry) return undefined;

      const ttl = entry.size === null ? SIZE_RATE_LIMIT_TTL : SIZE_CACHE_TTL;
      if (Date.now() - entry.timestamp < ttl) return entry.size;
    } catch (error) {
      // cache corrompido; ignora
    }

    return undefined;
  }

  function writeSizeCache(key, size) {
    try {
      const data = JSON.parse(localStorage.getItem(SIZE_CACHE_KEY) || '{}');
      data[key] = { size, timestamp: Date.now() };
      localStorage.setItem(SIZE_CACHE_KEY, JSON.stringify(data));
    } catch (error) {
      // armazenamento indisponível; ignora
    }
  }

  const sizeMemoryCache = new Map();
  const sizePromises = new Map();

  function fetchRepositorySize(owner, repository) {
    const key = `${owner}/${repository}`;

    if (sizeMemoryCache.has(key)) return Promise.resolve(sizeMemoryCache.get(key));

    const cached = readSizeCache(key);
    if (cached !== undefined) {
      sizeMemoryCache.set(key, cached);
      return Promise.resolve(cached);
    }

    if (sizePromises.has(key)) return sizePromises.get(key);

    const promise = (async () => {
      let size = null;

      try {
        const response = await fetch(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}`, {
          headers: { Accept: 'application/vnd.github+json' },
        });

        if (!response.ok) {
          writeSizeCache(key, null);
          size = null;
          return size;
        }

        const data = await response.json();

        if (Number.isFinite(data.size) && data.size >= 0) size = data.size;

        // A API respondeu (tamanho válido, repositório privado, limite de
        // taxa etc.): persiste para evitar novas requisições em seguida.
        writeSizeCache(key, size);
      } catch (error) {
        // Rede indisponível: não persiste, permitindo tentar novamente na
        // próxima visita sem guardar um resultado errado.
      }

      sizeMemoryCache.set(key, size);
      return size;
    })();

    sizePromises.set(key, promise);
    promise.finally(() => sizePromises.delete(key));

    return promise;
  }

  function createSizeIcon() {
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('aria-hidden', 'true');
    icon.setAttribute('viewBox', '0 0 16 16');
    icon.setAttribute('width', '16');
    icon.setAttribute('height', '16');
    icon.setAttribute('fill', 'currentColor');
    icon.setAttribute('data-view-component', 'true');
    icon.classList.add('octicon', 'octicon-database', 'mr-1');

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', DATABASE_ICON);
    path.setAttribute('fill-rule', 'evenodd');
    icon.appendChild(path);

    return icon;
  }

  function findRepoNameLink() {
    const repository = getRepository();
    if (!repository) return null;

    const expectedPath = `/${repository.owner}/${repository.repository}`;
    const candidates = document.querySelectorAll([
      '#repository-container-header strong a',
      '#repository-container-header a[href]',
      '#repo-title-component a[href]',
      '#repo-title-component h1 a',
      '[data-testid="repo-title-component"] a',
      'h1 a',
    ].join(','));

    for (const link of candidates) {
      const href = (link.getAttribute('href') || '')
        .split('#')[0]
        .split('?')[0]
        .replace(/\/+$/, '')
        .toLowerCase();
      if (href === expectedPath || href.endsWith(expectedPath)) return link;
    }

    return null;
  }

  async function addRepositorySize() {
    const repository = getRepository();
    if (!repository) return;

    const cacheKey = `${repository.owner}/${repository.repository}`;

    // Se já sabemos que o tamanho está indisponível (erro ou limite de API),
    // não recria o rótulo nem refaz a requisição. Depois que o cache em
    // memória é preenchido, ele é a fonte confiável (evita reler o
    // localStorage a cada ciclo do MutationObserver).
    if (sizeMemoryCache.has(cacheKey)) {
      if (sizeMemoryCache.get(cacheKey) === null) return;
    } else if (readSizeCache(cacheKey) === null) {
      return;
    }

    const nameLink = findRepoNameLink();
    const existing = document.querySelector(`[${SIZE_MARKER}]`);

    if (!nameLink) {
      existing?.remove();
      return;
    }

    // Já existe um rótulo válido do repositório atual: nada a fazer.
    if (existing && existing.dataset.repoKey === cacheKey && existing.isConnected) return;

    // Rótulo de outro repositório (navegação SPA) ou órfão: remove e recria.
    existing?.remove();

    const label = document.createElement('span');
    label.setAttribute(SIZE_MARKER, '');
    label.dataset.repoKey = cacheKey;
    label.className = 'Label Label--info Label--accent v-align-middle ml-1 tooltipped tooltipped-s';
    label.setAttribute('aria-label', 'Tamanho do repositório');
    label.textContent = '…';
    nameLink.after(label);

    const size = await fetchRepositorySize(repository.owner, repository.repository);
    if (!label.isConnected) return;

    if (size === null) {
      label.remove();
      return;
    }

    const text = formatRepositorySize(size);
    label.textContent = '';
    label.append(createSizeIcon(), document.createTextNode(text));
    label.title = `Tamanho do repositório: ${text}`;
  }

  // ---- Agendamento das atualizações ----

  let scheduled = false;

  function scheduleUpdate() {
    if (scheduled) return;
    scheduled = true;

    requestAnimationFrame(() => {
      scheduled = false;
      addButton();
      addRepositorySize();
    });
  }

  addButton();
  addRepositorySize();

  new MutationObserver(scheduleUpdate).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  document.addEventListener('turbo:load', scheduleUpdate);
  document.addEventListener('pjax:end', scheduleUpdate);
}());
