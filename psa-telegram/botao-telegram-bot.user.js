// ==UserScript==
// @name         Botão para Telegram na PSARips
// @namespace    botao-telegram-bot.user.js
// @version      2026-09-25-18:15
// @icon         https://img.icons8.com/?size=100&id=ZjsLJhlQchzI&format=png&color=000000
// @description  Abre no Telegram links visitados a partir do PSA.
// @author       lourencosv
// @contributor  Codex <codex@openai.com>
// @license      CC BY-NC 4.0
// @updateURL    https://raw.githubusercontent.com/codacoisa/extensoes/refs/heads/main/psa-telegram/botao-telegram-bot.meta.js
// @downloadURL  https://raw.githubusercontent.com/codacoisa/extensoes/refs/heads/main/psa-telegram/botao-telegram-bot.user.js
// @match        *://*/*
// @run-at       document-end
// @grant        GM_getTab
// @grant        GM_saveTab
// ==/UserScript==

(function () {
  'use strict';

  if (window.top !== window.self) return;

  const BOT_USERNAME = 'Nick_Bypass_Bot';
  const PANEL_ID = 'psa-telegram-panel';
  const STYLE_ID = 'psa-telegram-styles';
  const TAB_STATE_KEY = 'psaTelegramRedirect';
  const REDIRECT_STATE_TTL_MS = 15_000;

  const ICON_PATHS = {
    app: 'M21.5 4.5 18.4 19a1.1 1.1 0 0 1-1.6.7l-4.2-2.8-2.1 2a.95.95 0 0 1-1.6-.67l.36-4.45 8.1-7.3a.5.5 0 0 0-.64-.76l-10.02 6.32-4.28-1.38a1.06 1.06 0 0 1 .03-2.03L20 3.3a1.17 1.17 0 0 1 1.5 1.2Z',
    web: 'M12 2a10 10 0 1 0 10 10A10.01 10.01 0 0 0 12 2Zm6.93 9h-3.01a15.87 15.87 0 0 0-1.38-5.05A8.03 8.03 0 0 1 18.93 11ZM12 4.06c.93 1.14 1.82 3.18 2.17 5.94H9.83C10.18 7.24 11.07 5.2 12 4.06ZM4.07 13h3.01a15.87 15.87 0 0 0 1.38 5.05A8.03 8.03 0 0 1 4.07 13Zm3.01-2H4.07a8.03 8.03 0 0 1 4.39-5.05A15.87 15.87 0 0 0 7.08 11ZM12 19.94c-.93-1.14-1.82-3.18-2.17-5.94h4.34c-.35 2.76-1.24 4.8-2.17 5.94ZM14.39 13H9.61a14.02 14.02 0 0 1 0-2h4.78a14.02 14.02 0 0 1 0 2Zm.15 5.05A15.87 15.87 0 0 0 15.92 13h3.01a8.03 8.03 0 0 1-4.39 5.05Z'
  };

  function isPsaHostname(hostname) {
    const normalizedHostname = hostname.toLowerCase();
    return normalizedHostname === 'psa.wf' || normalizedHostname.endsWith('.psa.wf');
  }

  function isPsaUrl(value) {
    if (!value) return false;

    try {
      return isPsaHostname(new URL(value).hostname);
    } catch {
      return false;
    }
  }

  function getTab(callback) {
    if (typeof GM_getTab !== 'function') {
      callback(null);
      return;
    }

    try {
      GM_getTab((tab) => callback(tab || null));
    } catch {
      callback(null);
    }
  }

  function saveTab(tab) {
    if (typeof GM_saveTab !== 'function') return;

    try {
      GM_saveTab(tab);
    } catch {
      // Tab-scoped tracking is optional; document.referrer remains the fallback.
    }
  }

  function rememberPsaNavigation(event, currentTab) {
    if (
      !event.isTrusted ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) return;
    if (!(event.target instanceof Element)) return;

    const anchor = event.target.closest('a[href]');
    if (!anchor) return;

    const target = (anchor.target || '').toLowerCase();
    if (!['', '_self', '_top', '_parent'].includes(target)) return;

    let destination;
    try {
      destination = new URL(anchor.href, window.location.href);
    } catch {
      return;
    }

    if (!['http:', 'https:'].includes(destination.protocol) || isPsaHostname(destination.hostname)) return;

    function saveRedirectMarker(tab) {
      if (!tab) return;

      tab[TAB_STATE_KEY] = {
        source: window.location.origin,
        expiresAt: Date.now() + REDIRECT_STATE_TTL_MS
      };
      saveTab(tab);
    }

    if (currentTab) {
      saveRedirectMarker(currentTab);
    } else {
      getTab(saveRedirectMarker);
    }
  }

  function listenForPsaLinks() {
    let currentTab = null;
    getTab((tab) => {
      currentTab = tab;
    });

    document.addEventListener('click', (event) => {
      rememberPsaNavigation(event, currentTab);
    }, true);
  }

  function getCurrentUrl() {
    const url = new URL(window.location.href);
    const filteredParams = new URLSearchParams();

    for (const [key, value] of url.searchParams) {
      if (key.toLowerCase() === 'src' && value.toUpperCase() === 'PSA') continue;
      filteredParams.append(key, value);
    }

    url.search = filteredParams.toString();
    return url.href;
  }

  function createTelegramUrl(scheme, message) {
    if (scheme === 'tg') {
      return `tg://resolve?domain=${encodeURIComponent(BOT_USERNAME)}&text=${encodeURIComponent(message)}`;
    }

    const url = new URL(`https://t.me/${BOT_USERNAME}`);
    url.searchParams.set('text', message);
    return url.href;
  }

  function createAction({ variant, title, href, newTab = false }) {
    const link = document.createElement('a');
    link.className = 'psa-telegram-action';
    link.dataset.variant = variant;
    link.href = href;
    link.title = title;
    link.setAttribute('aria-label', title);

    if (newTab) {
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    }

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('fill', 'currentColor');
    path.setAttribute('d', ICON_PATHS[variant]);
    svg.appendChild(path);
    link.appendChild(svg);

    return link;
  }

  function addStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${PANEL_ID} {
        position: fixed;
        right: 16px;
        bottom: 16px;
        z-index: 2147483647;
        display: flex;
        gap: 10px;
        padding: 10px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 16px;
        background: rgba(17, 17, 17, 0.94);
        box-shadow: 0 10px 28px rgba(0, 0, 0, 0.35);
        backdrop-filter: blur(8px);
      }

      #${PANEL_ID} .psa-telegram-action {
        display: inline-flex;
        width: 44px;
        height: 44px;
        align-items: center;
        justify-content: center;
        border-radius: 12px;
        background: #1f1f1f;
        color: #57a9ff;
        transition: background 120ms ease, transform 120ms ease;
      }

      #${PANEL_ID} .psa-telegram-action[data-variant="web"] {
        color: #7be0b8;
      }

      #${PANEL_ID} .psa-telegram-action:hover {
        background: #2d2d2d;
        transform: translateY(-1px);
      }

      #${PANEL_ID} .psa-telegram-action:focus-visible {
        outline: 2px solid #70b7ff;
        outline-offset: 2px;
      }

      #${PANEL_ID} .psa-telegram-action svg {
        display: block;
        width: 22px;
        height: 22px;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function removePanel() {
    document.getElementById(PANEL_ID)?.remove();
    document.getElementById(STYLE_ID)?.remove();
  }

  function watchForSameDocumentNavigation() {
    const renderedUrl = window.location.href;
    let dismissed = false;

    function dismissIfLocationChanged() {
      if (window.location.href === renderedUrl || dismissed) return;
      dismissed = true;
      removePanel();
    }

    window.addEventListener('popstate', dismissIfLocationChanged);
    window.addEventListener('hashchange', dismissIfLocationChanged);
    document.addEventListener('click', (event) => {
      if (!(event.target instanceof Element) || event.target.closest(`#${PANEL_ID}`)) return;

      const anchor = event.target.closest('a[href]');
      if (
        !anchor ||
        anchor.target === '_blank' ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) return;
      removePanel();
    }, true);
    document.addEventListener('submit', (event) => {
      if (event.target instanceof HTMLFormElement && event.target.target !== '_blank') removePanel();
    }, true);

    if (window.navigation && typeof window.navigation.addEventListener === 'function') {
      window.navigation.addEventListener('navigate', (event) => {
        if (event.destination?.url === renderedUrl) return;
        setTimeout(dismissIfLocationChanged, 0);
      });
    }
  }

  function render() {
    if (document.getElementById(PANEL_ID)) return;

    const currentUrl = getCurrentUrl();
    const panel = document.createElement('aside');
    panel.id = PANEL_ID;
    panel.setAttribute('aria-label', 'Abrir URL no Telegram');
    panel.append(
      createAction({
        variant: 'app',
        title: 'Abrir no aplicativo do Telegram',
        href: createTelegramUrl('tg', currentUrl)
      }),
      createAction({
        variant: 'web',
        title: 'Abrir no Telegram Web',
        href: createTelegramUrl('https', currentUrl),
        newTab: true
      })
    );

    addStyles();
    document.documentElement.appendChild(panel);
    watchForSameDocumentNavigation();
  }

  function initializeRedirectPage() {
    const cameFromPsa = isPsaUrl(document.referrer);

    getTab((tab) => {
      const marker = tab?.[TAB_STATE_KEY];
      const wasClickedFromPsa = Boolean(
        marker &&
        marker.expiresAt > Date.now() &&
        isPsaUrl(marker.source)
      );

      if (marker && tab) {
        delete tab[TAB_STATE_KEY];
        saveTab(tab);
      }

      if (cameFromPsa || wasClickedFromPsa) render();
    });
  }

  if (isPsaHostname(window.location.hostname)) {
    listenForPsaLinks();
    return;
  }

  initializeRedirectPage();
})();
