import {fields,authorized,sameOrigin,state,write,merged,publicObject,token,snapshot,read} from '../lib/store.mjs';
export default async function handler(req,res){
 res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Robots-Tag','noindex, nofollow');
 const action=req.query.action||'load';
 try{
 if(action==='view'){
  const id=String(req.query.id||'');if(!/^[a-f0-9]{48}$/.test(id))return res.status(404).json({error:'Подборка недоступна.'});
  const {data:s}=await state();const share=s.shares.find(x=>x.id===id);if(!share||share.revoked||Date.now()>=Date.parse(share.expiresAt))return res.status(410).json({error:'Срок подборки истёк или ссылка отключена.'});
  const r=await read('shares/'+id+'.json');return r?res.json(r.data):res.status(410).json({error:'Подборка недоступна.'});
 }
 if(!authorized(req))return res.status(401).json({error:'Требуется вход в карту.'});
 const owner=authorized(req,true)&&req.headers['x-editor-password']===(process.env.MAP_USERS||'').split(',')[0].trim().split(':').slice(1).join(':');
 if(action==='owner')return res.status(owner?200:403).json({owner});
 const r=await state(),s=r.data;
 if(req.method==='GET'){
  if(action==='load')return res.json({revision:s.revision,overrides:s.overrides});
  if(!owner)return res.status(403).json({error:'Доступно только владельцу.'});
  return res.json({revision:s.revision,history:s.history.map(({before,...h})=>h),shares:s.shares});
 }
 if(req.method!=='POST')return res.status(405).end();
 if(!owner||!sameOrigin(req))return res.status(403).json({error:'Доступно только владельцу.'});
 const b=typeof req.body==='string'?JSON.parse(req.body):req.body||{};
 if(b.revision!==s.revision)return res.status(409).json({error:'Данные изменились на другом устройстве. Скачайте патч и обновите страницу: ваши правки сохранены в этой вкладке.'});
 const now=new Date().toISOString();
 if(action==='save'){
  if(!Array.isArray(b.patches)||!b.patches.length||b.patches.length>1500)return res.status(400).json({error:'Некорректный пакет.'});
  const objects=new Map(merged(s).map(d=>[d.cad,d])),before=structuredClone(s.overrides),seen=new Set();let count=0;
  for(const p of b.patches){if(!objects.has(p.cad)||seen.has(p.cad))return res.status(400).json({error:'Неизвестный или повторный кадастр.'});seen.add(p.cad);
   const d=objects.get(p.cad),changes={};
   for(const f of fields)if(Object.hasOwn(p,f)){
    const v=p[f];if(f==='price'?(v!==null&&(typeof v!=='number'||!Number.isFinite(v)||v<0)):(typeof v!=='string'||v.length>10000))return res.status(400).json({error:'Некорректное поле: '+f});
    if(f==='id'&&v&&!/^\d+$/.test(v))return res.status(400).json({error:'ID должен состоять из цифр.'});
    if((d[f]??(f==='price'?null:''))!==v)changes[f]=v;
   }
   if(Object.keys(changes).length){s.overrides[p.cad]={...s.overrides[p.cad],...changes};count++;}
  }
  if(count)s.history.unshift({id:token(),at:now,count,before});else return res.json({revision:s.revision});
 }else if(action==='undo'){
  const last=s.history[0];if(!last||last.id!==b.id)return res.status(409).json({error:'Можно отменить только последнее изменение.'});
  const before=structuredClone(s.overrides);s.overrides=last.before;s.history.unshift({id:token(),at:now,count:Object.keys(before).length,before,label:'Отмена последнего изменения'});
 }else if(action==='share'){
  if(!Array.isArray(b.cads)||!b.cads.length||b.cads.length>1500)return res.status(400).json({error:'Выберите объекты.'});
  const objects=new Map(merged(s).map(d=>[d.cad,d]));if(b.cads.some(c=>!objects.has(c)))return res.status(400).json({error:'Неизвестный кадастр.'});
  const share={id:token(),createdAt:now,expiresAt:new Date(Date.now()+10*86400000).toISOString(),count:new Set(b.cads).size};
  await snapshot(share.id,{...share,objects:[...new Set(b.cads)].map(c=>publicObject(objects.get(c)))});s.shares.unshift(share);
 }else if(action==='revoke'){
  const share=s.shares.find(x=>x.id===b.id);if(!share)return res.status(404).end();share.revoked=true;
 }else return res.status(400).json({error:'Неизвестное действие.'});
 s.revision++;await write(s,r.etag);return res.json({revision:s.revision,share:action==='share'?s.shares[0]:undefined});
 }catch(e){console.error('Registry operation failed',e.name);return res.status(e.name==='BlobPreconditionFailedError'?409:503).json({error:e.name==='BlobPreconditionFailedError'?'Данные изменились. Обновите страницу, сохранив локальный патч.':'Хранилище временно недоступно. Локальный патч сохранён.'});}
}
