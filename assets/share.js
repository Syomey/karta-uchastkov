'use strict';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>n==null?'—':Number(n).toLocaleString('ru-RU',{maximumFractionDigits:2});
const positive=n=>Number.isFinite(Number(n))&&Number(n)>0?Number(n):null;
const area=d=>!['квартира','апартаменты','комната'].includes(d.kind)&&positive(d.area)?Number(d.area)/100:null;
const unit=d=>d.kind==='участок'&&area(d)&&positive(d.price)?Math.round(d.price/area(d)):null;
const COLORS={'Трудовское':'#e11d48','Перовское':'#2563eb','Мирновское':'#16a34a','Чистенское':'#d97706','Добровское':'#7c3aed'};
const PALETTE=['#0891b2','#db2777','#65a30d','#ea580c','#4f46e5','#0d9488','#b45309','#9333ea','#dc2626','#0284c7','#ca8a04','#059669'];
const col=s=>{if(COLORS[s])return COLORS[s];let h=0;for(const ch of String(s||''))h=(h*31+ch.charCodeAt(0))>>>0;return PALETTE[h%PALETTE.length];};
let rows=[],visible=[],map=null,selected=null;const layers=new Map();
const mobile=()=>matchMedia('(max-width:760px)').matches;
function color(d){const key=map&&map.getZoom()<12?d.sheet:(d.vill||d.sheet);return ['м.о. Алушта','г.о. Алушта'].includes(key)?'#14532d':col(key);}
function notice(text){$('mapNotice').textContent=text;$('mapNotice').hidden=false;}
function setList(open){$('side').classList.toggle('closed',!open);$('toggle').textContent=open?'Скрыть':'Список · '+rows.length;$('toggle').setAttribute('aria-expanded',String(open));if(map)setTimeout(()=>map.invalidateSize(),0);}
async function copy(text){try{if(!navigator.clipboard)throw Error();await navigator.clipboard.writeText(text);}catch{prompt('Скопируйте:',text);}}
function crm(d){return d.id?'<div class="object-cad"><span>Топнлаб ID</span><a target="_blank" rel="noopener noreferrer" href="https://crm.topnlab.ru/object-card/'+encodeURIComponent(d.id)+'">'+esc(d.id)+'</a><button class="cadCopy" data-copy="'+esc(d.id)+'" aria-label="Копировать ID Топнлаба">⧉</button></div>':'';}
function renderList(){const q=$('search').value.trim().toLocaleLowerCase('ru');visible=rows.filter(d=>[d.cad,d.id,d.vill,d.sheet].some(v=>String(v||'').toLocaleLowerCase('ru').includes(q)));$('count').textContent='Показано: '+visible.length+' из '+rows.length;
 $('list').innerHTML=visible.map(d=>'<li'+(selected?.cad===d.cad?' class="sel"':'')+'><button data-pick="'+esc(d.cad)+'" aria-label="Открыть объект '+esc(d.cad)+'"><span class="dot" style="--dot:'+color(d)+'"></span><span class="c">'+esc(d.cad)+'</span> · '+(positive(d.price)?fmt(d.price/1000)+' тыс. ₽':'—')+'<div class="s">'+esc(d.vill||d.sheet||'Местоположение не уточнено')+' · '+fmt(area(d))+' сот. · '+fmt(unit(d))+' ₽/сот.</div></button></li>').join('');
 if(!visible.length)$('list').innerHTML='<li class="s">По запросу ничего не найдено</li>';
 if(map){const shown=new Set(visible.map(d=>d.cad));for(const [cad,l]of layers){for(const item of [l.shape,l.marker])if(item){if(shown.has(cad))item.addTo(map);else map.removeLayer(item);}}}
 $('copyAll').disabled=!visible.length;$('compare').disabled=!visible.length;}
function restyle(){for(const l of layers.values()){const c=color(l.d),active=selected?.cad===l.d.cad;if(l.shape)l.shape.setStyle({color:c,fillColor:c,weight:active?3:2,fillOpacity:active?.5:.35});l.marker.setStyle({color:active?'#facc15':'#fff',fillColor:c,weight:active?3:1});l.marker.setRadius(active?7:5);}renderList();}
function pick(d){selected=d;const card=$('objectCard');card.innerHTML='<div class="object-head"><span>'+esc((d.kind||'Объект')+' · '+(d.vill||d.sheet||'Местоположение не уточнено'))+'</span><button class="action" data-close-card aria-label="Закрыть карточку">×</button></div><div class="object-price">'+(positive(d.price)?fmt(d.price)+' ₽':'Цена не указана')+'</div><div class="object-metrics">'+fmt(area(d))+' сот. · '+fmt(unit(d))+' ₽/сот.</div><div class="object-cad"><span>'+esc(d.cad)+'</span><button class="cadCopy" data-copy="'+esc(d.cad)+'" aria-label="Копировать кадастр">⧉</button></div>'+crm(d)+'<details class="object-details"><summary>Подробнее</summary><p>'+esc(d.addr||'Адрес не указан')+'</p>'+(d.use?'<p>'+esc(d.use)+'</p>':'')+(d.cat?'<p>'+esc(d.cat)+'</p>':'')+'</details>';card.hidden=false;if(mobile())setList(false);const l=layers.get(d.cad);if(l&&map)map.panTo(l.marker.getLatLng());restyle();}
function overview(){if(!map)return;const points=visible.map(d=>layers.get(d.cad)?.marker.getLatLng()).filter(Boolean);if(points.length)map.fitBounds(L.latLngBounds(points),{padding:[30,30],maxZoom:14});}
function initMap(){
 if(typeof L==='undefined')throw Error('Библиотека карты не загрузилась');
 map=L.map('map',{preferCanvas:true}).setView([44.8,34.2],10);
 const scheme=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,referrerPolicy:'strict-origin-when-cross-origin',attribution:'© OpenStreetMap contributors'}).addTo(map);
 const satellite=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,attribution:'© Esri'});
 let failures=0;scheme.on('tileerror',()=>{if(++failures===3&&map.hasLayer(scheme)){setBase('satellite');notice('Схема недоступна — включён спутник.');}});satellite.on('tileerror',()=>notice('Подложка временно недоступна. Точки и карточки объектов доступны.'));
 function setBase(name){map.removeLayer(scheme);map.removeLayer(satellite);(name==='satellite'?satellite:scheme).addTo(map);document.querySelectorAll('[data-base]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.base===name)));$('basePicker').hidden=true;$('baseToggle').setAttribute('aria-expanded','false');}
 document.querySelectorAll('[data-base]').forEach(b=>b.onclick=()=>setBase(b.dataset.base));
 for(const d of rows){if(!d.g?.coordinates)continue;try{const shape=L.geoJSON({type:'Feature',geometry:d.g,properties:{}},{style:{color:color(d),weight:2,fillOpacity:.35},pointToLayer:(_,latlng)=>L.circleMarker(latlng,{radius:0,opacity:0,fillOpacity:0,interactive:false})});if(!shape.getLayers().length)continue;const center=shape.getBounds().getCenter();const marker=L.circleMarker(center,{radius:5,color:'#fff',weight:1,fillColor:color(d),fillOpacity:1});shape.bindTooltip(esc(d.cad),{sticky:true});marker.bindTooltip(esc(d.cad));shape.on('click',()=>pick(d));marker.on('click',()=>pick(d));shape.addTo(map);marker.addTo(map);layers.set(d.cad,{d,shape,marker});}catch{}}
 map.on('zoomend',restyle);overview();restyle();
}
$('toggle').onclick=()=>setList($('side').classList.contains('closed'));
$('search').oninput=renderList;
$('overview').onclick=overview;
$('baseToggle').onclick=()=>{$('basePicker').hidden=!$('basePicker').hidden;$('baseToggle').setAttribute('aria-expanded',String(!$('basePicker').hidden));};
$('copyAll').onclick=()=>copy(visible.map(d=>d.cad).join('\n'));
$('compare').onclick=()=>{const shown=visible;$('compareDialog').querySelector('h2').textContent='Сравнение объектов: '+shown.length;$('comparison').innerHTML='<table><thead><tr><th>Кадастр</th><th>Населённый пункт</th><th>Земля, сот.</th><th>Цена, ₽</th><th>₽/сот.</th><th>Топнлаб</th></tr></thead><tbody>'+shown.map(d=>'<tr><td>'+esc(d.cad)+'</td><td>'+esc(d.vill||'—')+'</td><td>'+fmt(area(d))+'</td><td>'+fmt(d.price)+'</td><td>'+fmt(unit(d))+'</td><td>'+(d.id?'<a target="_blank" rel="noopener noreferrer" href="https://crm.topnlab.ru/object-card/'+encodeURIComponent(d.id)+'">'+esc(d.id)+'</a>':'—')+'</td></tr>').join('')+'</tbody></table>';$('compareDialog').showModal();};
$('closeCompare').onclick=()=>$('compareDialog').close();
document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.copy)copy(b.dataset.copy);if(b.dataset.pick){const d=rows.find(d=>d.cad===b.dataset.pick);if(d)pick(d);}if(b.hasAttribute('data-close-card')){$('objectCard').hidden=true;selected=null;restyle();}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){$('objectCard').hidden=true;$('basePicker').hidden=true;selected=null;if(map)restyle();}});
setList(!mobile());
(async()=>{try{const id=location.hash.slice(1);if(!/^[a-f0-9]{48}$/.test(id))throw Error('В ссылке отсутствует код подборки. Откройте полную ссылку, включая часть после #.');const r=await fetch('/api/registry?action=view&id='+encodeURIComponent(id),{cache:'no-store'});const s=await r.json();if(!r.ok)throw Error(s.error||'Подборка недоступна.');rows=s.objects;$('status').textContent=rows.length+' объектов · на '+new Date(s.createdAt).toLocaleDateString('ru-RU')+' · до '+new Date(s.expiresAt).toLocaleDateString('ru-RU');setList(!mobile());renderList();try{initMap();}catch{notice('Карта временно недоступна. Объекты доступны в списке.');setList(true);$('mapTools').hidden=true;}}catch(e){$('status').textContent=e.message||'Подборка недоступна.';setList(true);$('mapTools').hidden=true;}})();
