/* Sanba — texto estritamente preto/branco conforme o fundo real. */
(() => {
  "use strict";
  const skip = new Set(["SCRIPT","STYLE","META","LINK","TITLE","HEAD"]);
  function parseColor(value) {
    if (!value) return null;
    const m=value.match(/rgba?\(([^)]+)\)/i);
    if(m){
      const parts=m[1].replace(/\s*\/\s*/g,",").split(/[\s,]+/).filter(Boolean);
      const n=parts.slice(0,4).map(Number);
      if(n.length>=3 && n.slice(0,3).every(Number.isFinite))
        return {r:n[0],g:n[1],b:n[2],a:Number.isFinite(n[3])?n[3]:1};
    }
    const h=value.match(/#([0-9a-f]{3,8})\b/i);
    if(h){
      let x=h[1];
      if(x.length===3||x.length===4)x=[...x].map(c=>c+c).join("");
      if(x.length>=6)return {r:parseInt(x.slice(0,2),16),g:parseInt(x.slice(2,4),16),b:parseInt(x.slice(4,6),16),a:x.length===8?parseInt(x.slice(6,8),16)/255:1};
    }
    return null;
  }
  const blend=(top,bottom)=>{
    if(!top)return bottom||{r:255,g:255,b:255,a:1};
    if(!bottom||top.a>=.999)return {...top,a:1};
    const a=Math.max(0,Math.min(1,top.a));
    return {r:top.r*a+bottom.r*(1-a),g:top.g*a+bottom.g*(1-a),b:top.b*a+bottom.b*(1-a),a:1};
  };
  const lum=c=>{
    const f=v=>{v/=255;return v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4);};
    return .2126*f(c.r)+.7152*f(c.g)+.0722*f(c.b);
  };
  function applyContrast(){
    if(!document.body)return;
    const cache=new WeakMap();
    function background(el){
      if(!el||el===document.documentElement)return {r:255,g:255,b:255,a:1};
      if(cache.has(el))return cache.get(el);
      const parent=background(el.parentElement),cs=getComputedStyle(el),image=cs.backgroundImage||"";
      let result=parent;
      if(image&&image!=="none"){
        const colors=[...image.matchAll(/rgba?\([^)]+\)|#[0-9a-f]{3,8}\b/gi)].map(m=>parseColor(m[0])).filter(Boolean);
        if(colors.length){
          const samples=colors.map(c=>blend(c,parent));
          result=samples.reduce((a,c)=>({r:a.r+c.r,g:a.g+c.g,b:a.b+c.b}),{r:0,g:0,b:0});
          result={r:result.r/samples.length,g:result.g/samples.length,b:result.b/samples.length,a:1};
        }
      }else{
        const solid=parseColor(cs.backgroundColor);
        if(solid&&solid.a>0)result=blend(solid,parent);
      }
      cache.set(el,result);return result;
    }
    for(const el of [document.body,...document.body.querySelectorAll("*")]){
      if(skip.has(el.tagName))continue;
      const color=lum(background(el))>.179?"#000000":"#ffffff";
      if(el.style.getPropertyValue("color")!==color||el.style.getPropertyPriority("color")!=="important")
        el.style.setProperty("color",color,"important");
    }
  }
  let scheduled=false;
  function schedule(){
    if(scheduled)return;scheduled=true;
    requestAnimationFrame(()=>{scheduled=false;applyContrast();});
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",applyContrast,{once:true});
  else applyContrast();
  const observer=new MutationObserver(schedule);
  observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:["class","hidden","data-theme","data-surface","aria-expanded","aria-selected","disabled"]});
  document.addEventListener("mouseover",schedule,true);
  document.addEventListener("focusin",schedule,true);
  window.addEventListener("resize",schedule,{passive:true});
})();