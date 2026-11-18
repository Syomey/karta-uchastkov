import {get,put} from '@vercel/blob';
import {readFileSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
export const fields=['id','price','vill','sheet','kind','title','agent','src','avito'];
export function base(){return JSON.parse(readFileSync(process.cwd()+'/data/objects.js','utf8').replace(/^window\.OBJECTS=/,'').replace(/;\s*$/,''));}
export function principal(req){try{return Buffer.from((req.headers.authorization||'').replace(/^Basic /,''),'base64').toString('utf8');}catch{return '';}}
export function authorized(req,owner=false){const users=(process.env.MAP_USERS||'').split(',').map(s=>s.trim()).filter(Boolean);return (owner?users.slice(0,1):users).includes(principal(req));}
export function sameOrigin(req){const origin=req.headers.origin;return !origin||origin==='https://'+req.headers.host||origin==='http://'+req.headers.host;}
export function token(){return randomBytes(24).toString('hex');}
export async function read(path){const r=await get(path,{access:'private',abortSignal:AbortSignal.timeout(10000),useCache:false,headers:{"Accept-Encoding":"identity"}});if(!r)return null;return {data:JSON.parse(await new Response(r.stream).text()),etag:r.blob.etag.replace(/^W\//,'')};}
export async function state(){let r=await read('registry/state.json');if(r)return r;try{await put('registry/state.json',JSON.stringify({revision:0,overrides:{},history:[],shares:[]}),{access:'private',abortSignal:AbortSignal.timeout(10000),addRandomSuffix:false,allowOverwrite:false});}catch{}return await read('registry/state.json');}
export async function write(s,etag){await put('registry/state.json',JSON.stringify(s),{access:'private',abortSignal:AbortSignal.timeout(10000),addRandomSuffix:false,allowOverwrite:true,ifMatch:etag});}
export async function snapshot(id,data){await put('shares/'+id+'.json',JSON.stringify(data),{access:'private',abortSignal:AbortSignal.timeout(10000),addRandomSuffix:false,allowOverwrite:false,ttlDays:11});}
export function merged(s){const all=new Map(base().map(d=>[d.cad,d]));for(const [cad,d]of Object.entries(s.additions||{}))if(!all.has(cad))all.set(cad,d);return [...all.values()].map(d=>({...d,...s.overrides[d.cad]}));}
export function publicObject(d){d={...d};if(!d.kind){const u=String(d.avito||'');if(u.includes('/zemelnye_uchastki/'))d.kind='участок';else if(u.includes('/doma_dachi_kottedzhi/'))d.kind='дом';else if(u.includes('/kvartiry/'))d.kind='квартира';}return Object.fromEntries(['cad','id','price','vill','sheet','kind','title','area','addr','cat','use','g'].filter(k=>d[k]!==undefined).map(k=>[k,d[k]]));}
