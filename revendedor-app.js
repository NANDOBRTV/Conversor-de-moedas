import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const config = window.SANBA_SUPABASE_CONFIG || {};
window.SANBA_RESELLER_APP_READY = true;
const $ = id => document.getElementById(id);
const form = $('resellerLoginForm');
const usernameInput = $('username');
const passwordInput = $('password');
const loginMessage = $('loginMessage');
const accountMessage = $('accountMessage');
const loginCard = $('loginCard');
const dashboard = $('dashboard');
const calcMessage = $('calcMessage');
const loginView = $('loginView');
const registerView = $('registerView');
const showLoginTab = $('showLoginTab');
const showRegisterTab = $('showRegisterTab');
const inviteParams = new URLSearchParams(window.location.search);
let resellerInviteToken = inviteParams.get('convite') || '';
if (resellerInviteToken) {
  document.body.classList.add('invite-mode');
  try { sessionStorage.setItem('sanba_reseller_invite_token', resellerInviteToken); } catch (_) {}
  window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
} else {
  try { resellerInviteToken = sessionStorage.getItem('sanba_reseller_invite_token') || ''; } catch (_) {}
}
$('registerForm').style.display = resellerInviteToken ? '' : 'none';
$('inviteRequiredNotice').style.display = resellerInviteToken ? 'none' : 'block';
function setAuthView(view) {
  const isLogin = view === 'login';
  loginView.style.display = isLogin ? 'block' : 'none';
  registerView.style.display = isLogin ? 'none' : 'block';
  showLoginTab.classList.toggle('active', isLogin);
  showRegisterTab.classList.toggle('active', !isLogin);
  showLoginTab.setAttribute('aria-selected', String(isLogin));
  showRegisterTab.setAttribute('aria-selected', String(!isLogin));
  if (isLogin) $('username').focus({ preventScroll: true });
  else $('registerEmail').focus({ preventScroll: true });
}
showLoginTab.addEventListener('click', () => setAuthView('login'));
showRegisterTab.addEventListener('click', () => setAuthView('register'));

const HISTORY_KEY = 'sanba_reseller_calculation_history_v1';
const validConfig = typeof config.url === 'string' && config.url.startsWith('https://') &&
  typeof config.anonKey === 'string' && config.anonKey.length > 20 &&
  !config.url.includes('COLOQUE_') && !config.anonKey.includes('COLOQUE_');
const supabase = validConfig ? createClient(config.url, config.anonKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
}) : null;
let currentProfile = null;
let latestCalculation = null;
let historyItems = [];

function message(el, text, type='error') {
  el.textContent = text;
  el.className = 'login-message visible ' + type;
}
function hideMessage(el) { el.textContent = ''; el.className = 'login-message' }
function money(value, currency = 'BRL') { return Number(value).toLocaleString('pt-BR', {style:'currency',currency}); }
function dateLabel(value) {
  if (!value) return 'Sem vencimento';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'Não informado';
  return d.toLocaleDateString('pt-BR');
}
function accessIsActive(profile) {
  return profile && profile.access_status === 'active' &&
    (!profile.access_until || new Date(profile.access_until).getTime() > Date.now());
}
function readHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    historyItems = Array.isArray(parsed) ? parsed.filter(x => x && typeof x.id === 'string' && Number.isFinite(x.totalCost)) : [];
  } catch (e) { historyItems = []; }
}
function writeHistory() {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(historyItems.slice(0,50))); return true; }
  catch (e) { message(accountMessage, 'O navegador não permitiu salvar o histórico. Confira o espaço disponível ou as configurações de privacidade.'); return false; }
}
function renderHistory() {
  const list = $('historyList'); list.replaceChildren();
  $('historyEmpty').style.display = historyItems.length ? 'none' : 'block';
  historyItems.forEach(item => {
    const li=document.createElement('li'); li.className='history-item';
    const info=document.createElement('div'), currency=item.currency||'BRL';
    const title=document.createElement('strong');
    title.textContent=(item.lotCoins||0).toLocaleString('pt-BR')+' moedas no lote · '+currency;
    const detail=document.createElement('small');
    detail.textContent=new Date(item.savedAt).toLocaleString('pt-BR')+' · '+(item.packageCount||0).toLocaleString('pt-BR')+' pacotes · Custo: '+money(item.totalCost,currency);
    info.append(title,detail);
    const price=document.createElement('div'); price.className='history-price'; price.textContent=money(item.totalProfit??0,currency);
    const label=document.createElement('small'); label.textContent='Lucro estimado'; price.appendChild(label);
    const actions=document.createElement('button'); actions.className='btn btn-light btn-small'; actions.type='button'; actions.textContent='Ver';
    actions.addEventListener('click',()=>{
      $('calcCurrency').value=item.currency||'BRL'; $('calcQuantity').value=item.packageCoins||1600;
      $('calcLotCoins').value=item.lotCoins||160000; $('calcCost').value=item.purchaseCostUSD??item.purchaseCost??'';
      $('calcUsdRate').value=item.usdRate??1; $('calcSalePrice').value=item.salePrice??''; $('calcExtras').value=item.extras||0;
      calculate(false); $('calculatorTitle').scrollIntoView({behavior:'smooth',block:'start'});
    });
    const right=document.createElement('div'); right.style.display='grid'; right.style.justifyItems='end'; right.style.gap='7px';
    right.append(price,actions); li.append(info,right); list.appendChild(li);
  });
  $('statCount').textContent=String(historyItems.length);
  $('statLast').textContent=historyItems.length?money(historyItems[0].totalCost,historyItems[0].currency||'BRL'):'—';
}
function membershipTier(profile) {
  const tier = String(profile?.membership_tier || 'common').toLowerCase();
  return ['common','gold','diamond','developer'].includes(tier) ? tier : 'common';
}
function tierLabel(profile) {
  const tier = membershipTier(profile);
  if (tier === 'common' && profile?.reseller_application_status === 'approved') return 'Revendedor';
  return tier === 'developer' ? 'Desenvolvedor' : tier === 'diamond' ? 'Diamante' : tier === 'gold' ? 'Ouro' : 'Comum';
}
function applyAccessUI(profile) {
  const tier = membershipTier(profile);
  const activeReseller = profile?.reseller_application_status === 'approved';
  const active = accessIsActive(profile) && (tier !== 'common' || activeReseller);
  $('accountPurchase').style.display = tier === 'common' && profile.reseller_application_status === 'approved' ? 'grid' : 'none';
  // Recursos pagos ficam ocultos para contas pendentes, suspensas ou vencidas.
  document.querySelectorAll('.stats, .calculator, .history-card').forEach(el => {
    el.style.display = active ? '' : 'none';
  });
  $('copyResults').style.display = (tier === 'diamond' || tier === 'developer') ? '' : 'none';
  $('downloadResults').style.display = (tier === 'diamond' || tier === 'developer') ? '' : 'none';
  if (active) {
    loginCard.style.display = 'none';
    form.style.display = '';
    setAuthView('login');
  $('loginIntro').textContent = 'Acesse seu painel com nome de usuário e senha.';
  } else {
    loginCard.style.display = 'none';
    form.style.display = 'none';
    $('loginIntro').textContent = 'Sua conta existe, mas ainda não tem acesso ativo. Escolha um plano na área Minha conta, faça o Pix pelo WhatsApp e aguarde a aprovação.';
  }
  dashboard.style.display = 'block';
}
function renderAccount(profile) {
  const tier = membershipTier(profile);
  const accountActive = accessIsActive(profile);
  const premiumActive = accountActive && tier !== 'common';
  $('welcomeTitle').textContent = 'Olá, ' + profile.username + '!';
  const resellerApproved = profile.reseller_application_status === 'approved';
  const resellerPending = profile.reseller_application_status === 'pending';
  $('heroStatus').textContent = resellerApproved && accountActive
    ? '✓ Acesso de revendedor aprovado'
    : premiumActive
      ? '✓ Acesso ' + tierLabel(profile) + ' liberado'
      : resellerPending
        ? '⌛ Solicitação de revendedor aguardando aprovação'
        : tier === 'common' && accountActive
          ? '✓ Conta Comum ativa · escolha um plano para liberar ferramentas premium'
          : tier === 'common'
            ? '⚠ Conta sem acesso ativo'
            : '⚠ Conta autenticada · acesso pendente';
  $('accountUsername').textContent = profile.username || '—';
  $('accountEmail').textContent = profile.email || 'E-mail não informado';
  if (document.activeElement !== $('editUsername')) $('editUsername').value = profile.username || '';
  if (document.activeElement !== $('editEmail')) $('editEmail').value = profile.email || '';
  $('accountPlan').textContent = tierLabel(profile) + (profile.plan_name && !/^(comum|common|ouro|gold|diamante|diamond|premium|pendente|pending)$/i.test(profile.plan_name) ? ' · ' + profile.plan_name : '');
  $('accountUntil').textContent = dateLabel(profile.access_until);
  $('accountStatus').replaceChildren();
  const badge = document.createElement('span');
  badge.className = 'badge' + (accountActive ? '' : ' inactive');
  badge.textContent = accountActive ? 'ATIVO' : 'INATIVO';
  $('accountStatus').appendChild(badge);
  $('statAccess').textContent = resellerApproved && accountActive ? 'Revendedor ativo' : premiumActive ? tierLabel(profile) : tier === 'common' && accountActive ? 'Conta comum' : tier === 'common' ? 'Acesso inativo' : 'Pendente';
  $('statAccess').style.color = accountActive ? '#047857' : '#9f1239';
  if (resellerApproved && accountActive) {
    message(accountMessage, 'Sua solicitação de revendedor foi aprovada. Você já pode usar as ferramentas básicas de revenda. Ouro e Diamante continuam sujeitos às regras próprias de pagamento e aprovação.', 'success');
  } else if (resellerPending) {
    message(accountMessage, 'Seu cadastro foi recebido. O acesso de revendedor será liberado somente após a aprovação manual do desenvolvedor.', 'error');
  } else if (tier === 'common' && accountActive) {
    message(accountMessage, 'Sua conta comum está ativa, mas o acesso de revendedor exige convite individual e aprovação manual. Depois da aprovação, você poderá solicitar Ouro ou Diamante, sujeitos à conferência de pagamento.', 'success');
  } else if (tier === 'common') {
    message(accountMessage, 'Sua conta ainda não tem acesso de revendedor. Solicite um convite individual ao desenvolvedor e aguarde a aprovação manual.', 'error');
  } else if (!premiumActive) {
    message(accountMessage, 'Sua conta foi autenticada, mas o acesso do plano não está ativo ou venceu. Fale com o suporte para conferir a liberação.', 'error');
  } else hideMessage(accountMessage);
}
async function showSignedIn(session) {
  if (!session || !supabase) return false;

  // Assim que o Supabase confirma a sessão, sai da tela de login.
  // Se a consulta do perfil falhar, o usuário verá a mensagem dentro do painel,
  // em vez de ficar preso na tela de entrada sem saber o motivo.
  loginCard.style.display = 'none';
  dashboard.style.display = 'block';
  $('welcomeTitle').textContent = 'Carregando seu painel…';
  message(accountMessage, 'Login confirmado. Estamos carregando os dados da sua conta.', 'success');

  const {data:profile,error} = await supabase.from('reseller_profiles')
    .select('username, email, requested_plan, access_status, plan_name, access_until, membership_tier, reseller_application_status, reseller_requested_at, reseller_reviewed_at')
    .eq('user_id',session.user.id).maybeSingle();
  if (error || !profile) {
    const detail = error && error.code === 'PGRST116'
      ? 'O perfil da conta não foi encontrado.'
      : 'Não foi possível consultar o perfil da conta.';
    const notice = 'A senha foi validada, mas o painel não conseguiu carregar os dados da conta. ' + detail + ' Seus campos foram preservados; tente novamente e, se persistir, informe esta mensagem ao suporte.';
    message(accountMessage, notice, 'error');
    // Mantém o painel aberto para exibir o diagnóstico, em vez de retornar ao login.
    dashboard.style.display = 'block';
    loginCard.style.display = 'none';
    $('welcomeTitle').textContent = 'Painel conectado, mas perfil indisponível';
    return false;
  }
  currentProfile = profile;
  $('settingsMenuToggle').style.display = 'inline-flex';
  if ($('adminOrdersLink')) $('adminOrdersLink').style.display = profile.membership_tier === 'developer' ? 'inline-flex' : 'none';
  const inviteAdminPanel = $('resellerInviteAdminPanel');
  if (inviteAdminPanel) {
    inviteAdminPanel.hidden = profile.membership_tier !== 'developer' || !accessIsActive(profile);
    if (!inviteAdminPanel.hidden) loadResellerAdminData();
  }
  const rechargePanel = $('rechargeOrdersPanel');
  if (rechargePanel) {
    const canUseOrders = accessIsActive(profile);
    rechargePanel.hidden = !canUseOrders;
    if (canUseOrders) loadRechargeOrders();
  }
  $('editUsername').value = profile.username || '';
  $('editEmail').value = profile.email || session.user.email || '';
  $('settingsPlanName').textContent = tierLabel(profile);
  $('settingsPlanStatus').textContent = accessIsActive(profile) ? 'Ativo' : 'Inativo / pendente';
  $('settingsPlanUntil').textContent = dateLabel(profile.access_until);
  applyAccessUI(profile);
  renderAccount(profile);
  readHistory();
  renderHistory();
  hideMessage(loginMessage);
  return true;
}
const rechargeStatusLabels={pending:'Aguardando pagamento',payment_confirmed:'Pagamento confirmado',processing:'Em processamento',completed:'Concluído',payment_rejected:'Pagamento não confirmado',cancelled:'Cancelado'};
async function loadRechargeOrders(){
  const list=$('rechargeOrdersList'),note=$('rechargeOrdersMessage');
  if(!list||!currentProfile||!accessIsActive(currentProfile)||!supabase)return;
  list.innerHTML='<div class="history-empty">Carregando pedidos de recarga…</div>';hideMessage(note);
  const {data,error}=await supabase.from('recharge_orders').select('id,user_id,sanba_id,coin_quantity,amount,currency,status,created_at,admin_note').order('created_at',{ascending:false}).limit(100);
  if(error){list.textContent='Não foi possível carregar os pedidos. Verifique a conexão e atualize.';return}
  if(!data||!data.length){list.innerHTML='<div class="history-empty">Ainda não há pedidos de recarga registrados.</div>';return}
  list.replaceChildren();
  data.forEach(o=>{
    const card=document.createElement('article');card.className='recharge-order';
    const info=document.createElement('div'),title=document.createElement('strong'),id=document.createElement('small'),coins=document.createElement('small'),date=document.createElement('small'),price=document.createElement('small'),status=document.createElement('span');
    title.textContent=Number(o.amount).toLocaleString('pt-BR',{style:'currency',currency:o.currency||'BRL'})+' · '+Number(o.coin_quantity).toLocaleString('pt-BR')+' moedas';
    id.textContent='Pedido: '+o.id+' · Usuário: '+o.user_id;
    coins.textContent='ID Sanba: '+o.sanba_id;
    date.textContent=new Date(o.created_at).toLocaleString('pt-BR');
    price.textContent=o.admin_note?'Observação: '+o.admin_note:'';
    status.className='recharge-status';status.textContent=rechargeStatusLabels[o.status]||o.status;
    info.append(title,id,coins,date);if(o.admin_note)info.append(price);info.append(status);
    const actions=document.createElement('div');actions.className='recharge-order-actions';
    const expiresAt = new Date(new Date(o.created_at).getTime() + 15 * 60 * 1000);
    if(o.status === 'pending'){
      const deadline=document.createElement('small');
      deadline.className='recharge-order-deadline';
      deadline.textContent = Date.now() >= expiresAt.getTime()
        ? 'Prazo de pagamento vencido. O sistema cancelará este pedido automaticamente.'
        : 'Prazo para confirmar o pagamento: até ' + expiresAt.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}) + ' (15 minutos após o pedido).';
      info.append(deadline);
    }
    const nextActions = currentProfile.membership_tier === 'developer'
      ? (o.status === 'pending'
        ? [['payment_confirmed','Confirmar pagamento']]
        : (o.status === 'payment_confirmed' || o.status === 'processing')
          ? [['completed','Confirmar entrega']]
          : [])
      : [];
    nextActions.forEach(([next,label])=>{
      const b=document.createElement('button');b.type='button';b.className='btn btn-primary btn-small';b.textContent=label;b.addEventListener('click',()=>updateRechargeStatus(o.id,next,b));actions.appendChild(b);
    });
    card.append(info,actions);list.appendChild(card);
  });
}
async function updateRechargeStatus(id,status,button){
  if(!supabase||!currentProfile||currentProfile.membership_tier!=='developer')return;
  button.disabled=true;
  const {error}=await supabase.from('recharge_orders').update({status}).eq('id',id);
  if(error){button.disabled=false;message($('rechargeOrdersMessage'),'Não foi possível atualizar o status. Tente novamente.');return}
  await loadRechargeOrders();
}
$('refreshRechargeOrders')?.addEventListener('click',loadRechargeOrders);
const settingsMenu = $('settingsMenu');
const settingsToggle = $('settingsMenuToggle');
function setSettingsMenu(open) {
  settingsMenu.classList.toggle('open', open);
  settingsMenu.setAttribute('aria-hidden', String(!open));
  settingsToggle.setAttribute('aria-expanded', String(open));
  settingsToggle.setAttribute('aria-label', open ? 'Fechar configurações' : 'Abrir configurações');
}
settingsToggle.addEventListener('click', () => setSettingsMenu(!settingsMenu.classList.contains('open')));
$('settingsMenuClose').addEventListener('click', () => setSettingsMenu(false));
document.addEventListener('click', event => {
  if (!settingsMenu.contains(event.target) && !settingsToggle.contains(event.target)) setSettingsMenu(false);
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') setSettingsMenu(false);
});
$('profileSettingsForm').addEventListener('submit', async event => {
  event.preventDefault();
  const feedback = $('profileSettingsMessage');
  hideMessage(feedback);
  if (!supabase || !currentProfile) { message(feedback, 'Entre novamente para editar seus dados.'); return; }
  const username = $('editUsername').value.trim().toLowerCase();
  const email = $('editEmail').value.trim().toLowerCase();
  if (!/^[a-z0-9_.-]{3,30}$/.test(username)) {
    message(feedback, 'O usuário deve ter de 3 a 30 caracteres: letras sem acento, números, ponto, hífen ou sublinhado.'); return;
  }
  const button = $('saveProfileButton');
  button.disabled = true; button.textContent = 'Salvando…';
  try {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) throw new Error('Sua sessão expirou. Entre novamente.');
    const userId = authData.user.id;
    const usernameChanged = username !== String(currentProfile.username || '').toLowerCase();
    const emailChanged = email !== String(currentProfile.email || '').toLowerCase();
    if (usernameChanged) {
      const { error } = await supabase.from('reseller_profiles').update({ username }).eq('user_id', userId);
      if (error) throw error;
      const { error: metadataError } = await supabase.auth.updateUser({ data: { username } });
      if (metadataError) throw metadataError;
      currentProfile = { ...currentProfile, username };
    }
    if (emailChanged) {
      const { error } = await supabase.auth.updateUser({ email });
      if (error) throw error;
      message(feedback, usernameChanged
        ? 'Nome de usuário atualizado. Enviamos uma confirmação para o novo e-mail; ele só muda após você confirmar a mensagem.'
        : 'Enviamos uma confirmação para o novo e-mail. O endereço só muda após você confirmar a mensagem.', 'success');
    } else {
      message(feedback, usernameChanged ? 'Nome de usuário atualizado com sucesso.' : 'Nenhuma alteração foi feita.', 'success');
    }
    renderAccount(currentProfile);
    if (usernameChanged) $('editUsername').value = username;
  } catch (error) {
    const detail = String(error && error.message || '');
    message(feedback, /duplicate|unique|already exists/i.test(detail)
      ? 'Esse nome de usuário já está em uso. Escolha outro.'
      : detail || 'Não foi possível salvar as alterações. Confira os dados e tente novamente.');
  } finally {
    button.disabled = false; button.textContent = 'Salvar alterações';
  }
});

$('changePasswordForm').addEventListener('submit', async event => {
  event.preventDefault();
  const feedback = $('changePasswordMessage');
  hideMessage(feedback);
  if (!supabase || !currentProfile) { message(feedback, 'Entre novamente para alterar sua senha.'); return; }
  const password = $('settingsNewPassword').value;
  const confirmation = $('settingsConfirmPassword').value;
  if (password.length < 8) { message(feedback, 'A nova senha precisa ter pelo menos 8 caracteres.'); return; }
  if (password !== confirmation) { message(feedback, 'As duas senhas não são iguais. Confira e tente novamente.'); return; }
  const button = $('changePasswordButton');
  button.disabled = true; button.textContent = 'Atualizando…';
  try {
    const { data, error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
    if (!data || !data.user) throw new Error('Não foi possível confirmar a atualização. Entre novamente e tente de novo.');
    $('settingsNewPassword').value = '';
    $('settingsConfirmPassword').value = '';
    message(feedback, 'Senha atualizada com sucesso.', 'success');
  } catch (error) {
    message(feedback, String(error && error.message || 'Não foi possível atualizar a senha. Tente novamente.'));
  } finally {
    button.disabled = false; button.textContent = 'Atualizar senha';
  }
});
$('settingsLogoutButton').addEventListener('click', () => $('logoutButton').click());

async function requestPurchase(tier) {
  const purchaseMessage = $('purchaseMessage');
  if (!supabase || !currentProfile || !currentProfile.username || !currentProfile.email) {
    message(purchaseMessage, 'Não conseguimos identificar sua conta. Saia e entre novamente antes de comprar.');
    return;
  }
  const button = tier === 'gold' ? $('requestMonthly') : $('requestOneTime');
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = 'Preparando pedido…';
  message(purchaseMessage, 'Estamos registrando seu pedido antes de abrir o WhatsApp.', 'success');
  try {
    const { data, error } = await supabase.functions.invoke('create-customer-order', { body: { tier, customer_name: currentProfile.full_name || currentProfile.name || '' } });
    if (error) throw error;
    if (!data || data.error || !data.whatsapp_url || !/^https:\/\/wa\.me\//i.test(data.whatsapp_url) || !data.order || !data.order.id) {
      throw new Error(data && data.error ? data.error : 'O pedido não foi criado. Tente novamente ou fale com o suporte.');
    }
    message(purchaseMessage, 'Pedido ' + data.order.id + ' registrado. Abrindo o WhatsApp com os dados do Pix…', 'success');
    window.location.assign(data.whatsapp_url);
  } catch (error) {
    console.error('Checkout error', error);
    const detail = String(error && error.message || '');
    message(purchaseMessage, detail && !/fetch|network|function|non-2xx|failed/i.test(detail)
      ? detail
      : 'Não foi possível registrar o pedido agora. Nenhuma liberação foi feita. Verifique sua conexão e tente novamente.');
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}
$('requestMonthly').addEventListener('click', () => requestPurchase('gold'));
$('requestOneTime').addEventListener('click', () => requestPurchase('diamond'));
// Pagamento manual por Pix: o pedido é confirmado no painel administrativo.
$('registerForm').addEventListener('submit', async event => {
  event.preventDefault();
  const registerMessage = $('registerMessage');
  hideMessage(registerMessage);
  if (!supabase) { message(registerMessage, 'O Supabase ainda não está configurado para cadastro.'); return; }
  if (!resellerInviteToken) {
    message(registerMessage, 'O cadastro de revendedor exige um convite individual válido. Solicite o link ao desenvolvedor.');
    return;
  }
  const email = $('registerEmail').value.trim().toLowerCase();
  const username = $('registerUsername').value.trim().toLowerCase();
  const password = $('registerPassword').value;
  if (!/^[a-z0-9_.-]{3,30}$/.test(username)) {
    message(registerMessage, 'O nome de usuário deve ter de 3 a 30 caracteres: letras sem acento, números, ponto, hífen ou sublinhado.');
    return;
  }
  if (password.length < 8) {
    message(registerMessage, 'Use uma senha com pelo menos 8 caracteres.');
    return;
  }
  const submit = $('registerSubmit');
  submit.disabled = true; submit.textContent = 'Criando sua conta…';
  try {
    const inviteDigest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(resellerInviteToken));
    const inviteHash = Array.from(new Uint8Array(inviteDigest)).map(b => b.toString(16).padStart(2, '0')).join('');
    const {data,error} = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username, requested_plan: 'monthly', account_type: 'reseller', reseller_invite_hash: inviteHash } }
    });
    if (error) throw error;
    $('registerPassword').value = '';
    resellerInviteToken = '';
    try { sessionStorage.removeItem('sanba_reseller_invite_token'); } catch (_) {}
    $('registerForm').style.display = 'none';
    $('inviteRequiredNotice').style.display = 'block';
    if (data.session) {
      message(registerMessage, 'Cadastro enviado! Sua solicitação de revendedor está aguardando aprovação manual. O acesso não será liberado antes da aprovação.', 'success');
      await showSignedIn(data.session);
    } else {
      message(registerMessage, 'Solicitação recebida. Se o Supabase exigir confirmação, abra o e-mail e confirme o endereço. Depois entre com seu usuário e senha. O desenvolvedor precisa aprovar o cadastro antes de liberar o acesso de revendedor.', 'success');
    }
  } catch (error) {
    const raw = String(error && error.message || '');
    const safe = /already registered|already exists|duplicate key|unique constraint/i.test(raw)
      ? 'Este e-mail ou nome de usuário já está cadastrado. Tente entrar ou use outro nome de usuário.'
      : (raw || 'Não foi possível criar a conta agora. Tente novamente.');
    message(registerMessage, safe);
  } finally {
    submit.disabled = false; submit.textContent = 'Criar minha conta';
  }
});

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
  const appsList = $('resellerApplicationsList');
  const invitesList = $('resellerInvitesList');
  if (!appsList || !invitesList || !currentProfile || currentProfile.membership_tier !== 'developer') return;
  appsList.replaceChildren(Object.assign(document.createElement('div'), {className:'history-empty', textContent:'Carregando solicitações…'}));
  invitesList.replaceChildren(Object.assign(document.createElement('div'), {className:'history-empty', textContent:'Carregando convites…'}));
  try {
    const [appsResult, invitesResult] = await Promise.all([
      resellerInviteAdminCall({action:'list_applications'}),
      resellerInviteAdminCall({action:'list_invites'})
    ]);
    appsList.replaceChildren();
    const applications = appsResult.applications || [];
    if (!applications.length) appsList.append(Object.assign(document.createElement('div'), {className:'history-empty', textContent:'Nenhuma solicitação de revendedor ainda.'}));
    applications.forEach(app => {
      const card=document.createElement('article'); card.className='history-item';
      const info=document.createElement('div');
      const name=document.createElement('strong'); name.textContent=app.username || 'Usuário';
      const email=document.createElement('small'); email.textContent=app.email || 'E-mail não informado';
      const date=document.createElement('small'); date.textContent='Solicitado: '+adminDate(app.reseller_requested_at);
      const status=document.createElement('small'); status.textContent='Status: '+({pending:'Aguardando aprovação',approved:'Aprovado',rejected:'Recusado'}[app.reseller_application_status] || app.reseller_application_status);
      info.append(name,email,date,status); card.append(info);
      if (app.reseller_application_status === 'pending') {
        const actions=document.createElement('div'); actions.className='history-actions';
        const approve=document.createElement('button'); approve.type='button'; approve.className='btn btn-primary btn-small'; approve.textContent='Aprovar';
        approve.addEventListener('click',async()=>{if(!confirm('Aprovar '+(app.username||'este cadastro')+' como revendedor? Isso libera somente o acesso básico; Ouro e Diamante continuam protegidos.'))return;approve.disabled=true;try{await resellerInviteAdminCall({action:'approve_application',user_id:app.user_id});inviteAdminNotice('Cadastro aprovado. O acesso básico de revendedor foi liberado.','success');await loadResellerAdminData()}catch(e){inviteAdminNotice(e.message,'error');approve.disabled=false}});
        const reject=document.createElement('button'); reject.type='button'; reject.className='btn btn-light btn-small'; reject.textContent='Recusar';
        reject.addEventListener('click',async()=>{const note=prompt('Motivo da recusa (opcional):')||'';if(!confirm('Confirma recusar esta solicitação?'))return;reject.disabled=true;try{await resellerInviteAdminCall({action:'reject_application',user_id:app.user_id,note});inviteAdminNotice('Solicitação recusada; o acesso de revendedor não foi liberado.','success');await loadResellerAdminData()}catch(e){inviteAdminNotice(e.message,'error');reject.disabled=false}});
        actions.append(approve,reject); card.append(actions);
      }
      appsList.append(card);
    });
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
    appsList.replaceChildren(Object.assign(document.createElement('div'), {className:'history-empty', textContent:'Não foi possível carregar solicitações.'}));
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
$('togglePassword').addEventListener('click', () => {
  const show = passwordInput.type === 'password';
  passwordInput.type = show ? 'text' : 'password';
  $('togglePassword').textContent = show ? 'Ocultar' : 'Mostrar';
  $('togglePassword').setAttribute('aria-label', show ? 'Ocultar senha' : 'Mostrar senha');
  $('togglePassword').setAttribute('aria-pressed', String(show));
});
form.addEventListener('submit', async event => {
  event.preventDefault(); hideMessage(loginMessage);
  if (!supabase) { message(loginMessage, 'O serviço de autenticação não está configurado. Confira a configuração do Supabase.'); return; }
  const user = usernameInput.value.trim();
  const pass = passwordInput.value;
  const submit = $('loginSubmit'); submit.disabled = true; submit.textContent = 'Verificando acesso…';
  try {
    const response = await fetch(config.url.replace(/\/$/, '') + '/functions/v1/login-by-username', {
      method:'POST', headers:{'Content-Type':'application/json','apikey':config.anonKey},
      body:JSON.stringify({username:user,password:pass})
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      const loginError = new Error(result.error || 'Não foi possível entrar. Confira seu usuário e senha.');
      loginError.status = response.status;
      throw loginError;
    }
    if (!result.access_token || !result.refresh_token) throw new Error('O serviço de login respondeu sem uma sessão válida. Tente novamente.');
    const {error} = await supabase.auth.setSession({access_token:result.access_token,refresh_token:result.refresh_token});
    if (error) throw new Error('Não foi possível iniciar a sessão. Tente novamente.');
    const {data} = await supabase.auth.getSession();
    const profileLoaded = await showSignedIn(data.session);
    if (!profileLoaded) {
      throw new Error('A senha foi validada, mas o perfil não carregou. Seus dados foram preservados; tente novamente em instantes.');
    }
    passwordInput.value = '';
  } catch (err) {
    const errorText = err && err.message ? err.message : 'Falha de conexão. Tente novamente mais tarde.';
    // Se a sessão já foi iniciada, mostre o erro dentro do painel; não esconda o
    // diagnóstico atrás do formulário de login.
    if (dashboard.style.display === 'block' && loginCard.style.display === 'none') {
      message(accountMessage, errorText, 'error');
    } else {
      message(loginMessage, errorText, 'error');
    }
    // Preserva os campos quando a falha ocorre depois de autenticar ou durante uma
    // indisponibilidade. Limpa apenas a senha quando as credenciais são rejeitadas.
    if (err && (err.status === 400 || err.status === 401)) passwordInput.value = '';
  } finally { submit.disabled = false; submit.textContent = 'Entrar no painel'; }
});
$('logoutButton').addEventListener('click', async () => {
  if (supabase) await supabase.auth.signOut();
  currentProfile = null; latestCalculation = null;
  $('settingsMenuToggle').style.display = 'none'; setSettingsMenu(false);
  dashboard.style.display = 'none'; loginCard.style.display = 'block'; form.style.display = '';
  setAuthView('login');
      $('loginIntro').textContent = 'Acesse seu painel com nome de usuário e senha.';
  document.querySelectorAll('.stats, .calculator, .history-card').forEach(el => { el.style.display = ''; });
  form.reset(); hideMessage(loginMessage); hideMessage(accountMessage); hideMessage(calcMessage);
  $('calcResults').style.display = 'none'; $('heroStatus').textContent = '🔐 Entre para acessar suas ferramentas';
});
const exchangeRateCache = {};
let rateRequestId = 0;
function updateUsdRateField() {
  const currency = $('calcCurrency').value;
  const rate = $('calcUsdRate');
  const field = $('usdRateField');
  const labels = {
    BRL: 'Cotação do dólar em reais (R$)',
    USD: 'Cotação do dólar em dólares (US$)',
    VES: 'Cotação do dólar em bolívares (VES)'
  };
  field.firstChild.textContent = labels[currency] + ' ';
  rate.readOnly = currency !== 'USD';
  rate.disabled = currency === 'USD';
  field.style.opacity = '1';
  if (currency === 'USD') {
    rate.value = '1';
    $('rateStatus').textContent = 'Cotação fixa: US$ 1 = US$ 1.';
    calculate(false);
    return;
  }
  rate.value = '';
  $('rateStatus').textContent = 'Buscando cotação publicada…';
  fetchExchangeRate(currency);
}
async function fetchExchangeRate(currency) {
  const requestId = ++rateRequestId;
  if (currency === 'USD') return;
  try {
    let rate, dateText, sourceText;
    const cached = exchangeRateCache[currency];
    if (cached && Date.now() - cached.fetchedAt < 5 * 60 * 1000) {
      ({rate, dateText, sourceText} = cached);
    } else if (currency === 'BRL') {
      const response = await fetch('https://open.er-api.com/v6/latest/USD', {cache:'no-cache'});
      if (!response.ok) throw new Error('Não foi possível consultar a cotação do real.');
      const data = await response.json();
      if (data.result !== 'success' || !Number.isFinite(data.rates?.BRL) || data.rates.BRL <= 0) throw new Error('A fonte não retornou uma cotação válida para o real.');
      rate = data.rates.BRL;
      dateText = data.time_last_update_utc ? new Date(data.time_last_update_utc).toLocaleString('pt-BR', {dateStyle:'short',timeStyle:'short',timeZone:'America/Sao_Paulo'}) : 'data não informada';
      sourceText = 'Fonte: ExchangeRate-API · taxa de referência';
      exchangeRateCache[currency] = {rate,dateText,sourceText,fetchedAt:Date.now()};
    } else {
      const response = await fetch('https://bcv.today/api/v1/rate.json', {cache:'no-cache'});
      if (!response.ok) throw new Error('Não foi possível consultar a cotação do bolívar.');
      const data = await response.json();
      if (!Number.isFinite(data.USD) || data.USD <= 0) throw new Error('A fonte não retornou uma cotação válida para o bolívar.');
      rate = data.USD;
      dateText = data.effective_date || data.date || 'data não informada';
      sourceText = 'Fonte: taxa oficial publicada pelo BCV';
      exchangeRateCache[currency] = {rate,dateText,sourceText,fetchedAt:Date.now()};
    }
    if (requestId !== rateRequestId || $('calcCurrency').value !== currency) return;
    $('calcUsdRate').value = String(rate);
    $('rateStatus').textContent = 'US$ 1 = ' + Number(rate).toLocaleString('pt-BR',{maximumFractionDigits:6}) + ' ' + currency + ' · Data: ' + dateText + ' · ' + sourceText;
    calculate(false);
  } catch (error) {
    if (requestId !== rateRequestId || $('calcCurrency').value !== currency) return;
    $('calcUsdRate').value = '';
    $('rateStatus').textContent = 'Não foi possível atualizar a cotação. Tente trocar a moeda e voltar ou recarregar a página.';
    message(calcMessage, error.message || 'Falha ao consultar a cotação. O cálculo ficará indisponível até a cotação ser obtida.');
  }
}
const MAIN_CONVERTER_SALE_PRICES = {BRL:6, USD:0.99, VES:1450};
function updateSuggestedSalePrice() {
  const currency = $('calcCurrency').value;
  const packageCoins = Number($('calcQuantity').value) || 1500;
  const basePrice = MAIN_CONVERTER_SALE_PRICES[currency];
  $('calcSalePrice').value = (basePrice * packageCoins / 1500).toFixed(2);
}
$('calcCurrency').addEventListener('change', () => {
  updateSuggestedSalePrice();
  updateUsdRateField();
});
$('calcQuantity').addEventListener('change', updateSuggestedSalePrice);
updateSuggestedSalePrice();
updateUsdRateField();
// Reconsulta a cotação a cada 5 minutos; evita chamadas excessivas às fontes externas.
setInterval(() => {
  if (dashboard.style.display !== 'none' && $('calcCurrency').value !== 'USD') {
    fetchExchangeRate($('calcCurrency').value);
  }
}, 5 * 60 * 1000);
function calculate(showErrors=true) {
  hideMessage(calcMessage);
  const currency=$('calcCurrency').value;
  const packageCoins=Number($('calcQuantity').value);
  const lotCoins=Number($('calcLotCoins').value);
  const purchaseCostUSD=Number($('calcCost').value);
  const usdRate=Number($('calcUsdRate').value);
  const salePrice=Number($('calcSalePrice').value);
  const extras=Number($('calcExtras').value);
  const feePercent=Number($('calcFeePercent').value);
  if(currency !== 'USD' && (!Number.isFinite(usdRate) || usdRate <= 0)) {
    $('calcResults').style.display='none';
    if(showErrors) message(calcMessage,'A cotação automática ainda não foi carregada. Aguarde ou recarregue a página.');
    return null;
  }
  if(!Number.isInteger(packageCoins)||packageCoins<1||!Number.isInteger(lotCoins)||lotCoins<1||
    !Number.isFinite(purchaseCostUSD)||purchaseCostUSD<=0||!Number.isFinite(usdRate)||usdRate<=0||!Number.isFinite(salePrice)||salePrice<=0||
    !Number.isFinite(extras)||extras<0||!Number.isFinite(feePercent)||feePercent<0||feePercent>100){
    $('calcResults').style.display='none';
    if(showErrors) message(calcMessage,'Preencha os campos com valores válidos. O custo do lote e o preço de venda precisam ser maiores que zero.');
    return null;
  }
  const packageCount=Math.floor(lotCoins/packageCoins), leftoverCoins=lotCoins%packageCoins;
  if(packageCount<1){$('calcResults').style.display='none';if(showErrors)message(calcMessage,'O lote precisa ter moedas suficientes para formar pelo menos um pacote.');return null;}
  const purchaseCost=purchaseCostUSD*usdRate;
  const totalCost=purchaseCost+extras;
  const grossRevenue=salePrice*packageCount;
  const saleFees=grossRevenue*feePercent/100;
  const netRevenue=grossRevenue-saleFees;
  const totalProfit=netRevenue-totalCost;
  const marginPercent=netRevenue>0?totalProfit/netRevenue*100:null;
  const returnPercent=totalCost>0?totalProfit/totalCost*100:0;
  const result={currency,packageCoins,lotCoins,packageCount,leftoverCoins,purchaseCostUSD,usdRate,purchaseCost,salePrice,extras,feePercent,totalCost,grossRevenue,saleFees,netRevenue,totalProfit,marginPercent,returnPercent,savedAt:new Date().toISOString()};
  latestCalculation=result;
  const rows=[
    ['Pacotes que você consegue vender',packageCount.toLocaleString('pt-BR')+' pacotes',false],
    ['Moedas restantes',leftoverCoins.toLocaleString('pt-BR')+' moedas',false],
    ['Compra do lote em dólares',money(purchaseCostUSD,'USD'),false],
    ['Custo da compra convertido',money(purchaseCost,currency),false],
    ['Custo total com extras',money(totalCost,currency),false],
    ['Total que entra com as vendas',money(grossRevenue,currency),false],
    ['Total recebido pelas vendas',money(netRevenue,currency),false],
    ['LUCRO FINAL DO LOTE',money(totalProfit,currency),true],
    ['SUA MARGEM DE LUCRO',marginPercent===null?'Não aplicável (receita líquida zero)':marginPercent.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})+'%',true],
    ['Retorno sobre o dinheiro investido',returnPercent.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})+'%',false]
  ];
  const grid=$('resultGrid');grid.replaceChildren();
  rows.forEach(([label,value,featured])=>{const item=document.createElement('div');item.className='result-item'+(featured?' featured':'');const span=document.createElement('span');span.textContent=label;const strong=document.createElement('strong');strong.textContent=value;item.append(span,strong);grid.appendChild(item);});
  $('calcResults').style.display='block';
  return result;
}
// Se algum parâmetro mudar, invalida o resultado anterior para evitar salvar/copiar/exportar números desatualizados.
['calcCurrency','calcQuantity','calcLotCoins','calcCost','calcUsdRate','calcSalePrice','calcExtras','calcFeePercent'].forEach(id => {
  $(id).addEventListener('input', () => {
    latestCalculation = null;
    $('calcResults').style.display = 'none';
  });
});
$('profitCalculator').addEventListener('submit', event => {
  event.preventDefault();
  const result = calculate(true);
  if (result) {
    message(calcMessage, 'Cálculo concluído. Confira os valores e salve se quiser guardar no histórico.', 'success');
    calcMessage.scrollIntoView({behavior:'smooth',block:'nearest'});
  }
});
$('clearCalculator').addEventListener('click', () => {
  $('calcQuantity').value = '1500'; $('calcLotCoins').value = '160000'; $('calcCost').value = '100'; $('calcUsdRate').value = $('calcCurrency').value === 'USD' ? '1' : ''; updateSuggestedSalePrice(); $('calcExtras').value = '0'; $('calcFeePercent').value = '0';
  latestCalculation = null; $('calcResults').style.display = 'none'; hideMessage(calcMessage);
  updateUsdRateField();
  $('calcCost').focus();
});
$('saveCalculation').addEventListener('click', () => {
  // Sempre recalcula com os campos atuais para nunca salvar um resultado antigo.
  const result = calculate(true);
  if (!result) return;
  const item = {...result,id:Date.now().toString(36)+Math.random().toString(36).slice(2,7),savedAt:new Date().toISOString()};
  historyItems.unshift(item); historyItems = historyItems.slice(0,50);
  if (writeHistory()) { renderHistory(); message(calcMessage, 'Cálculo salvo neste navegador.', 'success'); }
});
$('clearHistory').addEventListener('click', () => {
  if (!historyItems.length) { message(accountMessage,'O histórico já está vazio.','success'); return; }
  if (!confirm('Tem certeza de que deseja apagar todos os cálculos salvos neste navegador?')) return;
  historyItems = []; writeHistory(); renderHistory(); message(accountMessage,'Histórico apagado deste navegador.','success');
});
function exportText() {
  if(!latestCalculation)return '';
  const r=latestCalculation,currency=r.currency||'BRL';
  return ['RESUMO DO LOTE SANBA','Moeda: '+currency,'Moedas no lote: '+r.lotCoins,'Moedas por pacote: '+r.packageCoins,'Pacotes que pode vender: '+r.packageCount,'Compra do lote em dólares: '+money(r.purchaseCostUSD??r.purchaseCost,'USD'),'Cotação do dólar: '+(r.usdRate??1),'Custo da compra convertido: '+money(r.purchaseCost??r.totalCost,currency),'Custo total com extras: '+money(r.totalCost,currency),'Preço de venda por pacote: '+money(r.salePrice,currency),'Faturamento bruto: '+money(r.grossRevenue,currency),'Taxa sobre vendas ('+r.feePercent+'%): '+money(r.saleFees,currency),'Receita líquida após taxa: '+money(r.netRevenue,currency),'LUCRO FINAL: '+money(r.totalProfit,currency),'MARGEM DE LUCRO: '+(r.marginPercent===null?'Não aplicável (receita líquida zero)':r.marginPercent.toFixed(2)+'%'),'Retorno sobre investimento: '+r.returnPercent.toFixed(2)+'%'].join('\n');
}
$('copyResults').addEventListener('click', async () => {
  const text = exportText();
  if (!text) return;
  try { await navigator.clipboard.writeText(text); message(calcMessage,'Resultado copiado. Você já pode colar onde quiser.','success'); }
  catch (e) { message(calcMessage,'Seu navegador bloqueou a cópia automática. Use “Baixar CSV” para guardar o resultado.'); }
});
$('downloadResults').addEventListener('click',()=>{
  if(!latestCalculation)return;
  const r=latestCalculation,currency=r.currency||'BRL';
  const rows=[['Campo','Valor'],['Moeda',currency],['Moedas no lote',r.lotCoins],['Moedas por pacote',r.packageCoins],['Pacotes vendáveis',r.packageCount],['Moedas restantes',r.leftoverCoins],['Compra do lote (USD)',Number(r.purchaseCostUSD??r.purchaseCost).toFixed(2)],['Cotação USD',Number(r.usdRate??1)],['Custo da compra convertido ('+currency+')',Number(r.purchaseCost??r.totalCost).toFixed(2)],['Custo total com extras ('+currency+')',r.totalCost.toFixed(2)],['Preço por pacote ('+currency+')',r.salePrice.toFixed(2)],['Faturamento bruto ('+currency+')',r.grossRevenue.toFixed(2)],['Taxa sobre vendas (%)',r.feePercent],['Valor descontado em taxas ('+currency+')',r.saleFees.toFixed(2)],['Receita líquida após taxas ('+currency+')',r.netRevenue.toFixed(2)],['Lucro final ('+currency+')',r.totalProfit.toFixed(2)],['Margem de lucro (%)',r.marginPercent===null?'Não aplicável':r.marginPercent.toFixed(2)],['Retorno sobre investimento (%)',r.returnPercent.toFixed(2)]];
  const csv='\uFEFF'+rows.map(row=>row.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(';')).join('\r\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='calculo-lote-sanba.csv';document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
});
// Reavalia o vencimento enquanto a página permanece aberta.
setInterval(() => {
  if (currentProfile) {
    applyAccessUI(currentProfile);
    renderAccount(currentProfile);
  }
}, 60000);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && currentProfile) {
    applyAccessUI(currentProfile);
    renderAccount(currentProfile);
  }
});
if (supabase) {
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') {
      currentProfile = null; $('settingsMenuToggle').style.display='none'; setSettingsMenu(false); dashboard.style.display='none'; loginCard.style.display='block'; form.style.display='';
      $('loginIntro').textContent = 'Use seu nome de usuário e senha para abrir seu painel de revendedor.';
      document.querySelectorAll('.stats, .calculator, .history-card').forEach(el => { el.style.display=''; });
    }
  });
  supabase.auth.getSession().then(({data,error}) => {
    if (!error && data.session) showSignedIn(data.session);
  }).catch(() => {});
} else {
  message(loginMessage,'A configuração do Supabase não foi encontrada. O login não pode funcionar até que a configuração seja corrigida.');
}
