
// Restrição de domínio para evitar cópias acidentais hospedadas em outros domínios.
// Isso não substitui controles de segurança no servidor.
(function(){
  var host=window.location.hostname;
  if(host!=="nandobrtv.github.io" && host!=="localhost" && host!=="127.0.0.1"){
    document.body.innerHTML="<div style='text-align:center;padding:50px;font-family:sans-serif;'><h1>Acesso indisponível</h1><p>Abra o Conversor Sanba pelo site oficial.</p></div>";
    throw new Error("Unauthorized domain");
  }
})();

var WHATSAPP_BRL="5582996843269", WHATSAPP_INTERNACIONAL="584145154287", CUSTO_USD=0.99/1500, CUSTO_BRL=6/1500, CUSTO_VES=1450/1500, MINIMO_MOEDAS=1000, TAMANHO_ID=8;
var PRECOS_SESSAO={BRL:6,USD:0.99,VES:1450};
function atualizarCustoSessao(){CUSTO_BRL=PRECOS_SESSAO.BRL/1500;CUSTO_USD=PRECOS_SESSAO.USD/1500;CUSTO_VES=PRECOS_SESSAO.VES/1500;}
function custoPorMoeda(c){if(c==='BRL')return CUSTO_BRL;if(c==='VES')return CUSTO_VES;return CUSTO_USD*(TAXAS[c]||1)}
// Para adicionar moeda: atualizar MOEDAS, MOEDA_IDS, TAXAS e PRECOS_SESSAO; revisar também a regra de preço e a formatação.
var MOEDAS={BRL:{f:'🇧🇷',s:'R$',n:'Real'},USD:{f:'🇺🇸',s:'US$',n:'Dólar'},VES:{f:'🇻🇪',s:'Bs',n:'Bolívar venezuelano'}};
var MOEDA_IDS=['BRL','USD','VES'];
var TAXAS={USD:1,BRL:5.60,VES:1450/0.99};
var TZ_MAP={'America/Sao_Paulo':'BRL','America/Bahia':'BRL','America/Recife':'BRL','America/Fortaleza':'BRL','America/Manaus':'BRL','America/Belem':'BRL','America/Cuiaba':'BRL','America/Campo_Grande':'BRL','America/Porto_Velho':'BRL','America/Rio_Branco':'BRL','America/Noronha':'BRL','America/Argentina/Buenos_Aires':'ARS','America/Argentina/Cordoba':'ARS','America/Argentina/Mendoza':'ARS','America/Argentina/Salta':'ARS','America/Argentina/Tucuman':'ARS','America/Argentina/Jujuy':'ARS','America/Argentina/Ushuaia':'ARS','America/La_Paz':'BOB','America/Santiago':'CLP','Pacific/Easter':'CLP','America/Bogota':'COP','America/Caracas':'VES','America/Guayaquil':'USD','Pacific/Galapagos':'USD','America/Guyana':'GYD','America/Asuncion':'PYG','America/Lima':'PEN','America/Paramaribo':'SRD','America/Montevideo':'UYU','America/Belize':'BZD','America/Costa_Rica':'CRC','America/Guatemala':'GTQ','America/Tegucigalpa':'HNL','America/Mexico_City':'MXN','America/Cancun':'MXN','America/Monterrey':'MXN','America/Chihuahua':'MXN','America/Tijuana':'MXN','America/Managua':'NIO','America/Panama':'PAB','America/Havana':'CUP','America/Santo_Domingo':'DOP','America/Port-au-Prince':'HTG','America/Jamaica':'JMD','America/Port_of_Spain':'TTD','America/Nassau':'BSD','America/Barbados':'BBD','America/St_Kitts':'XCD','America/St_Lucia':'XCD','America/Grenada':'XCD','America/Antigua':'XCD'};
var LANG_MAP={'pt-br':'BRL','pt':'BRL','es-ar':'ARS','es-bo':'BOB','es-cl':'CLP','es-co':'COP','es-ve':'VES','es-ec':'USD','es-py':'PYG','es-pe':'PEN','es-uy':'UYU','es-mx':'MXN','es-gt':'GTQ','es-hn':'HNL','es-ni':'NIO','es-pa':'PAB','es-cr':'CRC','es-do':'DOP','es-cu':'CUP','es-bz':'BZD','en-jm':'JMD','en-tt':'TTD','en-bs':'BSD','en-bb':'BBD','en-bz':'BZD'};

function detectarMoeda(){
  try{var tz=Intl.DateTimeFormat().resolvedOptions().timeZone||'';if(TZ_MAP[tz])return TZ_MAP[tz]}catch(e){}
  try{var lang=(navigator.language||'').toLowerCase();if(LANG_MAP[lang])return LANG_MAP[lang];var base=lang.split('-')[0];if(LANG_MAP[base])return LANG_MAP[base]}catch(e){}
  return 'BRL';
}

var detectada=detectarMoeda(); if(['BRL','USD','VES'].indexOf(detectada)===-1)detectada='BRL'; var moeda=detectada, fmtN=new Intl.NumberFormat('pt-BR');
function num(v){
  v=String(v).trim().replace(/[^\d.,-]/g,'');
  if(!v||((v.match(/-/g)||[]).length>1)||v.indexOf('-')>0)return NaN;
  var negativo=v.charAt(0)==='-';
  if(negativo)v=v.slice(1);
  if(!v||!/\d/.test(v))return NaN;
  var normalizado;
  if(v.indexOf(',')>-1){
    if((v.match(/,/g)||[]).length!==1)return NaN;
    var partes=v.split(',');
    if(!/^\d+$/.test(partes[1])||partes[1].length>2)return NaN;
    if(partes[0].indexOf('.')>-1){
      if(!/^\d{1,3}(\.\d{3})+$/.test(partes[0]))return NaN;
      partes[0]=partes[0].replace(/\./g,'');
    }else if(!/^\d+$/.test(partes[0]))return NaN;
    normalizado=partes[0]+'.'+partes[1];
  }else if(v.indexOf('.')>-1){
    if(/^\d+\.\d{1,2}$/.test(v))normalizado=v;
    else if(/^\d{1,3}(\.\d{3})+$/.test(v))normalizado=v.replace(/\./g,'');
    else return NaN;
  }else{
    if(!/^\d+$/.test(v))return NaN;
    normalizado=v;
  }
  var n=Number(normalizado);
  return Number.isFinite(n)?(negativo?-n:n):NaN;
}
function fmtEx(v,c){var s=MOEDAS[c].s;if(v===0)return s+' 0,00';var t=v.toFixed(10).replace(/0+$/,'').replace(/\.$/,'');if(t.indexOf('.')<0)t+='.00';var p=t.split('.');var d=p[1]||'00';if(d.length===1)d+='0';return s+' '+p[0].replace(/\B(?=(\d{3})+(?!\d))/g,'.')+','+d}
function fmtRd(v,c){try{return new Intl.NumberFormat('pt-BR',{style:'currency',currency:c}).format(v)}catch(e){return MOEDAS[c].s+' '+v.toFixed(2).replace('.',',')}}
function casasMoeda(c){try{return new Intl.NumberFormat('pt-BR',{style:'currency',currency:c}).resolvedOptions().maximumFractionDigits}catch(e){return 2}}
function arredondarParaCima(v,c){var fator=Math.pow(10,casasMoeda(c));return Math.ceil(v*fator-1e-9)/fator}
function fmtM(v){if(Math.abs(v-Math.round(v))<.0001)return fmtN.format(Math.round(v))+' moedas';var s=v.toFixed(2).replace(/0+$/,'').replace(/\.$/,'');var p=s.split('.');return p[0].replace(/\B(?=(\d{3})+(?!\d))/g,'.')+(p[1]?','+p[1]:'')+' moedas'}
function wpp(msg,c){var numero=c==='BRL'?WHATSAPP_BRL:WHATSAPP_INTERNACIONAL;return 'https://wa.me/'+numero+'?text='+encodeURIComponent(msg)}

// Abre/tenta iniciar o app Sanba no Android; se a tentativa não for aceita,
// o Chrome pode usar o fallback da Play Store.
// IMPORTANTE: a abertura direta só funciona se o app permitir resolver este intent.
// Sem um deep link/intent de inicialização compatível configurado no app, não há
// garantia de abrir o app apenas conhecendo seu package name.
document.getElementById('linkSanba').addEventListener('click',function(e){
  e.preventDefault();
  var playStoreUrl='https://play.google.com/store/apps/details?id=com.vixual.sanba';
  var userAgent=navigator.userAgent||navigator.vendor||window.opera;

  if(/android/i.test(userAgent)){
    // Intent Android com ação de inicialização e fallback oficial da Play Store.
    // Testar em Chrome Android com o Sanba instalado e também sem ele.
    var intentUrl='intent://launch/#Intent;action=android.intent.action.MAIN;category=android.intent.category.LAUNCHER;package=com.vixual.sanba;S.browser_fallback_url='+encodeURIComponent(playStoreUrl)+';end';
    window.location.href=intentUrl;
  } else {
    // Em outros sistemas, abre a página oficial do app na Play Store.
    window.open(playStoreUrl,'_blank','noopener,noreferrer');
  }
});

var userIdEl=document.getElementById('userId');
function sanitizeId(){var v=userIdEl.value.replace(/\D/g,'').slice(0,TAMANHO_ID);if(userIdEl.value!==v)userIdEl.value=v;return v}
function getUserId(){return userIdEl.value.trim()}
function isIdValid(){var id=getUserId();return /^\d{8}$/.test(id)&&!/^0{8}$/.test(id)}
function updateIdHint(){
  var id=getUserId(),hint=document.getElementById('idHint'),idError=document.getElementById('idError');
  idError.classList.toggle('show',id.length>0&&!isIdValid());
  if(id.length===0){userIdEl.className='';hint.textContent='Digite '+TAMANHO_ID+' dígitos (ex: 76328158)';hint.className='hint'}
  else if(id.length<TAMANHO_ID){userIdEl.className='invalido';hint.textContent='Faltam '+(TAMANHO_ID-id.length)+' dígito'+(TAMANHO_ID-id.length>1?'s':'');hint.className='hint warn'}
  else if(!isIdValid()){userIdEl.className='invalido';hint.textContent='Este ID não parece válido. Confira os 8 dígitos.';hint.className='hint warn'}
  else{userIdEl.className='valido';hint.textContent='✓ Formato do ID válido';hint.className='hint ok'}
}

var sel=document.getElementById('currencySelect');
var regionSel=document.getElementById('regionSelect');
// A lista de moedas é recriada sem duplicações.
sel.innerHTML='';
MOEDA_IDS.forEach(function(k){var o=document.createElement('option');o.value=k;o.textContent=MOEDAS[k].f+' '+k+' — '+MOEDAS[k].n;if(k===moeda)o.selected=true;sel.appendChild(o)});
regionSel.value=moeda;
function atualizarIndicadorMoeda(){var d=MOEDAS[moeda];document.getElementById('autoText').innerHTML='Moeda/região selecionada: <b>'+d.f+' '+moeda+' — '+d.n+'</b>';var st=document.getElementById('detectStatus');st.classList.remove('loading');st.textContent='✓ Sugestão de moeda pronta: '+d.f+' '+moeda+'. Você pode alterar manualmente.';}
atualizarIndicadorMoeda();

function attLabels(){
  var c=MOEDAS[moeda];
  document.getElementById('tabC').textContent='🪙 Moedas → Valor';
  document.getElementById('tabR').textContent='💵 Valor → Moedas';
  document.getElementById('lblR').textContent='Quanto deseja pagar em '+c.n+' ('+c.s+')?';
  var custoLocal=custoPorMoeda(moeda);
  document.getElementById('minR').innerHTML='Mínimo: <b>'+fmtRd(MINIMO_MOEDAS*custoLocal,moeda)+'</b>';
  document.getElementById('info').innerHTML='Preço base: <b>1.500 moedas = '+fmtRd(1500*custoLocal,moeda)+'</b><br>Cada moeda = '+fmtEx(custoLocal,moeda);
}

function calcC(){
  var m=num(document.getElementById('moedas').value);
  var rc=document.getElementById('resC'),ec=document.getElementById('errC'),pc=document.getElementById('pgtoC'),wc=document.getElementById('wppC'),nc=document.getElementById('needC');
  wc.removeAttribute('data-order');
  rc.classList.remove('show');pc.classList.remove('show');ec.classList.remove('show');wc.classList.remove('show');nc.classList.remove('show');wc.removeAttribute('href');
  if(!(m>0))return;
  if(!Number.isInteger(m)){ec.classList.add('show');document.getElementById('errCMsg').textContent='Informe uma quantidade inteira de moedas, sem casas decimais.';return}
  if(m<MINIMO_MOEDAS){ec.classList.add('show');document.getElementById('errCMsg').innerHTML='Faltam <b>'+fmtN.format(MINIMO_MOEDAS-m)+'</b> moedas';return}
  
  var custoLocal=custoPorMoeda(moeda);
  var exato=m*custoLocal;
  
  var p=arredondarParaCima(exato,moeda);
  document.getElementById('valC').textContent=fmtRd(p,moeda);
  document.getElementById('detC').textContent=fmtN.format(m)+' moedas × preço de referência; valor estimado: '+fmtRd(p,moeda);
  document.getElementById('summaryC').textContent='ID: '+(isIdValid()?getUserId():'não informado/ inválido')+' | '+fmtN.format(m)+' moedas = '+fmtRd(p,moeda)+' (referência)';
  rc.classList.add('show');
  
  if(Math.abs(exato-p)>1e-9){pc.classList.add('show');document.getElementById('pgtoCVal').textContent=fmtRd(p,moeda)}
  if(!isIdValid()){nc.classList.add('show');return}
  
  var msg;
  if(moeda==='BRL'){
    msg='Olá! Vim pelo site da Calculadora de Recarga Sanba.\n\n🪙 *Quantidade:* '+fmtN.format(Math.round(m))+' moedas\n💰 *Valor a pagar:* '+fmtRd(p,moeda)+'\n🆔 *ID Sanba:* '+getUserId()+'\n\nQuero fazer essa recarga. Pode me ajudar?';
  }else{
    msg='¡Hola! Vengo del sitio web del Conversor Sanba.\n\n🪙 *Cantidad:* '+fmtN.format(Math.round(m))+' monedas\n💰 *Total a pagar:* '+fmtRd(p,moeda)+'\n🆔 *ID de Sanba:* '+getUserId()+'\n\nQuiero realizar esta recarga. ¿Me pueden ayudar?';
  }
  wc.dataset.order=JSON.stringify({sanba_id:getUserId(),coin_quantity:Math.round(m),amount:p,currency:moeda,calc_mode:'coins_to_value'});wc.href=wpp(msg,moeda);wc.classList.add('show');
}

function calcR(){
  var entradaValor=document.getElementById('reais').value;
  var v=num(entradaValor);
  var rr=document.getElementById('resR'),er=document.getElementById('errR'),wr=document.getElementById('wppR'),nr=document.getElementById('needR');
  wr.removeAttribute('data-order');
  rr.classList.remove('show');er.classList.remove('show');wr.classList.remove('show');nr.classList.remove('show');wr.removeAttribute('href');
  if(!String(entradaValor).trim())return;
  if(!Number.isFinite(v)){er.classList.add('show');document.getElementById('errRMsg').textContent='Digite um valor válido, por exemplo 10,50, sem repetir separadores.';return;}
  if(v<=0){er.classList.add('show');document.getElementById('errRMsg').textContent='Informe um valor maior que zero.';return;}
  
  var custoLocal=custoPorMoeda(moeda);
  var qtd=Math.floor(v/custoLocal+1e-9);
  var valorCobrado=arredondarParaCima(qtd*custoLocal,moeda);
  while(qtd>0&&valorCobrado>v+1e-9){qtd--;valorCobrado=arredondarParaCima(qtd*custoLocal,moeda)}
  if(qtd<MINIMO_MOEDAS){er.classList.add('show');var minV=arredondarParaCima(MINIMO_MOEDAS*custoLocal,moeda);document.getElementById('errRMsg').innerHTML='O valor mínimo para receber '+fmtN.format(MINIMO_MOEDAS)+' moedas é <b>'+fmtRd(minV,moeda)+'</b>';return}
  document.getElementById('valR').textContent=fmtM(qtd);
  document.getElementById('detR').textContent='Orçamento: '+fmtRd(v,moeda)+' · custo estimado das moedas: '+fmtRd(valorCobrado,moeda);
  document.getElementById('summaryR').textContent='ID: '+(isIdValid()?getUserId():'não informado/ inválido')+' | '+fmtM(qtd)+' = '+fmtRd(valorCobrado,moeda)+' (referência)';
  rr.classList.add('show');
  

  if(!isIdValid()){nr.classList.add('show');return}
  
  var msg;
  if(moeda==='BRL'){
    msg='Olá! Vim pelo site da Calculadora de Recarga Sanba.\n\n💰 *Valor a pagar:* '+fmtRd(valorCobrado,moeda)+'\n🪙 *Quantidade:* '+fmtN.format(qtd)+' moedas\n🆔 *ID Sanba:* '+getUserId()+'\n\nQuero fazer essa recarga. Pode me ajudar?';
  }else{
    msg='¡Hola! Vengo del sitio web del Conversor Sanba.\n\n💰 *Monto a pagar:* '+fmtRd(valorCobrado,moeda)+'\n🪙 *Cantidad:* '+fmtN.format(qtd)+' monedas\n🆔 *ID de Sanba:* '+getUserId()+'\n\nQuiero realizar esta recarga. ¿Me pueden ayudar?';
  }
  wr.dataset.order=JSON.stringify({sanba_id:getUserId(),coin_quantity:Math.round(qtd),amount:valorCobrado,currency:moeda,calc_mode:'value_to_coins'});wr.href=wpp(msg,moeda);wr.classList.add('show');
}

var rememberIdEl=document.getElementById('rememberId');var rememberStatus=document.getElementById('rememberStatus');
function carregarIdSalvo(){try{var salvo=localStorage.getItem('sanba_calculadora_id');if(salvo&&/^\d{8}$/.test(salvo)&&!/^0{8}$/.test(salvo)){userIdEl.value=salvo;rememberIdEl.checked=true;rememberStatus.textContent='ID recuperado do armazenamento local deste navegador.';}}catch(e){rememberStatus.textContent='O navegador não permitiu acessar o armazenamento local.';}}
function sincronizarIdSalvo(){try{if(rememberIdEl.checked&&isIdValid()){localStorage.setItem('sanba_calculadora_id',getUserId());rememberStatus.textContent='ID salvo somente neste navegador.';}else{localStorage.removeItem('sanba_calculadora_id');rememberStatus.textContent=rememberIdEl.checked?'Digite um ID válido para salvá-lo neste navegador.':'Seu ID não será salvo se esta opção ficar desmarcada.';}}catch(e){rememberStatus.textContent='Não foi possível salvar o ID neste navegador.';}}
rememberIdEl.addEventListener('change',sincronizarIdSalvo);
userIdEl.addEventListener('input',function(){sanitizeId();updateIdHint();sincronizarIdSalvo();calcC();calcR()});
document.getElementById('moedas').addEventListener('input',function(){var v=this.value.replace(/\D/g,'');if(this.value!==v)this.value=v;calcC();});
document.getElementById('reais').addEventListener('input',function(){var v=this.value.replace(/[^\d.,]/g,'');if(this.value!==v)this.value=v;calcR();});
document.getElementById('printC').addEventListener('click',function(){if(document.getElementById('resC').classList.contains('show'))window.print();});
document.getElementById('printR').addEventListener('click',function(){if(document.getElementById('resR').classList.contains('show'))window.print();});
carregarIdSalvo();
document.getElementById('wppC').addEventListener('click',function(e){if(!isIdValid()||!this.classList.contains('show')||!this.getAttribute('href')){e.preventDefault();this.removeAttribute('href');calcC();}});
document.getElementById('wppR').addEventListener('click',function(e){if(!isIdValid()||!this.classList.contains('show')||!this.getAttribute('href')){e.preventDefault();this.removeAttribute('href');calcR();}});
async function createRechargeThenOpenWhatsApp(anchor,e){
  e.preventDefault();
  if(anchor.dataset.submitting==='true'||!isIdValid()||!anchor.dataset.order||!anchor.getAttribute('href')){return}
  const targetUrl=anchor.getAttribute('href');
  const popup=window.open('about:blank','_blank');
  if(!popup){alert('Permita abrir uma nova aba para continuar pelo WhatsApp.');return}
  // Evita criar pedidos duplicados por toques/cliques repetidos durante a gravação.
  anchor.dataset.submitting='true';
  anchor.setAttribute('aria-disabled','true');
  anchor.style.pointerEvents='none';
  popup.opener=null;
  popup.document.title='Preparando pedido…';
  popup.document.body.innerHTML='<p style="font-family:system-ui;padding:24px">Salvando seu pedido com segurança…</p>';
  try{
    const {createClient}=await import('https://esm.sh/@supabase/supabase-js@2');
    const cfg=window.SANBA_SUPABASE_CONFIG||{};
    if(!cfg.url||!cfg.anonKey)throw new Error('Não foi possível conectar ao sistema de pedidos.');
    const sb=createClient(cfg.url,cfg.anonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
    const {data:{session},error:sessionError}=await sb.auth.getSession();
    if(sessionError)throw sessionError;
    const order=JSON.parse(anchor.dataset.order);
    if(!/^\d{8}$/.test(order.sanba_id)||/^0{8}$/.test(order.sanba_id)||!Number.isInteger(order.coin_quantity)||order.coin_quantity<1000||!Number.isFinite(Number(order.amount))||Number(order.amount)<=0||!['BRL','USD','VES'].includes(order.currency))throw new Error('Confira o ID Sanba e os dados calculados antes de continuar.');
    if(!session){
      popup.location.replace(new URL('./cliente.html',window.location.href).toString());
      anchor.dataset.submitting='false';anchor.removeAttribute('aria-disabled');anchor.style.pointerEvents='';
      alert('Entre na sua conta na Área do Cliente para registrar a recarga. Depois volte à calculadora e toque em Comprar pelo WhatsApp novamente. O WhatsApp só será aberto depois que o pedido for salvo.');
      return;
    }
    const {data,error}=await sb.from('recharge_orders').insert({...order,user_id:session.user.id,status:'pending'}).select('id').single();
    if(error)throw error;
    const finalWhatsAppUrl=new URL(targetUrl);
    const existingMessage=finalWhatsAppUrl.searchParams.get('text')||'';
    finalWhatsAppUrl.searchParams.set('text',existingMessage+'\n\n📦 Número do pedido: '+data.id);
    popup.location.replace(finalWhatsAppUrl.toString());
  }catch(err){
    popup.close();
    anchor.dataset.submitting='false';anchor.removeAttribute('aria-disabled');anchor.style.pointerEvents='';
    const detail=err&&err.message?err.message:'Erro desconhecido';
    alert('Não foi possível registrar a recarga, então o WhatsApp não foi aberto para evitar um pedido sem histórico. Entre na Área do Cliente e tente novamente. Detalhe: '+detail);
  }
}
document.getElementById('wppC').addEventListener('click',function(e){createRechargeThenOpenWhatsApp(this,e)});
document.getElementById('wppR').addEventListener('click',function(e){createRechargeThenOpenWhatsApp(this,e)});
sel.addEventListener('change',function(e){moeda=e.target.value;regionSel.value=moeda;atualizarIndicadorMoeda();attLabels();calcC();calcR()});
regionSel.addEventListener('change',function(e){moeda=e.target.value;sel.value=moeda;atualizarIndicadorMoeda();attLabels();calcC();calcR()});
document.getElementById('changeCurrency').addEventListener('click',function(){sel.focus();sel.scrollIntoView({behavior:'smooth',block:'center'})});
function copiarTexto(texto, statusEl){
  if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(texto).then(function(){statusEl.textContent='Resumo copiado! Cole no WhatsApp para enviar.'}).catch(function(){fallbackCopiar(texto,statusEl)});}
  else fallbackCopiar(texto,statusEl);
}
function fallbackCopiar(texto,statusEl){var ta=document.createElement('textarea');ta.value=texto;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();try{var ok=document.execCommand('copy');statusEl.textContent=ok?'Resumo copiado! Cole no WhatsApp para enviar.':'Não foi possível copiar automaticamente. Selecione e copie o resumo.';}catch(e){statusEl.textContent='Não foi possível copiar automaticamente.';}ta.remove();}
document.getElementById('copyC').addEventListener('click',function(){var m=num(document.getElementById('moedas').value);if(!Number.isInteger(m)||m<MINIMO_MOEDAS||!isIdValid()){document.getElementById('summaryC').textContent='Informe um ID válido de 8 dígitos e pelo menos 1.000 moedas.';return;}copiarTexto('ID Sanba: '+getUserId()+'\nQuantidade: '+fmtN.format(m)+' moedas\nValor estimado: '+document.getElementById('valC').textContent+'\nMoeda/região: '+moeda+'\nValor apenas de referência — confirme antes de pagar.',document.getElementById('summaryC'));});
document.getElementById('copyR').addEventListener('click',function(){var v=num(document.getElementById('reais').value);var custoLocal=custoPorMoeda(moeda);var qtd=Math.floor(v/custoLocal+1e-9);var cobrado=arredondarParaCima(qtd*custoLocal,moeda);while(qtd>0&&cobrado>v+1e-9){qtd--;cobrado=arredondarParaCima(qtd*custoLocal,moeda);}if(!Number.isFinite(v)||qtd<MINIMO_MOEDAS||!isIdValid()){document.getElementById('summaryR').textContent='Informe um ID válido de 8 dígitos e valor suficiente para pelo menos 1.000 moedas.';return;}copiarTexto('ID Sanba: '+getUserId()+'\nQuantidade: '+fmtN.format(qtd)+' moedas\nValor estimado: '+fmtRd(cobrado,moeda)+'\nMoeda/região: '+moeda+'\nValor apenas de referência — confirme antes de pagar.',document.getElementById('summaryR'));});
document.getElementById('clearAll').addEventListener('click',function(){
  document.getElementById('userId').value='';
  if(!rememberIdEl.checked){try{localStorage.removeItem('sanba_calculadora_id');}catch(e){}}
  else{sincronizarIdSalvo();}
  document.getElementById('moedas').value='';
  document.getElementById('reais').value='';
  ['summaryC','summaryR'].forEach(function(id){document.getElementById(id).textContent='';});
  ['rateStatus'].forEach(function(id){document.getElementById(id).textContent='';});
  updateIdHint();calcC();calcR();
  document.getElementById('activeModeLabel').textContent='Modo ativo: '+(document.getElementById('tabC').getAttribute('aria-selected')==='true'?'Moedas → Valor':'Valor → Moedas');
  document.getElementById('userId').focus();
});
document.getElementById('moedas').addEventListener('input',calcC);
document.getElementById('reais').addEventListener('input',calcR);
document.querySelectorAll('.tab').forEach(function(t){t.addEventListener('click',function(){document.querySelectorAll('.tab').forEach(function(x){x.classList.remove('active');x.setAttribute('aria-selected','false')});t.classList.add('active');t.setAttribute('aria-selected','true');var m=t.dataset.m;document.getElementById('modeC').classList.toggle('active',m==='c');document.getElementById('modeR').classList.toggle('active',m==='r');document.getElementById('activeModeLabel').textContent='Modo ativo: '+(m==='c'?'Moedas → Valor':'Valor → Moedas')})});

attLabels();updateIdHint();

// Central pública de relatórios: sem dados de clientes ou segredos.
(function(){
  var overlay=document.getElementById('projectReports');
  var menuBtn=document.getElementById('openSiteMenu');
  var miniMenu=document.getElementById('siteMiniMenu');
  var openBtn=document.getElementById('openProjectReports');
  var closeBtn=document.getElementById('closeProjectReports');
  var historyList=document.getElementById('projectHistoryList');
  var historyStatus=document.getElementById('projectHistoryStatus');
  var historyLoaded=false;
  function closeMenu(){miniMenu.hidden=true;menuBtn.setAttribute('aria-expanded','false');}
  function toggleMenu(){var show=miniMenu.hidden;miniMenu.hidden=!show;menuBtn.setAttribute('aria-expanded',show?'true':'false');}
  function closePanel(){overlay.classList.remove('open');overlay.setAttribute('aria-hidden','true');openBtn.focus();}
  function openPanel(){closeMenu();overlay.classList.add('open');overlay.setAttribute('aria-hidden','false');closeBtn.focus();if(!historyLoaded)loadHistory();}
  menuBtn.addEventListener('click',toggleMenu);
  document.addEventListener('click',function(e){if(!e.target.closest('.site-menu-wrap'))closeMenu();});
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!miniMenu.hidden){closeMenu();menuBtn.focus();}});
  openBtn.addEventListener('click',openPanel);
  closeBtn.addEventListener('click',closePanel);
  overlay.addEventListener('click',function(e){if(e.target===overlay)closePanel();});
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&overlay.classList.contains('open'))closePanel();});
  document.querySelectorAll('[data-project-tab]').forEach(function(tab){
    tab.addEventListener('click',function(){
      document.querySelectorAll('[data-project-tab]').forEach(function(t){var active=t===tab;t.classList.toggle('active',active);t.setAttribute('aria-selected',active?'true':'false');});
      document.querySelectorAll('[data-project-section]').forEach(function(section){section.hidden=section.getAttribute('data-project-section')!==tab.getAttribute('data-project-tab');});
      if(tab.getAttribute('data-project-tab')==='history'&&!historyLoaded)loadHistory();
    });
  });
  function loadHistory(){
    historyStatus.textContent='Carregando alterações do GitHub…';
    historyList.replaceChildren();
    fetch('https://api.github.com/repos/NANDOBRTV/Conversor-de-moedas/commits?per_page=10',{
      headers:{'Accept':'application/vnd.github+json'}
    }).then(function(response){if(!response.ok)throw new Error('GitHub indisponível');return response.json();})
    .then(function(commits){
      if(!Array.isArray(commits)||!commits.length)throw new Error('Histórico vazio');
      commits.forEach(function(commit){
        var li=document.createElement('li');
        var title=document.createElement('strong');
        var date=document.createElement('small');
        var link=document.createElement('a');
        var message=commit&&commit.commit&&commit.commit.message?commit.commit.message.split('\n')[0]:'Alteração sem título';
        var rawDate=commit&&commit.commit&&commit.commit.author?commit.commit.author.date:'';
        title.textContent=message;
        date.textContent=rawDate?'Data: '+new Date(rawDate).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:'UTC'})+' UTC':'Data indisponível';
        link.href=commit.html_url||'https://github.com/NANDOBRTV/Conversor-de-moedas/commits/main';
        link.target='_blank';link.rel='noopener noreferrer';link.textContent='Ver commit no GitHub';
        li.appendChild(title);li.appendChild(date);li.appendChild(link);historyList.appendChild(li);
      });
      historyStatus.textContent='Exibindo '+commits.length+' alterações recentes do repositório.';
      historyLoaded=true;
    }).catch(function(){
      historyStatus.textContent='Não foi possível carregar o histórico agora. Confira a conexão e tente novamente.';
      historyLoaded=false;
    });
  }
  document.getElementById('refreshProjectHistory').addEventListener('click',loadHistory);
})();

// Os valores comerciais são definidos pelas configurações do conversor.\n// A confirmação final do preço e o pagamento acontecem manualmente pelo WhatsApp.


;
