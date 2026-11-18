const fs=require('fs'),vm=require('vm'),assert=require('assert');
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
const helpers=html.slice(html.indexOf('// Selection/filter helpers:'),html.indexOf('const EDIT_UNLOCK_KEY'));
const elements=new Map();let clipboard='',fallbackText='',promptText='',fallbackSuccess=true,focused=false;
const el=id=>{if(!elements.has(id))elements.set(id,{value:'default',open:false,textContent:'',focus(){focused=true},appendChild(field){fallbackText=field.value}});return elements.get(id)};
const ctx={DATA:[{cad:'1040302340:303030',price:200},{cad:'10303040:3004040',price:100},{cad:'not-selected'}],selectedCads:new Set(['1040302340:303030','10303040:3004040']),navigator:{clipboard:{writeText:async text=>{clipboard=text}}},document:{getElementById:el,activeElement:el('focus'),body:{appendChild(field){fallbackText=field.value}},createElement(){return {value:'',style:{},focus(){},select(){},setSelectionRange(){},remove(){}}},execCommand:()=>fallbackSuccess},window:{prompt:(message,text)=>promptText=text},setTimeout:()=>{}};
vm.createContext(ctx);vm.runInContext(helpers,ctx);
(async()=>{
  const expected='1040302340:303030\n10303040:3004040';
  assert.equal(ctx.selectedCadText(),expected);await ctx.copySelectedCads();assert.equal(clipboard,expected);assert.equal(el('copyStatus').textContent,'Скопировано номеров: 2');
  el('sortOrder').value='price-asc';assert.equal(ctx.selectedCadText(),'10303040:3004040\n1040302340:303030');el('sortOrder').value='default';
  ctx.navigator.clipboard.writeText=async()=>{throw Error('denied')};await ctx.copySelectedCads();assert.equal(fallbackText,expected);assert(focused);
  fallbackSuccess=false;await ctx.copySelectedCads();assert.equal(promptText,expected);
  ctx.selectedCads.clear();clipboard='unchanged';await ctx.copySelectedCads();assert.equal(clipboard,'unchanged');
  console.log('PASS: exact newline-separated cadastral numbers, hidden selections, sort order, clipboard API, legacy fallback, manual fallback, empty selection.');
})().catch(error=>{console.error(error);process.exitCode=1});
