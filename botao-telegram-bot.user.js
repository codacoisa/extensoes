// ==UserScript==
// @name         Botão para Telegram na PSARips
// @namespace    botao-telegram-bot.user.js
// @version      1.3
// @icon         https://img.icons8.com/?size=100&id=ZjsLJhlQchzI&format=png&color=000000
// @description  Marca o clique em continue no go2.pics e mostra atalhos flutuantes para abrir o bot no Telegram.
// @author       lourencosv (GPT)
// @license      CC BY-NC 4.0
// @updateURL    https://raw.githubusercontent.com/vibeinstance/psa-telegram/refs/heads/main/botao-telegram-bot.user.js
// @downloadURL  https://raw.githubusercontent.com/vibeinstance/psa-telegram/refs/heads/main/botao-telegram-bot.user.js
// @match        *://*/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_setClipboard
// @run-at       document-end
// ==/UserScript==

(function () {
  'use strict';

  if (window.top !== window.self) return;

  const CFG = {
    botUsername: 'Nick_Bypass_Bot',
    botUserId: '8226002644',
    armKey: '__psa_go2_next_redirect__',
    webComposeKey: '__psa_go2_telegram_web_compose__',
    armTtlMs: 2 * 60 * 1000,
    webComposeTtlMs: 5 * 60 * 1000,
    desktopCloseDelayMs: 30 * 1000,
    excludedHosts: ['psa.wf', 'go2.pics', 'get-to.link', 't.me', 'telegram.me', 'web.telegram.org'],
    blankFallbackIfCloseFails: false
  };

  const now = () => Date.now();
  const getHost = () => location.hostname.replace(/^www\./, '');
  const isTelegramWebPage = () => getHost() === 'web.telegram.org';
  const getDesktopTelegramUrl = message =>
    `tg://resolve?domain=${encodeURIComponent(CFG.botUsername)}` +
    `&text=${encodeURIComponent(message)}`;
  const getWebTelegramUrlA = () => `https://web.telegram.org/a/#${encodeURIComponent(CFG.botUserId)}`;

  function isExcludedHost(host) {
    return CFG.excludedHosts.some(knownHost => host === knownHost || host.endsWith(`.${knownHost}`));
  }

  function armNextRedirect(reason = 'continue-click') {
    GM_setValue(CFG.armKey, JSON.stringify({ ts: now(), reason, from: location.href }));
  }

  function readJsonValue(key) {
    const raw = GM_getValue(key, '');
    if (!raw) return null;

    try {
      return JSON.parse(raw);
    } catch (_) {
      GM_deleteValue(key);
      return null;
    }
  }

  function readArm() {
    return readJsonValue(CFG.armKey);
  }

  function clearArm() {
    GM_deleteValue(CFG.armKey);
  }

  function savePendingWebCompose(payload) {
    GM_setValue(CFG.webComposeKey, JSON.stringify(payload));
  }

  function readPendingWebCompose() {
    return readJsonValue(CFG.webComposeKey);
  }

  function clearPendingWebCompose() {
    GM_deleteValue(CFG.webComposeKey);
  }

  function isArmValid(arm) {
    return !!(arm && arm.ts && (now() - arm.ts) <= CFG.armTtlMs);
  }

  function isPendingWebComposeValid(payload) {
    return !!(payload && payload.ts && payload.message && (now() - payload.ts) <= CFG.webComposeTtlMs);
  }

  function isGo2Page() {
    return getHost() === 'go2.pics';
  }

  function detectContinueClick(event) {
    const target = event.target?.closest?.('a, button, input[type="button"], input[type="submit"]');
    if (!target) return;

    const text = (target.innerText || target.value || '').trim().toLowerCase();
    const href = (target.href || '').toLowerCase();
    const idClass = `${target.id || ''} ${target.className || ''}`.toLowerCase();

    const looksLikeContinue =
      text.includes('continue') ||
      text.includes('continuar') ||
      idClass.includes('continue') ||
      href.includes('go2') ||
      href.includes('redirect');

    if (looksLikeContinue) armNextRedirect('go2-continue');
  }

  function setupGo2Watcher() {
    document.addEventListener('click', detectContinueClick, true);
    document.addEventListener('submit', () => armNextRedirect('go2-submit'), true);
  }

  function ensureUiStyles() {
    if (document.getElementById('psa-go2-telegram-style')) return;

    const style = document.createElement('style');
    style.id = 'psa-go2-telegram-style';
    style.textContent = `
      #psa-go2-telegram-panel {
        position: fixed;
        right: 16px;
        bottom: 16px;
        z-index: 2147483647;
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px;
        border-radius: 16px;
        background: rgba(17, 17, 17, 0.94);
        border: 1px solid rgba(255, 255, 255, 0.1);
        box-shadow: 0 10px 28px rgba(0,0,0,.35);
        backdrop-filter: blur(8px);
      }
      .psa-go2-telegram-action {
        width: 44px;
        height: 44px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border: 0;
        border-radius: 12px;
        background: #1f1f1f;
        color: #fff;
        cursor: pointer;
        transition: transform .12s ease, background .12s ease, color .12s ease;
      }
      .psa-go2-telegram-action:hover {
        background: #2d2d2d;
        transform: translateY(-1px);
      }
      .psa-go2-telegram-action:focus-visible {
        outline: 2px solid #70b7ff;
        outline-offset: 2px;
      }
      .psa-go2-telegram-action svg {
        width: 22px;
        height: 22px;
        display: block;
      }
      .psa-go2-telegram-action[data-variant="app"] { color: #57a9ff; }
      .psa-go2-telegram-action[data-variant="web"] { color: #7be0b8; }
      #psa-go2-telegram-toast {
        position: fixed;
        right: 16px;
        bottom: 78px;
        z-index: 2147483647;
        background: rgba(17, 17, 17, 0.95);
        color: #fff;
        border-radius: 8px;
        padding: 8px 10px;
        font: 12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        border: 1px solid #333;
      }
    `;

    (document.head || document.documentElement).appendChild(style);
  }

  function toast(message) {
    ensureUiStyles();

    let el = document.getElementById('psa-go2-telegram-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'psa-go2-telegram-toast';
      document.documentElement.appendChild(el);
    }

    el.textContent = message;
    clearTimeout(el._hideTimer);
    el._hideTimer = setTimeout(() => el.remove(), 2200);
  }

  function tryCloseTabBestEffort(delayMs = 300) {
    setTimeout(() => {
      try { window.close(); } catch (_) {}

      if (!CFG.blankFallbackIfCloseFails) return;

      setTimeout(() => {
        try {
          if (!document.hidden) location.replace('about:blank');
        } catch (_) {}
      }, 400);
    }, 300);
  }

  async function copyTextBestEffort(text) {
    if (typeof GM_setClipboard === 'function') {
      GM_setClipboard(text, 'text');
      return true;
    }

    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }

    return false;
  }

  function buildIcon(kind) {
    const svgNs = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNs, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');

    const path = document.createElementNS(svgNs, 'path');
    path.setAttribute('fill', 'currentColor');

    if (kind === 'web') {
      path.setAttribute(
        'd',
        'M12 2a10 10 0 1 0 10 10A10.01 10.01 0 0 0 12 2Zm6.93 9h-3.01a15.87 15.87 0 0 0-1.38-5.05A8.03 8.03 0 0 1 18.93 11ZM12 4.06c.93 1.14 1.82 3.18 2.17 5.94H9.83C10.18 7.24 11.07 5.2 12 4.06ZM4.07 13h3.01a15.87 15.87 0 0 0 1.38 5.05A8.03 8.03 0 0 1 4.07 13Zm3.01-2H4.07a8.03 8.03 0 0 1 4.39-5.05A15.87 15.87 0 0 0 7.08 11ZM12 19.94c-.93-1.14-1.82-3.18-2.17-5.94h4.34c-.35 2.76-1.24 4.8-2.17 5.94ZM14.39 13H9.61a14.02 14.02 0 0 1 0-2h4.78a14.02 14.02 0 0 1 0 2Zm.15 5.05A15.87 15.87 0 0 0 15.92 13h3.01a8.03 8.03 0 0 1-4.39 5.05Z'
      );
    } else {
      path.setAttribute(
        'd',
        'M21.5 4.5 18.4 19a1.1 1.1 0 0 1-1.6.7l-4.2-2.8-2.1 2a.95.95 0 0 1-1.6-.67l.36-4.45 8.1-7.3a.5.5 0 0 0-.64-.76l-10.02 6.32-4.28-1.38a1.06 1.06 0 0 1 .03-2.03L20 3.3a1.17 1.17 0 0 1 1.5 1.2Z'
      );
    }

    svg.appendChild(path);
    return svg;
  }

  function createActionButton(options) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'psa-go2-telegram-action';
    btn.dataset.variant = options.variant;
    btn.title = options.title;
    btn.setAttribute('aria-label', options.title);
    btn.appendChild(buildIcon(options.variant));
    btn.addEventListener('click', options.onClick);
    return btn;
  }

  function openTelegramDesktop(message) {
    clearPendingWebCompose();
    location.href = getDesktopTelegramUrl(message);
    tryCloseTabBestEffort(CFG.desktopCloseDelayMs);
  }

  function openTelegramWeb(message) {
    savePendingWebCompose({
      ts: now(),
      route: 'a',
      botId: CFG.botUserId,
      message
    });

    const opened = window.open(getWebTelegramUrlA(), '_blank');
    if (opened) {
      try { opened.opener = null; } catch (_) {}
    } else {
      location.href = getWebTelegramUrlA();
    }

    tryCloseTabBestEffort();
  }

  function showFloatingActions() {
    if (document.getElementById('psa-go2-telegram-panel')) return;
    ensureUiStyles();

    const currentUrl = location.href;
    const panel = document.createElement('div');
    panel.id = 'psa-go2-telegram-panel';

    panel.append(
      createActionButton({
        variant: 'app',
        title: 'Abrir no app do Telegram',
        onClick: async () => {
          try {
            await copyTextBestEffort(currentUrl);
            toast('URL copiada. Abrindo app do Telegram...');
          } catch (_) {
            toast('Abrindo app do Telegram.');
          }
          openTelegramDesktop(currentUrl);
        }
      }),
      createActionButton({
        variant: 'web',
        title: 'Abrir no Telegram Web (/a/)',
        onClick: async () => {
          try {
            await copyTextBestEffort(currentUrl);
            toast('URL preparada. Abrindo Telegram Web...');
          } catch (_) {
            toast('Abrindo Telegram Web.');
          }
          openTelegramWeb(currentUrl);
        }
      })
    );

    document.documentElement.appendChild(panel);
  }

  function isVisibleElement(el) {
    if (!(el instanceof Element)) return false;

    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    return (
      rect.width > 120 &&
      rect.height > 18 &&
      rect.bottom > 0 &&
      rect.right > 0 &&
      rect.top < window.innerHeight &&
      style.visibility !== 'hidden' &&
      style.display !== 'none'
    );
  }

  function findTelegramWebComposer() {
    const candidates = Array.from(document.querySelectorAll(
      'div[contenteditable="true"][role="textbox"], div[contenteditable="true"][data-tab], div[contenteditable="true"], textarea'
    ))
      .filter(isVisibleElement)
      .map(el => ({ el, rect: el.getBoundingClientRect() }));

    const bottomCandidates = candidates
      .filter(({ rect }) => rect.bottom >= (window.innerHeight * 0.55))
      .sort((a, b) => b.rect.bottom - a.rect.bottom || b.rect.width - a.rect.width);

    if (bottomCandidates.length) return bottomCandidates[0].el;
    return candidates.sort((a, b) => b.rect.bottom - a.rect.bottom || b.rect.width - a.rect.width)[0]?.el || null;
  }

  function readComposerText(el) {
    if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) return el.value || '';
    return el?.textContent || '';
  }

  function dispatchInputEvents(el, text) {
    try {
      el.dispatchEvent(new InputEvent('beforeinput', {
        bubbles: true,
        cancelable: true,
        data: text,
        inputType: 'insertText'
      }));
    } catch (_) {}

    try {
      el.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        data: text,
        inputType: 'insertText'
      }));
    } catch (_) {
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  function injectTextIntoComposer(el, text) {
    if (!el || !text) return false;

    const existing = readComposerText(el).trim();
    if (existing === text || existing.includes(text)) return true;

    const nextText = existing ? `${existing}\n${text}` : text;
    const insertChunk = existing ? `\n${text}` : text;

    try { el.focus({ preventScroll: true }); } catch (_) {}
    try { el.click(); } catch (_) {}

    if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
      el.value = nextText;
      dispatchInputEvents(el, insertChunk);
      return readComposerText(el).includes(text);
    }

    try {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(!!existing);
      selection?.removeAllRanges();
      selection?.addRange(range);
    } catch (_) {}

    if (typeof document.execCommand === 'function') {
      try {
        if (!existing) document.execCommand('selectAll', false, null);
        const inserted = document.execCommand('insertText', false, insertChunk);
        dispatchInputEvents(el, insertChunk);
        if (inserted && readComposerText(el).includes(text)) return true;
      } catch (_) {}
    }

    el.textContent = nextText;
    dispatchInputEvents(el, insertChunk);
    return readComposerText(el).includes(text);
  }

  function isExpectedTelegramWebRoute(payload) {
    if (!payload || payload.route !== 'a') return false;
    const hash = decodeURIComponent(location.hash || '');
    return location.pathname.startsWith('/a') && hash.includes(String(payload.botId));
  }

  function maybeInjectTelegramWebCompose() {
    if (!isTelegramWebPage()) return;

    const payload = readPendingWebCompose();
    if (!isPendingWebComposeValid(payload)) {
      clearPendingWebCompose();
      return;
    }

    let attempts = 0;
    const maxAttempts = 180;
    const timer = setInterval(() => {
      attempts += 1;

      if (!isPendingWebComposeValid(payload)) {
        clearPendingWebCompose();
        clearInterval(timer);
        return;
      }

      if (!isExpectedTelegramWebRoute(payload)) {
        if (attempts >= maxAttempts) clearInterval(timer);
        return;
      }

      const composer = findTelegramWebComposer();
      if (!composer) {
        if (attempts >= maxAttempts) clearInterval(timer);
        return;
      }

      if (injectTextIntoComposer(composer, payload.message)) {
        clearPendingWebCompose();
        clearInterval(timer);
        toast('Link preenchido no Telegram Web.');
        return;
      }

      if (attempts >= maxAttempts) clearInterval(timer);
    }, 700);
  }

  function maybeShowButtonOnNextRedirectedPage() {
    const host = getHost();
    if (isExcludedHost(host)) return;

    const arm = readArm();
    if (!isArmValid(arm)) {
      clearArm();
      return;
    }

    clearArm();
    showFloatingActions();
  }

  maybeInjectTelegramWebCompose();

  if (isGo2Page()) setupGo2Watcher();
  else maybeShowButtonOnNextRedirectedPage();
})();
