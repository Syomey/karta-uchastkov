const fs=require('fs'),vm=require('vm'),assert=require('assert');
const template=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
const helpers=template.slice(template.indexOf('// Selection/filter helpers:'),template.indexOf('const EDIT_UNLOCK_KEY'));
const elements=new Map(),events={},selected=new Set();
const element=id=>{if(!elements.has(id))elements.set(id,{value:'',validity:{valid:true},style:{},classList:{toggle(){}},dataset:{},listeners:{},textContent:'',innerHTML:'',open:false,setAttribute(k,v){this[k]=v},addEventListener(k,f){this.listeners[k]=f},remove(){this.removed=true},closest(){return null}});return elements.get(id)};
let applied=0;const p=(x,y)=>({x,y,distanceTo(o){return Math.hypot(x-o.x,y-o.y)}});
const mapElement=element('map');mapElement.appendChild=()=>{};
const context={selectedCads:selected,visibleObjects:[],onlySelected:false,suppressPlotClickUntil:0,objectPopup:null,popupObject:null,DATA:[],layers:new Map(),fmt:n=>Math.round(n).toString(),esc:s=>String(s??''),theme:()=>({ours:c=>({color:c,fillColor:c,weight:2}),point:c=>({color:c,fillColor:c,weight:2}),marker:c=>({color:'#fff',fillColor:c,radius:5,weight:1})}),colOfPlot:()=> '#14532d',L:{CircleMarker:class {},latLngBounds:(a,b)=>({contains:c=>c.x>=Math.min(a.x,b.x)&&c.x<=Math.max(a.x,b.x)&&c.y>=Math.min(a.y,b.y)&&c.y<=Math.max(a.y,b.y)})},document:{getElementById:element,createElement:()=>element('rect'+elements.size),body:{style:{userSelect:'auto'}},addEventListener:(k,f)=>events[k]=f},window:{addEventListener:(k,f)=>events['window:'+k]=f},apply:()=>applied++,renderComparison:()=>{},syncVillages:()=>{},map:{getContainer:()=>mapElement,mouseEventToContainerPoint:e=>p(e.x,e.y),containerPointToLatLng:x=>x,dragging:{state:true,enabled(){return this.state},disable(){this.state=false},enable(){this.state=true}}}};
context.updateTouchTools=()=>{};context.cancelEditorHold=()=>{};context.boxSelectionMode=false;context.touchSelectionMode=false;
vm.createContext(context);vm.runInContext(helpers,context);
const d={cad:'a',kind:'участок',price:4e6,area:800};
assert.equal(context.areaSot(d),8);assert.equal(context.pricePerSot(d),500000);
assert.equal(context.pricePerSot({...d,area:850}),4e6/8.5);
for(const value of [0,-1,null,{},[],NaN,Infinity,'bad','']){assert.equal(context.pricePerSot({...d,area:value}),null);assert.equal(context.pricePerSot({...d,price:value}),null)}
assert.equal(context.pricePerSot({...d,kind:'дом'}),null);
assert.equal(context.areaSot({...d,kind:'дом'}),8);
assert.equal(context.areaSot({...d,kind:'квартира'}),null);
assert.equal(context.pricePerSot({...d,kind:null,title:'Участок 8 сот.'}),500000);
assert.equal(context.pricePerSot({...d,kind:null,avito:'https://avito.ru/x/zemelnye_uchastki/y'}),500000);
assert.equal(context.pricePerSot({...d,kind:null,title:'Дом 100 м²',avito:'https://avito.ru/x/doma_dachi_kottedzhi/y'}),null);
assert.equal(context.pricePerSot({...d,kind:null,title:''}),null);
assert(context.passesNumeric(d,context.parseRange('8','8'),context.parseRange('500000','500000')));
assert(!context.parseRange('9','8').valid);assert(!context.parseRange('-1','8').valid);
assert(!context.passesNumeric({...d,area:null},context.parseRange('1',''),context.parseRange('','')));
assert(context.passesNumeric({...d,area:null},context.parseRange('',''),context.parseRange('','')));
for(const order of ['price-asc','price-desc','area-asc','area-desc','unit-asc','unit-desc']){
  const rows=[{...d,cad:'missing',price:null,area:null},{...d,cad:'small',price:1e6,area:500},{...d,cad:'large',price:4e6,area:800}];
  context.sortObjects(rows,order);assert.equal(rows[2].cad,'missing');assert.equal(rows[0].cad,order.endsWith('desc')?'large':'small');
}
context.toggleSelected('a');assert(selected.has('a'));assert(context.onlySelected);context.toggleSelected('a');assert(!selected.has('a'));assert(!context.onlySelected);
selected.add('hidden');context.visibleObjects=[d];context.updateSelectionUI();assert(element('selectionCount').textContent.includes('скрыто фильтрами: 1'));
context.DATA=[{...d,id:'123',vill:'Доброе'},{...d,cad:'hidden',kind:'дом'}];selected.add('a');context.renderComparison();assert(element('compareBody').innerHTML.includes('object-card/123'));assert(element('compareBody').innerHTML.includes('500000'));
const entry={d,lyr:{eachLayer(fn){fn({setStyle(s){this.style=s;entry.polygonStyle=s}})}},m:{setStyle(s){entry.markerStyle=s}}};context.stylePlot(entry);assert.equal(entry.polygonStyle.color,'#f59e0b');assert.equal(entry.polygonStyle.fillColor,'#14532d');selected.delete('a');context.stylePlot(entry);assert.equal(entry.polygonStyle.weight,2);assert.equal(entry.markerStyle.radius,5);
vm.runInContext(template.slice(template.indexOf('document.getElementById("onlySelected").addEventListener'),template.indexOf('function isTouchDevice()')),context);
vm.runInContext(template.slice(template.indexOf('// A transparent rectangle'),template.lastIndexOf('\nsyncToggle();')),context);
// Actual registered mouse handlers: reverse drag, additive selection, filtered objects only.
context.visibleObjects=[d,{...d,cad:'b'},{...d,cad:'outside'}];
for(const [cad,point] of [['a',p(15,15)],['b',p(25,25)],['outside',p(90,90)],['filtered',p(20,20)]])context.layers.set(cad,{m:{getLatLng:()=>point}});
const event=(x,y,extra={})=>({x,y,shiftKey:true,button:0,target:{closest:()=>null},preventDefault(){},stopImmediatePropagation(){},...extra});
mapElement.listeners.mousedown(event(30,30));events.mousemove(event(10,10));events.mouseup(event(10,10));
assert(selected.has('a')&&selected.has('b')&&selected.has('hidden'));assert(!selected.has('outside'));assert(!selected.has('filtered'));assert(context.map.dragging.enabled());assert.equal(context.document.body.style.userSelect,'auto');
// Cancelled rectangles do not select; regular pan is never intercepted.
selected.clear();mapElement.listeners.mousedown(event(0,0));events.mousemove(event(50,50));events['window:blur']();assert.equal(selected.size,0);assert(context.map.dragging.enabled());
let intercepted=false;mapElement.listeners.mousedown(event(0,0,{shiftKey:false,preventDefault(){intercepted=true}}));assert(!intercepted);
mapElement.listeners.mousedown(event(14,14));events.mouseup(event(14,14));assert.equal(selected.size,0);
element('clearSelected').listeners.click();assert(!context.onlySelected);assert.equal(selected.size,0);
// Touch rectangle mode, cancellation and two-finger handoff.
context.boxSelectionMode=true;
const touchEvent=(points)=>({...event(0,0),touches:points.map(([x,y])=>({clientX:x,clientY:y,x,y}))});
mapElement.listeners.touchstart(touchEvent([[10,10]]));events.touchmove(touchEvent([[30,30]]));events.touchend(touchEvent([]));assert(selected.has('a')&&selected.has('b'));assert(context.map.dragging.enabled());
selected.clear();mapElement.listeners.touchstart(touchEvent([[10,10]]));events.touchmove(touchEvent([[30,30]]));events.touchcancel();assert.equal(selected.size,0);assert(context.map.dragging.enabled());
mapElement.listeners.touchstart(touchEvent([[10,10]]));mapElement.listeners.touchstart(touchEvent([[10,10],[30,30]]));assert(context.map.dragging.enabled());assert.equal(selected.size,0);
const popupSource=template.slice(template.indexOf('function popup(d){'),template.indexOf('\nconst layers = new Map();'));
context.isClientView=()=>true;context.territoryName=String;context.layers=new Map();vm.runInContext(popupSource,context);
assert(context.popup({...d,id:'123'}).includes('object-card/123'));assert(context.popup(d).includes('500000 ₽/сот.'));
console.log('PASS: numeric calculations, legacy kinds, ranges, sorting, unknown values, selection, comparison, styles, rectangle handlers, cancellation, pan, client CRM link.');
