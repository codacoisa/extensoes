// ==UserScript==
// @name         Botão para Telegram na PSARips
// @namespace    botao-telegram-bot.user.js
// @version      1.0
// @icon         https://img.icons8.com/?size=100&id=ZjsLJhlQchzI&format=png&color=000000
// @description  Marca o clique em continue no go2.pics e mostra um botão flutuante no próximo site aberto.
// @author       lourencosv (GPT)
// @license      CC BY-NC 4.0
// @updateURL    https://gist.githubusercontent.com/lourencosv/acec6d278e7055ce3623f392e0fb01d6/raw/botao-telegram-bot.user.js
// @downloadURL  https://gist.githubusercontent.com/lourencosv/acec6d278e7055ce3623f392e0fb01d6/raw/botao-telegram-bot.user.js
// @match        *://*/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_addStyle
// @grant        GM_setClipboard
// @run-at       document-end
// ==/UserScript==

(function () {
  'use strict';

  if (window.top !== window.self) return;

  const CFG = {
    botUsername: 'Nick_Bypass_Bot',
    armKey: '__psa_go2_next_redirect__',
    armTtlMs: 2 * 60 * 1000, // 2 min
    buttonText: 'Abrir Telegram e Fechar',
    excludedHosts: ['psa.wf', 'go2.pics', 't.me', 'telegram.me', 'web.telegram.org'],
    blankFallbackIfCloseFails: false // mude para true se quiser cair em about:blank quando não fechar
  };

  const now = () => Date.now();
  const getHost = () => location.hostname.replace(/^www\./, '');

  function isExcludedHost(host) {
    return CFG.excludedHosts.some(h => host === h || host.endsWith('.' + h));
  }

  function armNextRedirect(reason = 'continue-click') {
    GM_setValue(CFG.armKey, JSON.stringify({ ts: now(), reason, from: location.href }));
  }

  function readArm() {
    const raw = GM_getValue(CFG.armKey, '');
    if (!raw) return null;
    try { return JSON.parse(raw); }
    catch { GM_deleteValue(CFG.armKey); return null; }
  }

  function clearArm() {
    GM_deleteValue(CFG.armKey);
  }

  function isArmValid(arm) {
    return !!(arm && arm.ts && (now() - arm.ts) <= CFG.armTtlMs);
  }

  function isGo2Page() {
    return getHost() === 'go2.pics';
  }

  function detectContinueClick(e) {
    const target = e.target?.closest?.('a, button, input[type="button"], input[type="submit"]');
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

  function toast(message) {
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

  function tryCloseTabBestEffort() {
    // Safari costuma bloquear close() em abas não abertas por script.
    setTimeout(() => {
      try { window.close(); } catch (_) {}

      if (!CFG.blankFallbackIfCloseFails) return;

      setTimeout(() => {
        try {
          // Se ainda estivermos aqui, close() falhou.
          if (!document.hidden) location.replace('about:blank');
        } catch (_) {}
      }, 400);
    }, 300);
  }

  function showFloatingButton() {
    if (document.getElementById('psa-go2-telegram-btn')) return;

    GM_addStyle(`
      #psa-go2-telegram-btn {
        position: fixed;
        right: 16px;
        bottom: 16px;
        z-index: 2147483647;
        background: #111;
        color: #fff;
        border: 1px solid #333;
        border-radius: 10px;
        padding: 10px 14px;
        font: 600 13px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        box-shadow: 0 8px 20px rgba(0,0,0,.25);
        cursor: pointer;
      }
      #psa-go2-telegram-btn:hover { background: #1d1d1d; }
      #psa-go2-telegram-toast {
        position: fixed;
        right: 16px;
        bottom: 62px;
        z-index: 2147483647;
        background: rgba(17,17,17,.95);
        color: #fff;
        border-radius: 8px;
        padding: 8px 10px;
        font: 12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        border: 1px solid #333;
      }
    `);

    const btn = document.createElement('button');
    btn.id = 'psa-go2-telegram-btn';
    btn.type = 'button';
    btn.textContent = CFG.buttonText;

    btn.addEventListener('click', async () => {
      const currentUrl = location.href;

      try {
        if (typeof GM_setClipboard === 'function') {
          GM_setClipboard(currentUrl, 'text');
        } else if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(currentUrl);
        }
        toast('URL copiada. Abrindo Telegram...');
      } catch {
        toast('Abrindo Telegram (sem copiar).');
      }

      const tgUrl =
        `tg://resolve?domain=${encodeURIComponent(CFG.botUsername)}` +
        `&text=${encodeURIComponent(currentUrl)}`;

      // Dispara o deep link no mesmo gesto do usuário
      location.href = tgUrl;

      // Tenta fechar a guia depois (Safari pode bloquear)
      tryCloseTabBestEffort();
    });

    document.documentElement.appendChild(btn);
  }

  function maybeShowButtonOnNextRedirectedPage() {
    const host = getHost();
    if (isExcludedHost(host)) return;

    const arm = readArm();
    if (!isArmValid(arm)) {
      clearArm();
      return;
    }

    clearArm(); // só mostra uma vez
    showFloatingButton();
  }

  if (isGo2Page()) setupGo2Watcher();
  else maybeShowButtonOnNextRedirectedPage();
})();