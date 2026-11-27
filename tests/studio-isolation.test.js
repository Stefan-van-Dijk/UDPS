import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, realpath, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve, relative, sep } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const testRoot = resolve(root, 'web/test');
const baseline = JSON.parse(await readFile(new URL('../docs/studio-root-baseline.json', import.meta.url), 'utf8'));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const json = async path => JSON.parse(await readFile(resolve(root, path), 'utf8'));

async function walk(directory, skipTest = false) {
  const result = [];
  for (const item of await readdir(directory, { withFileTypes: true })) {
    if (skipTest && item.name === 'test') continue;
    const path = resolve(directory, item.name);
    assert(!item.isSymbolicLink(), `Unexpected web symlink: ${path}`);
    if (item.isDirectory()) result.push(...await walk(path));
    else result.push(relative(root, path).split(sep).join('/'));
  }
  return result.sort();
}

test('de originele webroot blijft bytegelijk aan de vastgezette Git-baseline', async () => {
  assert.equal(baseline.schema, 1);
  assert.equal(baseline.commit, '9a05876a33ab8d37543a393a8843f7c623c4ffc8');
  assert.equal(baseline.algorithm, 'sha256');
  const paths = baseline.files.map(item => item.file);
  assert(paths.length > 0);
  assert.equal(new Set(paths).size, paths.length);
  assert.deepEqual(await walk(resolve(root, 'web'), true), [...paths].sort());
  for (const item of baseline.files) {
    assert(item.file.startsWith('web/') && !item.file.startsWith('web/test/') && !item.file.includes('..'));
    assert.equal(sha256(await readFile(resolve(root, item.file))), item.sha256, item.file);
  }
});

test('npm behoudt de rootchecks en voert ook de Studio-tests uit', async () => {
  const current = await json('package.json');
  assert(current.scripts.check.startsWith(baseline.rootScripts.check + ' && '));
  assert(current.scripts.test.startsWith(baseline.rootScripts.test + ' '));
  assert(current.scripts.check.includes('scripts/check-studio.mjs'));
  assert(current.scripts.test.includes('tests/studio/*.test.cjs'));
  assert(current.scripts.test.includes('tests/studio/*.test.mjs'));
});

test('de testversie heeft eigen opslag en traceerbare buildherkomst', async () => {
  const html = await readFile(resolve(testRoot, 'index.html'), 'utf8');
  assert.match(html, /UDPS Studio · Testversie/);
  assert.match(html, /window\.UDPS_STUDIO_MODE\s*=\s*["']test["']/);
  assert.match(html, /window\.UDPS_STUDIO_STORAGE_NAMESPACE\s*=\s*["']udps-studio-test-v1["']/);
  const build = await json('web/test/studio-build.json');
  assert.equal(build.schema, 1);
  assert.equal(build.mode, 'test');
  assert.equal(build.storageNamespace, 'udps-studio-test-v1');
  assert.equal(build.productBaseCommit, baseline.commit);
  assert.match(build.sourceCommit, /^[a-f0-9]{40}$/);
  const copied = await json('tests/studio/sync-manifest.json');
  assert.equal(copied.schema, 1);
  assert.equal(copied.sourceCommit, build.sourceCommit, 'Refresh tests after the final Sites source commit.');
  assert.equal(copied.sourceTestsDirty, false, 'Commit/freeze the source tests before the final snapshot.');
  assert(copied.excluded.includes('studio-werkblad-model.test.cjs'));
  for (const item of copied.files) assert.equal(sha256(await readFile(resolve(root, 'tests/studio', item.file))), item.sha256, item.file);
});

test('scripts, styles en gelinkte assets blijven binnen de testsubmap', async () => {
  const html = await readFile(resolve(testRoot, 'index.html'), 'utf8');
  const styles = [];
  let scripts = 0;
  async function asset(value, base) {
    if (/^(?:data:|#)/i.test(value)) return null;
    assert(!/^(?:[a-z][a-z0-9+.-]*:|\/)/i.test(value), `Non-relative test asset: ${value}`);
    const url = new URL(value, base);
    url.search = ''; url.hash = '';
    const path = await realpath(fileURLToPath(url));
    assert(path.startsWith(testRoot + sep), `Asset escapes web/test: ${value}`);
    assert((await stat(path)).isFile(), `Asset is not a file: ${value}`);
    return url;
  }
  const index = new URL('../web/test/index.html', import.meta.url);
  for (const match of html.matchAll(/<(script|link|img)\b[^>]*?\b(?:src|href)=["']([^"']+)["'][^>]*>/gi)) {
    const url = await asset(match[2], index);
    if (match[1].toLowerCase() === 'script') scripts++;
    if (url?.pathname.endsWith('.css')) styles.push(url);
  }
  assert(scripts > 0);
  for (const url of styles) {
    const css = await readFile(url, 'utf8');
    for (const match of css.matchAll(/url\(\s*["']?([^"')\s]+)["']?\s*\)/g)) await asset(match[1], url);
  }
});
