// ==UserScript==
// @name         Script Manager do Site
// @namespace    script-manager-do-site.user.js
// @version      0.8
// @icon         https://img.icons8.com/?size=100&id=LXhpSVCU82mF&format=png&color=000000
// @description  Bloqueia scripts externos por host usando chave estável (origin+pathname).
// @author       lourencosv (GPT)
// @license      CC BY-NC 4.0
// @updateURL    https://gist.githubusercontent.com/lourencosv/e934f6ab104b03a007418a7bb18e36f5/raw/script-manager-do-site.user.js
// @downloadURL  https://gist.githubusercontent.com/lourencosv/e934f6ab104b03a007418a7bb18e36f5/raw/script-manager-do-site.user.js
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

  function parseJson(raw, fallback) {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : fallback;
    } catch {
      return fallback;
    }
  }

  function loadIndex() {
    return parseJson(GM_getValue(INDEX_KEY, '{}'), {});
  }

  function saveIndex(indexObj) {
    GM_setValue(INDEX_KEY, JSON.stringify(indexObj));
  }

  function loadBlockedForHost(host) {
    const arr = parseJson(GM_getValue(SITE_KEY(host), '[]'), []);
    return Array.isArray(arr) ? new Set(arr) : new Set();
  }

  function saveBlockedForHost(host, set) {
    const arr = [...set];
    GM_setValue(SITE_KEY(host), JSON.stringify(arr));
    const index = loadIndex();
    if (arr.length === 0) delete index[host];
    else index[host] = arr;
    saveIndex(index);
  }

  function loadInlineIndex() {
    return parseJson(GM_getValue(INLINE_INDEX_KEY, '{}'), {});
  }

  function saveInlineIndex(indexObj) {
    GM_setValue(INLINE_INDEX_KEY, JSON.stringify(indexObj));
  }

  function loadBlockedInlineForHost(host) {
    const arr = parseJson(GM_getValue(INLINE_SITE_KEY(host), '[]'), []);
    return Array.isArray(arr) ? new Set(arr) : new Set();
  }

  function saveBlockedInlineForHost(host, set) {
    const arr = [...set];
    GM_setValue(INLINE_SITE_KEY(host), JSON.stringify(arr));
    const index = loadInlineIndex();
    if (arr.length === 0) delete index[host];
    else index[host] = arr;
    saveInlineIndex(index);
  }

  function loadExcludedHosts() {
    const arr = parseJson(GM_getValue(EXCLUDED_KEY, '[]'), []);
    return Array.isArray(arr) ? new Set(arr) : new Set();
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

  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(16);
  }

  function inlineKeyFromCode(code) {
    const text = String(code || '').trim();
    return `inline:${hash(text)}`;
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
    const code = (el?.textContent || '').trim();
    return blockedInline.has(inlineKeyFromCode(code));
  }

  function neutralizeScript(el) {
    try {
      el.type = 'text/plain';
      el.setAttribute('data-sm-blocked', '1');
      if (el.parentNode) el.parentNode.removeChild(el);
    } catch {}
  }

  function installInterceptors() {
    const origAppendChild = Node.prototype.appendChild;
    const origInsertBefore = Node.prototype.insertBefore;

    function intercept(node) {
      try {
        if (node && node.tagName === 'SCRIPT' && isBlockedScriptElement(node)) {
          neutralizeScript(node);
          return node;
        }
      } catch {}
      return null;
    }

    Node.prototype.appendChild = function appendChildIntercept(node) {
      const r = intercept(node);
      if (r) return r;
      return origAppendChild.call(this, node);
    };

    Node.prototype.insertBefore = function insertBeforeIntercept(node, ref) {
      const r = intercept(node);
      if (r) return r;
      return origInsertBefore.call(this, node, ref);
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

    const obs = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const n of m.addedNodes) tryBlockNode(n);
      }
    });

    const start = () => {
      const root = document.documentElement || document;
      obs.observe(root, { childList: true, subtree: true });
      try {
        document.querySelectorAll('script').forEach((s) => {
          if (isBlockedScriptElement(s)) neutralizeScript(s);
        });
      } catch {}
    };

    if (document.documentElement) {
      start();
    } else {
      new MutationObserver(() => {
        if (document.documentElement) start();
      }).observe(document, { childList: true, subtree: true });
    }
  }

  const navLock = (() => {
    let active = false;
    let pending = null;
    let restoreFns = [];
    let removedMeta = [];
    let statusCb = null;

    function setStatus(msg) {
      if (typeof statusCb === 'function') statusCb(msg || '');
    }

    function parseMetaRefresh(content) {
      const m = String(content || '').match(/^\s*(\d+)\s*;\s*url\s*=\s*(.+)\s*$/i);
      if (!m) return null;
      return {
        seconds: Number(m[1] || 0),
        url: (m[2] || '').replace(/^['"]|['"]$/g, ''),
      };
    }

    function disableMetaRefresh() {
      try {
        const metas = Array.from(document.querySelectorAll('meta[http-equiv="refresh" i]'));
        for (const meta of metas) {
          const content = meta.getAttribute('content') || '';
          const parsed = parseMetaRefresh(content);
          if (!parsed || !parsed.url) continue;
          removedMeta.push({ node: meta, content });
          meta.parentNode && meta.parentNode.removeChild(meta);
          pending = pending || { type: 'meta-refresh', url: new URL(parsed.url, location.href).href };
          setStatus('Redirecionamento adiado até fechar o painel.');
        }
      } catch {}
    }

    function wrap(obj, prop, wrapper) {
      const orig = obj[prop];
      if (typeof orig !== 'function') return;
      obj[prop] = wrapper(orig);
      restoreFns.push(() => {
        obj[prop] = orig;
      });
    }

    function start(onStatus) {
      if (active) return;
      active = true;
      pending = null;
      removedMeta = [];
      restoreFns = [];
      statusCb = onStatus || null;

      try {
        wrap(window.location, 'assign', (orig) => function assignIntercept(url) {
          if (!active) return orig.call(this, url);
          pending = { type: 'location.assign', url: new URL(String(url), location.href).href };
          setStatus('Navegação adiada até fechar o painel.');
        });
        wrap(window.location, 'replace', (orig) => function replaceIntercept(url) {
          if (!active) return orig.call(this, url);
          pending = { type: 'location.replace', url: new URL(String(url), location.href).href };
          setStatus('Navegação adiada até fechar o painel.');
        });
      } catch {}

      try {
        wrap(history, 'pushState', (orig) => function pushStateIntercept(state, title, url) {
          if (!active) return orig.apply(this, arguments);
          if (url != null) {
            pending = { type: 'history.pushState', url: new URL(String(url), location.href).href };
            setStatus('Navegação adiada até fechar o painel.');
            return;
          }
          return orig.apply(this, arguments);
        });
        wrap(history, 'replaceState', (orig) => function replaceStateIntercept(state, title, url) {
          if (!active) return orig.apply(this, arguments);
          if (url != null) {
            pending = { type: 'history.replaceState', url: new URL(String(url), location.href).href };
            setStatus('Navegação adiada até fechar o painel.');
            return;
          }
          return orig.apply(this, arguments);
        });
      } catch {}

      disableMetaRefresh();
    }

    function stop() {
      if (!active) return null;
      active = false;

      for (const r of restoreFns) {
        try {
          r();
        } catch {}
      }
      restoreFns = [];

      if (!pending) {
        for (const it of removedMeta) {
          try {
            it.node.setAttribute('content', it.content);
            document.head && document.head.appendChild(it.node);
          } catch {}
        }
      }
      removedMeta = [];

      const p = pending;
      pending = null;
      setStatus('');
      statusCb = null;
      return p;
    }

    return { start, stop };
  })();

  function ensureStyles() {
    GM_addStyle(`
      #sm-overlay {
        --sm-bg:#f3f5f8;
        --sm-card:#ffffff;
        --sm-card-2:#f8fafc;
        --sm-text:#0b1220;
        --sm-muted:#5b6b81;
        --sm-border:#dde4ee;
        --sm-shadow:0 24px 80px rgba(11, 18, 32, 0.24);
        --sm-focus:0 0 0 4px rgba(14, 116, 255, 0.18);
        --sm-accent:#0e74ff;
        --sm-accent-soft:#e9f2ff;
        --sm-danger:#b42318;
        --sm-danger-soft:#fef0f0;
        --sm-warn:#9a6700;
        --sm-warn-soft:#fff8eb;
        --sm-radius:16px;
        --sm-radius-sm:10px;
        --sm-font:13px/1.46 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      }
      #sm-overlay {
        position: fixed;
        inset: 0;
        z-index: 2147483647;
        background: rgba(11, 18, 32, 0.45);
        backdrop-filter: blur(3px);
        color: var(--sm-text);
        font: var(--sm-font);
      }
      #sm-overlay, #sm-overlay * {
        box-sizing: border-box;
      }
      #sm-panel {
        position: fixed;
        left: 50%;
        top: 5vh;
        transform: translateX(-50%);
        width: min(1020px, 96vw);
        max-height: 90vh;
        overflow: auto;
        background: var(--sm-card);
        color: var(--sm-text) !important;
        border: 1px solid var(--sm-border);
        border-radius: var(--sm-radius);
        box-shadow: var(--sm-shadow);
        font: var(--sm-font);
      }
      .sm-header {
        position: sticky;
        top: 0;
        z-index: 3;
        background: linear-gradient(180deg, #ffffff 0%, #ffffff 72%, rgba(255, 255, 255, 0.96) 100%);
        border-bottom: 1px solid var(--sm-border);
        padding: 14px;
      }
      .sm-topline {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
      }
      .sm-title {
        margin: 0;
        font-size: 15px;
        font-weight: 750;
        letter-spacing: 0.2px;
        color: var(--sm-text) !important;
      }
      .sm-sub {
        margin-top: 5px;
        color: var(--sm-muted) !important;
        font-size: 12px;
      }
      .sm-controls {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 10px;
      }
      .sm-input {
        flex: 1;
        min-width: 230px;
        box-sizing: border-box;
        border: 1px solid var(--sm-border);
        border-radius: var(--sm-radius-sm);
        padding: 9px 10px;
        font: inherit;
        color: var(--sm-text) !important;
        background: #fff !important;
        outline: none;
      }
      .sm-input:focus {
        border-color: #74b2ff;
        box-shadow: var(--sm-focus);
      }
      .sm-btn {
        border: 1px solid var(--sm-border);
        border-radius: var(--sm-radius-sm);
        background: #fff !important;
        color: var(--sm-text) !important;
        padding: 8px 10px;
        font: inherit;
        cursor: pointer;
        white-space: nowrap;
        transition: border-color .15s ease, background-color .15s ease, color .15s ease;
      }
      .sm-btn:hover { border-color: #bcc7d9; background: #f8fbff; }
      .sm-btn-primary {
        border-color: rgba(14, 116, 255, 0.28);
        background: var(--sm-accent-soft) !important;
        color: var(--sm-accent) !important;
      }
      .sm-btn-danger {
        border-color: rgba(180, 35, 24, 0.26);
        background: var(--sm-danger-soft) !important;
        color: var(--sm-danger) !important;
      }
      .sm-body {
        padding: 14px;
        display: grid;
        gap: 10px;
        background: var(--sm-bg);
      }
      .sm-pillbar {
        display: flex;
        flex-wrap: wrap;
        gap: 7px;
        color: var(--sm-muted) !important;
        font-size: 12px;
      }
      .sm-pill {
        border: 1px solid var(--sm-border);
        border-radius: 999px;
        padding: 4px 9px;
        background: var(--sm-card) !important;
        color: var(--sm-muted) !important;
      }
      .sm-note {
        border: 1px solid rgba(154, 103, 0, 0.26);
        background: var(--sm-warn-soft);
        color: var(--sm-warn) !important;
        border-radius: var(--sm-radius-sm);
        padding: 8px 9px;
        font-size: 12px;
      }
      .sm-status {
        border: 1px solid rgba(14, 116, 255, 0.25);
        background: var(--sm-accent-soft);
        color: var(--sm-accent) !important;
        border-radius: var(--sm-radius-sm);
        padding: 8px 9px;
        font-size: 12px;
        display: none;
        margin-top: 8px;
      }
      .sm-section {
        border: 1px solid var(--sm-border);
        border-radius: var(--sm-radius);
        overflow: hidden;
        background: var(--sm-card);
      }
      .sm-section-title {
        margin: 0;
        padding: 11px 12px;
        font-size: 12.5px;
        font-weight: 750;
        border-bottom: 1px solid var(--sm-border);
        background: var(--sm-card-2);
        color: var(--sm-text) !important;
        text-transform: none !important;
        letter-spacing: 0 !important;
      }
      details.sm-accordion {
        border-top: 1px solid var(--sm-border);
      }
      details.sm-accordion:first-of-type { border-top: 0; }
      details.sm-accordion > summary {
        cursor: pointer;
        list-style: none;
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 10px;
        padding: 10px 12px;
        font-weight: 600;
      }
      details.sm-accordion > summary::-webkit-details-marker { display: none; }
      details.sm-accordion[open] > summary {
        background: var(--sm-card-2);
        border-bottom: 1px solid var(--sm-border);
      }
      .sm-summary-left {
        display: grid;
        gap: 2px;
        min-width: 0;
      }
      .sm-summary-title {
        font-size: 12.5px;
        font-weight: 700;
        color: var(--sm-text) !important;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .sm-summary-sub {
        font-size: 11.5px;
        color: var(--sm-muted) !important;
      }
      .sm-badge {
        border: 1px solid var(--sm-border);
        border-radius: 999px;
        padding: 3px 8px;
        font-size: 11px;
        color: var(--sm-muted) !important;
        background: #fff !important;
      }
      .sm-row {
        padding: 10px 12px;
        border-bottom: 1px solid var(--sm-border);
        display: grid;
        gap: 5px;
      }
      .sm-row:last-child { border-bottom: 0; }
      .sm-mono {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
        font-size: 12px;
        word-break: break-all;
      }
      .sm-meta { color: var(--sm-muted) !important; font-size: 12px; }
      .sm-row-actions { display: flex; flex-wrap: wrap; gap: 8px; }
      .sm-empty {
        padding: 18px 12px;
        color: var(--sm-muted) !important;
        font-size: 12px;
      }
      @media (max-width: 700px) {
        #sm-panel { top: 2vh; max-height: 95vh; width: min(1020px, 98vw); }
        .sm-header { padding: 12px; }
        .sm-body { padding: 12px; }
      }
    `);
  }

  function whenDomReady(fn) {
    if (document.readyState === 'complete' || document.readyState === 'interactive') fn();
    else document.addEventListener('DOMContentLoaded', fn, { once: true });
  }

  function openOverlay(titleText, opts) {
    const options = { lockNavigation: true, ...opts };
    if (document.getElementById('sm-overlay')) return null;
    ensureStyles();

    const overlay = document.createElement('div');
    overlay.id = 'sm-overlay';

    const panel = document.createElement('div');
    panel.id = 'sm-panel';

    const header = document.createElement('div');
    header.className = 'sm-header';

    const topline = document.createElement('div');
    topline.className = 'sm-topline';

    const title = document.createElement('h2');
    title.className = 'sm-title';
    title.textContent = titleText;

    const closeBtn = document.createElement('button');
    closeBtn.className = 'sm-btn';
    closeBtn.type = 'button';
    closeBtn.textContent = 'Fechar';

    const status = document.createElement('div');
    status.className = 'sm-status';

    function setStatus(msg) {
      const text = String(msg || '').trim();
      status.textContent = text;
      status.style.display = text ? 'block' : 'none';
    }

    function closeOverlay() {
      try {
        overlay.remove();
      } catch {}
      if (options.lockNavigation) {
        const pending = navLock.stop();
        if (pending && pending.url) {
          try {
            window.location.href = pending.url;
          } catch {}
        }
      }
      window.removeEventListener('keydown', onEsc, true);
    }

    const onEsc = (e) => {
      if (e.key === 'Escape') closeOverlay();
    };

    closeBtn.addEventListener('click', closeOverlay);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeOverlay();
    });

    topline.appendChild(title);
    topline.appendChild(closeBtn);
    header.appendChild(topline);
    header.appendChild(status);

    panel.appendChild(header);
    overlay.appendChild(panel);

    whenDomReady(() => {
      (document.body || document.documentElement).appendChild(overlay);
    });

    window.addEventListener('keydown', onEsc, true);

    if (options.lockNavigation) navLock.start(setStatus);

    return { panel, header, body: (() => {
      const body = document.createElement('div');
      body.className = 'sm-body';
      panel.appendChild(body);
      return body;
    })() };
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

    described.push(...collectScriptsFromDoc(document));
    if (!includeFrames) return { described, notes };

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

  function hostFromHref(href) {
    try {
      return new URL(href).host || '(desconhecido)';
    } catch {
      return '(desconhecido)';
    }
  }

  function matchesQuery(script, q) {
    if (!q) return true;
    const haystack = [script.kind, script.href || '', script.key || '', script.id || '', script.preview || '']
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  }

  function createAccordionSummary(title, subtitle, badgeText) {
    const summary = document.createElement('summary');

    const left = document.createElement('div');
    left.className = 'sm-summary-left';

    const titleEl = document.createElement('div');
    titleEl.className = 'sm-summary-title';
    titleEl.textContent = title;

    const subEl = document.createElement('div');
    subEl.className = 'sm-summary-sub';
    subEl.textContent = subtitle;

    const badge = document.createElement('span');
    badge.className = 'sm-badge';
    badge.textContent = badgeText;

    left.appendChild(titleEl);
    left.appendChild(subEl);
    summary.appendChild(left);
    summary.appendChild(badge);
    return summary;
  }

  function openSitePanel() {
    const ui = openOverlay(`Script Manager - ${HOST}`, { lockNavigation: true });
    if (!ui) return;

    const sub = document.createElement('div');
    sub.className = 'sm-sub';
    sub.textContent = 'Lista por site de origem. Clique no site para expandir os scripts.';
    ui.header.appendChild(sub);

    const controls = document.createElement('div');
    controls.className = 'sm-controls';

    const search = document.createElement('input');
    search.className = 'sm-input';
    search.placeholder = 'Filtrar por URL, dominio ou trecho';

    const refreshBtn = document.createElement('button');
    refreshBtn.className = 'sm-btn';
    refreshBtn.type = 'button';
    refreshBtn.textContent = 'Recarregar';

    const framesBtn = document.createElement('button');
    framesBtn.className = 'sm-btn';
    framesBtn.type = 'button';
    framesBtn.textContent = 'Frames: nao';

    controls.appendChild(search);
    controls.appendChild(refreshBtn);
    controls.appendChild(framesBtn);
    ui.header.appendChild(controls);

    const warning = document.createElement('div');
    warning.className = 'sm-note';
    warning.textContent = 'Bloqueio externo usa origin + pathname. Inline usa hash do conteudo. Inline do HTML inicial pode executar antes do bloqueio.';
    ui.body.appendChild(warning);

    const content = document.createElement('div');
    ui.body.appendChild(content);

    let includeFrames = false;

    function renderList() {
      const q = (search.value || '').trim().toLowerCase();
      content.textContent = '';

      const { described, notes } = collectScriptsIncludingFrames(includeFrames);
      const externalsAll = described.filter((s) => s.kind === 'external');
      const inlineAll = described.filter((s) => s.kind === 'inline');
      const externals = externalsAll.filter((s) => matchesQuery(s, q));
      const inlines = inlineAll.filter((s) => matchesQuery(s, q));

      const stats = document.createElement('div');
      stats.className = 'sm-pillbar';
      stats.innerHTML = [
        `<span class="sm-pill">Total: ${described.length}</span>`,
        `<span class="sm-pill">Externos: ${externalsAll.length} (filtro: ${externals.length})</span>`,
        `<span class="sm-pill">Inline: ${inlineAll.length} (filtro: ${inlines.length})</span>`,
        `<span class="sm-pill">Bloqueados externos: ${blocked.size}</span>`,
        `<span class="sm-pill">Bloqueados inline: ${blockedInline.size}</span>`,
      ].join('');
      content.appendChild(stats);

      if (notes.length) {
        const note = document.createElement('div');
        note.className = 'sm-note';
        note.textContent = notes.join(' | ');
        content.appendChild(note);
      }

      const extSection = document.createElement('section');
      extSection.className = 'sm-section';
      const extTitle = document.createElement('h3');
      extTitle.className = 'sm-section-title';
      extTitle.textContent = `Sites externos (${externals.length} scripts)`;
      extSection.appendChild(extTitle);

      const bySite = new Map();
      externals.forEach((s) => {
        const host = hostFromHref(s.href);
        if (!bySite.has(host)) bySite.set(host, []);
        bySite.get(host).push(s);
      });

      const sortedSites = [...bySite.keys()].sort((a, b) => a.localeCompare(b));
      if (sortedSites.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'sm-empty';
        empty.textContent = 'Nenhum script externo corresponde ao filtro atual.';
        extSection.appendChild(empty);
      } else {
        for (const site of sortedSites) {
          const items = bySite.get(site).slice().sort((a, b) => (a.href || '').localeCompare(b.href || ''));
          const blockedCount = items.filter((s) => blocked.has(s.key)).length;

          const details = document.createElement('details');
          details.className = 'sm-accordion';
          details.open = Boolean(q) || blockedCount > 0;
          details.appendChild(
            createAccordionSummary(
              site,
              `${items.length} script(s) neste site`,
              `${blockedCount} bloqueado(s)`
            )
          );

          items.forEach((s) => {
            const row = document.createElement('div');
            row.className = 'sm-row';

            const src = document.createElement('div');
            src.className = 'sm-mono';
            src.textContent = s.href;

            const meta = document.createElement('div');
            meta.className = 'sm-meta';
            meta.textContent = `Chave: ${s.key} | Estado: ${blocked.has(s.key) ? 'bloqueado' : 'liberado'}`;

            const actions = document.createElement('div');
            actions.className = 'sm-row-actions';

            const toggle = document.createElement('button');
            const isOn = blocked.has(s.key);
            toggle.type = 'button';
            toggle.className = `sm-btn ${isOn ? 'sm-btn-primary' : ''}`;
            toggle.textContent = isOn ? 'Liberar script' : 'Bloquear script';
            toggle.addEventListener('click', () => {
              if (blocked.has(s.key)) blocked.delete(s.key);
              else blocked.add(s.key);
              saveBlockedForHost(HOST, blocked);
              blocked = loadBlockedForHost(HOST);
              renderList();
            });

            actions.appendChild(toggle);
            row.appendChild(src);
            row.appendChild(meta);
            row.appendChild(actions);
            details.appendChild(row);
          });

          extSection.appendChild(details);
        }
      }
      content.appendChild(extSection);

      const inSection = document.createElement('section');
      inSection.className = 'sm-section';
      const inTitle = document.createElement('h3');
      inTitle.className = 'sm-section-title';
      inTitle.textContent = `Scripts inline (somente visualizacao): ${inlines.length}`;
      inSection.appendChild(inTitle);

      if (inlines.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'sm-empty';
        empty.textContent = 'Nenhum script inline corresponde ao filtro atual.';
        inSection.appendChild(empty);
      } else {
        const details = document.createElement('details');
        details.className = 'sm-accordion';
        details.open = Boolean(q);

        details.appendChild(
          createAccordionSummary(
            'Scripts inline',
            'Conteudo nao bloqueavel por URL',
            `${inlines.length} item(ns)`
          )
        );

        inlines.forEach((s) => {
          const row = document.createElement('div');
          row.className = 'sm-row';

          const id = document.createElement('div');
          id.className = 'sm-mono';
          id.textContent = `[inline] ${s.id}`;

          const meta = document.createElement('div');
          meta.className = 'sm-meta';
          meta.textContent = `Hash: ${s.key} | Tamanho: ${s.size} chars | Preview: ${(s.preview || '').slice(0, 130)}`;

          const actions = document.createElement('div');
          actions.className = 'sm-row-actions';

          const toggle = document.createElement('button');
          const isOn = blockedInline.has(s.key);
          toggle.type = 'button';
          toggle.className = `sm-btn ${isOn ? 'sm-btn-primary' : ''}`;
          toggle.textContent = isOn ? 'Liberar inline' : 'Bloquear inline';
          toggle.addEventListener('click', () => {
            if (blockedInline.has(s.key)) blockedInline.delete(s.key);
            else blockedInline.add(s.key);
            saveBlockedInlineForHost(HOST, blockedInline);
            blockedInline = loadBlockedInlineForHost(HOST);
            renderList();
          });

          row.appendChild(id);
          row.appendChild(meta);
          actions.appendChild(toggle);
          row.appendChild(actions);
          details.appendChild(row);
        });

        inSection.appendChild(details);
      }
      content.appendChild(inSection);
    }

    search.addEventListener('input', renderList);
    refreshBtn.addEventListener('click', renderList);
    framesBtn.addEventListener('click', () => {
      includeFrames = !includeFrames;
      framesBtn.textContent = `Frames: ${includeFrames ? 'sim' : 'nao'}`;
      renderList();
    });

    renderList();
  }

  function openGlobalBlockedPanel() {
    const ui = openOverlay('Bloqueios globais', { lockNavigation: false });
    if (!ui) return;

    const sub = document.createElement('div');
    sub.className = 'sm-sub';
    sub.textContent = 'Visualizacao compacta por host. Clique no host para ver as chaves bloqueadas.';
    ui.header.appendChild(sub);

    const controls = document.createElement('div');
    controls.className = 'sm-controls';

    const search = document.createElement('input');
    search.className = 'sm-input';
    search.placeholder = 'Filtrar por host ou chave';

    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'sm-btn sm-btn-danger';
    clearBtn.textContent = 'Zerar bloqueios globais';

    controls.appendChild(search);
    controls.appendChild(clearBtn);
    ui.header.appendChild(controls);

    const content = document.createElement('div');
    ui.body.appendChild(content);

    function render() {
      const q = (search.value || '').trim().toLowerCase();
      content.textContent = '';

      const index = loadIndex();
      const inlineIndex = loadInlineIndex();
      const hosts = [...new Set([...Object.keys(index), ...Object.keys(inlineIndex)])].sort();
      let totalExternal = 0;
      let totalInline = 0;
      hosts.forEach((h) => {
        totalExternal += Array.isArray(index[h]) ? index[h].length : 0;
        totalInline += Array.isArray(inlineIndex[h]) ? inlineIndex[h].length : 0;
      });

      const stats = document.createElement('div');
      stats.className = 'sm-pillbar';
      stats.innerHTML = `<span class="sm-pill">Hosts: ${hosts.length}</span><span class="sm-pill">Externos: ${totalExternal}</span><span class="sm-pill">Inline: ${totalInline}</span>`;
      content.appendChild(stats);

      const section = document.createElement('section');
      section.className = 'sm-section';
      const title = document.createElement('h3');
      title.className = 'sm-section-title';
      title.textContent = 'Hosts com bloqueios';
      section.appendChild(title);

      let anyVisible = false;
      for (const host of hosts) {
        const extKeys = (Array.isArray(index[host]) ? index[host] : []).slice().sort();
        const inlKeys = (Array.isArray(inlineIndex[host]) ? inlineIndex[host] : []).slice().sort();
        const visibleExt = extKeys.filter((k) => !q || host.toLowerCase().includes(q) || k.toLowerCase().includes(q));
        const visibleInl = inlKeys.filter((k) => !q || host.toLowerCase().includes(q) || k.toLowerCase().includes(q));
        if (visibleExt.length === 0 && visibleInl.length === 0) continue;
        anyVisible = true;

        const details = document.createElement('details');
        details.className = 'sm-accordion';
        details.open = Boolean(q);
        details.appendChild(
          createAccordionSummary(
            host,
            'Bloqueios externos e inline para este host',
            `ext ${visibleExt.length} | inl ${visibleInl.length}`
          )
        );

        const actionRow = document.createElement('div');
        actionRow.className = 'sm-row';
        const actions = document.createElement('div');
        actions.className = 'sm-row-actions';

        const clearHostBtn = document.createElement('button');
        clearHostBtn.type = 'button';
        clearHostBtn.className = 'sm-btn';
        clearHostBtn.textContent = 'Liberar todos deste host';
        clearHostBtn.addEventListener('click', () => {
          saveBlockedForHost(host, new Set());
          saveBlockedInlineForHost(host, new Set());
          if (host === HOST) blocked = loadBlockedForHost(HOST);
          if (host === HOST) blockedInline = loadBlockedInlineForHost(HOST);
          render();
        });

        actions.appendChild(clearHostBtn);
        actionRow.appendChild(actions);
        details.appendChild(actionRow);

        if (visibleExt.length) {
          const extHead = document.createElement('div');
          extHead.className = 'sm-row';
          const label = document.createElement('div');
          label.className = 'sm-meta';
          label.textContent = 'Scripts externos';
          extHead.appendChild(label);
          details.appendChild(extHead);
        }

        visibleExt.forEach((k) => {
          const row = document.createElement('div');
          row.className = 'sm-row';

          const meta = document.createElement('div');
          meta.className = 'sm-meta';
          meta.textContent = 'Chave externa bloqueada';

          const key = document.createElement('div');
          key.className = 'sm-mono';
          key.textContent = k;

          const rowActions = document.createElement('div');
          rowActions.className = 'sm-row-actions';

          const removeBtn = document.createElement('button');
          removeBtn.type = 'button';
          removeBtn.className = 'sm-btn';
          removeBtn.textContent = 'Liberar';
          removeBtn.addEventListener('click', () => {
            const set = loadBlockedForHost(host);
            set.delete(k);
            saveBlockedForHost(host, set);
            if (host === HOST) blocked = loadBlockedForHost(HOST);
            render();
          });

          rowActions.appendChild(removeBtn);
          row.appendChild(meta);
          row.appendChild(key);
          row.appendChild(rowActions);
          details.appendChild(row);
        });

        if (visibleInl.length) {
          const inlHead = document.createElement('div');
          inlHead.className = 'sm-row';
          const label = document.createElement('div');
          label.className = 'sm-meta';
          label.textContent = 'Scripts inline';
          inlHead.appendChild(label);
          details.appendChild(inlHead);
        }

        visibleInl.forEach((k) => {
          const row = document.createElement('div');
          row.className = 'sm-row';

          const meta = document.createElement('div');
          meta.className = 'sm-meta';
          meta.textContent = 'Hash inline bloqueado';

          const key = document.createElement('div');
          key.className = 'sm-mono';
          key.textContent = k;

          const rowActions = document.createElement('div');
          rowActions.className = 'sm-row-actions';

          const removeBtn = document.createElement('button');
          removeBtn.type = 'button';
          removeBtn.className = 'sm-btn';
          removeBtn.textContent = 'Liberar inline';
          removeBtn.addEventListener('click', () => {
            const set = loadBlockedInlineForHost(host);
            set.delete(k);
            saveBlockedInlineForHost(host, set);
            if (host === HOST) blockedInline = loadBlockedInlineForHost(HOST);
            render();
          });

          rowActions.appendChild(removeBtn);
          row.appendChild(meta);
          row.appendChild(key);
          row.appendChild(rowActions);
          details.appendChild(row);
        });

        section.appendChild(details);
      }

      if (!anyVisible) {
        const row = document.createElement('div');
        row.className = 'sm-empty';
        row.textContent = hosts.length === 0
          ? 'Nenhum bloqueio global registrado.'
          : 'Nenhum item corresponde ao filtro atual.';
        section.appendChild(row);
      }

      content.appendChild(section);
    }

    clearBtn.addEventListener('click', () => {
      const index = loadIndex();
      const inlineIndex = loadInlineIndex();
      const hosts = [...new Set([...Object.keys(index), ...Object.keys(inlineIndex)])];
      hosts.forEach((h) => {
        saveBlockedForHost(h, new Set());
        saveBlockedInlineForHost(h, new Set());
      });
      GM_setValue(INDEX_KEY, '{}');
      GM_setValue(INLINE_INDEX_KEY, '{}');
      blocked = loadBlockedForHost(HOST);
      blockedInline = loadBlockedInlineForHost(HOST);
      render();
    });

    search.addEventListener('input', render);
    render();
  }

  function openExcludedHostsPanel() {
    const ui = openOverlay('Sites excluidos do Script Manager', { lockNavigation: false });
    if (!ui) return;

    const sub = document.createElement('div');
    sub.className = 'sm-sub';
    sub.textContent = 'Hosts excluidos ficam totalmente fora dos efeitos do script.';
    ui.header.appendChild(sub);

    const controls = document.createElement('div');
    controls.className = 'sm-controls';

    const search = document.createElement('input');
    search.className = 'sm-input';
    search.placeholder = 'Filtrar host excluido';

    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'sm-btn sm-btn-danger';
    clearBtn.textContent = 'Remover todas as exclusoes';

    controls.appendChild(search);
    controls.appendChild(clearBtn);
    ui.header.appendChild(controls);

    const content = document.createElement('div');
    ui.body.appendChild(content);

    function render() {
      const q = (search.value || '').trim().toLowerCase();
      const all = [...loadExcludedHosts()].sort();

      content.textContent = '';

      const stats = document.createElement('div');
      stats.className = 'sm-pillbar';
      stats.innerHTML = `<span class="sm-pill">Total excluidos: ${all.length}</span>`;
      content.appendChild(stats);

      const section = document.createElement('section');
      section.className = 'sm-section';
      const title = document.createElement('h3');
      title.className = 'sm-section-title';
      title.textContent = 'Hosts excluidos';
      section.appendChild(title);

      const visible = all.filter((h) => !q || h.toLowerCase().includes(q));
      if (visible.length === 0) {
        const row = document.createElement('div');
        row.className = 'sm-empty';
        row.textContent = all.length === 0
          ? 'Nenhum host excluido.'
          : 'Nenhum host corresponde ao filtro atual.';
        section.appendChild(row);
      } else {
        visible.forEach((host) => {
          const details = document.createElement('details');
          details.className = 'sm-accordion';
          details.appendChild(
            createAccordionSummary(
              host,
              'Este host esta totalmente ignorado pelo script',
              'excluido'
            )
          );

          const row = document.createElement('div');
          row.className = 'sm-row';
          const actions = document.createElement('div');
          actions.className = 'sm-row-actions';
          const removeBtn = document.createElement('button');
          removeBtn.type = 'button';
          removeBtn.className = 'sm-btn';
          removeBtn.textContent = 'Reativar host';
          removeBtn.addEventListener('click', () => {
            setHostExcluded(host, false);
            if (host === HOST) excludedHosts = loadExcludedHosts();
            render();
          });
          actions.appendChild(removeBtn);
          row.appendChild(actions);
          details.appendChild(row);
          section.appendChild(details);
        });
      }

      content.appendChild(section);
    }

    clearBtn.addEventListener('click', () => {
      excludedHosts = new Set();
      saveExcludedHosts(excludedHosts);
      render();
    });

    search.addEventListener('input', render);
    render();
  }

  function toggleCurrentHostExclusion() {
    const currentlyExcluded = isHostExcluded(HOST);
    setHostExcluded(HOST, !currentlyExcluded);
    const nowExcluded = !currentlyExcluded;
    registerMenuCommands();
    alert(
      nowExcluded
        ? `Host excluido: ${HOST}\nA partir do proximo carregamento, o script nao vai atuar neste site.`
        : `Host reativado: ${HOST}\nRecarregue para voltar a aplicar os bloqueios.`
    );
  }

  function exclusionToggleMenuLabel() {
    return isHostExcluded(HOST)
      ? 'Reativar este site nos efeitos do script'
      : 'Excluir este site dos efeitos do script';
  }

  function registerMenuCommands() {
    const prevIds = Array.isArray(window.__VINI_SM_MENU_IDS__) ? window.__VINI_SM_MENU_IDS__ : [];
    if (typeof GM_unregisterMenuCommand === 'function') {
      prevIds.forEach((id) => {
        try {
          GM_unregisterMenuCommand(id);
        } catch {}
      });
    }

    const ids = [];
    const excluded = isHostExcluded(HOST);

    if (!excluded) {
      ids.push(GM_registerMenuCommand('Abrir painel de scripts (este site)', openSitePanel));
      ids.push(GM_registerMenuCommand('Gerenciar scripts bloqueados (global)', openGlobalBlockedPanel));
      ids.push(
        GM_registerMenuCommand('Ping (diagnostico)', () => {
          alert(`Script Manager carregou. Topo: ${IS_TOP ? 'sim' : 'nao'} | Host: ${HOST}`);
        })
      );
    }

    ids.push(GM_registerMenuCommand(exclusionToggleMenuLabel(), toggleCurrentHostExclusion));
    ids.push(GM_registerMenuCommand('Gerenciar sites excluidos', openExcludedHostsPanel));
    window.__VINI_SM_MENU_IDS__ = ids;
  }

  if (alreadyLoaded) return;

  if (!IS_TOP) {
    if (isHostExcluded(HOST)) return;
    installInterceptors();
    installMutationBlocker();
    return;
  }

  registerMenuCommands();

  if (isHostExcluded(HOST)) {
    return;
  }

  installInterceptors();
  installMutationBlocker();
})();
