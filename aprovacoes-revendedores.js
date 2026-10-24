import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const config=window.SANBA_SUPABASE_CONFIG||{};
const $=id=>document.getElementById(id);
const accessMessage=$('accessMessage');
const query=new URLSearchParams(window.location.search);
const view=query.get('status')==='approved'?'approved':'pending';
const validConfig=typeof config.url==='string'&&config.url.startsWith('https://')&&typeof config.anonKey==='string'&&config.anonKey.length>20&&!config.url.includes('COLOQUE_')&&!config.anonKey.includes('COLOQUE_');
const supabase=validConfig?createClient(config.url,config.anonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}):null;
let currentProfile=null;
function accessIsActive(profile){return !!profile&&profile.access_status==='active'&&(!profile.access_until||new Date(profile.access_until).getTime()>Date.now());}
function showAccessMessage(text,type='error'){accessMessage.textContent=text;accessMessage.className='login-message visible '+type;}
function notice(text,type='success'){const el=$('approvalMessage');el.textContent=text;el.className='login-message visible '+type;}
function adminDate(value){if(!value)return '—';const d=new Date(value);return Number.isNaN(d.getTime())?'—':d.toLocaleString('pt-BR');}
async function adminCall(body){
 if(!supabase)throw new Error('Supabase não configurado.');
 const {data,error}=await supabase.functions.invoke('manage-reseller-invites',{body});
 if(error||!data)throw new Error(data?.error||error?.message||'Não foi possível concluir a ação.');
 if(data.error)throw new Error(data.error);
 return data;
}
function setPageView(){
 const pending=view==='pending';
 $('pageTitle').textContent=pending?'🕒 Pedidos para aprovação':'✅ Pedidos aprovados';
 $('pageDescription').textContent=pending?'Veja quem solicitou cadastro e ainda precisa da sua autorização para virar revendedor.':'Veja os cadastros que você já aprovou para se tornarem revendedores.';
 $('listTitle').textContent=pending?'Cadastros aguardando aprovação':'Revendedores aprovados';
 $('listDescription').textContent=pending?'Aprovar libera somente o acesso básico. Os planos Ouro e Diamante continuam separados.':'Estas pessoas já tiveram o cadastro aprovado para acesso básico de revendedor.';
 $('pendingTab').classList.toggle('active',pending);
 $('approvedTab').classList.toggle('active',!pending);
 $('pendingTab').setAttribute('aria-current',pending?'page':'false');
 $('approvedTab').setAttribute('aria-current',!pending?'page':'false');
}
async function loadApplications(){
 const list=$('applicationsList');
 list.replaceChildren(Object.assign(document.createElement('div'),{className:'history-empty',textContent:'Carregando cadastros…'}));
 try{
  const result=await adminCall({action:'list_applications'});
  const all=result.applications||[];
  const apps=all.filter(app=>app.reseller_application_status===view);
  list.replaceChildren();
  if(!apps.length){list.append(Object.assign(document.createElement('div'),{className:'history-empty',textContent:view==='pending'?'Não há cadastros aguardando aprovação.':'Ainda não há cadastros aprovados.'}));return;}
  apps.forEach(app=>{
   const card=document.createElement('article');card.className='history-item';
   const info=document.createElement('div');
   const name=document.createElement('strong');name.textContent=app.username||'Usuário';
   const email=document.createElement('small');email.textContent=app.email||'E-mail não informado';
   const date=document.createElement('small');date.textContent='Solicitado: '+adminDate(app.reseller_requested_at);
   const status=document.createElement('small');status.textContent='Status: '+({pending:'Aguardando aprovação',approved:'Aprovado',rejected:'Recusado'}[app.reseller_application_status]||app.reseller_application_status);
   info.append(name,email,date,status);card.append(info);
   if(view==='pending'){
    const actions=document.createElement('div');actions.className='history-actions';
    const approve=document.createElement('button');approve.type='button';approve.className='btn btn-primary btn-small';approve.textContent='Aprovar cadastro';
    approve.addEventListener('click',async()=>{if(!confirm('Aprovar '+(app.username||'este cadastro')+' como revendedor? Isso libera somente o acesso básico.'))return;approve.disabled=true;try{await adminCall({action:'approve_application',user_id:app.user_id});notice('Cadastro aprovado. O acesso básico de revendedor foi liberado.','success');await loadApplications();}catch(e){notice(e.message||'Não foi possível aprovar o cadastro.','error');approve.disabled=false;}});
    const reject=document.createElement('button');reject.type='button';reject.className='btn btn-light btn-small';reject.textContent='Recusar';
    reject.addEventListener('click',async()=>{if(!confirm('Confirma recusar esta solicitação? O acesso de revendedor não será liberado.'))return;const note=prompt('Motivo da recusa (opcional):')||'';reject.disabled=true;try{await adminCall({action:'reject_application',user_id:app.user_id,note});notice('Solicitação recusada.','success');await loadApplications();}catch(e){notice(e.message||'Não foi possível recusar o cadastro.','error');reject.disabled=false;}});
    actions.append(approve,reject);card.append(actions);
   }
   list.append(card);
  });
 }catch(e){list.replaceChildren(Object.assign(document.createElement('div'),{className:'history-empty',textContent:'Não foi possível carregar os cadastros. Atualize a página e tente novamente.'}));notice(e.message||'Falha ao carregar solicitações.','error');}
}
$('refreshApplications').addEventListener('click',loadApplications);
async function init(){
 setPageView();
 if(!supabase){showAccessMessage('A configuração do Supabase não foi encontrada.');return;}
 const {data:{session},error:sessionError}=await supabase.auth.getSession();
 if(sessionError||!session){showAccessMessage('Entre primeiro no painel do revendedor e depois abra esta área pelo menu.');return;}
 const {data:profile,error}=await supabase.from('reseller_profiles').select('username,email,membership_tier,access_status,access_until').eq('user_id',session.user.id).maybeSingle();
 if(error||!profile){showAccessMessage('Não foi possível verificar o perfil da conta. Volte ao painel e tente novamente.');return;}
 currentProfile=profile;
 if(profile.membership_tier!=='developer'||!accessIsActive(profile)){showAccessMessage('Acesso restrito: somente a conta de desenvolvedor ativa pode aprovar cadastros.');return;}
 accessMessage.hidden=true;$('approvalPanel').hidden=false;await loadApplications();
}
init().catch(e=>showAccessMessage(e?.message||'Não foi possível iniciar a área de aprovação.'));
