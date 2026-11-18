import assert from 'node:assert/strict';import fs from 'node:fs';import * as store from '../lib/store.mjs';
let s={revision:0,overrides:{},history:[],shares:[]},snaps=new Map();const base=[{cad:'90:1',price:100,id:'123',agent:'secret',avito:'private'}];
globalThis.fixture={...store,authorized:(r,owner)=>owner?r.headers.authorization==='owner':!!r.headers.authorization,sameOrigin:()=>true,state:async()=>({data:structuredClone(s),etag:s.revision}),write:async(next,e)=>{assert.equal(e,s.revision);s=next;},merged:x=>base.map(d=>({...d,...x.overrides[d.cad]})),snapshot:async(id,data)=>snaps.set(id,data),read:async path=>({data:snaps.get(path.split('/')[1].replace('.json',''))})};process.env.MAP_USERS='owner:pass';process.env.EDITOR_PASSWORD='Table 4';
const src=fs.readFileSync(new URL('../api/registry.mjs',import.meta.url),'utf8').replace(/^import[^\n]+/,'const {fields,authorized,sameOrigin,state,write,merged,publicObject,token,snapshot,read}=globalThis.fixture;');const {default:handler}=await import('data:text/javascript;base64,'+Buffer.from(src).toString('base64'));
async function call(action,body,authorization='owner',query={},password='Table 4'){const req={query:{action,...query},method:body?'POST':'GET',headers:{authorization,'x-editor-password':password},body};const res={code:200,setHeader(){},status(c){this.code=c;return this},json(d){this.data=d;return this},end(){return this}};await handler(req,res);return res;}
assert.equal((await call('save',{revision:0,patches:[{cad:'90:1',price:200}]},'viewer')).code,403);
assert.equal((await call('owner',null,'owner',{},'table 4')).code,403);assert.equal((await call('owner',null,'owner',{},'pass')).code,403);assert.equal((await call('owner',null)).code,200);
const code=process.env.EDITOR_PASSWORD;delete process.env.EDITOR_PASSWORD;assert.equal((await call('owner',null,'owner',{},undefined)).code,403);process.env.EDITOR_PASSWORD=code;
assert.equal((await call('save',{revision:0,patches:[{cad:'90:1',price:-1}]})).code,400);assert.equal(s.revision,0);
assert.equal((await call('save',{revision:0,patches:[{cad:'90:1',price:200}]})).code,200);
assert.equal((await call('save',{revision:0,patches:[{cad:'90:1',price:300}]})).code,409);
const share=(await call('share',{revision:1,cads:['90:1']})).data.share;assert.equal(Date.parse(share.expiresAt)-Date.parse(share.createdAt),864000000);
const obj=snaps.get(share.id).objects[0];assert.equal(obj.agent,undefined);assert.equal(obj.avito,undefined);assert.equal(obj.id,'123');
await call('save',{revision:2,patches:[{cad:'90:1',price:400}]});assert.equal(obj.price,200);
await call('undo',{revision:3,id:s.history[0].id});assert.equal(s.overrides['90:1'].price,200);
await call('revoke',{revision:4,id:share.id});assert.equal((await call('view',null,'',{id:share.id})).code,410);s.shares[0].revoked=false;s.shares[0].expiresAt='2020-01-01';assert.equal((await call('view',null,'',{id:share.id})).code,410);
console.log('PASS owner permissions, validation, conflicts, sanitized frozen snapshots, ten-day expiry, undo, revocation');