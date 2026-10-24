import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cfg=window.SANBA_SUPABASE_CONFIG||{};
const valid=typeof cfg.url==="string"&&cfg.url.startsWith("https://")&&typeof cfg.anonKey==="string"&&cfg.anonKey.length>20;
const sb=valid?createClient(cfg.url,cfg.anonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}):null;
const $=id=>document.getElementById(id);
let session=null, profiles=[];
function msg(id,text,type="error"){const el=$(id);el.textContent=text;el.className="msg show "+type;}
function accessMsg(text,type="error"){msg("accessMessage",text,type);}
function moneyDate(value){if(!value)return "Sem vencimento";const d=new Date(value);return Number.isNaN(d.getTime())?"—":d.toLocaleDateString("pt-BR");}
async function call(body){if(!sb)throw new Error("Supabase não configurado.");const {data,error}=await sb.functions.invoke("manage-developer-console",{body});if(error||!data)throw new Error(data?.error||error?.message||"Não foi possível concluir a operação.");if(data.error)throw new Error(data.error);return data;}
async function loadOverview(){try{const {overview}=await call({action:"overview"});const items=[
["Contas cadastradas",overview.profiles,"Todas as contas"],["Acessos ativos",overview.active,"Contas ativas"],["Contas suspensas",overview.suspended,"Acesso bloqueado"],["Revendedores Comum",overview.common,"Nível Comum"],["Planos Ouro",overview.gold,"Nível Ouro"],["Planos Diamante",overview.diamond,"Nível Diamante"],["Cadastros aguardando",overview.pendingApplications,"Solicitações de revendedor"],["Compras aguardando",overview.pendingCustomerOrders,"Pedidos de plano"],["Recargas pendentes",overview.pendingRechargeOrders,"Pedidos de recarga"],["Convites disponíveis",overview.invites,"Convites emitidos"],["Pedidos comerciais",overview.salesOrders,"Pedidos de revendedores"]];
$("overviewGrid").replaceChildren(...items.map(([label,value,note])=>{const card=document.createElement("article");card.className="metric";const span=document.createElement("span");span.textContent=label;const strong=document.createElement("strong");strong.textContent=Number(value).toLocaleString("pt-BR");const small=document.createElement("small");small.textContent=note;card.append(span,strong,small);return card;}));$("overviewMessage").className="msg";}catch(e){msg("overviewMessage",e.message);}}
function filteredProfiles(){const q=$("accountSearch").value.trim().toLowerCase();return profiles.filter(p=>!q||String(p.username||"").toLowerCase().includes(q)||String(p.email||"").toLowerCase().includes(q));}
function renderProfiles(){const list=$("accountsList");list.replaceChildren();const rows=filteredProfiles();if(!rows.length){list.append(Object.assign(document.createElement("div"),{className:"muted",textContent:"Nenhuma conta encontrada."}));return;}
rows.forEach(p=>{const card=document.createElement("article");card.className="account";const info=document.createElement("div");info.className="account-info";const name=document.createElement("strong");name.textContent=(p.username||"Conta sem usuário")+" · "+({common:"Comum",gold:"Ouro",diamond:"Diamante",developer:"Desenvolvedor"}[p.membership_tier]||p.membership_tier);const email=document.createElement("small");email.textContent=p.email||"E-mail não informado";const details=document.createElement("small");details.textContent="Acesso: "+({active:"Ativo",pending:"Pendente",suspended:"Suspenso"}[p.access_status]||p.access_status)+" · Validade: "+moneyDate(p.access_until);const application=document.createElement("small");application.textContent="Cadastro revendedor: "+({not_requested:"Não solicitado",pending:"Aguardando",approved:"Aprovado",rejected:"Recusado"}[p.reseller_application_status]||p.reseller_application_status);info.append(name,email,details,application);
const tierLabel=document.createElement("label");tierLabel.className="field";tierLabel.textContent="Plano";const tier=document.createElement("select");tier.setAttribute("aria-label","Plano de "+(p.username||"conta"));[["common","Comum"],["gold","Ouro"],["diamond","Diamante"]].forEach(([v,t])=>{const o=document.createElement("option");o.value=v;o.textContent=t;tier.append(o)});tier.value=["common","gold","diamond"].includes(p.membership_tier)?p.membership_tier:"common";tierLabel.append(tier);
const statusLabel=document.createElement("label");statusLabel.className="field";statusLabel.textContent="Acesso";const status=document.createElement("select");status.setAttribute("aria-label","Acesso de "+(p.username||"conta"));[["active","Ativo"],["pending","Pendente"],["suspended","Suspenso"]].forEach(([v,t])=>{const o=document.createElement("option");o.value=v;o.textContent=t;status.append(o)});status.value=p.access_status;statusLabel.append(status);
const controls=document.createElement("div");controls.className="account-controls";const save=document.createElement("button");save.type="button";save.className="btn btn-primary";save.textContent="Salvar";const reset=document.createElement("button");reset.type="button";reset.className="btn";reset.textContent="Desfazer";reset.addEventListener("click",()=>renderProfiles());
if(p.membership_tier==="developer"){tier.disabled=true;status.disabled=true;save.disabled=true;reset.disabled=true;const protectedNote=document.createElement("small");protectedNote.textContent="Conta protegida";info.append(protectedNote);}
save.addEventListener("click",async()=>{if(p.membership_tier==="developer")return;if(!confirm("Confirmar a alteração da conta @"+(p.username||"usuário")+" para "+tier.options[tier.selectedIndex].text+" / "+status.options[status.selectedIndex].text+"? Se ativar Ouro ou Diamante, confirme que o pagamento já foi verificado."))return;save.disabled=true;try{const result=await call({action:"update_profile",user_id:p.user_id,membership_tier:tier.value,access_status:status.value});profiles=profiles.map(x=>x.user_id===p.user_id?result.profile:x);msg("accountsMessage","Conta @"+(result.profile.username||"usuário")+" atualizada. Confira a validade exibida.","success");renderProfiles();await loadOverview();}catch(e){msg("accountsMessage",e.message);save.disabled=false;}});
controls.append(save,reset);card.append(info,tierLabel,statusLabel,controls);list.append(card);});}
async function loadProfiles(){const list=$("accountsList");list.replaceChildren(Object.assign(document.createElement("div"),{className:"muted",textContent:"Carregando contas…"}));try{const data=await call({action:"list_profiles"});profiles=data.profiles||[];renderProfiles();}catch(e){list.replaceChildren();msg("accountsMessage",e.message);}}
async function loadRevenueSummary(){
 const root=$("revenueSummaryGrid");if(!root)return;
 try{
  const {data,error}=await sb.functions.invoke("manage-revenue-orders",{body:{action:"list_orders"}});
  if(error||!data||data.error)throw new Error(data?.error||error?.message||"Não foi possível carregar o relatório.");
  const orders=data.orders||[];
  const paid=orders.filter(o=>["payment_confirmed","in_progress","delivered"].includes(o.status));
  const refunded=orders.filter(o=>o.status==="refunded");
  const pending=orders.filter(o=>o.status==="pending");
  const paidTotal=paid.reduce((s,o)=>s+Number(o.amount||0),0);
  const refundTotal=refunded.reduce((s,o)=>s+Number(o.amount||0),0);
  const net=paidTotal-refundTotal;
  const items=[
   ["Receita confirmada",paidTotal,"Pagamentos verificados manualmente"],
   ["Pedidos aguardando",pending.length,"Não contabilizados como receita"],
   ["Em execução / entregues",orders.filter(o=>["in_progress","delivered"].includes(o.status)).length,"Pedidos já pagos"],
   ["Reembolsos registrados",refundTotal,"Valor marcado como reembolsado"],
   ["Receita após reembolsos",net,"Estimativa baseada nos status registrados"],
   ["Total de pedidos",orders.length,"Últimos 300 pedidos carregados"]
  ];
  root.replaceChildren(...items.map(([label,value,note])=>{const card=document.createElement("article");card.className="metric";const span=document.createElement("span");span.textContent=label;const strong=document.createElement("strong");strong.textContent=typeof value==="number"&&label!=="Pedidos aguardando"&&label!=="Em execução / entregues"&&label!=="Total de pedidos"?value.toLocaleString("pt-BR",{style:"currency",currency:"BRL"}):Number(value).toLocaleString("pt-BR");const small=document.createElement("small");small.textContent=note;card.append(span,strong,small);return card;}));
  $("revenueSummaryMessage").className="msg";
 }catch(e){msg("revenueSummaryMessage",e.message);}
}
async function refreshAll(){await Promise.all([loadOverview(),loadProfiles(),loadRevenueSummary()]);}
async function init(){if(!sb){accessMsg("A configuração do Supabase não foi encontrada.");return;}const {data,error}=await sb.auth.getSession();session=data?.session;if(error||!session){accessMsg("Entre primeiro no painel do revendedor e depois abra a Central do Desenvolvedor.");return;}const {data:profile,error:profileError}=await sb.from("reseller_profiles").select("membership_tier,access_status,access_until").eq("user_id",session.user.id).maybeSingle();if(profileError||!profile){accessMsg("Não foi possível verificar o perfil da conta.");return;}if(profile.membership_tier!=="developer"||profile.access_status!=="active"||(profile.access_until&&new Date(profile.access_until).getTime()<=Date.now())){accessMsg("Acesso restrito: somente a conta Desenvolvedor ativa pode abrir esta central.");return;}$("accessMessage").className="msg";$("console").classList.remove("hidden");await refreshAll();}
$("refreshAll").addEventListener("click",refreshAll);$("accountSearch").addEventListener("input",renderProfiles);init().catch(e=>accessMsg(e.message||"Falha ao iniciar a Central do Desenvolvedor."));
