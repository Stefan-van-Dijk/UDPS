// Rebuild the browser-worker-only parser from pinned, installed sources.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root=fileURLToPath(new URL('../',import.meta.url)),version='0.9.12',builder='0.25.12';
const source=path.join(root,'node_modules/@xmldom/xmldom'),target=path.join(root,'web/vendor/ids-parser');
const pkg=JSON.parse(fs.readFileSync(path.join(source,'package.json'),'utf8'));
if(pkg.name!=='@xmldom/xmldom'||pkg.version!==version)throw Error('Install exactly @xmldom/xmldom '+version+' before rebuilding the IDS worker parser.');
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'udps-ids-parser-'));
try{
 fs.mkdirSync(target,{recursive:true});
 const entry=path.join(temporary,'entry.js');
 fs.writeFileSync(entry,`import parser from ${JSON.stringify(path.join(source,'lib/index.js'))};\nexport const DOMParser=parser.DOMParser;\nexport const XMLSerializer=parser.XMLSerializer;\n`);
 execFileSync('npm',['exec','--yes','--package','esbuild@'+builder,'--','esbuild',entry,'--bundle','--format=esm','--platform=browser','--target=es2020','--minify','--legal-comments=eof','--outfile='+path.join(target,'xmldom.js')],{cwd:root,stdio:'inherit'});
 fs.copyFileSync(path.join(source,'LICENSE'),path.join(target,'LICENSE'));
 const sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
 const provenance={name:pkg.name,version,license:pkg.license,homepage:pkg.homepage,builder:{name:'esbuild',version:builder},purpose:'XML parsing only inside the IDS module worker; no runtime network dependency.',sha256:{'xmldom.js':sha(path.join(target,'xmldom.js')),LICENSE:sha(path.join(target,'LICENSE'))},sourceFiles:Object.fromEntries(fs.readdirSync(path.join(source,'lib')).filter(f=>f.endsWith('.js')).sort().map(f=>['lib/'+f,sha(path.join(source,'lib',f))]))};
 fs.writeFileSync(path.join(target,'provenance.json'),JSON.stringify(provenance,null,2)+'\n');
}finally{fs.rmSync(temporary,{recursive:true,force:true});}
