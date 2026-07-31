// ==UserScript==
// @name         GitHub Fork Finder Button
// @namespace    https://github.com/codacoisa/github-tools
// @version      2026-07-31-14:34
// @description  Adiciona um botão Fork Finder ao lado do botão Fork nos repositórios do GitHub.
// @author       codacoisa
// @match        https://github.com/*/*
// @icon         https://github.githubassets.com/favicons/favicon.svg
// @grant        none
// @run-at       document-idle
// @downloadURL  https://raw.githubusercontent.com/codacoisa/github-tools/main/github-tools.user.js
// @updateURL    https://raw.githubusercontent.com/codacoisa/github-tools/main/github-tools.user.js
// ==/UserScript==

(function () {
  'use strict';

  const BUTTON_MARKER = 'data-fork-finder-button';

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
      '[data-testid="fork-button"]',
      'a[href$="/fork"]',
      'a[href$="/forks"]',
      'button[aria-label*="fork" i]',
    ].join(','));

    return [...candidates].find((element) => {
      const label = `${element.textContent || ''} ${element.getAttribute('aria-label') || ''}`;
      return /\bfork\b/i.test(label);
    }) || null;
  }

  function createButton(forkControl, repository) {
    const link = document.createElement('a');
    link.setAttribute(BUTTON_MARKER, '');
    link.href = `https://forkfinder.getinfotoyou.com/repo/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.repository)}`;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.className = forkControl.className;
    link.setAttribute('aria-label', `Abrir ${repository.owner}/${repository.repository} no Fork Finder`);
    link.textContent = 'Fork Finder';

    if (forkControl.hasAttribute('data-view-component')) {
      link.setAttribute('data-view-component', 'true');
    }

    return link;
  }

  function addButton() {
    const existingButton = document.querySelector(`a[${BUTTON_MARKER}]`);
    const repository = getRepository();

    if (!repository) {
      existingButton?.remove();
      return;
    }

    const expectedUrl = `https://forkfinder.getinfotoyou.com/repo/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.repository)}`;
    if (existingButton) {
      if (existingButton.href !== expectedUrl) existingButton.href = expectedUrl;
      return;
    }

    const forkControl = findForkControl();
    if (!forkControl) return;

    const link = createButton(forkControl, repository);
    const listItem = forkControl.closest('.pagehead-actions > li');

    if (listItem) {
      const newListItem = document.createElement('li');
      newListItem.setAttribute('data-fork-finder-container', '');
      newListItem.append(link);
      listItem.after(newListItem);
      return;
    }

    forkControl.after(link);
  }

  let scheduled = false;
  function scheduleButtonUpdate() {
    if (scheduled) return;
    scheduled = true;

    requestAnimationFrame(() => {
      scheduled = false;
      addButton();
    });
  }

  addButton();
  new MutationObserver(scheduleButtonUpdate).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  document.addEventListener('turbo:load', scheduleButtonUpdate);
  document.addEventListener('pjax:end', scheduleButtonUpdate);
}());
