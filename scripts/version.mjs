import fs from 'node:fs';
const next=process.argv[2];if(!/^\d+\.\d+\.\d+$/.test(next||''))throw Error('Gebruik npm run version:app -- 1.2.3');
const root=new URL('../',import.meta.url),pkg=JSON.parse(fs.readFileSync(new URL('package.json',root))),previous=pkg.version;
for(const file of fs.readdirSync(new URL('web/',root)).filter(n=>n.endsWith('.js'))){const path=new URL('web/'+file,root);let text=fs.readFileSync(path,'utf8').replaceAll(previous,next);text=text.replace(/(from\s*['"]\.\/[^'"?]+\.js)(?:\?v=[^'"]+)?(['"])/g,`$1?v=${next}$2`);fs.writeFileSync(path,text);}
const html=new URL('web/index.html',root);fs.writeFileSync(html,fs.readFileSync(html,'utf8').replaceAll(previous,next).replace(/(src="app\.js|href="style\.css)(?:\?v=[^"]+)?"/g,`$1?v=${next}"`));pkg.version=next;fs.writeFileSync(new URL('package.json',root),JSON.stringify(pkg,null,2)+'\n');
