
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const config=window.SANBA_SUPABASE_CONFIG||{};
const supabase=config.url&&config.anonKey?createClient(config.url,config.anonKey):null;
const $=id=>document.getElementById(id);
let mode='login',session=null,profile=null,customerName='';
function msg(id,text,type=''){const el=$(id);el.textContent=text;el.className='message show'+(type?' '+type:'')}
function clearMsg(id){const el=$(id);el.textContent='';el.className='message'}
async function checkPasswordLeak(password){let response;try{const bytes=new TextEncoder().encode(password);const digest=await crypto.subtle.digest('SHA-1',bytes);const sha1=Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,'0')).join('');response=await fetch('https://conversor-sanba-protection.onrender.com/v1/password-check',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sha1}),cache:'no-store'})}catch(_){throw new Error('Não foi possível verificar a segurança da senha agora. Tente novamente em instantes.')}const result=await response.json().catch(()=>({}));if(!response.ok||result.ok!==true)throw new Error(response.status===429?'Muitas tentativas de verificação. Aguarde um minuto e tente novamente.':'A verificação de segurança está temporariamente indisponível. Tente novamente mais tarde.');if(result.compromised===true)throw new Error('Não foi possível utilizar essa senha. Escolha outra e tente novamente.')}
function setMode(next){mode=next;$('loginTab').classList.toggle('active',mode==='login');$('signupTab').classList.toggle('active',mode==='signup');$('loginFields').classList.toggle('hidden',mode!=='login');$('signupFields').classList.toggle('hidden',mode!=='signup');$('authTitle').textContent=mode==='login'?'Entrar na sua conta':'Criar sua conta Sanba';$('authSubmit').textContent=mode==='login'?'Entrar':'Criar conta';clearMsg('authMessage')}
$('loginTab').addEventListener('click',()=>setMode('login'));$('signupTab').addEventListener('click',()=>setMode('signup'));
function showAccount(on){$('authPanel').classList.toggle('hidden',on);$('profilePanel').classList.toggle('hidden',!on);$('purchasePanel').classList.toggle('hidden',!on);$('productPanel').classList.toggle('hidden',!on);$('ordersPanel').classList.toggle('hidden',!on)}
async function loadOrders(){if(!session||!supabase)return;const el=$('ordersList');el.innerHTML='<div class="empty">Carregando recargas…</div>';const {data,error}=await supabase.from('recharge_orders').select('id,sanba_id,coin_quantity,amount,currency,calc_mode,status,created_at,admin_note').eq('user_id',session.user.id).order('created_at',{ascending:false}).limit(50);if(error){el.innerHTML='<div class="empty">Não foi possível carregar suas recargas. Atualize a página e tente novamente.</div>';return}if(!data||!data.length){el.innerHTML='<div class="empty">Você ainda não tem recargas registradas. Acesse a calculadora para gerar seu primeiro pedido.</div>';return}el.innerHTML=data.map(o=>{const status={pending:'Aguardando pagamento',payment_confirmed:'Pagamento confirmado',processing:'Em processamento',completed:'Concluído',payment_rejected:'Pagamento não confirmado',cancelled:'Cancelado'}[o.status]||o.status;const date=new Date(o.created_at).toLocaleString('pt-BR');const price=Number(o.amount).toLocaleString('pt-BR',{style:'currency',currency:o.currency||'BRL'});return '<article class="order"><div><strong>'+esc(Number(o.coin_quantity).toLocaleString('pt-BR'))+' moedas · '+esc(o.currency)+'</strong><small>ID Sanba: '+esc(o.sanba_id)+'</small><small>Pedido: '+esc(o.id)+'</small><small>'+esc(date)+' · '+price+'</small>'+(o.admin_note?'<small>Observação: '+esc(o.admin_note)+'</small>':'')+'</div><span class="status '+esc(o.status)+'">'+esc(status)+'</span></article>'}).join('')}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
$('refreshOrders').addEventListener('click',loadOrders);
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&session){loadOrders();loadProductAccess()}});
setInterval(()=>{if(session&&!document.hidden){loadOrders();loadProductAccess()}},30000);
async function showSignedIn(s){session=s;if(!supabase)return;const {data:p,error}=await supabase.from('reseller_profiles').select('username,email,membership_tier').eq('user_id',s.user.id).maybeSingle();if(error||!p){showAccount(false);msg('authMessage','Sua sessão foi iniciada, mas o perfil não carregou. Saia e entre novamente.','error');return}profile=p;$('profileUsername').textContent=p.username||'—';$('profileEmail').textContent=p.email||s.user.email||'—';customerName=localStorage.getItem('sanba_customer_name_'+s.user.id)||'';$('customerName').value=customerName;showAccount(true);await loadOrders();await loadProductAccess()}
$('authForm').addEventListener('submit',async e=>{e.preventDefault();if(!supabase){msg('authMessage','A configuração do Supabase não foi encontrada.','error');return}const btn=$('authSubmit');btn.disabled=true;btn.textContent=mode==='login'?'Entrando…':'Criando conta…';clearMsg('authMessage');try{if(mode==='signup'){const email=$('email').value.trim().toLowerCase(),username=$('newUsername').value.trim().toLowerCase(),password=$('newPassword').value;if(!/^[a-z0-9_.-]{3,30}$/.test(username))throw new Error('O nome de usuário deve ter 3 a 30 caracteres: letras sem acento, números, ponto, hífen ou sublinhado.');if(password.length<8)throw new Error('Use uma senha com pelo menos 8 caracteres.');await checkPasswordLeak(password);const {data,error}=await supabase.auth.signUp({email,password,options:{data:{username,requested_plan:'monthly',account_type:'customer'}}});if(error)throw error;if(data.session){msg('authMessage','Conta criada com sucesso.','success');await showSignedIn(data.session)}else{msg('authMessage','Cadastro recebido. Confirme seu e-mail, se solicitado, e depois entre com seu usuário e senha.','success');setMode('login')}}else{const identifier=$('username').value.trim().toLowerCase(),password=$('password').value;const {data,error}=await supabase.functions.invoke('login-by-username',{body:{identifier,password}});if(error||!data||!data.access_token||!data.refresh_token)throw new Error(data?.error||'Usuário ou senha incorretos.');const {data:sessionData,error:sessionError}=await supabase.auth.setSession({access_token:data.access_token,refresh_token:data.refresh_token});if(sessionError||!sessionData.session)throw new Error('Não foi possível iniciar a sessão. Tente novamente.');await showSignedIn(sessionData.session)}}catch(err){msg('authMessage',err.message||'Não foi possível concluir a operação.','error')}finally{btn.disabled=false;btn.textContent=mode==='login'?'Entrar':'Criar conta'}});
$('saveName').addEventListener('click',()=>{if(!session)return;customerName=$('customerName').value.trim().slice(0,80);localStorage.setItem('sanba_customer_name_'+session.user.id,customerName);msg('profileMessage','Nome salvo neste dispositivo e será incluído nos próximos pedidos.','success')});
async function buyDigitalProduct(code,buttonId,messageId,originalText){if(!session||!supabase){msg(messageId,'Entre na sua conta antes de comprar.','error');return}const btn=$(buttonId);btn.disabled=true;btn.textContent='Preparando pagamento…';clearMsg(messageId);try{const {data,error}=await supabase.functions.invoke('create-stripe-product-checkout',{body:{product_code:code}});if(error||!data?.checkout_url){if(data?.already_owned){await loadProductAccess();throw new Error('Você já possui este produto. Use o botão de acesso liberado.')}throw new Error(data?.error||'Não foi possível iniciar o pagamento.')}window.location.assign(data.checkout_url)}catch(err){msg(messageId,err.message||'Falha ao iniciar a compra.','error')}finally{btn.disabled=false;btn.textContent=originalText}}
$('buyProfitSheet').addEventListener('click',()=>buyDigitalProduct('planilha_lucro','buyProfitSheet','productMessage','Comprar com segurança'));
$('buyKit').addEventListener('click',()=>buyDigitalProduct('kit_divulgacao','buyKit','kitMessage','Comprar com segurança'));
$('buyPriceCalc').addEventListener('click',()=>buyDigitalProduct('calculadora_precos','buyPriceCalc','priceCalcMessage','Comprar com segurança'));
$('downloadKit').addEventListener('click',()=>{if(!session||!supabase){msg('kitMessage','Entre na sua conta para abrir o kit.','error');return}const viewer=window.open('./kit-divulgacao-online.html','_blank');if(!viewer){msg('kitMessage','O navegador bloqueou a nova aba. Permita pop-ups para este site e tente novamente.','error');return}msg('kitMessage','Abrindo o kit completo no navegador…','success')});
let returnPaymentChecked=false;
async function loadProductAccess(){
 if(!session||!supabase)return;
 const params=new URLSearchParams(location.search);
 if(!returnPaymentChecked&&params.get('product_payment')==='success'&&params.get('session_id')){
  returnPaymentChecked=true;
  const {data:verified,error:verifyError}=await supabase.functions.invoke('verify-product-payment',{body:{session_id:params.get('session_id')}});
  if(verifyError||!verified?.confirmed){
   returnPaymentChecked=false;
   msg('productMessage',verified?.error||'Estamos confirmando seu pagamento com o Stripe. A página tentará novamente automaticamente.','error');
  }else{
   msg('productMessage','Pagamento confirmado! Liberando seu produto nesta conta…','success');
   history.replaceState({},document.title,location.pathname);
  }
 }else if(params.get('product_payment')==='cancelled'){
  msg('productMessage','Pagamento cancelado. Nenhuma compra foi concluída. Você pode tentar novamente quando quiser.','');
  history.replaceState({},document.title,location.pathname);
 }
 const [sheet,kit,priceCalc]=await Promise.all([
  supabase.from('product_entitlements').select('active').eq('user_id',session.user.id).eq('product_code','planilha_lucro').maybeSingle(),
  supabase.from('product_entitlements').select('active').eq('user_id',session.user.id).eq('product_code','kit_divulgacao').maybeSingle(),
  supabase.from('product_entitlements').select('active').eq('user_id',session.user.id).eq('product_code','calculadora_precos').maybeSingle()
 ]);
 if(sheet.error){msg('productMessage','Não foi possível verificar o acesso à planilha. Atualize a página em instantes.','error')}else{
  const owned=Boolean(sheet.data?.active);$('openProfitSheet').classList.toggle('hidden',!owned);$('buyProfitSheet').classList.toggle('hidden',owned);
  if(owned)msg('productMessage','Pagamento confirmado. Sua planilha está liberada nesta conta.','success')
 }
 if(kit.error){msg('kitMessage','Não foi possível verificar o acesso ao kit agora. Atualize a página em instantes.','error')}else{
  const kitOwned=Boolean(kit.data?.active);$('downloadKit').classList.toggle('hidden',!kitOwned);$('buyKit').classList.toggle('hidden',kitOwned);
  if(kitOwned)msg('kitMessage','Seu kit está liberado. Abra e leia diretamente no navegador.','success')
 }
 if(priceCalc.error){msg('priceCalcMessage','Não foi possível verificar o acesso à calculadora agora. Atualize a página em instantes.','error')}else{
  const calcOwned=Boolean(priceCalc.data?.active);$('openPriceCalc').classList.toggle('hidden',!calcOwned);$('buyPriceCalc').classList.toggle('hidden',calcOwned);
  if(calcOwned)msg('priceCalcMessage','Pagamento confirmado. Sua calculadora está liberada.','success')
 }
 if(params.get('product_payment')==='success'&&!sheet.data?.active&&!kit.data?.active&&!priceCalc.data?.active&&!params.get('session_id')){
  msg('productMessage','Retorno do pagamento recebido. Atualize o acesso para consultar a liberação.','')
 }
}
$('signOut').addEventListener('click',async()=>{if(supabase)await supabase.auth.signOut();session=null;profile=null;showAccount(false);setMode('login');msg('authMessage','Você saiu da sua conta.','success')});

if(supabase){supabase.auth.getSession().then(({data})=>{if(data.session)showSignedIn(data.session)});supabase.auth.onAuthStateChange((_event,s)=>{if(s&&!session)showSignedIn(s)})}else{msg('authMessage','Supabase indisponível. Confira o arquivo de configuração.','error')}
if(window.location.hash==='#criar-conta'){setMode('signup');$('authTitle').scrollIntoView({behavior:'smooth',block:'center'});}
