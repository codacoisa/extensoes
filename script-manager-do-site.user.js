// ==UserScript==
// @name         Script Manager do Site
// @namespace    script-manager-do-site.user.js
// @version      0.6
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
// @grant        GM_addStyle
// ==/UserScript==

(() => {
  'use strict';

  // Evita double-run no mesmo documento (por reloads parciais/bugs de injeção)
  if (window.__VINI_SM_LOADED__) return;
  window.__VINI_SM_LOADED__ = true;

  const HOST = location.hostname || '(sem-host)';

  const IS_TOP = (() => {
    try { return window.top === window.self; } catch { return true; }
  })();

  // =========================
  // Storage
  // =========================
  const SITE_KEY = (host) => `blockedScripts:${host}`;
  const INDEX_KEY = 'blockedIndex';

  function loadIndex() {
    const raw = GM_getValue(INDEX_KEY, '{}');
    try {
      const obj = JSON.parse(raw);
      return (obj && typeof obj === 'object') ? obj : {};
    } catch {
      return {};
    }
  }

  function saveIndex(indexObj) {
    GM_setValue(INDEX_KEY, JSON.stringify(indexObj));
  }

  function loadBlockedForHost(host) {
    const raw = GM_getValue(SITE_KEY(host), '[]');
    try { return new Set(JSON.parse(raw)); } catch { return new Set(); }
  }

  function saveBlockedForHost(host, set) {
    GM_setValue(SITE_KEY(host), JSON.stringify([...set]));
    const index = loadIndex();
    const arr = [...set];
    if (arr.length === 0) delete index[host];
    else index[host] = arr;
    saveIndex(index);
  }

  let blocked = loadBlockedForHost(HOST);

  // =========================
  // Normalização / chaves
  // =========================
  function srcKey(src) {
    try {
      const u = new URL(src, location.href);
      return `${u.origin}${u.pathname}`;
    } catch {
      return String(src || '').trim();
    }
  }

  function fullHref(src) {
    try { return new URL(src, location.href).href; } catch { return String(src || '').trim(); }
  }

  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(16);
  }

  function describeScript(el) {
    const src = el.getAttribute('src');
    if (src) {
      return { kind: 'external', href: fullHref(src), key: srcKey(src) };
    }
    const code = (el.textContent || '').trim();
    const preview = code.slice(0, 200).replace(/\s+/g, ' ');
    const id = `inline:${hash(code)}:${preview.slice(0, 40)}`;
    return { kind: 'inline', id, preview, size: code.length };
  }

  function isBlockedScriptElement(el) {
    const src = el?.getAttribute?.('src');
    if (!src) return false;
    return blocked.has(srcKey(src));
  }

  function neutralizeScript(el) {
    try {
      el.type = 'text/plain';
      el.setAttribute('data-tm-blocked', '1');
      if (el.parentNode) el.parentNode.removeChild(el);
    } catch {}
  }

  // =========================
  // Bloqueio: interceptors
  // =========================
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

    Node.prototype.appendChild = function(node) {
      const r = intercept(node);
      if (r) return r;
      return origAppendChild.call(this, node);
    };

    Node.prototype.insertBefore = function(node, ref) {
      const r = intercept(node);
      if (r) return r;
      return origInsertBefore.call(this, node, ref);
    };
  }

  // =========================
  // Bloqueio: MutationObserver
  // =========================
  function installMutationBlocker() {
    const tryBlockNode = (node) => {
      if (!node) return;
      if (node.tagName === 'SCRIPT' && isBlockedScriptElement(node)) {
        neutralizeScript(node);
        return;
      }
      if (node.querySelectorAll) {
        const scripts = node.querySelectorAll('script[src]');
        for (const s of scripts) {
          if (isBlockedScriptElement(s)) neutralizeScript(s);
        }
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
        document.querySelectorAll('script[src]').forEach(s => {
          if (isBlockedScriptElement(s)) neutralizeScript(s);
        });
      } catch {}
    };

    if (document.documentElement) start();
    else new MutationObserver(() => {
      if (document.documentElement) start();
    }).observe(document, { childList: true, subtree: true });
  }

  installInterceptors();
  installMutationBlocker();

  // Se estiver dentro de iframe/frame: mantém bloqueio, mas não registra UI/menu (evita duplicação)
  if (!IS_TOP) return;

  // =========================
  // UI (CLEAN/LIGHT)
  // =========================
  function ensureStyles() {
    GM_addStyle(`
      :root{
        --sm-bg:#f7f7f8; --sm-surface:#fff; --sm-text:#111827; --sm-muted:#6b7280;
        --sm-border:#e5e7eb; --sm-shadow:0 18px 60px rgba(17,24,39,.18);
        --sm-focus:rgba(59,130,246,.25); --sm-accent:#2563eb; --sm-accent-weak:rgba(37,99,235,.10);
        --sm-warn:#b45309; --sm-warn-weak:rgba(245,158,11,.18);
        --sm-danger:#b91c1c; --sm-danger-weak:rgba(239,68,68,.12);
        --sm-radius:14px; --sm-radius-sm:10px;
        --sm-font:12.5px/1.4 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;
      }
      #vini-sm-overlay{position:fixed; inset:0; z-index:2147483647; background:rgba(17,24,39,.35); backdrop-filter:blur(2px);}
      #vini-sm-panel{
        position:fixed; top:8vh; left:50%; transform:translateX(-50%);
        width:min(980px,94vw); max-height:84vh; overflow:auto;
        background:var(--sm-surface); color:var(--sm-text);
        border:1px solid var(--sm-border); border-radius:var(--sm-radius);
        box-shadow:var(--sm-shadow); padding:14px; font:var(--sm-font);
      }
      #vini-sm-head{position:sticky; top:0; background:var(--sm-surface); padding-bottom:10px; margin-bottom:10px; border-bottom:1px solid var(--sm-border); z-index:2;}
      .vini-sm-headbar{display:flex; gap:10px; align-items:center; justify-content:space-between;}
      #vini-sm-title{font-size:13px; font-weight:650; letter-spacing:.2px;}
      .vini-sm-sub{margin-top:6px; color:var(--sm-muted); font-size:12px; display:flex; flex-wrap:wrap; gap:8px; align-items:center;}
      .vini-sm-pill{display:inline-flex; align-items:center; gap:6px; padding:3px 10px; border:1px solid var(--sm-border); border-radius:999px; background:var(--sm-bg); color:var(--sm-muted); font-size:11.5px;}
      #vini-sm-close{cursor:pointer; padding:7px 10px; border-radius:var(--sm-radius-sm); border:1px solid var(--sm-border); background:var(--sm-bg); color:var(--sm-text);}
      #vini-sm-close:hover{border-color:#d1d5db;}
      .vini-sm-controls{display:flex; gap:10px; flex-wrap:wrap; margin-top:10px; align-items:center;}
      #vini-sm-search{
        flex:1; min-width:260px; box-sizing:border-box; padding:9px 10px;
        border-radius:var(--sm-radius-sm); border:1px solid var(--sm-border); background:#fff; color:var(--sm-text); outline:none;
      }
      #vini-sm-search:focus{border-color:#93c5fd; box-shadow:0 0 0 4px var(--sm-focus);}
      .vini-sm-btn{cursor:pointer; padding:8px 10px; border-radius:var(--sm-radius-sm); border:1px solid var(--sm-border); background:var(--sm-bg); color:var(--sm-text); white-space:nowrap;}
      .vini-sm-btn:hover{border-color:#d1d5db;}
      .vini-sm-btn-danger{border-color:rgba(185,28,28,.25); background:var(--sm-danger-weak); color:var(--sm-danger);}
      .vini-sm-section{margin-top:12px; border:1px solid var(--sm-border); border-radius:var(--sm-radius); overflow:hidden; background:#fff;}
      .vini-sm-section h3{
        margin:0; padding:10px 12px; font-size:12.5px; font-weight:650;
        background:var(--sm-bg); border-bottom:1px solid var(--sm-border);
        display:flex; align-items:center; justify-content:space-between; gap:10px;
      }
      .vini-sm-count{color:var(--sm-muted); font-weight:600; font-size:11.5px;}
      .vini-sm-row{padding:10px 12px; border-bottom:1px solid var(--sm-border); display:flex; flex-direction:column; gap:6px;}
      .vini-sm-row:last-child{border-bottom:none;}
      .vini-sm-src{word-break:break-all; font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace; font-size:12px; color:var(--sm-text);}
      .vini-sm-meta{color:var(--sm-muted); font-size:11.5px; display:flex; flex-wrap:wrap; gap:8px; align-items:center;}
      .vini-sm-actions{display:flex; gap:10px; flex-wrap:wrap; align-items:center; margin-top:2px;}
      .vini-sm-toggle{cursor:pointer; padding:7px 10px; border-radius:var(--sm-radius-sm); border:1px solid var(--sm-border); background:#fff; color:var(--sm-text);}
      .vini-sm-toggle:hover{border-color:#d1d5db;}
      .vini-sm-toggle-on{border-color:rgba(37,99,235,.35); background:var(--sm-accent-weak); color:var(--sm-accent); font-weight:650;}
      details.vini-sm-details{border-top:1px solid var(--sm-border);}
      details.vini-sm-details>summary{
        cursor:pointer; list-style:none; padding:10px 12px; background:#fff;
        display:flex; align-items:center; justify-content:space-between; gap:10px; font-weight:650;
      }
      details.vini-sm-details>summary::-webkit-details-marker{display:none;}
      details.vini-sm-details[open]>summary{background:var(--sm-bg); border-bottom:1px solid var(--sm-border);}
      .vini-sm-warn{padding:8px 10px; border:1px solid rgba(180,83,9,.25); background:var(--sm-warn-weak); border-radius:var(--sm-radius-sm); color:var(--sm-warn); font-size:11.5px;}
    `);
  }

  function openOverlay(titleText) {
    if (document.getElementById('vini-sm-overlay')) return null;
    ensureStyles();

    const overlay = document.createElement('div');
    overlay.id = 'vini-sm-overlay';

    const panel = document.createElement('div');
    panel.id = 'vini-sm-panel';

    const head = document.createElement('div');
    head.id = 'vini-sm-head';

    const bar = document.createElement('div');
    bar.className = 'vini-sm-headbar';

    const title = document.createElement('div');
    title.id = 'vini-sm-title';
    title.textContent = titleText;

    const closeBtn = document.createElement('button');
    closeBtn.id = 'vini-sm-close';
    closeBtn.textContent = 'Fechar';
    closeBtn.addEventListener('click', () => overlay.remove());

    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

    bar.appendChild(title);
    bar.appendChild(closeBtn);
    head.appendChild(bar);

    panel.appendChild(head);
    overlay.appendChild(panel);
    (document.documentElement || document.body).appendChild(overlay);

    return panel;
  }

  function openSitePanel() {
    const panel = openOverlay(`Scripts detectados em ${HOST}`);
    if (!panel) return;

    const head = panel.querySelector('#vini-sm-head');

    const sub = document.createElement('div');
    sub.className = 'vini-sm-sub';
    sub.innerHTML = `
      <span class="vini-sm-pill">Bloqueio por origin + pathname</span>
      <span class="vini-sm-pill">Query/hash ignorados</span>
      <span class="vini-sm-pill">Inline: só visualização</span>
    `;

    const controls = document.createElement('div');
    controls.className = 'vini-sm-controls';

    const search = document.createElement('input');
    search.id = 'vini-sm-search';
    search.placeholder = 'Filtrar (URL, domínio ou trecho)…';

    const refreshBtn = document.createElement('button');
    refreshBtn.className = 'vini-sm-btn';
    refreshBtn.textContent = 'Recarregar lista';

    controls.appendChild(search);
    controls.appendChild(refreshBtn);

    const warn = document.createElement('div');
    warn.className = 'vini-sm-warn';
    warn.textContent = 'Se você bloquear um script essencial (login/captcha/dependências), a página pode quebrar. Libere e recarregue.';

    head.appendChild(sub);
    head.appendChild(controls);
    head.appendChild(warn);

    const container = document.createElement('div');
    panel.appendChild(container);

    function groupByOrigin(externals) {
      const map = new Map();
      for (const s of externals) {
        let origin = '(desconhecido)';
        try { origin = new URL(s.href).origin; } catch {}
        if (!map.has(origin)) map.set(origin, []);
        map.get(origin).push(s);
      }
      return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    }

    function matchesQuery(s, q) {
      if (!q) return true;
      const hay = [s.kind, s.href || '', s.key || '', s.id || '', s.preview || ''].join(' ').toLowerCase();
      return hay.includes(q);
    }

    function renderList() {
      const q = (search.value || '').trim().toLowerCase();
      container.textContent = '';

      const described = [...document.querySelectorAll('script')].map(describeScript);
      const externalsAll = described.filter(s => s.kind === 'external');
      const inlineAll = described.filter(s => s.kind === 'inline');

      const externals = externalsAll.filter(s => matchesQuery(s, q));
      const inlines = inlineAll.filter(s => matchesQuery(s, q));

      const topInfo = document.createElement('div');
      topInfo.className = 'vini-sm-sub';
      topInfo.innerHTML = `
        <span class="vini-sm-pill">Total na página: ${described.length}</span>
        <span class="vini-sm-pill">Externos: ${externalsAll.length} (no filtro: ${externals.length})</span>
        <span class="vini-sm-pill">Inline: ${inlineAll.length} (no filtro: ${inlines.length})</span>
        <span class="vini-sm-pill">Bloqueados neste host: ${blocked.size}</span>
      `;
      container.appendChild(topInfo);

      const secExt = document.createElement('div');
      secExt.className = 'vini-sm-section';

      const hExt = document.createElement('h3');
      hExt.innerHTML = `<span>Externos (agrupados por domínio)</span><span class="vini-sm-count">${externals.length}</span>`;
      secExt.appendChild(hExt);

      const grouped = groupByOrigin(externals);
      if (grouped.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'vini-sm-row';
        empty.textContent = 'Nenhum script externo corresponde ao filtro.';
        secExt.appendChild(empty);
      } else {
        for (const [origin, items] of grouped) {
          const det = document.createElement('details');
          det.className = 'vini-sm-details';
          det.open = (q ? true : items.some(s => blocked.has(s.key)));

          const sum = document.createElement('summary');
          const blockedCount = items.filter(s => blocked.has(s.key)).length;
          sum.innerHTML = `<span>${origin}</span><span class="vini-sm-count">${items.length} (${blockedCount} bloqueado(s))</span>`;
          det.appendChild(sum);

          items
            .sort((a, b) => (a.href || '').localeCompare(b.href || ''))
            .forEach((s) => {
              const row = document.createElement('div');
              row.className = 'vini-sm-row';

              const main = document.createElement('div');
              main.className = 'vini-sm-src';
              main.textContent = s.href;

              const meta = document.createElement('div');
              meta.className = 'vini-sm-meta';
              meta.textContent = `chave: ${s.key} • estado: ${blocked.has(s.key) ? 'bloqueado' : 'liberado'}`;

              const actions = document.createElement('div');
              actions.className = 'vini-sm-actions';

              const btn = document.createElement('button');
              const isOn = blocked.has(s.key);
              btn.className = 'vini-sm-toggle ' + (isOn ? 'vini-sm-toggle-on' : '');
              btn.textContent = isOn ? 'Bloqueado (clique p/ liberar)' : 'Bloquear';
              btn.addEventListener('click', () => {
                const nowOn = !blocked.has(s.key);
                if (nowOn) blocked.add(s.key);
                else blocked.delete(s.key);

                saveBlockedForHost(HOST, blocked);
                blocked = loadBlockedForHost(HOST);
                renderList();
              });

              actions.appendChild(btn);
              row.appendChild(main);
              row.appendChild(meta);
              row.appendChild(actions);
              det.appendChild(row);
            });

          secExt.appendChild(det);
        }
      }
      container.appendChild(secExt);

      const secIn = document.createElement('div');
      secIn.className = 'vini-sm-section';

      const hIn = document.createElement('h3');
      hIn.innerHTML = `<span>Inline (somente visualização)</span><span class="vini-sm-count">${inlines.length}</span>`;
      secIn.appendChild(hIn);

      if (inlines.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'vini-sm-row';
        empty.textContent = 'Nenhum script inline corresponde ao filtro.';
        secIn.appendChild(empty);
      } else {
        const det = document.createElement('details');
        det.className = 'vini-sm-details';
        det.open = !!q;

        const sum = document.createElement('summary');
        sum.innerHTML = `<span>Ver lista de inline</span><span class="vini-sm-count">${inlines.length}</span>`;
        det.appendChild(sum);

        inlines.forEach((s) => {
          const row = document.createElement('div');
          row.className = 'vini-sm-row';

          const main = document.createElement('div');
          main.className = 'vini-sm-src';
          main.textContent = `[inline] ${s.id}`;

          const meta = document.createElement('div');
          meta.className = 'vini-sm-meta';
          meta.textContent = `tamanho: ${s.size} chars • preview: ${s.preview ? s.preview.slice(0, 160) : ''}`;

          row.appendChild(main);
          row.appendChild(meta);
          det.appendChild(row);
        });

        secIn.appendChild(det);
      }
      container.appendChild(secIn);
    }

    search.addEventListener('input', renderList);
    refreshBtn.addEventListener('click', renderList);
    renderList();
  }

  function openGlobalBlockedPanel() {
    const panel = openOverlay('Scripts bloqueados (global)');
    if (!panel) return;

    const head = panel.querySelector('#vini-sm-head');

    const sub = document.createElement('div');
    sub.className = 'vini-sm-sub';
    sub.innerHTML = `
      <span class="vini-sm-pill">Fonte: índice global sincronizado</span>
      <span class="vini-sm-pill">Agrupado por host</span>
    `;

    const controls = document.createElement('div');
    controls.className = 'vini-sm-controls';

    const search = document.createElement('input');
    search.id = 'vini-sm-search';
    search.placeholder = 'Filtrar (host ou chave)…';

    const clearAllBtn = document.createElement('button');
    clearAllBtn.className = 'vini-sm-btn vini-sm-btn-danger';
    clearAllBtn.textContent = 'Zerar tudo (global)';

    controls.appendChild(search);
    controls.appendChild(clearAllBtn);

    head.appendChild(sub);
    head.appendChild(controls);

    const list = document.createElement('div');
    panel.appendChild(list);

    function render() {
      const q = (search.value || '').trim().toLowerCase();
      list.textContent = '';

      const index = loadIndex();
      const hosts = Object.keys(index).sort();

      let totalKeys = 0;
      for (const h of hosts) totalKeys += (Array.isArray(index[h]) ? index[h].length : 0);

      const info = document.createElement('div');
      info.className = 'vini-sm-sub';
      info.innerHTML = `
        <span class="vini-sm-pill">Hosts: ${hosts.length}</span>
        <span class="vini-sm-pill">Bloqueios: ${totalKeys}</span>
      `;
      list.appendChild(info);

      if (hosts.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'vini-sm-section';
        const row = document.createElement('div');
        row.className = 'vini-sm-row';
        row.textContent = 'Nenhum bloqueio global registrado.';
        empty.appendChild(row);
        list.appendChild(empty);
        return;
      }

      for (const h of hosts) {
        const keys = (Array.isArray(index[h]) ? index[h] : []).slice().sort();
        const visibleKeys = keys.filter(k => {
          if (!q) return true;
          return h.toLowerCase().includes(q) || k.toLowerCase().includes(q);
        });
        if (visibleKeys.length === 0) continue;

        const sec = document.createElement('div');
        sec.className = 'vini-sm-section';

        const det = document.createElement('details');
        det.className = 'vini-sm-details';
        det.open = !!q;

        const sum = document.createElement('summary');
        sum.innerHTML = `<span>${h}</span><span class="vini-sm-count">${visibleKeys.length} bloqueado(s)</span>`;
        det.appendChild(sum);

        const actionRow = document.createElement('div');
        actionRow.className = 'vini-sm-row';

        const actions = document.createElement('div');
        actions.className = 'vini-sm-actions';

        const clearHostBtn = document.createElement('button');
        clearHostBtn.className = 'vini-sm-btn';
        clearHostBtn.textContent = 'Liberar todos deste host';
        clearHostBtn.addEventListener('click', () => {
          saveBlockedForHost(h, new Set());
          if (h === HOST) blocked = loadBlockedForHost(HOST);
          render();
        });

        actions.appendChild(clearHostBtn);
        actionRow.appendChild(actions);
        det.appendChild(actionRow);

        visibleKeys.forEach((k) => {
          const row = document.createElement('div');
          row.className = 'vini-sm-row';

          const meta = document.createElement('div');
          meta.className = 'vini-sm-meta';
          meta.textContent = 'chave bloqueada:';

          const keyText = document.createElement('div');
          keyText.className = 'vini-sm-src';
          keyText.textContent = k;

          const itemActions = document.createElement('div');
          itemActions.className = 'vini-sm-actions';

          const btn = document.createElement('button');
          btn.className = 'vini-sm-toggle';
          btn.textContent = 'Liberar';
          btn.addEventListener('click', () => {
            const set = loadBlockedForHost(h);
            set.delete(k);
            saveBlockedForHost(h, set);
            if (h === HOST) blocked = loadBlockedForHost(HOST);
            render();
          });

          itemActions.appendChild(btn);
          row.appendChild(meta);
          row.appendChild(keyText);
          row.appendChild(itemActions);
          det.appendChild(row);
        });

        sec.appendChild(det);
        list.appendChild(sec);
      }
    }

    clearAllBtn.addEventListener('click', () => {
      const index = loadIndex();
      for (const h of Object.keys(index)) saveBlockedForHost(h, new Set());
      GM_setValue(INDEX_KEY, '{}');
      blocked = loadBlockedForHost(HOST);
      render();
    });

    search.addEventListener('input', render);
    render();
  }

  // =========================
  // Menu Tampermonkey (somente no topo)
  // =========================
  GM_registerMenuCommand('Abrir painel de scripts (este site)', openSitePanel);
  GM_registerMenuCommand('Gerenciar scripts bloqueados (global)', openGlobalBlockedPanel);

  // Diagnóstico opcional (ajuda a confirmar que só o topo registra UI)
  GM_registerMenuCommand('Ping (diagnóstico)', () => {
    alert(`Script Manager carregou. Topo: ${IS_TOP ? 'sim' : 'não'} | Host: ${HOST}`);
  });

})();