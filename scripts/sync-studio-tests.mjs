import { readFile, writeFile, readdir, mkdir, rm, realpath } from 'node:fs/promises';
import { isAbsolute, join, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== '--source' || !isAbsolute(args[1])) {
  throw Error('Usage: node scripts/sync-studio-tests.mjs --source /absolute/Sites/tests');
}
const from = await realpath(args[1]), target = resolve(root, 'tests/studio');
if (from === target || from.startsWith(target + sep) || target.startsWith(from + sep)) {
  throw Error('Choose the independent Sites tests folder, not the generated destination.');
}
const excluded = ['studio-werkblad-model.test.cjs'];
const files = [];
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

function translate(text) {
  const scriptList = /\bconst scripts\s*=\s*\[[^\]]*["']dist\//s.test(text);
  text = text.replaceAll('../dist', '../../web/test');
  if (scriptList) {
    text = text.replace(/(["'])dist\//g, '$1../../web/test/');
    text = text.replace(/path\.join\(__dirname,\s*(["'])\.\.\1,\s*file\)/g, 'path.join(__dirname, file)');
  }
  return text;
}

async function collect(directory) {
  for (const item of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
    const source = join(directory, item.name), file = relative(from, source).split(sep).join('/');
    if (item.isSymbolicLink()) throw Error(`Test symlinks are not accepted: ${file}`);
    if (excluded.includes(file)) continue;
    if (item.isDirectory()) { await collect(source); continue; }
    if (!item.isFile()) throw Error(`Unsupported test entry: ${file}`);
    const original = await readFile(source);
    const bytes = /\.[cm]?js$/.test(file) ? Buffer.from(translate(original.toString('utf8'))) : original;
    if (/\.test\.[cm]?js$/.test(file)) {
      const checked = spawnSync(process.execPath, ['--check', '--input-type=' + (file.endsWith('.mjs') ? 'module' : 'commonjs')], { input: bytes, encoding: 'utf8' });
      if (checked.status !== 0) throw Error(`Invalid translated test ${file}: ${checked.stderr}`);
    }
    files.push({ file, original, bytes });
  }
}

await collect(from);
if (!files.some(item => item.file === 'studio-workspace.test.cjs') || !files.some(item => item.file === 'ids-project.test.mjs')) {
  throw Error('The source must contain the verified Studio and IDS tests.');
}
const sourceCommit = execFileSync('git', ['-C', from, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const sourceTestsDirty = !!execFileSync('git', ['-C', from, 'status', '--porcelain', '--', '.'], { encoding: 'utf8' }).trim();
// All source reads, transformations and syntax checks precede replacement.
await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });
for (const item of files) {
  const output = join(target, item.file);
  await mkdir(resolve(output, '..'), { recursive: true });
  await writeFile(output, item.bytes);
}
await writeFile(join(target, 'sync-manifest.json'), JSON.stringify({
  schema: 1, source: 'Sites/tests', sourceCommit, sourceTestsDirty, excluded,
  files: files.map(item => ({ file: item.file, sourceSha256: hash(item.original), sha256: hash(item.bytes) }))
}, null, 2) + '\n');
console.log(`Prepared ${files.length} Studio test/fixture files in tests/studio; source ${sourceCommit}${sourceTestsDirty ? ' (test changes not committed)' : ''}.`);
