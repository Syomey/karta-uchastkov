import {put} from '@vercel/blob';
import {authorized,sameOrigin,state,write,merged,read,token} from '../lib/store.mjs';
import {scopeUsers,cache,inspectEntities,summary,apiCall,getGeometry,wait} from '../lib/topnlab.mjs';
const PATH='sync/topnlab-job.json';
async function saveJob(job,etag){return put(PATH,JSON.stringify(job),{access:'private',abortSignal:AbortSignal.timeout(10000),addRandomSuffix:false,allowOverwrite:!!etag,...(etag?{ifMatch:etag}:{})});}
async function checkpoint(job){await put('sync/topnlab-checkpoint.json',JSON.stringify({seenIds:[...new Set(job.seenIds)],finishedAt:job.finishedAt}),{access:'private',abortSignal:AbortSignal.timeout(10000),addRandomSuffix:false,allowOverwrite:true});}
export default async function handler(req,res){res.setHeader('Cache-Control','private, no-store');
 if(!authorized(req,true)||!process.env.EDITOR_PASSWORD||req.headers['x-editor-password']!==process.env.EDITOR_PASSWORD||!sameOrigin(req))return res.status(403).json({error:'Доступно только владельцу в редакторе.'});
 const action=req.query.action||'status';let job,lease;
 try{
 const saved=await read(PATH);job=saved?.data;
 if(req.method==='GET'){if(action==='report')return res.json({summary:summary(job),review:job?.review||[]});return res.json(summary(job));}
 if(req.method!=='POST')return res.status(405).end();
 if(!process.env.TOPNLAB_API_KEY)return res.status(503).json({error:'Не настроен ключ API Топнлаба.'});
 if(action==='start'){
  if(job&&job.phase!=='done'&&(job.phase!=='preparing'||Date.now()-Date.parse(job.startedAt)<120000))return res.json(summary(job));
  const cp=(await read('sync/topnlab-checkpoint.json'))?.data;
  job={id:token(),phase:'preparing',startedAt:new Date().toISOString(),ids:[],seenIds:cp?.seenIds||[],cursor:0,users:[],candidates:[],review:[],geometryIds:[],geometryCursor:0,counts:{team:0,existing:0,outsideTeam:0,outsideRegion:0,inactive:0,noCad:0,conflicts:0,missingApi:0,geometryMissing:0,added:0},nextApiAt:Date.now()};
  const lock=await saveJob(job,saved?.etag);lease=lock.etag;
  const call=async(...args)=>{await wait(Math.max(0,job.nextApiAt-Date.now()));job.nextApiAt=Date.now()+6100;return apiCall(process.env.TOPNLAB_API_KEY,...args);};
  const users=await call('getUsers/'),structure=await call('getStructure/');job.users=scopeUsers(users,structure);
  const ids=new Set(),changed=new Set();for(const realty_type of ['land','house']){const data=await call('get-ids',{type:'realty',realty_type,action:'sale'});const list=Array.isArray(data)?data:data.data;if(!Array.isArray(list))throw Error('Не удалось получить список ID Топнлаба.');list.forEach(id=>ids.add(String(id)));}
  if(cp?.finishedAt){for(const realty_type of ['land','house']){const data=await call('get-ids',{type:'realty',realty_type,action:'sale',manual_update_from:new Date(Date.parse(cp.finishedAt)-86400000).toISOString().slice(0,10)});const list=Array.isArray(data)?data:data.data;if(!Array.isArray(list))throw Error('Не удалось получить изменённые ID.');list.forEach(id=>changed.add(String(id)));}}
  const current=merged((await state()).data),existing=new Set(current.filter(d=>d.id).map(d=>String(d.id))),seen=new Set(job.seenIds);
  job.ids=[...ids].filter(id=>!existing.has(id)&&(!seen.has(id)||changed.has(id))).sort((a,b)=>Number(b)-Number(a));job.counts.existing=existing.size;job.phase=job.ids.length?'scan':'commit';await saveJob(job,lease);lease=null;return res.json(summary(job));
 }
 if(action!=='step'||!job)return res.status(400).json({error:'Сначала начните загрузку.'});
 if(job.phase==='done')return res.json(summary(job));
 if(job.phase==='preparing')return res.status(409).json({error:'Подготовка списка ещё выполняется. Повторите через несколько секунд.'});
 if(job.leaseUntil>Date.now())return res.status(409).json({error:'Этот пакет уже обрабатывается. Повторите через минуту.'});
 if(job.nextApiAt>Date.now())return res.json(summary(job));
 job.leaseUntil=Date.now()+90000;job.lastError='';const locked=await saveJob(job,saved.etag);lease=locked.etag;
 if(job.phase==='scan'){
  const ids=job.ids.slice(job.cursor,job.cursor+(job.batchSize||150));job.nextApiAt=Date.now()+6100;
  let response;
  try{response=await apiCall(process.env.TOPNLAB_API_KEY,'get-entities',{type:'realty',id:ids},true);job.failures=0;}catch(e){
   if(!(e.httpStatus===429||e.httpStatus>=500))throw e;
   job.failures=ids.length===1&&e.httpStatus===500?3:(job.failures||0)+1;job.nextApiAt=Date.now()+15000;job.lastError='Топнлаб временно недоступен, повторяем пакет.';
   if(job.failures>=3){if(ids.length>1){job.batchSize=Math.max(1,Math.floor(ids.length/2));job.failures=0;}else{job.review.push({id:ids[0],reason:'api_error'});job.counts.missingApi++;job.cursor++;job.failures=0;job.batchSize=1;job.nextApiAt=Date.now()+6100;if(job.cursor>=job.ids.length){job.geometryIds=job.candidates.filter(d=>d._needsGeometry).map(d=>d.cad);job.phase=job.geometryIds.length?'geometry':'commit';}}}
   job.leaseUntil=0;await saveJob(job,lease);lease=null;return res.json(summary(job));
  }
  const entities=response.data||response;
  job.counts.missingApi+=ids.filter(id=>!entities[id]).length;inspectEntities(job,entities,merged((await state()).data),cache());job.cursor+=ids.length;
  if(job.cursor>=job.ids.length){job.geometryIds=job.candidates.filter(d=>d._needsGeometry).map(d=>d.cad);job.phase=job.geometryIds.length?'geometry':'commit';}
 }else if(job.phase==='geometry'){
  const batch=job.geometryIds.slice(job.geometryCursor,job.geometryCursor+3);for(let i=0;i<batch.length;i++){if(i)await wait(2500);const d=job.candidates.find(d=>d.cad===batch[i]),g=await getGeometry(batch[i]);if(g){for(const[k,v]of Object.entries(g))if(v!==null&&v!=='')d[k]=v;}else job.counts.geometryMissing++;job.geometryCursor++;}job.nextApiAt=Date.now()+2500;if(job.geometryCursor>=job.geometryIds.length)job.phase='commit';
 }else if(job.phase==='commit'){
  const r=await state(),s=r.data;const prior=s.syncReports?.[job.id];
  if(prior){job.report=prior;job.counts.added=prior.added;}else{
   const current=merged(s),byCad=new Map(current.map(d=>[d.cad,d]));const beforeAdditions=structuredClone(s.additions||{});let added=0;
   for(const candidate of job.candidates){if(byCad.has(candidate.cad)){const existing=byCad.get(candidate.cad);if(String(existing.id)!==candidate.id){job.counts.conflicts++;job.review.push({id:candidate.id,cad:candidate.cad,existingId:existing.id||'',reason:'cad_conflict'});}continue;}const {_needsGeometry,...d}=candidate;s.additions??={};s.additions[d.cad]=d;byCad.set(d.cad,d);added++;}
   job.counts.added=added;job.report={...job.counts,checked:job.cursor,teamSize:job.users.length};s.syncReports??={};s.syncReports[job.id]=job.report;
   if(added)s.history.unshift({id:token(),at:new Date().toISOString(),count:added,before:structuredClone(s.overrides),beforeAdditions,label:'Добавление из Топнлаба'});
   s.revision++;await write(s,r.etag);
  }
  job.phase='done';job.finishedAt=new Date().toISOString();await checkpoint(job);
 }
 job.leaseUntil=0;await saveJob(job,lease);lease=null;return res.json(summary(job));
 }catch(e){if(job&&lease){job.leaseUntil=0;job.lastError=e.constructor.name==='BlobPreconditionFailedError'?'Данные изменились, повторите загрузку.':String(e.message||'Загрузку можно продолжить.').slice(0,220);if(job.phase==='preparing')job.startedAt='1970-01-01T00:00:00Z';try{await saveJob(job,lease);}catch{}}
 const conflict=e.constructor.name==='BlobPreconditionFailedError';return res.status(conflict?409:503).json({error:conflict?'Данные изменились. Нажмите «Продолжить загрузку».':job?.lastError||'Загрузка временно недоступна. Её можно продолжить.'});}
}
