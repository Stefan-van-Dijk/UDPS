import {readdir,readFile,stat} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const directory=new URL('../web/test/',import.meta.url);
async function walk(url){for(const item of await readdir(url,{withFileTypes:true})){const path=new URL(item.name+(item.isDirectory()?'/':''),url);if(item.isDirectory()){if(!['vendor','assets'].includes(item.name))await walk(path);}else if(/\.[cm]?js$/.test(item.name)){const result=spawnSync(process.execPath,['--check',fileURLToPath(path)],{stdio:'inherit'});if(result.status!==0)process.exit(result.status||1);}}}
await walk(directory);
const html=await readFile(new URL('index.html',directory),'utf8');
for(const match of html.matchAll(/(?:src|href)="([^"]+)"/g)){const value=match[1];if(/^(?:[a-z]+:|#|\/)/i.test(value))continue;await stat(new URL(value.split(/[?#]/)[0],directory));}
if(!html.includes('window.UDPS_STUDIO_STORAGE_NAMESPACE="udps-studio-test-v1"'))throw Error('Test storage namespace is missing.');
if(!html.includes('window.UDPS_STUDIO_MODE="test"'))throw Error('Test version marking is missing.');
console.log('Studio test syntax and isolation checked.');
