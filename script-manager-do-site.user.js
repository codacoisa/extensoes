// ==UserScript==
// @name         Script Manager do Site
// @namespace    script-manager-do-site.user.js
// @version      0.5
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

  // =========================
  // Contexto
  // =========================
  const HOST = location.hostname || '(sem-host)';

  // =========================
  // Storage
  // =========================
  // Por-host: Set de chaves estáveis de script bloqueado
  const SITE_KEY = (host) => `blockedScripts:${host}`;

  // Índice global: { host: [scriptKey...] }
  // Necessário porque o TM não permite enumerar todas as chaves do storage.
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

  // Salva por-host e sincroniza o índice global (para o painel global)
  function saveBlockedForHost(host, set) {
    GM_setValue(SITE_KEY(host), JSON.stringify([...set]));

    const index = loadIndex();
    const arr = [...set];

    if (arr.length === 0) delete index[host];
    else index[host] = arr;

    saveIndex(index);
  }

  // Cache local (host atual)
  let blocked = loadBlockedForHost(HOST);

  // =========================
  // Normalização / chaves
  // =========================
  // Chave estável para sobreviver a cache-busters (?v=..., #...)
  // Ex.: https://cdn.x.com/script.js?v=123 -> https://cdn.x.com/script.js
  function srcKey(src) {
    try {
      const u = new URL(src, location.href);
      return `${u.origin}${u.pathname}`;
    } catch {
      return String(src || '').trim();
    }
  }

  function fullHref(src) {
    try { return new URL(src, location.href).href; }
    catch { return String(src || '').trim(); }
  }

  // Hash simples (dedupe para inline; inline é só visualização)
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

  // Neutraliza execução (best effort): tipo inválido + remoção
  function neutralizeScript(el) {
    try {
      el.type = 'text/plain';
      el.setAttribute('data-tm-blocked', '1');
      if (el.parentNode) el.parentNode.removeChild(el);
    } catch {}
  }

  // =========================
  // Bloqueio: inserções dinâmicas
  // =========================
  // Pega scripts adicionados via appendChild/insertBefore.
  function installInterceptors() {
    const origAppendChild = Node.prototype.appendChild;
    const origInsertBefore = Node.prototype.insertBefore;

    function intercept(node) {
      try {
        if (node && node.tagName === 'SCRIPT' && isBlockedScriptElement(node)) {
          neutralizeScript(node);
          return node; // finge sucesso para não quebrar o chamador
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
  // Bloqueio: observer (parsing/carga)
  // =========================
  // Tenta capturar scripts que entram no DOM durante carregamento/parsing.
  // Não é garantido para "parser-inserted" que executa imediatamente, mas ajuda muito para async/defer e injeções rápidas.
  function installMutationBlocker() {
    const tryBlockNode = (node) => {
      if (!node) return;

      if (node.tagName === 'SCRIPT' && isBlockedScriptElement(node)) {
        neutralizeScript(node);
        return;
      }

      // Caso adicionem fragmentos contendo scripts
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

      // Tenta bloquear scripts já presentes (ajuda com defer/async)
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

  // =========================
  // UI helpers
  // =========================
  function ensureStyles() {
    GM_addStyle(`
      #vini-sm-overlay{position:fixed; inset:0; z-index:2147483647; background:rgba(0,0,0,.35);}
      #vini-sm-panel{position:fixed; top:10vh; left:50%; transform:translateX(-50%);
        width:min(980px, 92vw); max-height:80vh; overflow:auto;
        background:#0b0b0b; color:#eee; border:1px solid #333; border-radius:14px;
        box-shadow:0 12px 40px rgba(0,0,0,.45); padding:12px;
        font:12px/1.35 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;}
      #vini-sm-head{display:flex; gap:10px; align-items:center; justify-content:space-between; margin-bottom:10px;}
      #vini-sm-title{font-size:13px; font-weight:600;}
      #vini-sm-close{cursor:pointer; padding:6px 10px; border-radius:10px; border:1px solid #333; background:#151515; color:#eee;}
      #vini-sm-search{width:100%; box-sizing:border-box; margin:6px 0 10px; padding:7px 9px; border-radius:10px; border:1px solid #333; background:#111; color:#eee;}
      .vini-sm-row{border-top:1px solid #222; padding:8px 0;}
      .vini-sm-row:first-of-type{border-top:none;}
      .vini-sm-src{word-break:break-all; color:#cfcfcf;}
      .vini-sm-meta{opacity:.8; margin-top:4px;}
      .vini-sm-actions{margin-top:6px; display:flex; gap:10px; align-items:center; flex-wrap:wrap;}
      .vini-sm-toggle{cursor:pointer; padding:4px 8px; border-radius:10px; border:1px solid #333; background:#151515; color:#eee;}
      .vini-sm-warn{color:#ffcc66; margin-top:6px; opacity:.95;}
      .vini-sm-small{font-size:11px; opacity:.85;}
      .vini-sm-pill{display:inline-block; padding:2px 8px; border:1px solid #333; border-radius:999px; background:#111; font-size:11px; opacity:.9;}
      .vini-sm-grid{display:grid; grid-template-columns: 1fr auto; gap:8px; align-items:start;}
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

    const title = document.createElement('div');
    title.id = 'vini-sm-title';
    title.textContent = titleText;

    const closeBtn = document.createElement('button');
    closeBtn.id = 'vini-sm-close';
    closeBtn.textContent = 'Fechar';

    closeBtn.addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

    head.appendChild(title);
    head.appendChild(closeBtn);

    panel.appendChild(head);
    overlay.appendChild(panel);

    (document.documentElement || document.body).appendChild(overlay);
    return panel;
  }

  // =========================
  // Painel por site
  // =========================
  function openSitePanel() {
    const panel = openOverlay(`Scripts detectados em ${HOST}`);
    if (!panel) return;

    const search = document.createElement('input');
    search.id = 'vini-sm-search';
    search.placeholder = 'Filtrar por URL (src)…';

    const warn = document.createElement('div');
    warn.className = 'vini-sm-warn vini-sm-small';
    warn.textContent = 'Bloqueio por origin+pathname (ignora query/hash). Inline: visualização.';

    const list = document.createElement('div');

    panel.appendChild(search);
    panel.appendChild(warn);
    panel.appendChild(list);

    function renderList() {
      const q = (search.value || '').trim().toLowerCase();
      list.textContent = '';

      const scripts = [...document.querySelectorAll('script')]
        .map(describeScript)
        .sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'external' ? -1 : 1));

      const filtered = scripts.filter(s =>
        s.kind !== 'external' || !q || (s.href || '').toLowerCase().includes(q)
      );

      const header = document.createElement('div');
      header.className = 'vini-sm-small';
      header.textContent = `Total: ${scripts.length}`;
      list.appendChild(header);

      for (const s of filtered) {
        const row = document.createElement('div');
        row.className = 'vini-sm-row';

        if (s.kind === 'external') {
          const main = document.createElement('div');
          main.className = 'vini-sm-src';
          main.textContent = s.href;

          const meta = document.createElement('div');
          meta.className = 'vini-sm-meta vini-sm-small';
          meta.textContent = `chave: ${s.key} | estado: ${blocked.has(s.key) ? 'bloqueado' : 'liberado'}`;

          const actions = document.createElement('div');
          actions.className = 'vini-sm-actions';

          const btn = document.createElement('button');
          btn.className = 'vini-sm-toggle';
          btn.textContent = blocked.has(s.key) ? 'Bloqueado (clique p/ liberar)' : 'Bloquear este script';

          btn.addEventListener('click', () => {
            const nowOn = !blocked.has(s.key);
            if (nowOn) blocked.add(s.key);
            else blocked.delete(s.key);

            // Persiste no host e atualiza índice global
            saveBlockedForHost(HOST, blocked);

            // Recarrega cache local
            blocked = loadBlockedForHost(HOST);

            btn.textContent = blocked.has(s.key) ? 'Bloqueado (clique p/ liberar)' : 'Bloquear este script';
            meta.textContent = `chave: ${s.key} | estado: ${blocked.has(s.key) ? 'bloqueado' : 'liberado'}`;
          });

          actions.appendChild(btn);

          row.appendChild(main);
          row.appendChild(meta);
          row.appendChild(actions);
        } else {
          const main = document.createElement('div');
          main.className = 'vini-sm-src';
          main.textContent = `[inline] ${s.id}`;
          row.appendChild(main);
        }

        list.appendChild(row);
      }
    }

    search.addEventListener('input', renderList);
    renderList();
  }

  // =========================
  // Painel global (fora do site)
  // =========================
  function openGlobalBlockedPanel() {
    const panel = openOverlay('Scripts bloqueados (global)');
    if (!panel) return;

    const search = document.createElement('input');
    search.id = 'vini-sm-search';
    search.placeholder = 'Filtrar por host ou por chave…';

    const warn = document.createElement('div');
    warn.className = 'vini-sm-warn vini-sm-small';
    warn.textContent = 'Fonte: índice global (sincronizado ao bloquear/liberar).';

    const list = document.createElement('div');

    panel.appendChild(search);
    panel.appendChild(warn);
    panel.appendChild(list);

    function render() {
      const q = (search.value || '').trim().toLowerCase();
      list.textContent = '';

      const index = loadIndex();
      const hosts = Object.keys(index).sort();

      const rows = [];
      for (const h of hosts) {
        const keys = Array.isArray(index[h]) ? index[h] : [];
        for (const k of keys) rows.push({ host: h, key: k });
      }

      const filtered = rows.filter(r =>
        !q || r.host.toLowerCase().includes(q) || r.key.toLowerCase().includes(q)
      );

      const header = document.createElement('div');
      header.className = 'vini-sm-small';
      header.textContent = `Total de bloqueios: ${rows.length} | hosts: ${hosts.length}`;
      list.appendChild(header);

      if (filtered.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'vini-sm-row vini-sm-small';
        empty.textContent = 'Nada encontrado.';
        list.appendChild(empty);
        return;
      }

      // Agrupa por host para legibilidade
      const byHost = new Map();
      for (const r of filtered) {
        if (!byHost.has(r.host)) byHost.set(r.host, []);
        byHost.get(r.host).push(r.key);
      }

      for (const [h, keys] of byHost.entries()) {
        const hostRow = document.createElement('div');
        hostRow.className = 'vini-sm-row';

        const top = document.createElement('div');
        top.className = 'vini-sm-grid';

        const left = document.createElement('div');
        left.innerHTML = `<span class="vini-sm-pill">${h}</span> <span class="vini-sm-small">(${keys.length})</span>`;

        const right = document.createElement('div');
        right.className = 'vini-sm-actions';

        const clearHostBtn = document.createElement('button');
        clearHostBtn.className = 'vini-sm-toggle';
        clearHostBtn.textContent = 'Liberar todos deste host';
        clearHostBtn.addEventListener('click', () => {
          saveBlockedForHost(h, new Set());
          if (h === HOST) blocked = loadBlockedForHost(HOST);
          render();
        });

        right.appendChild(clearHostBtn);
        top.appendChild(left);
        top.appendChild(right);
        hostRow.appendChild(top);

        keys.sort().forEach((k) => {
          const item = document.createElement('div');
          item.className = 'vini-sm-meta vini-sm-small';
          item.style.marginTop = '6px';

          const wrap = document.createElement('div');
          wrap.className = 'vini-sm-actions';

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

          const keyText = document.createElement('span');
          keyText.className = 'vini-sm-src';
          keyText.textContent = k;

          wrap.appendChild(btn);
          wrap.appendChild(keyText);
          item.appendChild(wrap);
          hostRow.appendChild(item);
        });

        list.appendChild(hostRow);
      }
    }

    search.addEventListener('input', render);
    render();
  }

  // =========================
  // Menu Tampermonkey
  // =========================
  GM_registerMenuCommand('Abrir painel de scripts (este site)', openSitePanel);
  GM_registerMenuCommand('Gerenciar scripts bloqueados (global)', openGlobalBlockedPanel);

  // Diagnóstico opcional (mantém fácil verificar se o script está rodando na página)
  GM_registerMenuCommand('Ping (diagnóstico)', () => alert('Script Manager carregou nesta página.'));
})();