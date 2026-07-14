// ==UserScript==
// @name         Script Manager do Site
// @namespace    script-manager-do-site.user.js
// @version      1.4
// @icon         https://img.icons8.com/?size=100&id=LXhpSVCU82mF&format=png&color=000000
// @description  Bloqueia scripts externos por host usando chave estável (origin+pathname).
// @author       lourencosv (GPT)
// @license      CC BY-NC 4.0
// @updateURL    https://raw.githubusercontent.com/vibeinstance/script-manager/refs/heads/main/script-manager-do-site.user.js
// @downloadURL  https://raw.githubusercontent.com/vibeinstance/script-manager/refs/heads/main/script-manager-do-site.user.js
// @match        http://*/*
// @match        https://*/*
// @match        file://*/*
// @run-at       document-start
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @grant        GM_addStyle
// ==/UserScript==

(() => {
  'use strict';

  const alreadyLoaded = Boolean(window.__VINI_SM_LOADED__);
  window.__VINI_SM_LOADED__ = true;

  const HOST = location.hostname || '(sem-host)';
  const IS_TOP = (() => {
    try {
      return window.top === window.self;
    } catch {
      return true;
    }
  })();

  const SITE_KEY = (host) => `blockedScripts:${host}`;
  const INLINE_SITE_KEY = (host) => `blockedInlineScripts:${host}`;
  const INDEX_KEY = 'blockedIndex';
  const INLINE_INDEX_KEY = 'blockedInlineIndex';
  const EXCLUDED_KEY = 'excludedHosts';
  const NATIVE_APPEND_CHILD = Node.prototype.appendChild;
  const NATIVE_INSERT_BEFORE = Node.prototype.insertBefore;

  function lockPageScroll(doc = document) {
    const html = doc && doc.documentElement;
    const body = doc && doc.body;
    if (!html && !body) return () => {};
    const win = (doc && doc.defaultView) || window;
    const KEY = "__pjPageScrollLock__";
    const state = win[KEY] || (win[KEY] = { count: 0, prevHtmlOverflow: "", prevBodyOverflow: "" });
    if (state.count === 0) {
      state.prevHtmlOverflow = html ? html.style.overflow : "";
      state.prevBodyOverflow = body ? body.style.overflow : "";
      if (html) html.style.overflow = "hidden";
      if (body) body.style.overflow = "hidden";
    }
    state.count += 1;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      state.count = Math.max(0, state.count - 1);
      if (state.count === 0) {
        if (html) html.style.overflow = state.prevHtmlOverflow;
        if (body) body.style.overflow = state.prevBodyOverflow;
      }
    };
  }

  function parseJson(raw, fallback) {
    try {
      const value = JSON.parse(raw);
      return value && typeof value === 'object' ? value : fallback;
    } catch {
      return fallback;
    }
  }

  function loadIndex() {
    return parseJson(GM_getValue(INDEX_KEY, '{}'), {});
  }

  function saveIndex(value) {
    GM_setValue(INDEX_KEY, JSON.stringify(value));
  }

  function loadInlineIndex() {
    return parseJson(GM_getValue(INLINE_INDEX_KEY, '{}'), {});
  }

  function saveInlineIndex(value) {
    GM_setValue(INLINE_INDEX_KEY, JSON.stringify(value));
  }

  function loadSet(key) {
    const arr = parseJson(GM_getValue(key, '[]'), []);
    return Array.isArray(arr) ? new Set(arr) : new Set();
  }

  function saveSet(key, set) {
    GM_setValue(key, JSON.stringify([...set]));
  }

  function loadBlockedForHost(host) {
    return loadSet(SITE_KEY(host));
  }

  function saveBlockedForHost(host, set) {
    saveSet(SITE_KEY(host), set);
    const index = loadIndex();
    const arr = [...set];
    if (arr.length) index[host] = arr;
    else delete index[host];
    saveIndex(index);
  }

  function loadBlockedInlineForHost(host) {
    return loadSet(INLINE_SITE_KEY(host));
  }

  function saveBlockedInlineForHost(host, set) {
    saveSet(INLINE_SITE_KEY(host), set);
    const index = loadInlineIndex();
    const arr = [...set];
    if (arr.length) index[host] = arr;
    else delete index[host];
    saveInlineIndex(index);
  }

  function loadExcludedHosts() {
    return loadSet(EXCLUDED_KEY);
  }

  function saveExcludedHosts(set) {
    GM_setValue(EXCLUDED_KEY, JSON.stringify([...set].sort()));
  }

  let blocked = loadBlockedForHost(HOST);
  let blockedInline = loadBlockedInlineForHost(HOST);
  let excludedHosts = loadExcludedHosts();

  function isHostExcluded(host) {
    return excludedHosts.has(host);
  }

  function setHostExcluded(host, enabled) {
    if (enabled) excludedHosts.add(host);
    else excludedHosts.delete(host);
    saveExcludedHosts(excludedHosts);
  }

  function srcKey(src) {
    try {
      const u = new URL(src, location.href);
      return `${u.origin}${u.pathname}`;
    } catch {
      return String(src || '').trim();
    }
  }

  function fullHref(src) {
    try {
      return new URL(src, location.href).href;
    } catch {
      return String(src || '').trim();
    }
  }

  function hostFromHref(href) {
    try {
      return new URL(href).host || '(desconhecido)';
    } catch {
      return '(desconhecido)';
    }
  }

  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(16);
  }

  function inlineKeyFromCode(code) {
    return `inline:${hash(String(code || '').trim())}`;
  }

  function describeScript(el) {
    const src = el.getAttribute('src');
    if (src) {
      return { kind: 'external', href: fullHref(src), key: srcKey(src) };
    }
    const code = (el.textContent || '').trim();
    const preview = code.slice(0, 180).replace(/\s+/g, ' ');
    const key = inlineKeyFromCode(code);
    return {
      kind: 'inline',
      key,
      id: `${key}:${preview.slice(0, 36)}`,
      preview,
      size: code.length,
    };
  }

  function isBlockedScriptElement(el) {
    const src = el?.getAttribute?.('src');
    if (src) return blocked.has(srcKey(src));
    return blockedInline.has(inlineKeyFromCode(el?.textContent || ''));
  }

  function neutralizeScript(el) {
    try {
      el.type = 'text/plain';
      el.setAttribute('data-sm-blocked', '1');
      if (el.parentNode) el.parentNode.removeChild(el);
    } catch {}
  }

  function installInterceptors() {
    function intercept(node) {
      try {
        if (node && node.tagName === 'SCRIPT' && isBlockedScriptElement(node)) {
          neutralizeScript(node);
          return node;
        }
      } catch {}
      return null;
    }

    Node.prototype.appendChild = function patchedAppendChild(node) {
      const result = intercept(node);
      if (result) return result;
      return NATIVE_APPEND_CHILD.call(this, node);
    };

    Node.prototype.insertBefore = function patchedInsertBefore(node, ref) {
      const result = intercept(node);
      if (result) return result;
      return NATIVE_INSERT_BEFORE.call(this, node, ref);
    };
  }

  function installMutationBlocker() {
    const tryBlockNode = (node) => {
      if (!node) return;
      if (node.tagName === 'SCRIPT' && isBlockedScriptElement(node)) {
        neutralizeScript(node);
        return;
      }
      if (!node.querySelectorAll) return;
      const scripts = node.querySelectorAll('script');
      for (const s of scripts) {
        if (isBlockedScriptElement(s)) neutralizeScript(s);
      }
    };

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const added of mutation.addedNodes) tryBlockNode(added);
      }
    });

    const start = () => {
      const root = document.documentElement || document;
      observer.observe(root, { childList: true, subtree: true });
      try {
        document.querySelectorAll('script').forEach((s) => {
          if (isBlockedScriptElement(s)) neutralizeScript(s);
        });
      } catch {}
    };

    if (document.documentElement) start();
    else {
      new MutationObserver(() => {
        if (document.documentElement) start();
      }).observe(document, { childList: true, subtree: true });
    }
  }

  function ensureStyles() {
    if (window.__VINI_SM_STYLES__) return;
    window.__VINI_SM_STYLES__ = true;

    GM_addStyle(`
      #smx-overlay {
        --smx-bg:#f2f6fc;
        --smx-card:#ffffff;
        --smx-card-2:#f8fbff;
        --smx-text:#0f172a;
        --smx-muted:#64748b;
        --smx-line:#dbe5f1;
        --smx-accent:#2563eb;
        --smx-accent-soft:#eef4ff;
        --smx-success:#0f766e;
        --smx-success-soft:#ecfdf5;
        --smx-danger:#b42318;
        --smx-danger-soft:#fff1f2;
        --smx-warn:#9a6700;
        --smx-warn-soft:#fff7e6;
        --smx-shadow:0 28px 90px rgba(2, 6, 23, .28);
        --smx-radius:16px;
        --smx-radius-sm:10px;
        --smx-font:13px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;
        position: fixed;
        inset: 0;
        z-index: 2147483647;
        background: rgba(15, 23, 42, .48);
        backdrop-filter: blur(4px);
        -webkit-backdrop-filter: blur(4px);
        color: var(--smx-text);
        font: var(--smx-font);
        overscroll-behavior: contain;
      }
      #smx-overlay, #smx-overlay * { box-sizing: border-box; }
      #smx-panel {
        position: fixed;
        inset: 4vh 3vw;
        background: var(--smx-card);
        border: 1px solid var(--smx-line);
        border-radius: calc(var(--smx-radius) + 4px);
        box-shadow: var(--smx-shadow);
        display: grid;
        grid-template-rows: auto 1fr;
        overflow: hidden;
        overscroll-behavior: contain;
      }
      .smx-head {
        padding: 14px 16px;
        border-bottom: 1px solid #dbe3ef;
        background: linear-gradient(135deg, #0f3e75, #1f5ca4);
      }
      .smx-head-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }
      .smx-title { margin: 0; font-size: 16px; font-weight: 800; color: #ffffff !important; }
      .smx-sub { margin-top: 4px; color: rgba(255,255,255,.88) !important; font-size: 12px; }
      .smx-close {
        border: 0;
        background: rgba(255,255,255,.2) !important;
        color: #ffffff !important;
        border-radius: 999px;
        width: 34px;
        height: 34px;
        padding: 0;
        cursor: pointer;
        font: inherit;
      }
      .smx-close:hover { background: rgba(255,255,255,.28) !important; }
      .smx-layout {
        min-height: 0;
        display: grid;
        grid-template-columns: 260px 1fr;
        background: var(--smx-bg);
      }
      .smx-nav {
        border-right: 1px solid var(--smx-line);
        background: #f8fbff;
        padding: 14px;
        display: grid;
        align-content: start;
        gap: 10px;
        overflow: auto;
        overscroll-behavior: contain;
      }
      .smx-nav-title {
        font-size: 11px;
        font-weight: 800;
        letter-spacing: .08em;
        color: var(--smx-muted) !important;
        text-transform: uppercase;
        padding: 2px 4px;
      }
      .smx-nav-btn {
        width: 100%;
        text-align: left;
        border: 1px solid transparent;
        border-radius: 12px;
        background: transparent !important;
        color: var(--smx-text) !important;
        padding: 11px 12px;
        cursor: pointer;
        font: inherit;
      }
      .smx-nav-btn:hover { background: #fff !important; border-color: var(--smx-line); }
      .smx-nav-btn[data-active="1"] {
        background: var(--smx-accent-soft) !important;
        border-color: rgba(37,99,235,.2);
      }
      .smx-nav-label { display:block; font-weight:700; font-size:12.5px; }
      .smx-nav-desc { display:block; color: var(--smx-muted) !important; font-size:11.5px; margin-top:2px; }
      .smx-main {
        min-width: 0;
        min-height: 0;
        overflow: auto;
        overscroll-behavior: contain;
        padding: 16px;
        display: grid;
        align-content: start;
        gap: 14px;
      }
      .smx-grid { display: grid; gap: 14px; grid-template-columns: repeat(12, minmax(0,1fr)); }
      .smx-card {
        background: var(--smx-card);
        border: 1px solid var(--smx-line);
        border-radius: var(--smx-radius);
        overflow: visible;
        box-shadow: 0 1px 2px rgba(15, 23, 42, .04);
      }
      .smx-card-head {
        padding: 12px 14px 10px;
        border-bottom: 1px solid var(--smx-line);
        background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
      }
      .smx-card-title { margin: 0; font-size: 13px; font-weight: 800; color: var(--smx-text) !important; }
      .smx-card-desc { margin-top: 4px; color: var(--smx-muted) !important; font-size: 12px; }
      .smx-card-body { padding: 14px; display: grid; gap: 10px; }
      .smx-full { grid-column: span 12; }
      .smx-half { grid-column: span 6; }
      .smx-third { grid-column: span 4; }
      .smx-pills { display: flex; flex-wrap: wrap; gap: 8px; }
      .smx-pill {
        border: 1px solid var(--smx-line);
        border-radius: 999px;
        background: #fff !important;
        color: var(--smx-muted) !important;
        padding: 4px 9px;
        font-size: 11.5px;
      }
      .smx-note {
        border: 1px solid rgba(154,103,0,.2);
        background: var(--smx-warn-soft);
        color: var(--smx-warn) !important;
        border-radius: 12px;
        padding: 9px 10px;
        font-size: 12px;
      }
      .smx-ok {
        border: 1px solid rgba(15,118,110,.2);
        background: var(--smx-success-soft);
        color: var(--smx-success) !important;
        border-radius: 12px;
        padding: 9px 10px;
        font-size: 12px;
      }
      .smx-input, .smx-select {
        width: 100%;
        border: 1px solid var(--smx-line);
        border-radius: 10px;
        background: #fff !important;
        color: var(--smx-text) !important;
        padding: 9px 10px;
        font: inherit;
        outline: none;
      }
      .smx-input:focus, .smx-select:focus {
        border-color: #93c5fd;
        box-shadow: 0 0 0 4px rgba(37,99,235,.15);
      }
      .smx-row { display:flex; flex-wrap: wrap; gap: 8px; align-items: center; }
      .smx-btn {
        border: 1px solid var(--smx-line);
        border-radius: 10px;
        background: #fff !important;
        color: var(--smx-text) !important;
        padding: 8px 10px;
        cursor: pointer;
        font: inherit;
        white-space: nowrap;
      }
      .smx-btn:hover { border-color: #c7d4e3; background: #fbfdff !important; }
      .smx-btn-primary {
        background: var(--smx-accent-soft) !important;
        border-color: rgba(37,99,235,.22);
        color: var(--smx-accent) !important;
      }
      .smx-btn-danger {
        background: var(--smx-danger-soft) !important;
        border-color: rgba(180,35,24,.22);
        color: var(--smx-danger) !important;
      }
      details.smx-item {
        border: 1px solid var(--smx-line);
        border-radius: 12px;
        background: #fff;
        overflow: visible;
      }
      details.smx-item > summary {
        list-style: none;
        cursor: pointer;
        padding: 10px 12px;
        display: flex;
        justify-content: space-between;
        gap: 10px;
        align-items: center;
      }
      details.smx-item > summary::-webkit-details-marker { display:none; }
      details.smx-item[open] > summary {
        background: #f9fbff;
        border-bottom: 1px solid var(--smx-line);
      }
      .smx-sum-main { min-width: 0; display:grid; gap:2px; }
      .smx-sum-title {
        font-weight: 700;
        font-size: 12.5px;
        color: var(--smx-text) !important;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .smx-sum-sub { font-size: 11.5px; color: var(--smx-muted) !important; }
      .smx-sum-badge {
        border: 1px solid var(--smx-line);
        border-radius: 999px;
        padding: 3px 8px;
        font-size: 11px;
        color: var(--smx-muted) !important;
        background: #fff !important;
      }
      .smx-list-row {
        padding: 10px 12px;
        border-bottom: 1px solid var(--smx-line);
        display: grid;
        gap: 6px;
      }
      .smx-list-row:last-child { border-bottom: 0; }
      .smx-mono {
        font-family: ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace;
        font-size: 12px;
        word-break: break-all;
        color: var(--smx-text) !important;
      }
      .smx-meta { color: var(--smx-muted) !important; font-size: 11.5px; }
      .smx-empty {
        border: 1px dashed var(--smx-line);
        border-radius: 12px;
        background: #fff;
        color: var(--smx-muted) !important;
        padding: 14px;
        font-size: 12px;
      }
      .smx-kv { display: grid; gap: 8px; }
      .smx-kv-row {
        display: flex;
        justify-content: space-between;
        gap: 10px;
        padding: 8px 10px;
        border: 1px solid var(--smx-line);
        border-radius: 10px;
        background: #fff;
      }
      .smx-kv-key { color: var(--smx-muted) !important; font-size: 12px; }
      .smx-kv-val { color: var(--smx-text) !important; font-weight: 700; font-size: 12px; text-align: right; }
      @media (max-width: 980px) {
        .smx-layout { grid-template-columns: 1fr; }
        .smx-nav { border-right: 0; border-bottom: 1px solid var(--smx-line); }
        .smx-half, .smx-third { grid-column: span 12; }
      }
    `);
  }

  function whenDomReady(fn) {
    if (document.readyState === 'complete' || document.readyState === 'interactive') fn();
    else document.addEventListener('DOMContentLoaded', fn, { once: true });
  }

  function el(tag, opts = {}, children = []) {
    const node = document.createElement(tag);
    if (opts.className) node.className = opts.className;
    if (opts.text != null) node.textContent = opts.text;
    if (opts.html != null) node.innerHTML = opts.html;
    if (opts.type) node.type = opts.type;
    if (opts.placeholder) node.placeholder = opts.placeholder;
    if (opts.value != null) node.value = opts.value;
    if (opts.attrs) {
      Object.entries(opts.attrs).forEach(([k, v]) => {
        if (v == null || v === false) return;
        node.setAttribute(k, v === true ? '' : String(v));
      });
    }
    if (opts.on) {
      Object.entries(opts.on).forEach(([k, fn]) => node.addEventListener(k, fn));
    }
    children.forEach((child) => {
      if (child == null) return;
      node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
    });
    return node;
  }

  function summaryNode(title, subtitle, badge) {
    return el('summary', {}, [
      el('div', { className: 'smx-sum-main' }, [
        el('div', { className: 'smx-sum-title', text: title }),
        el('div', { className: 'smx-sum-sub', text: subtitle }),
      ]),
      el('span', { className: 'smx-sum-badge', text: badge }),
    ]);
  }

  function openShell() {
    if (document.getElementById('smx-overlay')) return null;
    ensureStyles();

    const overlay = el('div', { attrs: { id: 'smx-overlay' } });
    const panel = el('div', { attrs: { id: 'smx-panel' } });
    const head = el('div', { className: 'smx-head' });
    const headTop = el('div', { className: 'smx-head-top' });
    const titleWrap = el('div');
    const title = el('h2', { className: 'smx-title', text: 'Script Manager' });
    const subtitle = el('div', { className: 'smx-sub', text: `Host atual: ${HOST}` });
    const closeBtn = el('button', { className: 'smx-close', type: 'button', text: 'Fechar' });
    const layout = el('div', { className: 'smx-layout' });
    const nav = el('div', { className: 'smx-nav' });
    const main = el('div', { className: 'smx-main' });
    let unlockPageScroll = () => {};
    let mountObserver = null;
    let mountRetryTimer = null;

    titleWrap.appendChild(title);
    titleWrap.appendChild(subtitle);
    headTop.appendChild(titleWrap);
    headTop.appendChild(closeBtn);
    head.appendChild(headTop);

    layout.appendChild(nav);
    layout.appendChild(main);
    panel.appendChild(head);
    panel.appendChild(layout);
    overlay.appendChild(panel);

    function close() {
      if (mountObserver) {
        try {
          mountObserver.disconnect();
        } catch {}
        mountObserver = null;
      }
      if (mountRetryTimer) {
        clearTimeout(mountRetryTimer);
        mountRetryTimer = null;
      }
      try {
        overlay.remove();
      } catch {}
      try {
        unlockPageScroll();
      } catch {}
      window.removeEventListener('keydown', onEsc, true);
    }

    const onEsc = (e) => {
      if (e.key === 'Escape') close();
    };

    closeBtn.addEventListener('click', close);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });
    window.addEventListener('keydown', onEsc, true);

    const mountOverlay = () => {
      const root = document.body || document.documentElement;
      if (!root || overlay.isConnected) return false;
      try {
        NATIVE_APPEND_CHILD.call(root, overlay);
      } catch {
        return false;
      }
      try {
        unlockPageScroll = lockPageScroll(document);
      } catch {}
      return true;
    };

    if (!mountOverlay()) {
      mountObserver = new MutationObserver(() => {
        if (!mountOverlay()) return;
        try {
          mountObserver.disconnect();
        } catch {}
        mountObserver = null;
      });
      try {
        mountObserver.observe(document, { childList: true, subtree: true });
      } catch {}

      mountRetryTimer = setTimeout(() => {
        mountOverlay();
        if (mountObserver) {
          try {
            mountObserver.disconnect();
          } catch {}
          mountObserver = null;
        }
        mountRetryTimer = null;
      }, 800);
    }

    return { overlay, panel, head, nav, main, close };
  }

  function collectScriptsFromDoc(doc) {
    try {
      return Array.from(doc.querySelectorAll('script')).map(describeScript);
    } catch {
      return [];
    }
  }

  function collectScriptsIncludingFrames(includeFrames) {
    const described = [];
    const notes = [];
    if (!includeFrames) {
      described.push(...collectScriptsFromDoc(document));
      return { described, notes };
    }

    const visited = new Set();

    function walk(win, path) {
      if (!win || visited.has(win)) return;
      visited.add(win);

      let doc;
      try {
        doc = win.document;
      } catch {
        notes.push(`Frame cross-origin inacessivel: ${path}`);
        return;
      }

      described.push(...collectScriptsFromDoc(doc));

      let frames;
      try {
        frames = win.frames;
      } catch {
        return;
      }

      for (let i = 0; i < frames.length; i++) walk(frames[i], `${path}/${i}`);
    }

    walk(window, 'top');
    return { described, notes };
  }

  function matchesQuery(item, q) {
    if (!q) return true;
    const text = [item.kind, item.href || '', item.key || '', item.id || '', item.preview || '']
      .join(' ')
      .toLowerCase();
    return text.includes(q);
  }

  function buildPanelApp() {
    const shell = openShell();
    if (!shell) return;

    const state = {
      view: 'overview',
      siteSearch: '',
      siteIncludeFrames: false,
      globalSearch: '',
      excludedSearch: '',
    };

    const navTitle = el('div', { className: 'smx-nav-title', text: 'Painel' });
    shell.nav.appendChild(navTitle);

    const views = [
      {
        id: 'overview',
        label: 'Resumo',
        desc: 'Visão geral e ações rápidas do host atual',
        render: renderOverviewView,
      },
      {
        id: 'site',
        label: 'Este site',
        desc: 'Listar e bloquear scripts detectados nesta página',
        render: renderSiteView,
      },
      {
        id: 'global',
        label: 'Bloqueios globais',
        desc: 'Gerenciar todos os bloqueios salvos por host',
        render: renderGlobalView,
      },
      {
        id: 'excluded',
        label: 'Sites excluídos',
        desc: 'Hosts ignorados completamente pelo script',
        render: renderExcludedView,
      },
    ];

    const navButtons = new Map();

    function setView(viewId) {
      state.view = viewId;
      render();
    }

    views.forEach((v) => {
      const btn = el('button', {
        className: 'smx-nav-btn',
        type: 'button',
        on: { click: () => setView(v.id) },
      }, [
        el('span', { className: 'smx-nav-label', text: v.label }),
        el('span', { className: 'smx-nav-desc', text: v.desc }),
      ]);
      navButtons.set(v.id, btn);
      shell.nav.appendChild(btn);
    });

    function card(title, desc, bodyChildren) {
      const c = el('section', { className: 'smx-card smx-full' });
      const head = el('div', { className: 'smx-card-head' }, [
        el('h3', { className: 'smx-card-title', text: title }),
        desc ? el('div', { className: 'smx-card-desc', text: desc }) : null,
      ]);
      const body = el('div', { className: 'smx-card-body' });
      bodyChildren.forEach((child) => body.appendChild(child));
      c.appendChild(head);
      c.appendChild(body);
      return c;
    }

    function smallStatCard(title, value, hint) {
      const c = el('section', { className: 'smx-card smx-third' });
      const body = el('div', { className: 'smx-card-body' }, [
        el('div', { className: 'smx-meta', text: title }),
        el('div', { className: 'smx-title', text: String(value) }),
        hint ? el('div', { className: 'smx-meta', text: hint }) : null,
      ]);
      c.appendChild(body);
      return c;
    }

    function refreshHostState() {
      blocked = loadBlockedForHost(HOST);
      blockedInline = loadBlockedInlineForHost(HOST);
      excludedHosts = loadExcludedHosts();
    }

    function renderOverviewView(container) {
      refreshHostState();

      const hostExcluded = isHostExcluded(HOST);
      const index = loadIndex();
      const inlineIndex = loadInlineIndex();
      const globalHosts = new Set([...Object.keys(index), ...Object.keys(inlineIndex)]).size;
      const totalGlobalExternal = Object.values(index).reduce((acc, arr) => acc + (Array.isArray(arr) ? arr.length : 0), 0);
      const totalGlobalInline = Object.values(inlineIndex).reduce((acc, arr) => acc + (Array.isArray(arr) ? arr.length : 0), 0);

      const grid = el('div', { className: 'smx-grid' });
      grid.appendChild(smallStatCard('Host atual', HOST, hostExcluded ? 'Excluído do script' : 'Ativo'));
      grid.appendChild(smallStatCard('Bloqueios neste host', blocked.size, 'Scripts externos'));
      grid.appendChild(smallStatCard('Bloqueios inline neste host', blockedInline.size, 'Hash de conteúdo'));
      container.appendChild(grid);

      const statusMessage = hostExcluded
        ? el('div', { className: 'smx-note', text: 'Este host está excluído. O script não aplica bloqueios nem interceptações aqui.' })
        : el('div', { className: 'smx-ok', text: 'Este host está ativo. O bloqueio de scripts externos e inline está habilitado.' });

      container.appendChild(card(
        'Estado do host atual',
        'Use estas ações para ativar/desativar o script somente neste host.',
        [
          statusMessage,
          el('div', { className: 'smx-row' }, [
            el('button', {
              className: hostExcluded ? 'smx-btn smx-btn-primary' : 'smx-btn smx-btn-danger',
              type: 'button',
              text: hostExcluded ? 'Reativar script neste host' : 'Excluir host dos efeitos do script',
              on: {
                click: () => {
                  setHostExcluded(HOST, !hostExcluded);
                  refreshHostState();
                  registerMenuCommand();
                  render();
                },
              },
            }),
            el('button', {
              className: 'smx-btn',
              type: 'button',
              text: 'Abrir visão deste site',
              on: { click: () => setView('site') },
            }),
            el('button', {
              className: 'smx-btn',
              type: 'button',
              text: 'Abrir bloqueios globais',
              on: { click: () => setView('global') },
            }),
          ]),
        ]
      ));

      container.appendChild(card(
        'Resumo global',
        'Contagem total de bloqueios persistidos e hosts excluídos.',
        [
          el('div', { className: 'smx-pills' }, [
            el('span', { className: 'smx-pill', text: `Hosts com bloqueios: ${globalHosts}` }),
            el('span', { className: 'smx-pill', text: `Bloqueios externos: ${totalGlobalExternal}` }),
            el('span', { className: 'smx-pill', text: `Bloqueios inline: ${totalGlobalInline}` }),
            el('span', { className: 'smx-pill', text: `Hosts excluídos: ${excludedHosts.size}` }),
          ]),
          el('div', { className: 'smx-meta', text: 'Use “Este site” para diagnosticar a página atual, “Bloqueios globais” para limpar regras salvas e “Sites excluídos” para gerenciar hosts ignorados.' }),
        ]
      ));
    }

    function renderSiteView(container) {
      refreshHostState();

      const hostExcluded = isHostExcluded(HOST);
      const controls = el('div', { className: 'smx-row' });
      const search = el('input', {
        className: 'smx-input',
        placeholder: 'Filtrar por URL, domínio, hash ou trecho',
        value: state.siteSearch,
        on: {
          input: (e) => {
            state.siteSearch = e.target.value;
            render();
          },
        },
      });
      const framesBtn = el('button', {
        className: `smx-btn ${state.siteIncludeFrames ? 'smx-btn-primary' : ''}`,
        type: 'button',
        text: `Frames: ${state.siteIncludeFrames ? 'sim' : 'não'}`,
        on: {
          click: () => {
            state.siteIncludeFrames = !state.siteIncludeFrames;
            render();
          },
        },
      });
      const refreshBtn = el('button', {
        className: 'smx-btn',
        type: 'button',
        text: 'Atualizar leitura',
        on: { click: () => render() },
      });
      controls.appendChild(search);
      controls.appendChild(framesBtn);
      controls.appendChild(refreshBtn);

      const topInfo = hostExcluded
        ? el('div', { className: 'smx-note', text: 'Este host está excluído. O painel continua visível, mas o bloqueio não é aplicado até você reativar o host.' })
        : el('div', { className: 'smx-ok', text: 'Bloqueio ativo. Scripts dinâmicos detectados depois do carregamento podem ser neutralizados automaticamente.' });

      const collected = collectScriptsIncludingFrames(state.siteIncludeFrames);
      const q = state.siteSearch.trim().toLowerCase();
      const externalsAll = collected.described.filter((s) => s.kind === 'external');
      const inlineAll = collected.described.filter((s) => s.kind === 'inline');
      const externals = externalsAll.filter((s) => matchesQuery(s, q));
      const inlines = inlineAll.filter((s) => matchesQuery(s, q));

      container.appendChild(card(
        'Detector de scripts da página',
        'Use o filtro para localizar scripts e bloquear/liberar rapidamente. Externos usam origin + pathname. Inline usam hash do conteúdo.',
        [
          controls,
          topInfo,
          el('div', { className: 'smx-pills' }, [
            el('span', { className: 'smx-pill', text: `Total lidos: ${collected.described.length}` }),
            el('span', { className: 'smx-pill', text: `Externos: ${externalsAll.length} (filtro: ${externals.length})` }),
            el('span', { className: 'smx-pill', text: `Inline: ${inlineAll.length} (filtro: ${inlines.length})` }),
            el('span', { className: 'smx-pill', text: `Bloqueados externos neste host: ${blocked.size}` }),
            el('span', { className: 'smx-pill', text: `Bloqueados inline neste host: ${blockedInline.size}` }),
          ]),
          collected.notes.length ? el('div', { className: 'smx-note', text: collected.notes.join(' | ') }) : null,
          el('div', { className: 'smx-note', text: 'Limite técnico: scripts inline do HTML inicial podem executar antes do userscript em alguns cenários do navegador.' }),
        ].filter(Boolean)
      ));

      const extSectionBody = [];
      const byDomain = new Map();
      externals.forEach((s) => {
        const domain = hostFromHref(s.href);
        if (!byDomain.has(domain)) byDomain.set(domain, []);
        byDomain.get(domain).push(s);
      });
      const domains = [...byDomain.keys()].sort((a, b) => a.localeCompare(b));

      if (domains.length === 0) {
        extSectionBody.push(el('div', { className: 'smx-empty', text: 'Nenhum script externo encontrado para o filtro atual.' }));
      } else {
        domains.forEach((domain) => {
          const items = byDomain.get(domain).slice().sort((a, b) => (a.href || '').localeCompare(b.href || ''));
          const blockedCount = items.filter((s) => blocked.has(s.key)).length;
          const details = el('details', { className: 'smx-item', attrs: { open: q || blockedCount > 0 } });
          details.appendChild(summaryNode(domain, `${items.length} script(s) externos detectados`, `${blockedCount} bloqueado(s)`));

          items.forEach((s) => {
            const row = el('div', { className: 'smx-list-row' });
            row.appendChild(el('div', { className: 'smx-mono', text: s.href }));
            row.appendChild(el('div', { className: 'smx-meta', text: `Chave: ${s.key} | Estado: ${blocked.has(s.key) ? 'bloqueado' : 'liberado'}` }));
            row.appendChild(el('div', { className: 'smx-row' }, [
              el('button', {
                className: `smx-btn ${blocked.has(s.key) ? 'smx-btn-primary' : ''}`,
                type: 'button',
                text: blocked.has(s.key) ? 'Liberar script' : 'Bloquear script',
                on: {
                  click: () => {
                    if (blocked.has(s.key)) blocked.delete(s.key);
                    else blocked.add(s.key);
                    saveBlockedForHost(HOST, blocked);
                    blocked = loadBlockedForHost(HOST);
                    render();
                  },
                },
              }),
            ]));
            details.appendChild(row);
          });

          extSectionBody.push(details);
        });
      }

      container.appendChild(card(
        'Scripts externos por domínio',
        'Clique no domínio para expandir e controlar scripts individuais.',
        extSectionBody
      ));

      const inlineBody = [];
      if (inlines.length === 0) {
        inlineBody.push(el('div', { className: 'smx-empty', text: 'Nenhum script inline encontrado para o filtro atual.' }));
      } else {
        const details = el('details', { className: 'smx-item' });
        if (q) details.setAttribute('open', 'open');
        details.appendChild(summaryNode('Scripts inline', 'Bloqueio por hash do conteúdo', `${inlines.length} item(ns)`));

        inlines.forEach((s) => {
          const row = el('div', { className: 'smx-list-row' });
          row.appendChild(el('div', { className: 'smx-mono', text: `[inline] ${s.id}` }));
          row.appendChild(el('div', { className: 'smx-meta', text: `Hash: ${s.key} | Tamanho: ${s.size} chars | Prévia: ${(s.preview || '').slice(0, 120)}` }));
          row.appendChild(el('div', { className: 'smx-row' }, [
            el('button', {
              className: `smx-btn ${blockedInline.has(s.key) ? 'smx-btn-primary' : ''}`,
              type: 'button',
              text: blockedInline.has(s.key) ? 'Liberar inline' : 'Bloquear inline',
              on: {
                click: () => {
                  if (blockedInline.has(s.key)) blockedInline.delete(s.key);
                  else blockedInline.add(s.key);
                  saveBlockedInlineForHost(HOST, blockedInline);
                  blockedInline = loadBlockedInlineForHost(HOST);
                  render();
                },
              },
            }),
          ]));
          details.appendChild(row);
        });

        inlineBody.push(details);
      }

      container.appendChild(card(
        'Scripts inline',
        'Esta lista mostra scripts embutidos na página. O bloqueio usa hash do conteúdo, não URL.',
        inlineBody
      ));
    }

    function renderGlobalView(container) {
      refreshHostState();

      const searchRow = el('div', { className: 'smx-row' });
      const search = el('input', {
        className: 'smx-input',
        placeholder: 'Filtrar por host ou chave/hash',
        value: state.globalSearch,
        on: {
          input: (e) => {
            state.globalSearch = e.target.value;
            render();
          },
        },
      });
      const clearAll = el('button', {
        className: 'smx-btn smx-btn-danger',
        type: 'button',
        text: 'Zerar todos os bloqueios',
        on: {
          click: () => {
            const extIndex = loadIndex();
            const inlIndex = loadInlineIndex();
            const hosts = [...new Set([...Object.keys(extIndex), ...Object.keys(inlIndex)])];
            hosts.forEach((host) => {
              saveBlockedForHost(host, new Set());
              saveBlockedInlineForHost(host, new Set());
            });
            GM_setValue(INDEX_KEY, '{}');
            GM_setValue(INLINE_INDEX_KEY, '{}');
            refreshHostState();
            render();
          },
        },
      });
      searchRow.appendChild(search);
      searchRow.appendChild(clearAll);

      const extIndex = loadIndex();
      const inlIndex = loadInlineIndex();
      const allHosts = [...new Set([...Object.keys(extIndex), ...Object.keys(inlIndex)])].sort();
      const q = state.globalSearch.trim().toLowerCase();
      const hostItems = [];

      allHosts.forEach((host) => {
        const ext = (Array.isArray(extIndex[host]) ? extIndex[host] : []).slice().sort();
        const inl = (Array.isArray(inlIndex[host]) ? inlIndex[host] : []).slice().sort();
        const visibleExt = ext.filter((k) => !q || host.toLowerCase().includes(q) || k.toLowerCase().includes(q));
        const visibleInl = inl.filter((k) => !q || host.toLowerCase().includes(q) || k.toLowerCase().includes(q));
        if (!visibleExt.length && !visibleInl.length) return;
        hostItems.push({ host, visibleExt, visibleInl });
      });

      const totalExt = Object.values(extIndex).reduce((acc, arr) => acc + (Array.isArray(arr) ? arr.length : 0), 0);
      const totalInl = Object.values(inlIndex).reduce((acc, arr) => acc + (Array.isArray(arr) ? arr.length : 0), 0);

      container.appendChild(card(
        'Bloqueios persistidos',
        'Gerencie regras salvas para qualquer host. Você pode limpar tudo, limpar por host ou liberar itens individuais.',
        [
          searchRow,
          el('div', { className: 'smx-pills' }, [
            el('span', { className: 'smx-pill', text: `Hosts: ${allHosts.length}` }),
            el('span', { className: 'smx-pill', text: `Externos: ${totalExt}` }),
            el('span', { className: 'smx-pill', text: `Inline: ${totalInl}` }),
          ]),
        ]
      ));

      if (!hostItems.length) {
        container.appendChild(card(
          'Lista de hosts',
          'Hosts com bloqueios externos ou inline.',
          [el('div', { className: 'smx-empty', text: allHosts.length ? 'Nenhum item corresponde ao filtro atual.' : 'Nenhum bloqueio global registrado.' })]
        ));
        return;
      }

      const body = [];
      hostItems.forEach(({ host, visibleExt, visibleInl }) => {
        const details = el('details', { className: 'smx-item' });
        if (q) details.setAttribute('open', 'open');
        details.appendChild(summaryNode(host, 'Bloqueios externos e inline salvos para este host', `ext ${visibleExt.length} | inl ${visibleInl.length}`));

        const actionRow = el('div', { className: 'smx-list-row' });
        actionRow.appendChild(el('div', { className: 'smx-meta', text: 'Ações do host' }));
        actionRow.appendChild(el('div', { className: 'smx-row' }, [
          el('button', {
            className: 'smx-btn',
            type: 'button',
            text: 'Liberar todos deste host',
            on: {
              click: () => {
                saveBlockedForHost(host, new Set());
                saveBlockedInlineForHost(host, new Set());
                if (host === HOST) refreshHostState();
                render();
              },
            },
          }),
        ]));
        details.appendChild(actionRow);

        if (visibleExt.length) {
          details.appendChild(el('div', { className: 'smx-list-row' }, [el('div', { className: 'smx-meta', text: 'Scripts externos' })]));
          visibleExt.forEach((key) => {
            const row = el('div', { className: 'smx-list-row' });
            row.appendChild(el('div', { className: 'smx-meta', text: 'Chave externa bloqueada' }));
            row.appendChild(el('div', { className: 'smx-mono', text: key }));
            row.appendChild(el('div', { className: 'smx-row' }, [
              el('button', {
                className: 'smx-btn',
                type: 'button',
                text: 'Liberar',
                on: {
                  click: () => {
                    const set = loadBlockedForHost(host);
                    set.delete(key);
                    saveBlockedForHost(host, set);
                    if (host === HOST) refreshHostState();
                    render();
                  },
                },
              }),
            ]));
            details.appendChild(row);
          });
        }

        if (visibleInl.length) {
          details.appendChild(el('div', { className: 'smx-list-row' }, [el('div', { className: 'smx-meta', text: 'Scripts inline (hash)' })]));
          visibleInl.forEach((key) => {
            const row = el('div', { className: 'smx-list-row' });
            row.appendChild(el('div', { className: 'smx-meta', text: 'Hash inline bloqueado' }));
            row.appendChild(el('div', { className: 'smx-mono', text: key }));
            row.appendChild(el('div', { className: 'smx-row' }, [
              el('button', {
                className: 'smx-btn',
                type: 'button',
                text: 'Liberar inline',
                on: {
                  click: () => {
                    const set = loadBlockedInlineForHost(host);
                    set.delete(key);
                    saveBlockedInlineForHost(host, set);
                    if (host === HOST) refreshHostState();
                    render();
                  },
                },
              }),
            ]));
            details.appendChild(row);
          });
        }

        body.push(details);
      });

      container.appendChild(card(
        'Hosts com bloqueios',
        'Clique no host para expandir os itens salvos.',
        body
      ));
    }

    function renderExcludedView(container) {
      refreshHostState();

      const q = state.excludedSearch.trim().toLowerCase();
      const all = [...excludedHosts].sort();
      const visible = all.filter((host) => !q || host.toLowerCase().includes(q));

      const topRow = el('div', { className: 'smx-row' });
      topRow.appendChild(el('input', {
        className: 'smx-input',
        placeholder: 'Filtrar host excluído',
        value: state.excludedSearch,
        on: {
          input: (e) => {
            state.excludedSearch = e.target.value;
            render();
          },
        },
      }));
      topRow.appendChild(el('button', {
        className: isHostExcluded(HOST) ? 'smx-btn smx-btn-primary' : 'smx-btn',
        type: 'button',
        text: isHostExcluded(HOST) ? 'Reativar host atual' : 'Excluir host atual',
        on: {
          click: () => {
            setHostExcluded(HOST, !isHostExcluded(HOST));
            refreshHostState();
            registerMenuCommand();
            render();
          },
        },
      }));
      topRow.appendChild(el('button', {
        className: 'smx-btn smx-btn-danger',
        type: 'button',
        text: 'Remover todas as exclusões',
        on: {
          click: () => {
            excludedHosts = new Set();
            saveExcludedHosts(excludedHosts);
            registerMenuCommand();
            render();
          },
        },
      }));

      container.appendChild(card(
        'Hosts excluídos do script',
        'Hosts excluídos não recebem bloqueio de scripts, interceptores nem leitura automática. O painel continua disponível pelo menu único.',
        [
          topRow,
          el('div', { className: 'smx-pills' }, [
            el('span', { className: 'smx-pill', text: `Total excluídos: ${all.length}` }),
            el('span', { className: 'smx-pill', text: `Host atual: ${isHostExcluded(HOST) ? 'excluído' : 'ativo'}` }),
          ]),
        ]
      ));

      const body = [];
      if (!visible.length) {
        body.push(el('div', { className: 'smx-empty', text: all.length ? 'Nenhum host corresponde ao filtro atual.' : 'Nenhum host excluído.' }));
      } else {
        visible.forEach((host) => {
          const row = el('details', { className: 'smx-item' });
          row.appendChild(summaryNode(host, 'Host ignorado completamente pelo script', host === HOST ? 'host atual' : 'excluído'));
          row.appendChild(el('div', { className: 'smx-list-row' }, [
            el('div', { className: 'smx-meta', text: 'Ações deste host excluído' }),
            el('div', { className: 'smx-row' }, [
              el('button', {
                className: 'smx-btn',
                type: 'button',
                text: 'Reativar host',
                on: {
                  click: () => {
                    setHostExcluded(host, false);
                    refreshHostState();
                    registerMenuCommand();
                    render();
                  },
                },
              }),
            ]),
          ]));
          body.push(row);
        });
      }

      container.appendChild(card(
        'Lista de hosts excluídos',
        'Clique no host para ver a ação de reativação.',
        body
      ));
    }

    function render() {
      views.forEach((v) => {
        const btn = navButtons.get(v.id);
        if (btn) btn.setAttribute('data-active', state.view === v.id ? '1' : '0');
      });
      shell.main.textContent = '';
      const renderer = views.find((v) => v.id === state.view)?.render || renderOverviewView;
      renderer(shell.main);
    }

    render();
  }

  function registerMenuCommand() {
    if (!IS_TOP) return;
    const prevId = window.__VINI_SM_MENU_ID__;
    if (prevId && typeof GM_unregisterMenuCommand === 'function') {
      try {
        GM_unregisterMenuCommand(prevId);
      } catch {}
    }
    window.__VINI_SM_MENU_ID__ = GM_registerMenuCommand('Gerenciar Script Manager do Site', buildPanelApp);
  }

  if (IS_TOP) registerMenuCommand();
  if (alreadyLoaded) return;

  if (!IS_TOP) {
    if (isHostExcluded(HOST)) return;
    installInterceptors();
    installMutationBlocker();
    return;
  }

  if (isHostExcluded(HOST)) return;

  installInterceptors();
  installMutationBlocker();
})();
