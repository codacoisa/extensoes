// ==UserScript==
// @name         GitHub Tools
// @namespace    https://github.com/codacoisa/extensoes/tree/main/github-tools
// @version      2026-08-04-18:00
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

const GITHUB_TOOLS_ICON_COLORS = Object.freeze({
  neutral: 'var(--fgColor-muted, #57606a)',
  accent: 'var(--fgColor-accent, #0969da)',
  attention: 'var(--fgColor-attention, #9a6700)',
  danger: 'var(--fgColor-danger, #cf222e)',
  done: 'var(--fgColor-done, #8250df)',
  success: 'var(--fgColor-success, #1a7f37)',
  open: 'var(--fgColor-open, #1f883d)',
});

const GITHUB_TOOLS_FOLDER_ICONS = Object.freeze({
  '.github': ['folder-github', GITHUB_TOOLS_ICON_COLORS.accent],
  '.git': ['folder-git', GITHUB_TOOLS_ICON_COLORS.danger],
  '.vscode': ['folder-vscode', GITHUB_TOOLS_ICON_COLORS.accent],
  docs: ['folder-docs', GITHUB_TOOLS_ICON_COLORS.accent],
  test: ['folder-test', GITHUB_TOOLS_ICON_COLORS.success],
  tests: ['folder-test', GITHUB_TOOLS_ICON_COLORS.success],
  e2e: ['folder-test', GITHUB_TOOLS_ICON_COLORS.success],
  assets: ['folder-images', GITHUB_TOOLS_ICON_COLORS.attention],
  images: ['folder-images', GITHUB_TOOLS_ICON_COLORS.attention],
  public: ['folder-public', GITHUB_TOOLS_ICON_COLORS.attention],
  src: ['folder-src', GITHUB_TOOLS_ICON_COLORS.done],
  lib: ['folder-src', GITHUB_TOOLS_ICON_COLORS.done],
  packages: ['folder-packages', GITHUB_TOOLS_ICON_COLORS.done],
  scripts: ['folder-scripts', GITHUB_TOOLS_ICON_COLORS.neutral],
  tools: ['folder-tools', GITHUB_TOOLS_ICON_COLORS.neutral],
  config: ['folder-config', GITHUB_TOOLS_ICON_COLORS.neutral],
  '.config': ['folder-config', GITHUB_TOOLS_ICON_COLORS.neutral],
});

const GITHUB_TOOLS_SPECIAL_FILE_ICONS = Object.freeze({
  'package.json': ['npm/package', GITHUB_TOOLS_ICON_COLORS.danger],
  'package-lock.json': ['npm/lock', GITHUB_TOOLS_ICON_COLORS.danger],
  'pnpm-lock.yaml': ['pnpm', GITHUB_TOOLS_ICON_COLORS.accent],
  'yarn.lock': ['yarn', GITHUB_TOOLS_ICON_COLORS.accent],
  'dockerfile': ['docker', GITHUB_TOOLS_ICON_COLORS.accent],
  '.dockerignore': ['docker', GITHUB_TOOLS_ICON_COLORS.accent],
  'readme': ['markdown', GITHUB_TOOLS_ICON_COLORS.accent],
  'readme.md': ['markdown', GITHUB_TOOLS_ICON_COLORS.accent],
  'changelog': ['markdown', GITHUB_TOOLS_ICON_COLORS.accent],
  'changelog.md': ['markdown', GITHUB_TOOLS_ICON_COLORS.accent],
  'agents.md': ['markdown', GITHUB_TOOLS_ICON_COLORS.accent],
  'contributing.md': ['markdown', GITHUB_TOOLS_ICON_COLORS.accent],
  'security.md': ['markdown', GITHUB_TOOLS_ICON_COLORS.accent],
  'code_of_conduct.md': ['markdown', GITHUB_TOOLS_ICON_COLORS.accent],
  license: ['license', GITHUB_TOOLS_ICON_COLORS.done],
  'license.md': ['license', GITHUB_TOOLS_ICON_COLORS.done],
  notice: ['license', GITHUB_TOOLS_ICON_COLORS.done],
  '.env': ['settings', GITHUB_TOOLS_ICON_COLORS.neutral],
  '.env.example': ['settings', GITHUB_TOOLS_ICON_COLORS.neutral],
  '.editorconfig': ['settings', GITHUB_TOOLS_ICON_COLORS.neutral],
  '.gitignore': ['git', GITHUB_TOOLS_ICON_COLORS.danger],
  '.gitattributes': ['git', GITHUB_TOOLS_ICON_COLORS.danger],
  '.gitmodules': ['git', GITHUB_TOOLS_ICON_COLORS.danger],
});

const GITHUB_TOOLS_EXTENSION_ICONS = Object.freeze({
  js: ['javascript', GITHUB_TOOLS_ICON_COLORS.attention],
  jsx: ['react', GITHUB_TOOLS_ICON_COLORS.accent],
  mjs: ['javascript', GITHUB_TOOLS_ICON_COLORS.attention],
  cjs: ['javascript', GITHUB_TOOLS_ICON_COLORS.attention],
  ts: ['typescript', GITHUB_TOOLS_ICON_COLORS.accent],
  tsx: ['react', GITHUB_TOOLS_ICON_COLORS.accent],
  json: ['json', GITHUB_TOOLS_ICON_COLORS.attention],
  json5: ['json', GITHUB_TOOLS_ICON_COLORS.attention],
  jsonc: ['json', GITHUB_TOOLS_ICON_COLORS.attention],
  html: ['html', GITHUB_TOOLS_ICON_COLORS.danger],
  htm: ['html', GITHUB_TOOLS_ICON_COLORS.danger],
  xhtml: ['html', GITHUB_TOOLS_ICON_COLORS.danger],
  css: ['css', GITHUB_TOOLS_ICON_COLORS.accent],
  scss: ['css', GITHUB_TOOLS_ICON_COLORS.accent],
  sass: ['css', GITHUB_TOOLS_ICON_COLORS.accent],
  less: ['css', GITHUB_TOOLS_ICON_COLORS.accent],
  vue: ['vue', GITHUB_TOOLS_ICON_COLORS.open],
  svelte: ['svelte', GITHUB_TOOLS_ICON_COLORS.danger],
  astro: ['astro', GITHUB_TOOLS_ICON_COLORS.danger],
  py: ['python', GITHUB_TOOLS_ICON_COLORS.accent],
  pyw: ['python', GITHUB_TOOLS_ICON_COLORS.accent],
  rb: ['ruby', GITHUB_TOOLS_ICON_COLORS.danger],
  go: ['go', GITHUB_TOOLS_ICON_COLORS.accent],
  rs: ['rust', GITHUB_TOOLS_ICON_COLORS.attention],
  java: ['java', GITHUB_TOOLS_ICON_COLORS.danger],
  kt: ['kotlin', GITHUB_TOOLS_ICON_COLORS.done],
  kts: ['kotlin', GITHUB_TOOLS_ICON_COLORS.done],
  php: ['php', GITHUB_TOOLS_ICON_COLORS.accent],
  c: ['c', GITHUB_TOOLS_ICON_COLORS.neutral],
  h: ['c', GITHUB_TOOLS_ICON_COLORS.neutral],
  cc: ['cpp', GITHUB_TOOLS_ICON_COLORS.accent],
  cpp: ['cpp', GITHUB_TOOLS_ICON_COLORS.accent],
  cxx: ['cpp', GITHUB_TOOLS_ICON_COLORS.accent],
  hpp: ['cpp', GITHUB_TOOLS_ICON_COLORS.accent],
  swift: ['swift', GITHUB_TOOLS_ICON_COLORS.danger],
  sql: ['database', GITHUB_TOOLS_ICON_COLORS.attention],
  graphql: ['graphql', GITHUB_TOOLS_ICON_COLORS.done],
  gql: ['graphql', GITHUB_TOOLS_ICON_COLORS.done],
  sh: ['terminal', GITHUB_TOOLS_ICON_COLORS.neutral],
  bash: ['terminal', GITHUB_TOOLS_ICON_COLORS.neutral],
  zsh: ['terminal', GITHUB_TOOLS_ICON_COLORS.neutral],
  fish: ['terminal', GITHUB_TOOLS_ICON_COLORS.neutral],
  ps1: ['terminal', GITHUB_TOOLS_ICON_COLORS.accent],
  bat: ['terminal', GITHUB_TOOLS_ICON_COLORS.neutral],
  cmd: ['terminal', GITHUB_TOOLS_ICON_COLORS.neutral],
  yml: ['yaml', GITHUB_TOOLS_ICON_COLORS.danger],
  yaml: ['yaml', GITHUB_TOOLS_ICON_COLORS.danger],
  toml: ['settings', GITHUB_TOOLS_ICON_COLORS.neutral],
  xml: ['settings', GITHUB_TOOLS_ICON_COLORS.neutral],
  ini: ['settings', GITHUB_TOOLS_ICON_COLORS.neutral],
  conf: ['settings', GITHUB_TOOLS_ICON_COLORS.neutral],
  config: ['settings', GITHUB_TOOLS_ICON_COLORS.neutral],
  env: ['settings', GITHUB_TOOLS_ICON_COLORS.neutral],
  md: ['markdown', GITHUB_TOOLS_ICON_COLORS.accent],
  markdown: ['markdown', GITHUB_TOOLS_ICON_COLORS.accent],
  mdx: ['markdown', GITHUB_TOOLS_ICON_COLORS.accent],
  txt: ['document', GITHUB_TOOLS_ICON_COLORS.neutral],
  log: ['document', GITHUB_TOOLS_ICON_COLORS.neutral],
  rst: ['document', GITHUB_TOOLS_ICON_COLORS.neutral],
  pdf: ['pdf', GITHUB_TOOLS_ICON_COLORS.danger],
  doc: ['document', GITHUB_TOOLS_ICON_COLORS.accent],
  docx: ['document', GITHUB_TOOLS_ICON_COLORS.accent],
  xls: ['table', GITHUB_TOOLS_ICON_COLORS.success],
  xlsx: ['table', GITHUB_TOOLS_ICON_COLORS.success],
  ods: ['table', GITHUB_TOOLS_ICON_COLORS.success],
  csv: ['table', GITHUB_TOOLS_ICON_COLORS.success],
  tsv: ['table', GITHUB_TOOLS_ICON_COLORS.success],
  ppt: ['presentation', GITHUB_TOOLS_ICON_COLORS.attention],
  pptx: ['presentation', GITHUB_TOOLS_ICON_COLORS.attention],
  odp: ['presentation', GITHUB_TOOLS_ICON_COLORS.attention],
  png: ['image', GITHUB_TOOLS_ICON_COLORS.done],
  jpg: ['image', GITHUB_TOOLS_ICON_COLORS.done],
  jpeg: ['image', GITHUB_TOOLS_ICON_COLORS.done],
  gif: ['image', GITHUB_TOOLS_ICON_COLORS.done],
  webp: ['image', GITHUB_TOOLS_ICON_COLORS.done],
  svg: ['image', GITHUB_TOOLS_ICON_COLORS.done],
  mp3: ['audio', GITHUB_TOOLS_ICON_COLORS.done],
  wav: ['audio', GITHUB_TOOLS_ICON_COLORS.done],
  mp4: ['video', GITHUB_TOOLS_ICON_COLORS.done],
  mov: ['video', GITHUB_TOOLS_ICON_COLORS.done],
  zip: ['archive', GITHUB_TOOLS_ICON_COLORS.attention],
  gz: ['archive', GITHUB_TOOLS_ICON_COLORS.attention],
  tar: ['archive', GITHUB_TOOLS_ICON_COLORS.attention],
  ttf: ['font', GITHUB_TOOLS_ICON_COLORS.done],
  otf: ['font', GITHUB_TOOLS_ICON_COLORS.done],
  woff: ['font', GITHUB_TOOLS_ICON_COLORS.done],
  woff2: ['font', GITHUB_TOOLS_ICON_COLORS.done],
  lock: ['lock', GITHUB_TOOLS_ICON_COLORS.neutral],
});

function normalizeGithubToolsEntryName(value) {
  return String(value || '').trim().replace(/\\/g, '/').split('/').pop().toLowerCase();
}

function resolveGithubToolsIcon(fileName, isDirectory = false) {
  const name = normalizeGithubToolsEntryName(fileName);

  if (isDirectory) {
    const folder = GITHUB_TOOLS_FOLDER_ICONS[name];
    return Object.freeze({
      iconKey: folder?.[0] || 'folder',
      color: folder?.[1] || GITHUB_TOOLS_ICON_COLORS.neutral,
    });
  }

  const special = GITHUB_TOOLS_SPECIAL_FILE_ICONS[name];
  if (special) return Object.freeze({ iconKey: special[0], color: special[1] });
  if (/^\.git/.test(name)) return Object.freeze({ iconKey: 'git', color: GITHUB_TOOLS_ICON_COLORS.danger });
  if (/^\.env(?:\.|$)/.test(name) || /(?:^|[.-])config(?:[.-]|$)/.test(name)) {
    return Object.freeze({ iconKey: 'settings', color: GITHUB_TOOLS_ICON_COLORS.neutral });
  }
  if (/^(?:readme|changelog|agents|contributing|security)(?:\.|$)/.test(name)) {
    return Object.freeze({ iconKey: 'markdown', color: GITHUB_TOOLS_ICON_COLORS.accent });
  }
  if (/^(?:license|notice)(?:\.|$)/.test(name)) {
    return Object.freeze({ iconKey: 'license', color: GITHUB_TOOLS_ICON_COLORS.done });
  }

  const extension = name.includes('.') ? name.split('.').pop() : '';
  const typed = GITHUB_TOOLS_EXTENSION_ICONS[extension];
  return Object.freeze({
    iconKey: typed?.[0] || 'file',
    color: typed?.[1] || GITHUB_TOOLS_ICON_COLORS.neutral,
  });
}

if (typeof module === 'object' && module.exports) {
  module.exports = { resolveGithubToolsIcon };
}

(function () {
  'use strict';
  if (typeof document === 'undefined') return;

  const BUTTON_MARKER = 'data-fork-finder-button';
  const CLONE_BUTTON_MARKER = 'data-github-tools-clone-button';
  const FILE_ICON_MARKER = 'data-github-tools-file-icon';
  const FILE_TYPE_MARKER = 'data-github-tools-file-type';
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
    `a[${FILE_TYPE_MARKER}] {`,
    `  font-weight: 500;`,
    `}`,
    `a[${FILE_TYPE_MARKER}="${':folder'}"] {`,
    `  font-weight: 700;`,
    `}`,
    `span[${FILE_ICON_MARKER}] {`,
    `  display: inline-flex;`,
    `  width: 16px;`,
    `  height: 16px;`,
    `  margin: 0 4px 0 0;`,
    `  vertical-align: text-bottom;`,
    `  flex: 0 0 auto;`,
    `}`,
    `span[${FILE_ICON_MARKER}] .github-tools-file-icon-svg {`,
    `  display: block;`,
    `  width: 16px;`,
    `  height: 16px;`,
    `  min-width: 16px;`,
    `  min-height: 16px;`,
    `  fill: currentColor;`,
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

  function isRepositoryRootOrTreeRoute() {
    const segments = location.pathname.split('/').filter(Boolean);
    return segments.length === 2 || (segments.length >= 4 && segments[2].toLowerCase() === 'tree');
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

    paths.forEach((pathData, index) => {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', pathData);
      if (paths === CODE_PATH && index > 0) {
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', 'currentColor');
        path.setAttribute('stroke-linecap', 'round');
        path.setAttribute('stroke-linejoin', 'round');
        path.setAttribute('stroke-width', '1.25');
      }
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

  const FOLDER_PATH = 'M1.75 1h4.59c.46 0 .91.18 1.23.51l.92.91c.14.14.33.22.53.22h5.23c.97 0 1.75.78 1.75 1.75v8.86c0 .97-.78 1.75-1.75 1.75H1.75A1.75 1.75 0 0 1 0 13.25V2.75C0 1.78.78 1 1.75 1Z';
  const FILE_PATH = 'M3.75 1h5.59L13 4.66v10.09c0 .69-.56 1.25-1.25 1.25h-8A1.75 1.75 0 0 1 2 14.25v-11.5C2 1.78 2.78 1 3.75 1Zm5.25 1.5v3h3v-.22L9.22 2.5H9Z';
  const CODE_PATH = [FILE_PATH, 'M5.25 9.5 3.75 11l1.5 1.5m5-3L11.75 11l-1.5 1.5'];
  const PACKAGE_PATH = 'M8 1 14 4.25v7.5L8 15l-6-3.25v-7.5L8 1Zm0 1.72L3.5 5.16 8 7.59l4.5-2.43L8 2.72ZM3.5 6.44v4.42l3.75 2.03V8.47L3.5 6.44Zm9 0L8.75 8.47v4.42l3.75-2.03V6.44Z';
  const GITHUB_TOOLS_ICON_PATHS = Object.freeze({
    folder: [FOLDER_PATH],
    'folder-github': [FOLDER_PATH],
    'folder-git': [FOLDER_PATH],
    'folder-vscode': [FOLDER_PATH],
    'folder-docs': [FOLDER_PATH],
    'folder-test': [FOLDER_PATH],
    'folder-images': [FOLDER_PATH],
    'folder-public': [FOLDER_PATH],
    'folder-src': [FOLDER_PATH],
    'folder-packages': [FOLDER_PATH, PACKAGE_PATH],
    'folder-scripts': [FOLDER_PATH],
    'folder-tools': [FOLDER_PATH],
    'folder-config': [FOLDER_PATH],
    file: [FILE_PATH],
    javascript: CODE_PATH,
    react: CODE_PATH,
    typescript: CODE_PATH,
    json: CODE_PATH,
    html: CODE_PATH,
    css: CODE_PATH,
    vue: CODE_PATH,
    svelte: CODE_PATH,
    astro: CODE_PATH,
    python: CODE_PATH,
    ruby: CODE_PATH,
    go: CODE_PATH,
    rust: CODE_PATH,
    java: CODE_PATH,
    kotlin: CODE_PATH,
    php: CODE_PATH,
    c: CODE_PATH,
    cpp: CODE_PATH,
    swift: CODE_PATH,
    yaml: CODE_PATH,
    'npm/package': [PACKAGE_PATH],
    'npm/lock': [PACKAGE_PATH],
    pnpm: [PACKAGE_PATH],
    yarn: [PACKAGE_PATH],
    docker: [PACKAGE_PATH],
    markdown: [FILE_PATH],
    license: [FILE_PATH],
    git: [FILE_PATH],
    settings: [FILE_PATH],
    table: [FILE_PATH],
    presentation: [FILE_PATH],
    graphql: [FILE_PATH],
    terminal: [FILE_PATH],
    database: [FILE_PATH],
    image: [FILE_PATH],
    audio: [FILE_PATH],
    video: [FILE_PATH],
    archive: [FILE_PATH],
    font: [FILE_PATH],
    lock: [FILE_PATH],
    pdf: [FILE_PATH],
    document: [FILE_PATH],
  });

  function createFileIcon(resolution, isDirectory) {
    const wrapper = document.createElement('span');
    wrapper.setAttribute(FILE_ICON_MARKER, '');
    wrapper.setAttribute('aria-hidden', 'true');
    wrapper.dataset.iconKey = resolution.iconKey;
    wrapper.dataset.iconType = resolution.iconKey;
    wrapper.dataset.iconKind = isDirectory ? 'folder' : 'file';

    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('aria-hidden', 'true');
    icon.setAttribute('focusable', 'false');
    icon.setAttribute('viewBox', '0 0 16 16');
    icon.setAttribute('width', '16');
    icon.setAttribute('height', '16');
    icon.setAttribute('fill', 'currentColor');
    icon.dataset.iconKey = resolution.iconKey;
    icon.classList.add('github-tools-file-icon-svg');
    icon.style.color = resolution.color;

    const paths = GITHUB_TOOLS_ICON_PATHS[resolution.iconKey] || GITHUB_TOOLS_ICON_PATHS.file;
    paths.forEach((pathData, index) => {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', pathData);
      if (paths === CODE_PATH && index > 0) {
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', 'currentColor');
        path.setAttribute('stroke-linecap', 'round');
        path.setAttribute('stroke-linejoin', 'round');
        path.setAttribute('stroke-width', '1.25');
      }
      icon.appendChild(path);
    });
    wrapper.append(icon);
    return wrapper;
  }

  function addFileIcons() {
    const repository = getRepository();
    if (!repository) return;

    const entryPrefix = '/' + repository.owner + '/' + repository.repository + '/';
    const entries = [...document.querySelectorAll('a[href]')].filter((link) => (
      link.pathname.toLowerCase().startsWith(entryPrefix)
      && /\/(?:blob|tree)\//i.test(link.pathname)
    ));

    entries.forEach((link) => {
      const row = link.closest('tr, [role="row"], .Box-row, .js-navigation-item, li');
      if (!row) return;

      const nameCell = link.closest('td, [role="gridcell"], [role="cell"]') || link.parentElement;
      if (!nameCell) return;

      const managedIcon = nameCell.querySelector('[' + FILE_ICON_MARKER + ']');
      const nativeIcon = nameCell.querySelector('svg.octicon-file, svg.octicon-file-directory-fill, svg[class*="icon-directory"]');
      const iconCandidate = managedIcon?.querySelector('svg') || nativeIcon;
      const fileName = getFileNameFromLink(link);
      if (!fileName) return;

      const isDirectory = /\/tree\//i.test(link.pathname)
        || managedIcon?.dataset.iconKind === 'folder'
        || iconCandidate?.classList.contains('octicon-file-directory-fill')
        || iconCandidate?.classList.contains('icon-directory');
      const resolution = resolveGithubToolsIcon(fileName, isDirectory);

      link.setAttribute(FILE_TYPE_MARKER, isDirectory ? ':folder' : resolution.iconKey);
      link.style.setProperty('color', resolution.color, 'important');

      if (managedIcon
        && managedIcon.dataset.iconKey === resolution.iconKey
        && managedIcon.dataset.iconKind === (isDirectory ? 'folder' : 'file')) return;

      const icon = createFileIcon(resolution, isDirectory);
      const oldIcon = managedIcon || nativeIcon;
      if (oldIcon) oldIcon.replaceWith(icon);
      else link.before(icon);
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
    if (!isRepositoryRootOrTreeRoute()) return;
    if (scheduled) return;
    scheduled = true;

    requestAnimationFrame(() => {
      scheduled = false;
      if (!isRepositoryRootOrTreeRoute()) return;
      addButton();
      addCloneButton();
      addFileIcons();
      addRepositorySize();
    });
  }

  if (isRepositoryRootOrTreeRoute()) {
    addButton();
    addCloneButton();
    addFileIcons();
    addRepositorySize();
  }

  new MutationObserver(scheduleUpdate).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  document.addEventListener('turbo:load', scheduleUpdate);
  document.addEventListener('pjax:end', scheduleUpdate);
}());
