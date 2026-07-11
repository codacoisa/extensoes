// ==UserScript==
// @name         OpenSubtitles: força pt-BR
// @namespace    opensubtitles-pt-br.user.js
// @version      1.5
// @icon         https://img.icons8.com/?size=100&id=qlnCw19aQxaU&format=png&color=000000
// @description  Redireciona OpenSubtitles para portugues brasileiro e força buscas em pt-BR.
// @author       lourencosv (GPT)
// @license      CC BY-NC 4.0
// @updateURL    https://raw.githubusercontent.com/vibeinstance/opensubtitles-brazilian/refs/heads/main/opensubtitles-pt-br.user.js
// @downloadURL  https://raw.githubusercontent.com/vibeinstance/opensubtitles-brazilian/refs/heads/main/opensubtitles-pt-br.user.js
// @match        https://www.opensubtitles.org/*
// @match        https://www.opensubtitles.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const ORG_LOCALE = 'pb';
  const ORG_SUBLANG = 'pob';
  const COM_LOCALE = 'pt-BR';

  const LOCALE_RE = /^[a-z]{2}(?:-[a-z]{2})?$/i;
  const ORG_SEARCH_ROUTES = new Set(['search', 'search2', 'ssearch']);

  const url = new URL(window.location.href);
  const host = url.hostname.toLowerCase();
  const before = url.pathname + url.search;
  const segments = url.pathname.split('/').filter(Boolean);

  // Anubis bot-wall (opensubtitles.org). Do not touch its URL.
  if (url.href.includes('.within.website')) return;

  if (host.endsWith('opensubtitles.org')) {
    normalizeOpenSubtitlesOrg(url, segments);
  } else if (host.endsWith('opensubtitles.com')) {
    normalizeOpenSubtitlesCom(segments);
  } else {
    return;
  }

  url.pathname = '/' + segments.join('/');

  if (url.pathname + url.search !== before) {
    window.location.replace(url.toString());
  }

  function normalizeOpenSubtitlesOrg(targetUrl, parts) {
    if (parts[0]?.toLowerCase().startsWith('setlang-')) {
      parts[0] = `setlang-${ORG_LOCALE}`;
      return;
    }

    if (parts.length === 0 || parts[0].toLowerCase() !== ORG_LOCALE) {
      if (parts.length && /^[a-z]{2}$/i.test(parts[0])) parts[0] = ORG_LOCALE;
      else parts.unshift(ORG_LOCALE);
    }

    const setLangIdx = parts.findIndex(part =>
      part.toLowerCase().startsWith('setlang-')
    );
    if (setLangIdx !== -1) {
      parts[setLangIdx] = `setlang-${ORG_LOCALE}`;
    }

    const searchIdx = parts.findIndex(part =>
      ORG_SEARCH_ROUTES.has(part.toLowerCase())
    );
    if (searchIdx !== -1) {
      forcePathSegment(parts, searchIdx + 1, 'sublanguageid-', ORG_SUBLANG);
    }

    if (targetUrl.searchParams.has('sublanguageid')) {
      targetUrl.searchParams.set('sublanguageid', ORG_SUBLANG);
    }
  }

  function normalizeOpenSubtitlesCom(parts) {
    const hasBrazilianLocale =
      parts[0]?.toLowerCase() === COM_LOCALE.toLowerCase();

    if (!hasBrazilianLocale) {
      if (parts.length && LOCALE_RE.test(parts[0])) parts[0] = COM_LOCALE;
      else parts.unshift(COM_LOCALE);
    } else {
      parts[0] = COM_LOCALE;
    }

    // The localized root is a shortened landing page; use the full homepage.
    if (parts.length === 1) parts.push('home');
  }

  function forcePathSegment(parts, insertAt, prefix, value) {
    const next = `${prefix}${value}`;
    const existingIdx = parts.findIndex(part =>
      part.toLowerCase().startsWith(prefix.toLowerCase())
    );

    if (existingIdx !== -1) {
      parts[existingIdx] = next;
      return;
    }

    parts.splice(insertAt, 0, next);
  }
})();
