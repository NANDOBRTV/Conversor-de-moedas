import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const config = window.SANBA_SUPABASE_CONFIG || {};
const $ = id => document.getElementById(id);
const accessMessage = $('accessMessage');
const validConfig = typeof config.url === 'string' && config.url.startsWith('https://') && typeof config.anonKey === 'string' && config.anonKey.length > 20 && !config.url.includes('COLOQUE_') && !config.anonKey.includes('COLOQUE_');
const supabase = validConfig ? createClient(config.url, config.anonKey, {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}) : null;
let currentProfile = null;
function showAccessMessage(text,type='error'){accessMessage.textContent=text;accessMessage.className='login-message visible '+type;}
function accessIsActive(profile){return !!profile&&profile.access_status==='active'&&(!profile.access_until||new Date(profile.access_until).getTime()>Date.now());}
function orderNotice(text,type='success'){
  const el=$('ordersMessage');el.textContent=text;el.className='login-message visible '+type;
}
function brl(value){return Number(value||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});}
function safeText(value){return String(value??'');}
async function loadResellerOrders(){
  const list=$('resellerOrdersList');
  if(!supabase||!currentProfile||currentProfile.membership_tier!=='developer')return;
  list.replaceChildren(Object.assign(document.createElement('div'),{className:'history-empty',textContent:'Carregando pedidos…'}));
  const now=new Date(),start=new Date(now.getFullYear(),now.getMonth(),1).toISOString(),end=new Date(now.getFullYear(),now.getMonth()+1,1).toISOString();
  const {data,error}=await supabase.from('reseller_sales_orders').select('id,customer_name,customer_email,purchase_quantity,monthly_sales_total,status,notes,created_at').order('created_at',{ascending:false}).limit(250);
  if(error){list.replaceChildren(Object.assign(document.createElement('div'),{className:'history-empty',textContent:'Não foi possível carregar os pedidos. Confira a conexão e tente novamente.'}));orderNotice(error.message||'Falha ao carregar pedidos.','error');return;}
  const rows=data||[];
  const monthRows=rows.filter(o=>o.created_at>=start&&o.created_at<end);
  $('monthlySalesTotal').textContent=brl(monthRows.reduce((sum,o)=>sum+Number(o.monthly_sales_total||0),0));
  $('monthlyOrdersCount').textContent=String(monthRows.length);
  $('monthlySalesPeriod').textContent=now.toLocaleDateString('pt-BR',{month:'long',year:'numeric'});
  list.replaceChildren();
  if(!rows.length){list.append(Object.assign(document.createElement('div'),{className:'history-empty',textContent:'Nenhum pedido registrado ainda. Use o formulário acima para adicionar o primeiro.'}));return;}
  const labels={pending:'Pendente',contacted:'Contato realizado',completed:'Concluído',cancelled:'Cancelado'};
  rows.forEach(order=>{
    const card=document.createElement('article');card.className='history-item';
    const info=document.createElement('div');
    const title=document.createElement('strong');title.textContent=safeText(order.customer_name);
    const email=document.createElement('small');email.textContent='E-mail: '+safeText(order.customer_email);
    const qty=document.createElement('small');qty.textContent='Quantidade de compra: '+Number(order.purchase_quantity).toLocaleString('pt-BR');
    const sales=document.createElement('small');sales.textContent='Total mensal informado: '+brl(order.monthly_sales_total);
    const date=document.createElement('small');date.textContent='Registrado: '+new Date(order.created_at).toLocaleString('pt-BR');
    const status=document.createElement('span');status.className='order-status';status.textContent=labels[order.status]||order.status;
    info.append(title,email,qty,sales,date,status);
    if(order.notes){const note=document.createElement('small');note.textContent='Observações: '+safeText(order.notes);info.append(note);}
    const actions=document.createElement('div');actions.className='order-actions';
    const next=order.status==='pending'?'contacted':order.status==='contacted'?'completed':order.status==='completed'?'cancelled':'pending';
    const actionLabel={contacted:'Marcar contato realizado',completed:'Marcar concluído',cancelled:'Cancelar pedido',pending:'Reabrir pedido'}[next];
    const update=document.createElement('button');update.type='button';update.className='btn btn-light';update.textContent=actionLabel;
    update.addEventListener('click',async()=>{
      update.disabled=true;
      const {error:updateError}=await supabase.from('reseller_sales_orders').update({status:next,updated_at:new Date().toISOString()}).eq('id',order.id);
      if(updateError){orderNotice(updateError.message||'Não foi possível atualizar o pedido.','error');update.disabled=false;return;}
      orderNotice('Status do pedido atualizado.','success');await loadResellerOrders();
    });
    actions.append(update);card.append(info,actions);list.append(card);
  });
}
$('refreshOrders').addEventListener('click',loadResellerOrders);
$('resellerOrderForm').addEventListener('submit',async event=>{
  event.preventDefault();
  if(!supabase||!currentProfile){orderNotice('A sessão não está disponível. Entre novamente no painel.','error');return;}
  const button=$('saveResellerOrder');button.disabled=true;
  try{
    const payload={
      customer_name:$('orderCustomerName').value.trim(),
      customer_email:$('orderCustomerEmail').value.trim().toLowerCase(),
      purchase_quantity:Number($('orderPurchaseQuantity').value),
      monthly_sales_total:Number($('orderMonthlySales').value),
      notes:$('orderNotes').value.trim()||null,
      created_by:(await supabase.auth.getUser()).data.user.id
    };
    if(payload.customer_name.length<2||!payload.customer_email||!Number.isInteger(payload.purchase_quantity)||payload.purchase_quantity<1||!Number.isFinite(payload.monthly_sales_total)||payload.monthly_sales_total<0)throw new Error('Confira nome, e-mail, quantidade de compra e total mensal.');
    const {error}=await supabase.from('reseller_sales_orders').insert(payload);
    if(error)throw error;
    $('resellerOrderForm').reset();$('orderMonthlySales').value='0';
    orderNotice('Pedido registrado com sucesso.','success');
    await loadResellerOrders();
  }catch(error){orderNotice(error?.message||'Não foi possível salvar o pedido.','error');}
  finally{button.disabled=false;}
});


async function initializeOrdersPage(){
  if(!supabase){showAccessMessage('A configuração do Supabase não foi encontrada. Não é possível verificar o acesso.');return;}
  const {data:{session},error:sessionError}=await supabase.auth.getSession();
  if(sessionError||!session){showAccessMessage('Você precisa entrar no painel do revendedor primeiro. Faça login e depois abra os pedidos pelo menu.');return;}
  const {data:profile,error}=await supabase.from('reseller_profiles').select('username,email,membership_tier,access_status,access_until').eq('user_id',session.user.id).maybeSingle();
  if(error||!profile){showAccessMessage('Não foi possível verificar o perfil da conta. Volte ao painel e tente novamente.');return;}
  currentProfile=profile;
  if(profile.membership_tier!=='developer'||!accessIsActive(profile)){showAccessMessage('Acesso restrito: esta página está disponível somente para a conta de desenvolvedor com acesso ativo.','error');return;}
  accessMessage.hidden=true;
  $('adminPanel').hidden=false;
  await loadResellerOrders();
}
initializeOrdersPage().catch(error=>showAccessMessage(error?.message||'Não foi possível iniciar a página de pedidos.'));
