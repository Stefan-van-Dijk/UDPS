import {cp,readFile,writeFile,mkdir,readdir,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const args=process.argv.slice(2),source=args[args.indexOf('--source')+1],commit=args[args.indexOf('--source-commit')+1];
if(!args.includes('--source')||!args.includes('--source-commit')||!source||!/^[a-f0-9]{40}$/.test(commit||''))throw Error('Usage: node scripts/sync-studio-test.mjs --source /absolute/dist --source-commit SHA');
const from=resolve(source),target=join(root,'web/test');
if(from===target||!from.endsWith('/dist'))throw Error('Choose the verified Studio dist source.');
await readFile(join(from,'studio-shell.js'));
await rm(target,{recursive:true,force:true});await mkdir(target,{recursive:true});
for(const item of await readdir(from,{withFileTypes:true})){
 if(item.isSymbolicLink())throw Error('Source symlinks are not accepted.');
 if(item.isDirectory()&&!['assets','examples','ids','production'].includes(item.name))continue;
 if(item.isFile()&&!/\.(?:js|mjs|css|html|md|txt)$/.test(item.name))continue;
 await cp(join(from,item.name),join(target,item.name),{recursive:true});
}
const file=join(target,'index.html');let html=await readFile(file,'utf8');
html=html.replace('<title>UDPS Studio</title>','<title>UDPS Studio · Testversie</title>')
 .replace('<meta name="description"','<script>window.UDPS_STUDIO_MODE="test";window.UDPS_STUDIO_STORAGE_NAMESPACE="udps-studio-test-v1";</script>\n  <meta name="description"')
 .replace('<span class="prototype-mark">Klikmodel</span>','<span class="prototype-mark">Testversie</span>')
 .replace('Open dit klikmodel in een browser met JavaScript.','Open UDPS Studio in een browser met JavaScript.');
await writeFile(file,html);
await writeFile(join(target,'studio-build.json'),JSON.stringify({schema:1,source:'UDPS werkstroom klikmodel',sourceCommit:commit,productBaseCommit:'9a05876a33ab8d37543a393a8843f7c623c4ffc8',mode:'test',storageNamespace:'udps-studio-test-v1'},null,2)+'\n');
console.log('Prepared web/test with isolated storage; existing web files unchanged.');
