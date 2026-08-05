import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveGithubToolsIcon } from './github-tools.user.js';

test('prioriza nomes especiais antes da extensão', () => {
  assert.equal(resolveGithubToolsIcon('package.json').iconKey, 'npm/package');
  assert.equal(resolveGithubToolsIcon('package-lock.json').iconKey, 'npm/lock');
  assert.equal(resolveGithubToolsIcon('Dockerfile').iconKey, 'docker');
  assert.equal(resolveGithubToolsIcon('README.md').iconKey, 'markdown');
  assert.equal(resolveGithubToolsIcon('.gitignore').iconKey, 'git');
  assert.equal(resolveGithubToolsIcon('gitmessage').iconKey, 'git');
  assert.equal(resolveGithubToolsIcon('CODEOWNERS').iconKey, 'git');
  assert.equal(resolveGithubToolsIcon('GEMINI.md').iconKey, 'markdown');
});

test('resolve extensões semânticas', () => {
  assert.equal(resolveGithubToolsIcon('src/app.tsx').iconKey, 'react');
  assert.equal(resolveGithubToolsIcon('schema.graphql').iconKey, 'graphql');
  assert.equal(resolveGithubToolsIcon('data.csv').iconKey, 'table');
  assert.equal(resolveGithubToolsIcon('slides.pptx').iconKey, 'presentation');
  assert.equal(resolveGithubToolsIcon('archive.tar.gz').iconKey, 'archive');
  assert.equal(resolveGithubToolsIcon('compose.yaml').iconKey, 'docker');
  assert.equal(resolveGithubToolsIcon('Dockerfile.prod').iconKey, 'docker');
  assert.equal(resolveGithubToolsIcon('Makefile').iconKey, 'terminal');
  assert.equal(resolveGithubToolsIcon('records.jsonl').iconKey, 'json');
  assert.equal(resolveGithubToolsIcon('module.cppm').iconKey, 'cpp');
});

test('resolve pastas conhecidas e mantém fallback neutro', () => {
  assert.equal(resolveGithubToolsIcon('src', true).iconKey, 'folder-src');
  assert.equal(resolveGithubToolsIcon('/owner/repo/tree/main/tests', true).iconKey, 'folder-test');
  assert.equal(resolveGithubToolsIcon('unknown-folder', true).iconKey, 'folder');
  assert.equal(resolveGithubToolsIcon('unknown.extension').iconKey, 'file');
});

test('normaliza nomes com caminho, barras e maiúsculas', () => {
  assert.equal(resolveGithubToolsIcon('C:\\repo\\Dockerfile').iconKey, 'docker');
  assert.equal(resolveGithubToolsIcon('/repo/.ENV.example').iconKey, 'settings');
});
