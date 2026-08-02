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

  const FONT_AWESOME_ICON_PATHS = Object.freeze({
    "fa-markdown": ['0 0 640 512', "M593.8 59.1H46.2C20.7 59.1 0 79.8 0 105.2v301.5c0 25.5 20.7 46.2 46.2 46.2h547.7c25.5 0 46.2-20.7 46.1-46.1V105.2c0-25.4-20.7-46.1-46.2-46.1zM338.5 360.6H277v-120l-61.5 76.9-61.5-76.9v120H92.3V151.4h61.5l61.5 76.9 61.5-76.9h61.5v209.2zm135.3 3.1L381.5 256H443V151.4h61.5V256H566z"],
    "fa-git-alt": ['0 0 448 512', "M439.55 236.05L244 40.45a28.87 28.87 0 0 0-40.81 0l-40.66 40.63 51.52 51.52c27.06-9.14 52.68 16.77 43.39 43.68l49.66 49.66c34.23-11.8 61.18 31 35.47 56.69-26.49 26.49-70.21-2.87-56-37.34L240.22 199v121.85c25.3 12.54 22.26 41.85 9.08 55a34.34 34.34 0 0 1-48.55 0c-17.57-17.6-11.07-46.91 11.25-56v-123c-20.8-8.51-24.6-30.74-18.64-45L142.57 101 8.45 235.14a28.86 28.86 0 0 0 0 40.81l195.61 195.6a28.86 28.86 0 0 0 40.8 0l194.69-194.69a28.86 28.86 0 0 0 0-40.81z"],
    "fa-js": ['0 0 448 512', "M0 32v448h448V32H0zm243.8 349.4c0 43.6-25.6 63.5-62.9 63.5-33.7 0-53.2-17.4-63.2-38.5l34.3-20.7c6.6 11.7 12.6 21.6 27.1 21.6 13.8 0 22.6-5.4 22.6-26.5V237.7h42.1v143.7zm99.6 63.5c-39.1 0-64.4-18.6-76.7-43l34.3-19.8c9 14.7 20.8 25.6 41.5 25.6 17.4 0 28.6-8.7 28.6-20.8 0-14.4-11.4-19.5-30.7-28l-10.5-4.5c-30.4-12.9-50.5-29.2-50.5-63.5 0-31.6 24.1-55.6 61.6-55.6 26.8 0 46 9.3 59.8 33.7L368 290c-7.2-12.9-15-18-27.1-18-12.3 0-20.1 7.8-20.1 18 0 12.6 7.8 17.7 25.9 25.6l10.5 4.5c35.8 15.3 55.9 31 55.9 66.2 0 37.8-29.8 58.6-69.7 58.6z"],
    "fa-node-js": ['0 0 448 512', "M224 508c-6.7 0-13.5-1.8-19.4-5.2l-61.7-36.5c-9.2-5.2-4.7-7-1.7-8 12.3-4.3 14.8-5.2 27.9-12.7 1.4-.8 3.2-.5 4.6.4l47.4 28.1c1.7 1 4.1 1 5.7 0l184.7-106.6c1.7-1 2.8-3 2.8-5V149.3c0-2.1-1.1-4-2.9-5.1L226.8 37.7c-1.7-1-4-1-5.7 0L36.6 144.3c-1.8 1-2.9 3-2.9 5.1v213.1c0 2 1.1 4 2.9 4.9l50.6 29.2c27.5 13.7 44.3-2.4 44.3-18.7V167.5c0-3 2.4-5.3 5.4-5.3h23.4c2.9 0 5.4 2.3 5.4 5.3V378c0 36.6-20 57.6-54.7 57.6-10.7 0-19.1 0-42.5-11.6l-48.4-27.9C8.1 389.2.7 376.3.7 362.4V149.3c0-13.8 7.4-26.8 19.4-33.7L204.6 9c11.7-6.6 27.2-6.6 38.8 0l184.7 106.7c12 6.9 19.4 19.8 19.4 33.7v213.1c0 13.8-7.4 26.7-19.4 33.7L243.4 502.8c-5.9 3.4-12.6 5.2-19.4 5.2zm149.1-210.1c0-39.9-27-50.5-83.7-58-57.4-7.6-63.2-11.5-63.2-24.9 0-11.1 4.9-25.9 47.4-25.9 37.9 0 51.9 8.2 57.7 33.8.5 2.4 2.7 4.2 5.2 4.2h24c1.5 0 2.9-.6 3.9-1.7s1.5-2.6 1.4-4.1c-3.7-44.1-33-64.6-92.2-64.6-52.7 0-84.1 22.2-84.1 59.5 0 40.4 31.3 51.6 81.8 56.6 60.5 5.9 65.2 14.8 65.2 26.7 0 20.6-16.6 29.4-55.5 29.4-48.9 0-59.6-12.3-63.2-36.6-.4-2.6-2.6-4.5-5.3-4.5h-23.9c-3 0-5.3 2.4-5.3 5.3 0 31.1 16.9 68.2 97.8 68.2 58.4-.1 92-23.2 92-63.4z"],
    "fa-npm": ['0 0 576 512', "M288 288h-32v-64h32v64zm288-128v192H288v32H160v-32H0V160h576zm-416 32H32v128h64v-96h32v96h32V192zm160 0H192v160h64v-32h64V192zm224 0H352v128h64v-96h32v96h32v-96h32v96h32V192z"],
    "fa-python": ['0 0 448 512', "M439.8 200.5c-7.7-30.9-22.3-54.2-53.4-54.2h-40.1v47.4c0 36.8-31.2 67.8-66.8 67.8H172.7c-29.2 0-53.4 25-53.4 54.3v101.8c0 29 25.2 46 53.4 54.3 33.8 9.9 66.3 11.7 106.8 0 26.9-7.8 53.4-23.5 53.4-54.3v-40.7H226.2v-13.6h160.2c31.1 0 42.6-21.7 53.4-54.2 11.2-33.5 10.7-65.7 0-108.6zM286.2 404c11.1 0 20.1 9.1 20.1 20.3 0 11.3-9 20.4-20.1 20.4-11 0-20.1-9.2-20.1-20.4.1-11.3 9.1-20.3 20.1-20.3zM167.8 248.1h106.8c29.7 0 53.4-24.5 53.4-54.3V91.9c0-29-24.4-50.7-53.4-55.6-35.8-5.9-74.7-5.6-106.8.1-45.2 8-53.4 24.7-53.4 55.6v40.7h106.9v13.6h-147c-31.1 0-58.3 18.7-66.8 54.2-9.8 40.7-10.2 66.1 0 108.6 7.6 31.6 25.7 54.2 56.8 54.2H101v-48.8c0-35.3 30.5-66.4 66.8-66.4zm-6.7-142.6c-11.1 0-20.1-9.1-20.1-20.3.1-11.3 9-20.4 20.1-20.4 11 0 20.1 9.2 20.1 20.4s-9 20.3-20.1 20.3z"],
    "fa-docker": ['0 0 640 512', "M349.9 236.3h-66.1v-59.4h66.1v59.4zm0-204.3h-66.1v60.7h66.1V32zm78.2 144.8H362v59.4h66.1v-59.4zm-156.3-72.1h-66.1v60.1h66.1v-60.1zm78.1 0h-66.1v60.1h66.1v-60.1zm276.8 100c-14.4-9.7-47.6-13.2-73.1-8.4-3.3-24-16.7-44.9-41.1-63.7l-14-9.3-9.3 14c-18.4 27.8-23.4 73.6-3.7 103.8-8.7 4.7-25.8 11.1-48.4 10.7H2.4c-8.7 50.8 5.8 116.8 44 162.1 37.1 43.9 92.7 66.2 165.4 66.2 157.4 0 273.9-72.5 328.4-204.2 21.4.4 67.6.1 91.3-45.2 1.5-2.5 6.6-13.2 8.5-17.1l-13.3-8.9zm-511.1-27.9h-66v59.4h66.1v-59.4zm78.1 0h-66.1v59.4h66.1v-59.4zm78.1 0h-66.1v59.4h66.1v-59.4zm-78.1-72.1h-66.1v60.1h66.1v-60.1z"],
    "fa-html5": ['0 0 384 512', "M0 32l34.9 395.8L191.5 480l157.6-52.2L384 32H0zm308.2 127.9H124.4l4.1 49.4h175.6l-13.6 148.4-97.9 27v.3h-1.1l-98.7-27.3-6-75.8h47.7L138 320l53.5 14.5 53.7-14.5 6-62.2H84.3L71.5 112.2h241.1l-4.4 47.7z"],
    "fa-css3-alt": ['0 0 384 512', "M0 32l34.9 395.8L192 480l157.1-52.2L384 32H0zm313.1 80l-4.8 47.3L193 208.6l-.3.1h111.5l-12.8 146.6-98.2 28.7-98.8-29.2-6.4-73.9h48.9l3.2 38.3 52.6 13.3 54.7-15.4 3.7-61.6-166.3-.5v-.1l-.2.1-3.6-46.3L193.1 162l6.5-2.7H76.7L70.9 112h242.2z"],
    "fa-file-code": ['0 0 384 512', "M64 0C28.7 0 0 28.7 0 64L0 448c0 35.3 28.7 64 64 64l256 0c35.3 0 64-28.7 64-64l0-288-128 0c-17.7 0-32-14.3-32-32L224 0 64 0zM256 0l0 128 128 0L256 0zM153 289l-31 31 31 31c9.4 9.4 9.4 24.6 0 33.9s-24.6 9.4-33.9 0L71 337c-9.4-9.4-9.4-24.6 0-33.9l48-48c9.4-9.4 24.6-9.4 33.9 0s9.4 24.6 0 33.9zM265 255l48 48c9.4 9.4 9.4 24.6 0 33.9l-48 48c-9.4 9.4-24.6 9.4-33.9 0s-9.4-24.6 0-33.9l31-31-31-31c-9.4-9.4-9.4-24.6 0-33.9s24.6-9.4 33.9 0z"],
    "fa-file-lines": ['0 0 384 512', "M64 0C28.7 0 0 28.7 0 64L0 448c0 35.3 28.7 64 64 64l256 0c35.3 0 64-28.7 64-64l0-288-128 0c-17.7 0-32-14.3-32-32L224 0 64 0zM256 0l0 128 128 0L256 0zM112 256l160 0c8.8 0 16 7.2 16 16s-7.2 16-16 16l-160 0c-8.8 0-16-7.2-16-16s7.2-16 16-16zm0 64l160 0c8.8 0 16 7.2 16 16s-7.2 16-16 16l-160 0c-8.8 0-16-7.2-16-16s7.2-16 16-16zm0 64l160 0c8.8 0 16 7.2 16 16s-7.2 16-16 16l-160 0c-8.8 0-16-7.2-16-16s7.2-16 16-16z"],
    "fa-file-pdf": ['0 0 512 512', "M0 64C0 28.7 28.7 0 64 0L224 0l0 128c0 17.7 14.3 32 32 32l128 0 0 144-208 0c-35.3 0-64 28.7-64 64l0 144-48 0c-35.3 0-64-28.7-64-64L0 64zm384 64l-128 0L256 0 384 128zM176 352l32 0c30.9 0 56 25.1 56 56s-25.1 56-56 56l-16 0 0 32c0 8.8-7.2 16-16 16s-16-7.2-16-16l0-48 0-80c0-8.8 7.2-16 16-16zm32 80c13.3 0 24-10.7 24-24s-10.7-24-24-24l-16 0 0 48 16 0zm96-80l32 0c26.5 0 48 21.5 48 48l0 64c0 26.5-21.5 48-48 48l-32 0c-8.8 0-16-7.2-16-16l0-128c0-8.8 7.2-16 16-16zm32 128c8.8 0 16-7.2 16-16l0-64c0-8.8-7.2-16-16-16l-16 0 0 96 16 0zm80-112c0-8.8 7.2-16 16-16l48 0c8.8 0 16 7.2 16 16s-7.2 16-16 16l-32 0 0 32 32 0c8.8 0 16 7.2 16 16s-7.2 16-16 16l-32 0 0 48c0 8.8-7.2 16-16 16s-16-7.2-16-16l0-64 0-64z"],
    "fa-file-image": ['0 0 384 512', "M64 0C28.7 0 0 28.7 0 64L0 448c0 35.3 28.7 64 64 64l256 0c35.3 0 64-28.7 64-64l0-288-128 0c-17.7 0-32-14.3-32-32L224 0 64 0zM256 0l0 128 128 0L256 0zM64 256a32 32 0 1 1 64 0 32 32 0 1 1 -64 0zm152 32c5.3 0 10.2 2.6 13.2 6.9l88 128c3.4 4.9 3.7 11.3 1 16.5s-8.2 8.6-14.2 8.6l-88 0-40 0-48 0-48 0c-5.8 0-11.1-3.1-13.9-8.1s-2.8-11.2 .2-16.1l48-80c2.9-4.8 8.1-7.8 13.7-7.8s10.8 2.9 13.7 7.8l12.8 21.4 48.3-70.2c3-4.3 7.9-6.9 13.2-6.9z"],
    "fa-terminal": ['0 0 576 512', "M9.4 86.6C-3.1 74.1-3.1 53.9 9.4 41.4s32.8-12.5 45.3 0l192 192c12.5 12.5 12.5 32.8 0 45.3l-192 192c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3L178.7 256 9.4 86.6zM256 416l288 0c17.7 0 32 14.3 32 32s-14.3 32-32 32l-288 0c-17.7 0-32-14.3-32-32s14.3-32 32-32z"],
    "fa-database": ['0 0 448 512', "M448 80l0 48c0 44.2-100.3 80-224 80S0 172.2 0 128L0 80C0 35.8 100.3 0 224 0S448 35.8 448 80zM393.2 214.7c20.8-7.4 39.9-16.9 54.8-28.6L448 288c0 44.2-100.3 80-224 80S0 332.2 0 288L0 186.1c14.9 11.8 34 21.2 54.8 28.6C99.7 230.7 159.5 240 224 240s124.3-9.3 169.2-25.3zM0 346.1c14.9 11.8 34 21.2 54.8 28.6C99.7 390.7 159.5 400 224 400s124.3-9.3 169.2-25.3c20.8-7.4 39.9-16.9 54.8-28.6l0 85.9c0 44.2-100.3 80-224 80S0 476.2 0 432l0-85.9z"],
    "fa-folder": ['0 0 512 512', "M64 480H448c35.3 0 64-28.7 64-64V160c0-35.3-28.7-64-64-64H288c-10.1 0-19.6-4.7-25.6-12.8L243.2 57.6C231.1 41.5 212.1 32 192 32H64C28.7 32 0 60.7 0 96V416c0 35.3 28.7 64 64 64z"],
    "fa-file": ['0 0 384 512', "M0 64C0 28.7 28.7 0 64 0L224 0l0 128c0 17.7 14.3 32 32 32l128 0 0 288c0 35.3-28.7 64-64 64L64 512c-35.3 0-64-28.7-64-64L0 64zm384 64l-128 0L256 0 384 128z"],
    "fa-file-audio": ['0 0 384 512', "M64 0C28.7 0 0 28.7 0 64L0 448c0 35.3 28.7 64 64 64l256 0c35.3 0 64-28.7 64-64l0-288-128 0c-17.7 0-32-14.3-32-32L224 0 64 0zM256 0l0 128 128 0L256 0zm2 226.3c37.1 22.4 62 63.1 62 109.7s-24.9 87.3-62 109.7c-7.6 4.6-17.4 2.1-22-5.4s-2.1-17.4 5.4-22C269.4 401.5 288 370.9 288 336s-18.6-65.5-46.5-82.3c-7.6-4.6-10-14.4-5.4-22s14.4-10 22-5.4zm-91.9 30.9c6 2.5 9.9 8.3 9.9 14.8l0 128c0 6.5-3.9 12.3-9.9 14.8s-12.9 1.1-17.4-3.5L113.4 376 80 376c-8.8 0-16-7.2-16-16l0-48c0-8.8 7.2-16 16-16l33.4 0 35.3-35.3c4.6-4.6 11.5-5.9 17.4-3.5z"],
    "fa-file-excel": ['0 0 384 512', "M64 0C28.7 0 0 28.7 0 64L0 448c0 35.3 28.7 64 64 64l256 0c35.3 0 64-28.7 64-64l0-288-128 0c-17.7 0-32-14.3-32-32L224 0 64 0zM256 0l0 128 128 0L256 0zM155.7 250.2L192 302.1l36.3-51.9c7.6-10.9 22.6-13.5 33.4-5.9s13.5 22.6 5.9 33.4L221.3 344l46.4 66.2c7.6 10.9 5 25.8-5.9 33.4s-25.8 5-33.4-5.9L192 385.8l-36.3 51.9c-7.6 10.9-22.6 13.5-33.4 5.9s-13.5-22.6-5.9-33.4L162.7 344l-46.4-66.2c-7.6-10.9-5-25.8 5.9-33.4s25.8-5 33.4 5.9z"],
    "fa-file-powerpoint": ['0 0 384 512', "M64 0C28.7 0 0 28.7 0 64L0 448c0 35.3 28.7 64 64 64l256 0c35.3 0 64-28.7 64-64l0-288-128 0c-17.7 0-32-14.3-32-32L224 0 64 0zM256 0l0 128 128 0L256 0zM136 240l68 0c42 0 76 34 76 76s-34 76-76 76l-44 0 0 32c0 13.3-10.7 24-24 24s-24-10.7-24-24l0-56 0-104c0-13.3 10.7-24 24-24zm68 104c15.5 0 28-12.5 28-28s-12.5-28-28-28l-44 0 0 56 44 0z"],
    "fa-file-video": ['0 0 384 512', "M64 0C28.7 0 0 28.7 0 64L0 448c0 35.3 28.7 64 64 64l256 0c35.3 0 64-28.7 64-64l0-288-128 0c-17.7 0-32-14.3-32-32L224 0 64 0zM256 0l0 128 128 0L256 0zM64 288c0-17.7 14.3-32 32-32l96 0c17.7 0 32 14.3 32 32l0 96c0 17.7-14.3 32-32 32l-96 0c-17.7 0-32-14.3-32-32l0-96zM300.9 397.9L256 368l0-64 44.9-29.9c2-1.3 4.4-2.1 6.8-2.1c6.8 0 12.3 5.5 12.3 12.3l0 103.4c0 6.8-5.5 12.3-12.3 12.3c-2.4 0-4.8-.7-6.8-2.1z"],
    "fa-file-word": ['0 0 384 512', "M64 0C28.7 0 0 28.7 0 64L0 448c0 35.3 28.7 64 64 64l256 0c35.3 0 64-28.7 64-64l0-288-128 0c-17.7 0-32-14.3-32-32L224 0 64 0zM256 0l0 128 128 0L256 0zM111 257.1l26.8 89.2 31.6-90.3c3.4-9.6 12.5-16.1 22.7-16.1s19.3 6.4 22.7 16.1l31.6 90.3L273 257.1c3.8-12.7 17.2-19.9 29.9-16.1s19.9 17.2 16.1 29.9l-48 160c-3 10-12 16.9-22.4 17.1s-19.8-6.2-23.2-16.1L192 336.6l-33.3 95.3c-3.4 9.8-12.8 16.3-23.2 16.1s-19.5-7.1-22.4-17.1l-48-160c-3.8-12.7 3.4-26.1 16.1-29.9s26.1 3.4 29.9 16.1z"],
    "fa-file-zipper": ['0 0 384 512', "M64 0C28.7 0 0 28.7 0 64L0 448c0 35.3 28.7 64 64 64l256 0c35.3 0 64-28.7 64-64l0-288-128 0c-17.7 0-32-14.3-32-32L224 0 64 0zM256 0l0 128 128 0L256 0zM96 48c0-8.8 7.2-16 16-16l32 0c8.8 0 16 7.2 16 16s-7.2 16-16 16l-32 0c-8.8 0-16-7.2-16-16zm0 64c0-8.8 7.2-16 16-16l32 0c8.8 0 16 7.2 16 16s-7.2 16-16 16l-32 0c-8.8 0-16-7.2-16-16zm0 64c0-8.8 7.2-16 16-16l32 0c8.8 0 16 7.2 16 16s-7.2 16-16 16l-32 0c-8.8 0-16-7.2-16-16zm-6.3 71.8c3.7-14 16.4-23.8 30.9-23.8l14.8 0c14.5 0 27.2 9.7 30.9 23.8l23.5 88.2c1.4 5.4 2.1 10.9 2.1 16.4c0 35.2-28.8 63.7-64 63.7s-64-28.5-64-63.7c0-5.5 .7-11.1 2.1-16.4l23.5-88.2zM112 336c-8.8 0-16 7.2-16 16s7.2 16 16 16l32 0c8.8 0 16-7.2 16-16s-7.2-16-16-16l-32 0z"],
    "fa-font": ['0 0 448 512', "M254 52.8C249.3 40.3 237.3 32 224 32s-25.3 8.3-30 20.8L57.8 416 32 416c-17.7 0-32 14.3-32 32s14.3 32 32 32l96 0c17.7 0 32-14.3 32-32s-14.3-32-32-32l-1.8 0 18-48 159.6 0 18 48-1.8 0c-17.7 0-32 14.3-32 32s14.3 32 32 32l96 0c17.7 0 32-14.3 32-32s-14.3-32-32-32l-25.8 0L254 52.8zM279.8 304l-111.6 0L224 155.1 279.8 304z"],
    "fa-gears": ['0 0 640 512', "M308.5 135.3c7.1-6.3 9.9-16.2 6.2-25c-2.3-5.3-4.8-10.5-7.6-15.5L304 89.4c-3-5-6.3-9.9-9.8-14.6c-5.7-7.6-15.7-10.1-24.7-7.1l-28.2 9.3c-10.7-8.8-23-16-36.2-20.9L199 27.1c-1.9-9.3-9.1-16.7-18.5-17.8C173.9 8.4 167.2 8 160.4 8l-.7 0c-6.8 0-13.5 .4-20.1 1.2c-9.4 1.1-16.6 8.6-18.5 17.8L115 56.1c-13.3 5-25.5 12.1-36.2 20.9L50.5 67.8c-9-3-19-.5-24.7 7.1c-3.5 4.7-6.8 9.6-9.9 14.6l-3 5.3c-2.8 5-5.3 10.2-7.6 15.6c-3.7 8.7-.9 18.6 6.2 25l22.2 19.8C32.6 161.9 32 168.9 32 176s.6 14.1 1.7 20.9L11.5 216.7c-7.1 6.3-9.9 16.2-6.2 25c2.3 5.3 4.8 10.5 7.6 15.6l3 5.2c3 5.1 6.3 9.9 9.9 14.6c5.7 7.6 15.7 10.1 24.7 7.1l28.2-9.3c10.7 8.8 23 16 36.2 20.9l6.1 29.1c1.9 9.3 9.1 16.7 18.5 17.8c6.7 .8 13.5 1.2 20.4 1.2s13.7-.4 20.4-1.2c9.4-1.1 16.6-8.6 18.5-17.8l6.1-29.1c13.3-5 25.5-12.1 36.2-20.9l28.2 9.3c9 3 19 .5 24.7-7.1c3.5-4.7 6.8-9.5 9.8-14.6l3.1-5.4c2.8-5 5.3-10.2 7.6-15.5c3.7-8.7 .9-18.6-6.2-25l-22.2-19.8c1.1-6.8 1.7-13.8 1.7-20.9s-.6-14.1-1.7-20.9l22.2-19.8zM112 176a48 48 0 1 1 96 0 48 48 0 1 1 -96 0z"],
    "fa-lock": ['0 0 448 512', "M144 144l0 48 160 0 0-48c0-44.2-35.8-80-80-80s-80 35.8-80 80zM80 192l0-48C80 64.5 144.5 0 224 0s144 64.5 144 144l0 48 16 0c35.3 0 64 28.7 64 64l0 192c0 35.3-28.7 64-64 64L64 512c-35.3 0-64-28.7-64-64L0 256c0-35.3 28.7-64 64-64l16 0z"],
    "fa-scale-balanced": ['0 0 640 512', "M384 32l128 0c17.7 0 32 14.3 32 32s-14.3 32-32 32L398.4 96c-5.2 25.8-22.9 47.1-46.4 57.3L352 448l160 0c17.7 0 32 14.3 32 32s-14.3 32-32 32l-192 0-192 0c-17.7 0-32-14.3-32-32s14.3-32 32-32l160 0 0-294.7c-23.5-10.3-41.2-31.6-46.4-57.3L128 96c-17.7 0-32-14.3-32-32s14.3-32 32-32l128 0c14.6-19.4 37.8-32 64-32s49.4 12.6 64 32zm55.6 288l144.9 0L512 195.8 439.6 320zM512 416c-62.9 0-115.2-34-126-78.9c-2.6-11 1-22.3 6.7-32.1l95.2-163.2c5-8.6 14.2-13.8 24.1-13.8s19.1 5.3 24.1 13.8l95.2 163.2c5.7 9.8 9.3 21.1 6.7 32.1C627.2 382 574.9 416 512 416zM126.8 195.8L54.4 320l144.9 0L126.8 195.8zM.9 337.1c-2.6-11 1-22.3 6.7-32.1l95.2-163.2c5-8.6 14.2-13.8 24.1-13.8s19.1 5.3 24.1 13.8l95.2 163.2c5.7 9.8 9.3 21.1 6.7 32.1C242 382 189.7 416 126.8 416S11.7 382 .9 337.1z"],
    "fa-sliders": ['0 0 512 512', "M0 416c0 17.7 14.3 32 32 32l54.7 0c12.3 28.3 40.5 48 73.3 48s61-19.7 73.3-48L480 448c17.7 0 32-14.3 32-32s-14.3-32-32-32l-246.7 0c-12.3-28.3-40.5-48-73.3-48s-61 19.7-73.3 48L32 384c-17.7 0-32 14.3-32 32zm128 0a32 32 0 1 1 64 0 32 32 0 1 1 -64 0zM320 256a32 32 0 1 1 64 0 32 32 0 1 1 0-64 32 32 0 0 1 64 0zm32-80c-32.8 0-61 19.7-73.3 48L32 224c-17.7 0-32 14.3-32 32s14.3 32 32 32l246.7 0c12.3 28.3 40.5 48 73.3 48s61-19.7 73.3-48l54.7 0c17.7 0 32-14.3 32-32s-14.3-32-32-32l-54.7 0c-12.3-28.3-40.5-48-73.3-48zM192 128a32 32 0 1 1 0-64 32 32 0 0 1 0 64zm73.3-64C253 35.7 224.8 16 192 16s-61 19.7-73.3 48L32 64C14.3 64 0 78.3 0 96s14.3 32 32 32l86.7 0c12.3 28.3 40.5 48 73.3 48s61-19.7 73.3-48L480 128c17.7 0 32-14.3 32-32s-14.3-32-32-32L265.3 64z"],
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
    const iconKey = definition.className.split(/\s+/).find((className) => (
      className.startsWith('fa-') && className !== 'fa-solid' && className !== 'fa-brands'
    ));
    const [viewBox, pathData] = FONT_AWESOME_ICON_PATHS[iconKey] || INLINE_ICON_PATHS[type];
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

    if (!FONT_AWESOME_ICON_PATHS[iconKey] && presentation.label) {
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
