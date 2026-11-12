// Optional development snapshot for the standard project's entities. No user data is sent.
import fs from 'node:fs/promises';
import {dictionaries,relatedClasses,classDetails,relationshipKey,defaults} from '../web/bsdd.js';
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function fetcher(...args){await pause(350);let r=await fetch(...args);if(r.status===429){await pause(Math.min(60000,Math.max(1000,Number(r.headers.get('retry-after')||20)*1000)));r=await fetch(...args);}return r;}
let snapshot;try{snapshot=JSON.parse(await fs.readFile('web/relations.json','utf8'));}catch{snapshot={schema:1,registry:await dictionaries(fetcher),relations:{},details:{}};}
const save=()=>fs.writeFile('web/relations.json',JSON.stringify(snapshot));await save();
for(const e of ['IfcWindow','IfcDoor','IfcCurtainWall']){const r=await relatedClasses(defaults[0].uri,e,fetcher);snapshot.relations[relationshipKey(defaults[0].uri,e)]=r;await save();for(const c of r.items)if(!snapshot.details[c.uri]){snapshot.details[c.uri]=await classDetails(c.uri,fetcher);await save();}await save();console.log(e,r.items.length);}
await fs.writeFile('web/relations.json',JSON.stringify(snapshot));
