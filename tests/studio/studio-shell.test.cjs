const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(__dirname+'/../../web/test/studio-shell.js','utf8');
function book(name='A'){return {name,standards:{k:'R'},rows:[{id:'id1',key:'k',entity:'IfcDoor',propertySet:'Pset',name:'Width',type:'Text',label:'Width',active:true,override:null}]};}
function harness(initial){
 let workspace=initial, pending=[], saved=[], hooks={}, timers=new Map(),n=0;
 const state={project:null,saved:null,revised:false};
 const storage={load:async()=>({workspace}),save:async value=>{saved.push(structuredClone(value));return {};}};
 const dialog={open:true,addEventListener:(name,fn)=>hooks['dialog:'+name]=fn,querySelector:()=>({hidden:true}),close(){this.open=false;}};
 const context={structuredClone,TextEncoder,Date,Intl,Blob,crypto:require('node:crypto').webcrypto,window:{UDPS_STUDIO_MODE:'test',addEventListener:(name,fn)=>hooks[name]=fn},FormData:class{constructor(form){this.form=form;}get(name){return this.form.values?.[name];}getAll(name){return this.form.values?.[name]||[];}},setTimeout:fn=>{timers.set(++n,fn);return n;},clearTimeout:id=>timers.delete(id),UDPSStudioStorage:{create:()=>storage},console};
 vm.createContext(context);
 vm.runInContext(fs.readFileSync(__dirname+'/../../web/test/project-files.js','utf8')+'\n'+fs.readFileSync(__dirname+'/../../web/test/studio-workspace.js','utf8')+'\n'+source,context);
 const api={state,dialog,escapeHtml:x=>String(x??''),icon:()=>'',showDialog:x=>pending.push(x),buttonRow:()=>'',message:()=>{},currentFilters:()=>({entities:['IfcDoor'],search:'',propertySet:''}),render:()=>{},navigate:()=>{},switchProject:()=>{},downloadFile:()=>{}};
 const shell=vm.runInContext('UDPSStudioShell',context)(api);
 return {shell,state,dialog,hooks,saved,pending,model:context.UDPSStudioWorkspace,flush:async()=>{const tasks=[...timers.values()];timers.clear();for(const task of tasks)task();await new Promise(resolve=>setImmediate(resolve));},api};
}
test('source forms reach their own handler instead of being swallowed by the Studio shell',async()=>{
 const h=harness();await h.shell.init();for(const id of ['studio-bsdd-properties','studio-bsdd-preview','studio-library-export','ids-project-form'])assert.equal(h.shell.submit({id}),false);
});
test('opening an older saved file preserves that file baseline even with the same local book id',async()=>{
 const h=harness();const w=h.model.create(),p=book();h.model.publish(w,p,'1');const item=h.model.newFromBase(w,'A');h.model.publish(w,{...p,standards:{k:'New'}},'2');h.model.applyUpdate(w,item.id);
 const x=harness(w);await x.shell.init();const older=book();older.studioContext={schema:1,bookId:item.id,basisVersion:'1',baseProject:p};x.shell.projectOpened(older);x.state.project=older;x.shell.track();await x.flush();assert.equal(x.saved.at(-1).books[0].basisVersion,'1');assert.equal(x.saved.at(-1).books[0].baseProject.standards.k,'R');
});
test('invalid imported baseline cannot mutate an existing workspace book',async()=>{
 const h=harness();const w=h.model.create(),p=book();h.model.publish(w,p,'1');const item=h.model.newFromBase(w,'A');const x=harness(w);await x.shell.init();const bad=book();bad.studioContext={schema:1,bookId:item.id,basisVersion:'2',baseProject:{name:'broken',rows:[]}};assert.throws(()=>x.shell.projectOpened(bad),/werkblad/);assert.ok(x.shell.startPage().includes('v1'));assert.ok(!x.shell.startPage().includes('v2'));
});
test('a pending confirmed workspace mutation is guarded until the real storage acknowledgement',async()=>{
 const x=harness();await x.shell.init();const p=book();x.shell.projectOpened(p);x.state.project=p;x.shell.track();let stopped=0;x.hooks.beforeunload({preventDefault(){stopped++;}});assert.equal(stopped,1);await x.flush();x.hooks.beforeunload({preventDefault(){stopped++;}});assert.equal(stopped,1);
});
test('a corrupt stored workspace is not overwritten by an automatically created blank workspace',async()=>{
 const x=harness({schema:99});await x.shell.init();assert.ok(x.shell.startPage().includes('blijven behouden'));const p=book();x.shell.projectOpened(p);x.state.project=p;x.shell.track();await x.flush();assert.equal(x.saved.length,0);
});

test('a Studio file opened twice in a new browser keeps one workbook identity',async()=>{
 const h=harness();await h.shell.init();const p=book();p.studioContext={schema:1,bookId:'portable-book',basisVersion:null,baseProject:null};h.shell.projectOpened(p);h.state.project=p;h.shell.track();await h.flush();h.shell.projectOpened(p);h.state.project=p;h.shell.track();await h.flush();assert.equal(h.saved.at(-1).books.length,1);assert.equal(h.saved.at(-1).books[0].id,'portable-book');
});
test('publication review names a selected deletion before it can be published',async()=>{
 const seed=harness(),w=seed.model.create(),p=book();seed.model.publish(w,p,'1');const item=seed.model.newFromBase(w,'A');item.project.rows=[];
 const h=harness(w);await h.shell.init();const input=structuredClone(item.project);input.studioContext={schema:1,bookId:item.id,basisVersion:'1',baseProject:p};h.shell.projectOpened(input);h.state.project=input;h.shell.track();assert.equal(h.shell.submit({id:'studio-propose',values:{change:['id1']}}),true);assert.ok(h.pending.at(-1).includes('Verwijderd'));assert.ok(h.pending.at(-1).includes('Width'));assert.ok(!h.pending.at(-1).includes('Geen regels'));
});
test('workspace restore locks before file reading and cancels the old queued autosave',async()=>{
 const h=harness();await h.shell.init();const p=book();h.shell.projectOpened(p);h.state.project=p;h.shell.track();let resolveRead,reads=0;const text=new Promise(resolve=>resolveRead=resolve);const restored=h.model.create();restored.company.name='Restored';const buttons=[{disabled:false}],form={id:'studio-restore',isConnected:true,values:{},elements:{file:{files:[{size:200,text:()=>{reads++;return text;}}]}},querySelectorAll:()=>buttons};
 h.shell.submit(form);h.shell.submit(form);assert.equal(reads,1);assert.equal(buttons[0].disabled,true);await h.flush();assert.equal(h.saved.length,0);resolveRead(JSON.stringify(restored));await new Promise(resolve=>setImmediate(resolve));assert.equal(h.saved.length,1);assert.equal(h.saved[0].company.name,'Restored');assert.equal(h.state.project,null);assert.equal(buttons[0].disabled,false);
});
test('applying a base update refreshes the merged current book directly without a discard switch',async()=>{
 const seed=harness(),w=seed.model.create(),p=book();seed.model.publish(w,p,'1');const item=seed.model.newFromBase(w,'A');const next=book();next.standards.k='Company 2';seed.model.publish(w,next,'2');const h=harness(w);await h.shell.init();const input=structuredClone(item.project);input.studioContext={schema:1,bookId:item.id,basisVersion:'1',baseProject:p};h.shell.projectOpened(input);h.state.project=input;h.state.revised=true;h.shell.track();let opened=null,switches=0;h.api.openProject=project=>opened=project;h.api.switchProject=()=>switches++;h.shell.actions['studio-update']();h.shell.submit({id:'studio-update',values:{}});assert.equal(switches,0);assert.equal(opened.studioContext.basisVersion,'2');assert.equal(opened.standards.k,'Company 2');assert.equal(opened.needsSave,true);
});
test('resuming the current dirty workbook keeps the live draft without a discard switch',async()=>{
 const h=harness();await h.shell.init();const p=book();h.shell.projectOpened(p);h.state.project=p;h.state.revised=true;h.shell.track();await h.flush();const id=h.saved.at(-1).books[0].id;let switches=0,route='';h.api.switchProject=()=>switches++;h.api.navigate=value=>route=value;h.shell.actions['studio-open'](id);assert.equal(switches,0);assert.equal(route,'mappings');assert.equal(h.state.project,p);assert.equal(h.state.revised,true);
});
