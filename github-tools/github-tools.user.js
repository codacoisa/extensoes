// ==UserScript==
// @name         GitHub Tools
// @namespace    https://github.com/codacoisa/extensoes/tree/main/github-tools
// @version      2026-08-02-04:41
// @description  Adiciona customizações ao GitHub.
// @author       lourencosv
// @contributor  Codex <codex@openai.com>
// @contributor  Claude <noreply@anthropic.com>
// @match        https://github.com/*/*
// @icon         https://github.githubassets.com/favicons/favicon.svg
// @grant        none
// @run-at       document-idle
// @downloadURL  https://github.com/codacoisa/extensoes/raw/refs/heads/main/github-tools/github-tools.user.js
// @updateURL    https://github.com/codacoisa/extensoes/raw/refs/heads/main/github-tools/github-tools.user.js
// ==/UserScript==

(function () {
  'use strict';

  const BUTTON_MARKER = 'data-fork-finder-button';
  const CLONE_BUTTON_MARKER = 'data-github-tools-clone-button';
  const FILE_ICON_MARKER = 'data-github-tools-file-icon';
  const SIZE_MARKER = 'data-repo-size-label';
  const SIZE_CACHE_KEY = 'github-tools:repo-size-cache:v2';
  const SIZE_CACHE_TTL = 24 * 60 * 60 * 1000;
  const SIZE_RATE_LIMIT_TTL = 60 * 60 * 1000;
  const FORK_FINDER_URL = 'https://forkfinder.getinfotoyou.com/repo';

  const DATABASE_ICON =
    'M1 3.5c0-.626.292-1.165.7-1.59.406-.422.956-.767 1.579-1.041C4.525.32 6.195 0 8 0c1.805 0 3.475.32 4.722.869.622.274 1.172.62 1.578 1.04.408.426.7.965.7 1.591v9c0 .626-.292 1.165-.7 1.59-.406.422-.956.767-1.579 1.041C11.476 15.68 9.806 16 8 16c-1.805 0-3.475-.32-4.721-.869-.623-.274-1.173-.62-1.579-1.04C1.292 13.665 1 13.126 1 12.5v-9Zm1.5 0c0 .133.058.318.282.551.227.237.591.483 1.101.707C4.898 5.205 6.353 5.5 8 5.5c1.646 0 3.101-.295 4.118-.742.508-.224.873-.471 1.1-.708.224-.232.282-.417.282-.55 0-.133-.058-.318-.282-.551-.227-.237-.591-.483-1.101-.707C11.102 1.795 9.647 1.5 8 1.5c-1.646 0-3.101.295-4.118.742-.508.224-.873.471-1.1.708-.224.232-.282.417-.282.55Zm0 4.5c0 .133.058.318.282.551.227.237.591.483 1.101.707C4.898 9.705 6.353 10 8 10c1.646 0 3.101-.295 4.118-.742.508-.224.873-.471 1.1-.708.224-.232.282-.417.282-.55V5.724c-.241.15-.503.286-.778.407C11.475 6.68 9.805 7 8 7c-1.805 0-3.475-.32-4.721-.869a6.15 6.15 0 0 1-.779-.407v2.276Zm0 2.225V12.5c0 .133.058.318.282.55.227.233.592.484 1.1.708 1.016.447 2.471.742 4.118.742 1.647 0 3.102-.295 4.117-.742.51-.224.874-.475 1.101-.707.224-.233.282-.418.282-.551v-2.275c-.241.15-.503.285-.778.406C11.475 11.18 9.805 11.5 8 11.5c-1.805 0-3.475-.32-4.721-.869a6.327 6.327 0 0 1-.779-.406Z';

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
    `span[${FILE_ICON_MARKER}] {`,
    `  display: inline-flex;`,
    `  align-items: center;`,
    `  justify-content: center;`,
    `  width: 16px;`,
    `  min-width: 16px;`,
    `  height: 16px;`,
    `  margin: 0 4px 0 0;`,
    `  line-height: 1;`,
    `  vertical-align: text-bottom;`,
    `  flex: 0 0 16px;`,
    `}`,
    `span[${FILE_ICON_MARKER}][data-icon-kind="folder"] {`,
    `  color: var(--fgColor-accent, var(--color-accent-fg, #0969da));`,
    `}`,
    `span[${FILE_ICON_MARKER}] .github-tools-file-icon-svg {`,
    `  display: block;`,
    `  width: 16px;`,
    `  height: 16px;`,
    `  fill: currentColor;`,
    `}`,
    `img[${FILE_ICON_MARKER}] {`,
    `  display: none !important;`,
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
      } catch {
        showToast('Não foi possível copiar o comando', true);
      }
    });

    codeButton.after(copyButton);
  }

  const faIcon = (className, kind = 'file') => Object.freeze({ className, kind });

  const INLINE_ICON_PATHS = Object.freeze({
    folder: ['0 0 512 512', 'M64 480H448c35.3 0 64-28.7 64-64V160c0-35.3-28.7-64-64-64H288c-10.1 0-19.6-4.7-25.6-12.8L243.2 57.6C231.1 41.5 212.1 32 192 32H64C28.7 32 0 60.7 0 96V416c0 35.3 28.7 64 64 64z'],
    code: ['0 0 640 512', 'M392.8 1.2c-17-4.9-34.7 5-39.6 22l-128 448c-4.9 17 5 34.7 22 39.6s34.7-5 39.6-22l128-448c4.9-17 5-34.7-22-39.6zm80.6 120.1c-12.5 12.5-12.5 32.8 0 45.3L562.7 256l-89.4 89.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0l112-112c12.5-12.5 12.5-32.8 0-45.3l-112-112c-12.5-12.5-32.8-12.5-45.3 0zm-306.7 0c-12.5-12.5-32.8-12.5-45.3 0l-112 112c-12.5 12.5-12.5 32.8 0 45.3l112 112c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L77.3 256l89.4-89.4c12.5-12.5 12.5-32.8 0-45.3z'],
    terminal: ['0 0 576 512', 'M9.4 86.6C-3.1 74.1-3.1 53.9 9.4 41.4s32.8-12.5 45.3 0l192 192c12.5 12.5 12.5 32.8 0 45.3l-192 192c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3L178.7 256 9.4 86.6zM256 416l288 0c17.7 0 32 14.3 32 32s-14.3 32-32 32l-288 0c-17.7 0-32-14.3-32-32s14.3-32 32-32z'],
    file: ['0 0 384 512', 'M0 64C0 28.7 28.7 0 64 0L224 0l0 128c0 17.7 14.3 32 32 32l128 0 0 288c0 35.3-28.7 64-64 64L64 512c-35.3 0-64-28.7-64-64L0 64zm384 64l-128 0L256 0 384 128z'],
  });

  const FILE_ICON_BY_EXTENSION = Object.freeze({
    js: faIcon('fa-brands fa-js', 'brand'),
    jsx: faIcon('fa-brands fa-react', 'brand'),
    ts: faIcon('fa-solid fa-file-code'),
    tsx: faIcon('fa-brands fa-react', 'brand'),
    mjs: faIcon('fa-brands fa-js', 'brand'),
    cjs: faIcon('fa-brands fa-js', 'brand'),
    json: faIcon('fa-solid fa-file-code'),
    json5: faIcon('fa-solid fa-file-code'),
    jsonc: faIcon('fa-solid fa-file-code'),
    html: faIcon('fa-brands fa-html5', 'brand'),
    htm: faIcon('fa-brands fa-html5', 'brand'),
    xhtml: faIcon('fa-brands fa-html5', 'brand'),
    css: faIcon('fa-brands fa-css3-alt', 'brand'),
    scss: faIcon('fa-solid fa-file-code'),
    sass: faIcon('fa-solid fa-file-code'),
    less: faIcon('fa-solid fa-file-code'),
    styl: faIcon('fa-solid fa-file-code'),
    vue: faIcon('fa-brands fa-vuejs', 'brand'),
    svelte: faIcon('fa-solid fa-file-code'),
    astro: faIcon('fa-solid fa-file-code'),

    py: faIcon('fa-brands fa-python', 'brand'),
    pyw: faIcon('fa-brands fa-python', 'brand'),
    rb: faIcon('fa-solid fa-gem'),
    rake: faIcon('fa-solid fa-gem'),
    go: faIcon('fa-brands fa-golang', 'brand'),
    rs: faIcon('fa-solid fa-file-code'),
    java: faIcon('fa-brands fa-java', 'brand'),
    kt: faIcon('fa-solid fa-file-code'),
    kts: faIcon('fa-solid fa-file-code'),
    php: faIcon('fa-brands fa-php', 'brand'),
    c: faIcon('fa-solid fa-file-code'),
    h: faIcon('fa-solid fa-file-code'),
    cc: faIcon('fa-solid fa-file-code'),
    cpp: faIcon('fa-solid fa-file-code'),
    cxx: faIcon('fa-solid fa-file-code'),
    hpp: faIcon('fa-solid fa-file-code'),
    cs: faIcon('fa-solid fa-file-code'),
    swift: faIcon('fa-brands fa-swift', 'brand'),
    dart: faIcon('fa-solid fa-file-code'),
    lua: faIcon('fa-solid fa-file-code'),
    pl: faIcon('fa-solid fa-file-code'),
    pm: faIcon('fa-solid fa-file-code'),
    r: faIcon('fa-brands fa-r-project', 'brand'),
    scala: faIcon('fa-solid fa-file-code'),
    groovy: faIcon('fa-solid fa-file-code'),
    ex: faIcon('fa-solid fa-file-code'),
    exs: faIcon('fa-solid fa-file-code'),
    erl: faIcon('fa-solid fa-file-code'),
    hrl: faIcon('fa-solid fa-file-code'),
    fs: faIcon('fa-solid fa-file-code'),
    fsx: faIcon('fa-solid fa-file-code'),
    vb: faIcon('fa-solid fa-file-code'),
    asm: faIcon('fa-solid fa-file-code'),

    sql: faIcon('fa-solid fa-database'),
    graphql: faIcon('fa-solid fa-file-code'),
    gql: faIcon('fa-solid fa-file-code'),
    sh: faIcon('fa-solid fa-terminal'),
    bash: faIcon('fa-solid fa-terminal'),
    zsh: faIcon('fa-solid fa-terminal'),
    fish: faIcon('fa-solid fa-terminal'),
    ps1: faIcon('fa-solid fa-terminal'),
    psm1: faIcon('fa-solid fa-terminal'),
    bat: faIcon('fa-solid fa-terminal'),
    cmd: faIcon('fa-solid fa-terminal'),
    yml: faIcon('fa-solid fa-file-code'),
    yaml: faIcon('fa-solid fa-file-code'),
    toml: faIcon('fa-solid fa-file-code'),
    xml: faIcon('fa-solid fa-file-code'),
    xsd: faIcon('fa-solid fa-file-code'),
    ini: faIcon('fa-solid fa-file-code'),
    conf: faIcon('fa-solid fa-file-code'),
    config: faIcon('fa-solid fa-file-code'),
    properties: faIcon('fa-solid fa-file-code'),
    env: faIcon('fa-solid fa-sliders'),

    md: faIcon('fa-brands fa-markdown', 'brand'),
    markdown: faIcon('fa-brands fa-markdown', 'brand'),
    mdx: faIcon('fa-brands fa-markdown', 'brand'),
    txt: faIcon('fa-solid fa-file-lines'),
    log: faIcon('fa-solid fa-file-lines'),
    rst: faIcon('fa-solid fa-file-lines'),
    adoc: faIcon('fa-solid fa-file-lines'),
    pdf: faIcon('fa-solid fa-file-pdf'),
    doc: faIcon('fa-solid fa-file-word'),
    docx: faIcon('fa-solid fa-file-word'),
    odt: faIcon('fa-solid fa-file-word'),
    rtf: faIcon('fa-solid fa-file-word'),
    xls: faIcon('fa-solid fa-file-excel'),
    xlsx: faIcon('fa-solid fa-file-excel'),
    ods: faIcon('fa-solid fa-file-excel'),
    csv: faIcon('fa-solid fa-file-excel'),
    tsv: faIcon('fa-solid fa-file-excel'),
    ppt: faIcon('fa-solid fa-file-powerpoint'),
    pptx: faIcon('fa-solid fa-file-powerpoint'),
    odp: faIcon('fa-solid fa-file-powerpoint'),

    png: faIcon('fa-solid fa-file-image'),
    jpg: faIcon('fa-solid fa-file-image'),
    jpeg: faIcon('fa-solid fa-file-image'),
    gif: faIcon('fa-solid fa-file-image'),
    webp: faIcon('fa-solid fa-file-image'),
    svg: faIcon('fa-solid fa-file-image'),
    ico: faIcon('fa-solid fa-file-image'),
    bmp: faIcon('fa-solid fa-file-image'),
    tiff: faIcon('fa-solid fa-file-image'),
    avif: faIcon('fa-solid fa-file-image'),
    mp3: faIcon('fa-solid fa-file-audio'),
    wav: faIcon('fa-solid fa-file-audio'),
    ogg: faIcon('fa-solid fa-file-audio'),
    flac: faIcon('fa-solid fa-file-audio'),
    mp4: faIcon('fa-solid fa-file-video'),
    mov: faIcon('fa-solid fa-file-video'),
    webm: faIcon('fa-solid fa-file-video'),
    avi: faIcon('fa-solid fa-file-video'),
    zip: faIcon('fa-solid fa-file-zipper'),
    gz: faIcon('fa-solid fa-file-zipper'),
    tgz: faIcon('fa-solid fa-file-zipper'),
    bz2: faIcon('fa-solid fa-file-zipper'),
    xz: faIcon('fa-solid fa-file-zipper'),
    '7z': faIcon('fa-solid fa-file-zipper'),
    rar: faIcon('fa-solid fa-file-zipper'),
    ttf: faIcon('fa-solid fa-font'),
    otf: faIcon('fa-solid fa-font'),
    woff: faIcon('fa-solid fa-font'),
    woff2: faIcon('fa-solid fa-font'),
    lock: faIcon('fa-solid fa-lock'),
  });

  const FILE_ICON_BY_NAME = Object.freeze({
    dockerfile: faIcon('fa-brands fa-docker', 'brand'),
    '.dockerignore': faIcon('fa-brands fa-docker', 'brand'),
    'package.json': faIcon('fa-brands fa-node-js', 'brand'),
    'package-lock.json': faIcon('fa-brands fa-npm', 'brand'),
    'pnpm-lock.yaml': faIcon('fa-brands fa-node-js', 'brand'),
    'yarn.lock': faIcon('fa-brands fa-node-js', 'brand'),
    'bun.lock': faIcon('fa-brands fa-node-js', 'brand'),
    'bun.lockb': faIcon('fa-brands fa-node-js', 'brand'),
    'composer.json': faIcon('fa-brands fa-php', 'brand'),
    gemfile: faIcon('fa-solid fa-gem'),
    'gemfile.lock': faIcon('fa-solid fa-gem'),
    rakefile: faIcon('fa-solid fa-gem'),
    'go.mod': faIcon('fa-brands fa-golang', 'brand'),
    'go.sum': faIcon('fa-brands fa-golang', 'brand'),
    'cargo.toml': faIcon('fa-solid fa-file-code'),
    'cargo.lock': faIcon('fa-solid fa-lock'),
    requirements: faIcon('fa-brands fa-python', 'brand'),
    'requirements.txt': faIcon('fa-brands fa-python', 'brand'),
    'pyproject.toml': faIcon('fa-brands fa-python', 'brand'),
    'setup.py': faIcon('fa-brands fa-python', 'brand'),

    '.gitignore': faIcon('fa-brands fa-git-alt', 'brand'),
    '.gitattributes': faIcon('fa-brands fa-git-alt', 'brand'),
    '.gitmodules': faIcon('fa-brands fa-git-alt', 'brand'),
    gitmessage: faIcon('fa-brands fa-git-alt', 'brand'),
    'readme.md': faIcon('fa-solid fa-file-lines'),
    readme: faIcon('fa-solid fa-file-lines'),
    'changelog.md': faIcon('fa-solid fa-file-lines'),
    changelog: faIcon('fa-solid fa-file-lines'),
    'agents.md': faIcon('fa-solid fa-file-lines'),
    'code_of_conduct.md': faIcon('fa-solid fa-file-lines'),
    'contributing.md': faIcon('fa-solid fa-file-lines'),
    'security.md': faIcon('fa-solid fa-file-lines'),
    license: faIcon('fa-solid fa-scale-balanced'),
    'license.md': faIcon('fa-solid fa-scale-balanced'),
    notice: faIcon('fa-solid fa-scale-balanced'),
    makefile: faIcon('fa-solid fa-terminal'),
    cmakelists: faIcon('fa-solid fa-terminal'),
    'cmakelists.txt': faIcon('fa-solid fa-terminal'),
    justfile: faIcon('fa-solid fa-terminal'),
    procfile: faIcon('fa-solid fa-terminal'),
    '.env': faIcon('fa-solid fa-sliders'),
    '.env.example': faIcon('fa-solid fa-sliders'),
    '.nvmrc': faIcon('fa-brands fa-node-js', 'brand'),
    '.tool-versions': faIcon('fa-solid fa-sliders'),
    '.editorconfig': faIcon('fa-solid fa-gears'),
    '.prettierrc': faIcon('fa-solid fa-gears'),
    '.eslintrc': faIcon('fa-solid fa-gears'),
    'biome.json': faIcon('fa-solid fa-gears'),
    'tsconfig.json': faIcon('fa-solid fa-file-code'),
    'vite.config.js': faIcon('fa-solid fa-gears'),
    'vite.config.ts': faIcon('fa-solid fa-gears'),
  });

  const FOLDER_ICON_BY_NAME = Object.freeze({
    '.github': faIcon('fa-brands fa-github', 'folder'),
    '.git': faIcon('fa-brands fa-git-alt', 'folder'),
    '.vscode': faIcon('fa-solid fa-code', 'folder'),
    '.agents': faIcon('fa-solid fa-robot', 'folder'),
    '.claude': faIcon('fa-solid fa-robot', 'folder'),
    '.cline': faIcon('fa-solid fa-robot', 'folder'),
    '.codex': faIcon('fa-solid fa-robot', 'folder'),
    '.changeset': faIcon('fa-solid fa-list-check', 'folder'),
    '.husky': faIcon('fa-solid fa-terminal', 'folder'),
    '.greptile': faIcon('fa-solid fa-robot', 'folder'),
    node_modules: faIcon('fa-brands fa-node-js', 'folder'),
    docker: faIcon('fa-brands fa-docker', 'folder'),
    docs: faIcon('fa-solid fa-book', 'folder'),
    test: faIcon('fa-solid fa-vial', 'folder'),
    tests: faIcon('fa-solid fa-vial', 'folder'),
    e2e: faIcon('fa-solid fa-vial', 'folder'),
    evals: faIcon('fa-solid fa-vial', 'folder'),
    assets: faIcon('fa-solid fa-images', 'folder'),
    images: faIcon('fa-solid fa-images', 'folder'),
    public: faIcon('fa-solid fa-images', 'folder'),
    src: faIcon('fa-solid fa-cubes', 'folder'),
    lib: faIcon('fa-solid fa-cubes', 'folder'),
    apps: faIcon('fa-solid fa-cubes', 'folder'),
    packages: faIcon('fa-solid fa-cubes', 'folder'),
    sdk: faIcon('fa-solid fa-cubes', 'folder'),
    build: faIcon('fa-solid fa-box-archive', 'folder'),
    dist: faIcon('fa-solid fa-box-archive', 'folder'),
    target: faIcon('fa-solid fa-box-archive', 'folder'),
    scripts: faIcon('fa-solid fa-terminal', 'folder'),
    tools: faIcon('fa-solid fa-screwdriver-wrench', 'folder'),
    config: faIcon('fa-solid fa-gears', 'folder'),
    '.config': faIcon('fa-solid fa-gears', 'folder'),
  });

  function getFileNameFromLink(link) {
    try {
      const pathname = new URL(link.href, location.href).pathname;
      return decodeURIComponent(pathname.split('/').filter(Boolean).pop() || '').toLowerCase();
    } catch {
      return '';
    }
  }

  function getFileIconDefinition(fileName, isDirectory) {
    if (isDirectory) {
      return FOLDER_ICON_BY_NAME[fileName] || faIcon('fa-solid fa-folder', 'folder');
    }

    if (Object.prototype.hasOwnProperty.call(FILE_ICON_BY_NAME, fileName)) {
      return FILE_ICON_BY_NAME[fileName];
    }

    const extension = fileName.includes('.') ? fileName.split('.').pop() : '';
    return FILE_ICON_BY_EXTENSION[extension] || faIcon('fa-solid fa-file');
  }

  function getIconPresentation(definition, fileName) {
    const value = `${fileName} ${definition.className}`.toLowerCase();
    if (definition.kind === 'folder') {
      const folderColors = {
        '.github': '#24292f',
        '.vscode': '#007acc',
        docs: '#3b82f6',
        src: '#8b5cf6',
        lib: '#8b5cf6',
        tests: '#22c55e',
        test: '#22c55e',
        assets: '#f59e0b',
        images: '#f59e0b',
        scripts: '#64748b',
        node_modules: '#83cd29',
      };
      return { color: folderColors[fileName] || '#3b82f6', label: '', foreground: '#ffffff' };
    }

    const presentations = [
      [/git-alt|\.git/, '#f05032', 'git', '#ffffff'],
      [/docker/, '#2496ed', 'docker', '#ffffff'],
      [/npm/, '#cb3837', 'npm', '#ffffff'],
      [/node-js|\.nvmrc|package/, '#83cd29', 'node', '#17351b'],
      [/python|\.py$|pyproject/, '#3776ab', 'py', '#ffffff'],
      [/react|\.jsx$|\.tsx$/, '#61dafb', '⚛', '#123047'],
      [/fa-js|\.m?js$|\.cjs$/, '#f7df1e', 'JS', '#202124'],
      [/html5|\.x?html$/, '#e44d26', 'HTML', '#ffffff'],
      [/css3|\.s?css$|\.less$|\.styl$/, '#1572b6', 'CSS', '#ffffff'],
      [/vuejs|\.vue$/, '#42b883', 'VUE', '#ffffff'],
      [/markdown|\.mdx?$|readme|changelog/, '#2563eb', 'MD', '#ffffff'],
      [/file-pdf|\.pdf$/, '#ef4444', 'PDF', '#ffffff'],
      [/file-word|\.docx?$|\.odt$|\.rtf$/, '#2563eb', 'W', '#ffffff'],
      [/file-excel|\.xlsx?$|\.ods$|\.csv$|\.tsv$/, '#16a34a', 'X', '#ffffff'],
      [/file-powerpoint|\.pptx?$|\.odp$/, '#f97316', 'P', '#ffffff'],
      [/file-image|\.(png|jpe?g|gif|webp|svg|ico|bmp|tiff|avif)$/, '#a855f7', 'IMG', '#ffffff'],
      [/file-audio|\.(mp3|wav|ogg|flac)$/, '#ec4899', '♪', '#ffffff'],
      [/file-video|\.(mp4|mov|webm|avi)$/, '#dc2626', '▶', '#ffffff'],
      [/file-zipper|\.(zip|gz|tgz|bz2|xz|7z|rar)$/, '#d97706', 'ZIP', '#ffffff'],
      [/database|\.sql$|\.graphql$|\.gql$/, '#eab308', 'DB', '#422006'],
      [/terminal|\.sh$|\.bash$|\.zsh$|\.fish$|\.ps1$|\.bat$|\.cmd$|makefile|procfile/, '#334155', '>_', '#ffffff'],
      [/font|\.(ttf|otf|woff2?)$/, '#7c3aed', 'A', '#ffffff'],
      [/lock|\.lock$/, '#64748b', 'L', '#ffffff'],
      [/sliders|gears|\.tool-versions|\.editorconfig|biome|vite\.config/, '#64748b', 'CFG', '#ffffff'],
      [/scale-balanced|license|notice/, '#8b5cf6', '§', '#ffffff'],
      [/file-code|\.json$|\.ya?ml$|\.toml$|\.xml$|\.ini$|\.conf$|\.config$|\.env$|\.rs$|\.go$|\.java$|\.php$|\.swift$|\.rb$/, '#0f766e', '</>', '#ffffff'],
      [/file-lines|\.txt$|\.log$|\.rst$|\.adoc$/, '#64748b', 'TXT', '#ffffff'],
    ];

    const match = presentations.find(([pattern]) => pattern.test(value));
    if (match) return { color: match[1], label: match[2], foreground: match[3] };
    return { color: '#475569', label: 'FILE', foreground: '#ffffff' };
  }

  function createInlineIcon(definition, fileName) {
    const type = definition.kind === 'folder' ? 'folder' : 'file';
    const [viewBox, pathData] = INLINE_ICON_PATHS[type];
    const presentation = getIconPresentation(definition, fileName);
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('viewBox', viewBox);
    icon.setAttribute('aria-hidden', 'true');
    icon.setAttribute('focusable', 'false');
    icon.classList.add('github-tools-file-icon-svg');
    icon.style.color = presentation.color;

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', pathData);
    icon.appendChild(path);

    if (presentation.label) {
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', type === 'folder' ? '256' : '192');
      label.setAttribute('y', type === 'folder' ? '350' : '384');
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('font-family', 'system-ui, -apple-system, sans-serif');
      label.setAttribute('font-size', presentation.label.length > 3 ? '62' : '86');
      label.setAttribute('font-weight', '800');
      label.setAttribute('letter-spacing', '-3');
      label.setAttribute('fill', presentation.foreground);
      label.textContent = presentation.label;
      icon.appendChild(label);
    }

    return icon;
  }

  function createFileIcon(definition, fileName) {
    const wrapper = document.createElement('span');
    wrapper.setAttribute(FILE_ICON_MARKER, '');
    wrapper.dataset.iconClass = definition.className;
    wrapper.dataset.iconKind = definition.kind;
    wrapper.setAttribute('aria-hidden', 'true');

    wrapper.append(createInlineIcon(definition, fileName));
    return wrapper;
  }

  function addFileIcons() {
    const repository = getRepository();
    if (!repository) return;

    const entryPrefix = `/${repository.owner}/${repository.repository}/`;
    const entries = [...document.querySelectorAll('a[href]')].filter((link) => (
      link.pathname.toLowerCase().startsWith(entryPrefix)
      && /\/(?:blob|tree)\//i.test(link.pathname)
    ));

    entries.forEach((entry) => {
      const link = entry;
      const row = link.closest('tr, [role="row"], .Box-row, .js-navigation-item, li');
      if (!row) return;

      const nameCell = link.closest('td, [role="gridcell"], [role="cell"]') || link.parentElement;
      const managedIcon = nameCell.querySelector(`[${FILE_ICON_MARKER}]`);
      const nativeIcon = nameCell.querySelector('svg.octicon-file, svg.octicon-file-directory-fill, svg[class*="icon-directory"]');

      const fileName = getFileNameFromLink(link);
      if (!fileName) return;

      const isDirectory = /\/tree\//i.test(link.pathname)
        || nativeIcon?.classList.contains('octicon-file-directory-fill')
        || nativeIcon?.classList.contains('icon-directory');

      const definition = getFileIconDefinition(fileName, isDirectory);

      if (managedIcon
        && managedIcon.dataset.iconClass === definition.className
        && managedIcon.dataset.iconKind === definition.kind) return;

      const icon = createFileIcon(definition, fileName);

      if (managedIcon) {
        managedIcon.replaceWith(icon);
      } else if (nativeIcon) {
        nativeIcon.replaceWith(icon);
      } else {
        link.before(icon);
      }
    });
  }

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
    } catch {
    }

    return undefined;
  }

  function writeSizeCache(key, size) {
    try {
      const data = JSON.parse(localStorage.getItem(SIZE_CACHE_KEY) || '{}');
      data[key] = { size, timestamp: Date.now() };
      localStorage.setItem(SIZE_CACHE_KEY, JSON.stringify(data));
    } catch {
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

        writeSizeCache(key, size);
      } catch {
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

    if (existing && existing.dataset.repoKey === cacheKey && existing.isConnected) return;

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
