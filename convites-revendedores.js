import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const config = window.SANBA_SUPABASE_CONFIG || {};
const $ = id => document.getElementById(id);
const accessMessage = $('accessMessage');
const validConfig = typeof config.url === 'string' && config.url.startsWith('https://') && typeof config.anonKey === 'string' && config.anonKey.length > 20 && !config.url.includes('COLOQUE_') && !config.anonKey.includes('COLOQUE_');
const supabase = validConfig ? createClient(config.url, config.anonKey, {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}) : null;
let currentProfile = null;
function showAccessMessage(text,type='error'){accessMessage.textContent=text;accessMessage.className='login-message visible '+type;}
function accessIsActive(profile){return !!profile&&profile.access_status==='active'&&(!profile.access_until||new Date(profile.access_until).getTime()>Date.now());}
async function resellerInviteAdminCall(body) {
  if (!supabase) throw new Error('Supabase não configurado.');
  const { data, error } = await supabase.functions.invoke('manage-reseller-invites', { body });
  if (error || !data) throw new Error(data?.error || error?.message || 'Não foi possível concluir a ação.');
  if (data.error) throw new Error(data.error);
  return data;
}
function inviteAdminNotice(text, type='success') {
  const el = $('resellerInviteAdminMessage');
  el.textContent = text;
  el.className = 'login-message visible ' + type;
}
function adminDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('pt-BR');
}
async function loadResellerAdminData() {
  const invitesList = $('resellerInvitesList');
  if (!invitesList || !currentProfile || currentProfile.membership_tier !== 'developer') return;
  invitesList.replaceChildren(Object.assign(document.createElement('div'), {className:'history-empty', textContent:'Carregando convites…'}));
  try {
    const invitesResult = await resellerInviteAdminCall({action:'list_invites'});
    invitesList.replaceChildren();
    const invites = invitesResult.invites || [];
    if (!invites.length) invitesList.append(Object.assign(document.createElement('div'), {className:'history-empty', textContent:'Nenhum convite emitido.'}));
    invites.forEach(inv => {
      const card=document.createElement('article'); card.className='history-item';
      const info=document.createElement('div');
      const title=document.createElement('strong'); title.textContent=inv.invited_email || 'Convite sem e-mail vinculado';
      const status=document.createElement('small');
      const expired = new Date(inv.expires_at).getTime() <= Date.now();
      status.textContent='Status: '+(inv.status==='issued'&&expired?'Vencido':({issued:'Disponível',used:'Utilizado',revoked:'Revogado'}[inv.status]||inv.status));
      const expiry=document.createElement('small'); expiry.textContent='Validade: '+adminDate(inv.expires_at);
      info.append(title,status,expiry); card.append(info);
      if (inv.status === 'issued' && !expired) {
        const revoke=document.createElement('button'); revoke.type='button'; revoke.className='btn btn-light btn-small'; revoke.textContent='Revogar';
        revoke.addEventListener('click',async()=>{if(!confirm('Revogar este convite? O link deixará de funcionar.'))return;revoke.disabled=true;try{await resellerInviteAdminCall({action:'revoke_invite',invite_id:inv.id});inviteAdminNotice('Convite revogado.','success');await loadResellerAdminData()}catch(e){inviteAdminNotice(e.message,'error');revoke.disabled=false}});
        card.append(revoke);
      }
      invitesList.append(card);
    });
  } catch (error) {
    invitesList.replaceChildren(Object.assign(document.createElement('div'), {className:'history-empty', textContent:'Não foi possível carregar convites.'}));
    inviteAdminNotice(error.message || 'Falha ao carregar a área administrativa.','error');
  }
}
$('createResellerInviteForm')?.addEventListener('submit', async event => {
  event.preventDefault();
  const button=$('createResellerInvite'); button.disabled=true;
  try {
    const result=await resellerInviteAdminCall({action:'create_invite',invited_email:$('resellerInviteEmail').value.trim().toLowerCase()});
    $('resellerInviteLink').value=result.link;
    $('copyResellerInviteLink').disabled=false;
    $('resellerInviteEmail').value='';
    inviteAdminNotice('Convite gerado. Copie e envie o link; ele vale por 7 dias e só pode ser usado uma vez.','success');
    await loadResellerAdminData();
  } catch(error) { inviteAdminNotice(error.message || 'Não foi possível gerar o convite.','error'); }
  finally { button.disabled=false; }
});
$('copyResellerInviteLink')?.addEventListener('click', async () => {
  const value=$('resellerInviteLink').value;
  if(!value)return;
  try { await navigator.clipboard.writeText(value); inviteAdminNotice('Link copiado. Envie-o somente à pessoa convidada.','success'); }
  catch (_) { $('resellerInviteLink').focus(); $('resellerInviteLink').select(); inviteAdminNotice('Selecione e copie o link manualmente.','error'); }
});
$('refreshResellerAdmin')?.addEventListener('click', loadResellerAdminData);


async function initializeAdminPage(){
  if(!supabase){showAccessMessage('A configuração do Supabase não foi encontrada. Não é possível verificar o acesso.');return;}
  const {data:{session},error:sessionError}=await supabase.auth.getSession();
  if(sessionError||!session){showAccessMessage('Você precisa entrar no painel do revendedor primeiro. Faça login e depois abra o gerador pelo menu.');return;}
  const {data:profile,error}=await supabase.from('reseller_profiles').select('username,email,membership_tier,access_status,access_until').eq('user_id',session.user.id).maybeSingle();
  if(error||!profile){showAccessMessage('Não foi possível verificar o perfil da conta. Volte ao painel e tente novamente.');return;}
  currentProfile=profile;
  if(profile.membership_tier!=='developer'||!accessIsActive(profile)){showAccessMessage('Acesso restrito: esta página está disponível somente para a conta de desenvolvedor com acesso ativo.','error');return;}
  accessMessage.hidden=true;
  $('adminPanel').hidden=false;
  await loadResellerAdminData();
}
initializeAdminPage().catch(error=>showAccessMessage(error?.message||'Não foi possível iniciar o gerador de convites.'));
