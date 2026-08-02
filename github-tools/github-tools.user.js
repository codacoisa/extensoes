// ==UserScript==
// @name         GitHub Tools
// @namespace    https://github.com/codacoisa/extensoes/tree/main/github-tools
// @version      2026-08-01-22:19
// @description  Adiciona customizações ao GitHub.
// @author       lourencosv
// @contributor  Codex <codex@openai.com>
// @contributor  Claude <noreply@anthropic.com>
// @match        https://github.com/*/*
// @icon         https://github.githubassets.com/favicons/favicon.svg
// @grant        none
// @run-at       document-idle
// @downloadURL  https://raw.githubusercontent.com/codacoisa/extensoes/main/github-tools/github-tools.user.js
// @updateURL    https://raw.githubusercontent.com/codacoisa/extensoes/main/github-tools/github-tools.user.js
// ==/UserScript==

(function () {
  'use strict';

  const BUTTON_MARKER = 'data-fork-finder-button';
  const CLONE_BUTTON_MARKER = 'data-github-tools-clone-button';
  const FILE_ICON_MARKER = 'data-github-tools-file-icon';
  const SIZE_MARKER = 'data-repo-size-label';
  // v2 invalida resultados nulos gravados pela implementação anterior, que
  // podia esconder o tamanho mesmo depois de o cabeçalho ser encontrado.
  const SIZE_CACHE_KEY = 'github-tools:repo-size-cache:v2';
  const SIZE_CACHE_TTL = 24 * 60 * 60 * 1000;
  const SIZE_RATE_LIMIT_TTL = 60 * 60 * 1000;
  const FORK_FINDER_URL = 'https://forkfinder.getinfotoyou.com/repo';
  const FILE_ICON_BASE_URL = 'https://raw.githubusercontent.com/PKief/vscode-material-icon-theme/main/icons';

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
    `  box-sizing: border-box;`,
    `  display: inline-flex;`,
    `  align-items: center;`,
    `  justify-content: center;`,
    `  vertical-align: middle;`,
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
    `button[${CLONE_BUTTON_MARKER}], a[${CLONE_BUTTON_MARKER}] {`,
    `  display: inline-flex;`,
    `  align-items: center;`,
    `  justify-content: center;`,
    `  min-width: 32px;`,
    `  min-height: 32px;`,
    `  padding: 5px 8px;`,
    `  margin-inline-start: var(--base-size-8, 8px);`,
    `}`,
    `button[${CLONE_BUTTON_MARKER}] svg, a[${CLONE_BUTTON_MARKER}] svg {`,
    `  display: block;`,
    `  flex: 0 0 auto;`,
    `}`,
    `img[${FILE_ICON_MARKER}] {`,
    `  width: 16px !important;`,
    `  height: 16px !important;`,
    `  margin: 0 4px 0 0 !important;`,
    `  object-fit: scale-down;`,
    `  vertical-align: text-bottom;`,
    `  flex: 0 0 auto;`,
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

  function findStandaloneControl(excludedControl) {
    const candidates = document.querySelectorAll([
      '#repository-container-header button',
      '#repository-container-header a[role="button"]',
      '#repo-title-component button',
      '#repo-title-component a[role="button"]',
      'button.Button',
      'button',
    ].join(','));

    return [...candidates].find((element) => {
      if (element === excludedControl) return false;
      if (element.closest('.ButtonGroup, .BtnGroup, details')) return false;
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    }) || null;
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
    normalizeButtonStyles(forkControl, link);

    if (forkControl.hasAttribute('data-view-component')) {
      link.setAttribute('data-view-component', 'true');
    }

    return link;
  }

  function normalizeButtonStyles(source, target) {
    copyButtonStyles(source, target);

    const standaloneControl = findStandaloneControl(source);
    if (standaloneControl) {
      target.style.borderRadius = window.getComputedStyle(standaloneControl).borderRadius;
    } else if (source.closest('.ButtonGroup, .BtnGroup, details')) {
      target.style.borderRadius = 'var(--borderRadius-medium, 6px)';
    }
    target.style.borderStyle = 'solid';
    target.style.borderWidth = '1px';
  }

  // O GitHub aplica as dimensões do botão nativo com regras que podem variar
  // entre componentes e tamanhos. Copiar os valores calculados evita que um
  // link tenha altura, padding, raio ou tipografia diferentes.
  function copyButtonStyles(source, target) {
    if (!source || !target) return;

    const computed = window.getComputedStyle(source);
    [
      'font-family',
      'font-size',
      'font-weight',
      'font-style',
      'line-height',
      'letter-spacing',
      'display',
      'align-items',
      'justify-content',
      'box-sizing',
      'height',
      'min-height',
      'padding',
      'border-radius',
      'border-style',
      'border-width',
      'vertical-align',
      'gap',
    ].forEach((property) => {
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
      if (forkControl) normalizeButtonStyles(forkControl, existingButton);
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

  function getCloneCommand() {
    const repository = getRepository();
    if (!repository) return null;

    return {
      key: `${repository.owner}/${repository.repository}`,
      command: `git clone --recurse-submodules https://github.com/${repository.owner}/${repository.repository}.git`,
    };
  }

  function findCodeButton() {
    const candidates = document.querySelectorAll([
      '#repository-container-header button',
      '#repository-container-header summary',
      '#repo-title-component button',
      'button',
      'summary',
      'a[role="button"]',
    ].join(','));

    return [...candidates].find((element) => {
      const text = (element.textContent || '').replace(/\s+/g, ' ').trim();
      const label = (element.getAttribute('aria-label') || '').trim();
      return /^(?:code|código)$/i.test(text)
        || /^(?:code|código)(?:\s+(?:menu|button))?$/i.test(label);
    }) || null;
  }

  function createCopyIcon() {
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('aria-hidden', 'true');
    icon.setAttribute('focusable', 'false');
    icon.setAttribute('viewBox', '0 0 16 16');
    icon.setAttribute('width', '16');
    icon.setAttribute('height', '16');
    icon.setAttribute('fill', 'currentColor');
    icon.classList.add('octicon', 'octicon-copy');

    const paths = [
      'M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z',
      'M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5c.138 0 .25-.112.25-.25v-7.5a.25.25 0 0 0-.25-.25Z',
    ];

    paths.forEach((pathData) => {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', pathData);
      icon.appendChild(path);
    });

    return icon;
  }

  async function copyText(text) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    textarea.remove();

    if (!copied) throw new Error('Não foi possível copiar o comando');
  }

  function showToast(message, isError = false) {
    document.querySelector('[data-github-tools-toast]')?.remove();

    const toast = document.createElement('div');
    toast.setAttribute('data-github-tools-toast', '');
    toast.setAttribute('role', 'status');
    toast.textContent = message;
    Object.assign(toast.style, {
      position: 'fixed',
      top: '16px',
      right: '16px',
      zIndex: '9999',
      maxWidth: 'min(520px, calc(100vw - 32px))',
      padding: '8px 12px',
      border: '1px solid var(--borderColor-default, rgba(27, 31, 36, 0.15))',
      borderRadius: '6px',
      background: isError ? 'var(--bgColor-danger-emphasis, #cf222e)' : 'var(--bgColor-success-emphasis, #1f883d)',
      color: 'var(--fgColor-onEmphasis, #fff)',
      boxShadow: '0 3px 8px rgba(31, 35, 40, 0.15)',
      font: '500 14px/1.4 var(--fontStack-sansSerif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif)',
    });
    document.body.appendChild(toast);
    window.setTimeout(() => toast.remove(), 2200);
  }

  function addCloneButton() {
    const clone = getCloneCommand();
    const existing = document.querySelector(`[${CLONE_BUTTON_MARKER}]`);

    if (!clone) {
      existing?.remove();
      return;
    }

    const codeButton = findCodeButton();
    if (!codeButton) {
      if (existing?.dataset.repoKey !== clone.key) existing?.remove();
      return;
    }

    if (existing && existing.dataset.repoKey === clone.key) {
      if (existing.previousElementSibling !== codeButton) codeButton.after(existing);
      existing.title = clone.command;
      return;
    }
    existing?.remove();

    const copyButton = codeButton.cloneNode(true);
    copyButton.setAttribute(CLONE_BUTTON_MARKER, '');
    copyButton.dataset.repoKey = clone.key;
    copyButton.removeAttribute('id');
    copyButton.removeAttribute('aria-haspopup');
    copyButton.removeAttribute('aria-expanded');
    copyButton.removeAttribute('aria-describedby');
    copyButton.removeAttribute('href');
    copyButton.setAttribute('aria-label', 'Copiar comando de clone');
    copyButton.title = clone.command;
    if (copyButton instanceof HTMLButtonElement) copyButton.type = 'button';

    const content = copyButton.querySelector('[data-component="buttonContent"]');
    if (content) {
      content.replaceChildren(createCopyIcon());
    } else {
      copyButton.replaceChildren(createCopyIcon());
    }

    copyButton.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();

      try {
        await copyText(clone.command);
        showToast('Comando de clone copiado');
      } catch (error) {
        showToast('Não foi possível copiar o comando', true);
      }
    });

    codeButton.after(copyButton);
  }

  const FILE_ICON_BY_EXTENSION = {
    js: 'javascript',
    jsx: 'react',
    ts: 'typescript',
    tsx: 'react_ts',
    mjs: 'javascript',
    cjs: 'javascript',
    json: 'json',
    html: 'html',
    htm: 'html',
    css: 'css',
    scss: 'sass',
    sass: 'sass',
    less: 'less',
    md: 'markdown',
    mdx: 'mdx',
    py: 'python',
    rb: 'ruby',
    go: 'go',
    rs: 'rust',
    java: 'java',
    kt: 'kotlin',
    kts: 'kotlin',
    php: 'php',
    vue: 'vue',
    svelte: 'svelte',
    sql: 'database',
    graphql: 'graphql',
    gql: 'graphql',
    sh: 'console',
    bash: 'console',
    zsh: 'console',
    ps1: 'powershell',
    yml: 'yaml',
    yaml: 'yaml',
    xml: 'xml',
    csv: 'csv',
    pdf: 'pdf',
    zip: 'zip',
    gz: 'zip',
    png: 'image',
    jpg: 'image',
    jpeg: 'image',
    gif: 'image',
    webp: 'image',
    svg: 'svg',
    ico: 'image',
    mp3: 'audio',
    wav: 'audio',
    mp4: 'video',
    mov: 'video',
    lock: 'lock',
  };

  const FILE_ICON_BY_NAME = {
    dockerfile: 'docker',
    '.dockerignore': 'docker',
    '.env': 'tune',
    '.gitignore': 'git',
    '.gitattributes': 'git',
    '.gitmodules': 'git',
    'package.json': 'nodejs',
    'package-lock.json': 'nodejs',
    'pnpm-lock.yaml': 'nodejs',
    'yarn.lock': 'nodejs',
  };

  function getFileNameFromLink(link) {
    try {
      const pathname = new URL(link.href, location.href).pathname;
      return decodeURIComponent(pathname.split('/').filter(Boolean).pop() || '').toLowerCase();
    } catch (error) {
      return '';
    }
  }

  function getFileIconName(fileName, isDirectory) {
    if (isDirectory) return 'folder';
    if (FILE_ICON_BY_NAME[fileName]) return FILE_ICON_BY_NAME[fileName];

    const extension = fileName.includes('.') ? fileName.split('.').pop() : '';
    return FILE_ICON_BY_EXTENSION[extension] || 'file';
  }

  function addFileIcons() {
    const entries = document.querySelectorAll([
      '.react-directory-truncate[href]',
      '.react-directory-truncate a[href]',
      '.js-navigation-open[href]',
    ].join(','));

    entries.forEach((entry) => {
      const link = entry.matches('a[href]') ? entry : entry.querySelector('a[href]');
      if (!link) return;

      const row = link.closest('tr, [role="row"], .Box-row, .js-navigation-item, li') || link.parentElement;
      const icon = row?.querySelector('svg:not([data-github-tools-file-icon-fallback])');
      if (!icon || icon.closest(`[${FILE_ICON_MARKER}]`)) return;

      const fileName = getFileNameFromLink(link);
      if (!fileName) return;

      const isDirectory = /\/tree\//i.test(link.pathname)
        || icon.classList.contains('octicon-file-directory-fill')
        || icon.classList.contains('icon-directory');
      const image = document.createElement('img');
      image.setAttribute(FILE_ICON_MARKER, '');
      image.setAttribute('aria-hidden', 'true');
      image.alt = '';
      image.src = `${FILE_ICON_BASE_URL}/${getFileIconName(fileName, isDirectory)}.svg`;

      const fallback = icon.cloneNode(true);
      fallback.setAttribute('data-github-tools-file-icon-fallback', '');
      image.addEventListener('error', () => {
        if (image.isConnected) image.replaceWith(fallback);
      }, { once: true });

      icon.replaceWith(image);
    });
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
    icon.style.flex = '0 0 auto';
    icon.style.verticalAlign = 'middle';
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
    label.style.display = 'inline-flex';
    label.style.alignItems = 'center';
    label.style.verticalAlign = 'middle';
    label.style.transform = 'translateY(-1px)';
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
      addCloneButton();
      addFileIcons();
      addRepositorySize();
    });
  }

  addButton();
  addCloneButton();
  addFileIcons();
  addRepositorySize();

  new MutationObserver(scheduleUpdate).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  document.addEventListener('turbo:load', scheduleUpdate);
  document.addEventListener('pjax:end', scheduleUpdate);
}());
