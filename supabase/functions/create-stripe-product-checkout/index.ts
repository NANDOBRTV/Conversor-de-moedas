import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const origin="https://nandobrtv.github.io";
const headers={"Access-Control-Allow-Origin":origin,"Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json","Vary":"Origin"};
const reply=(body:Record<string,unknown>,status=200)=>new Response(JSON.stringify(body),{status,headers});
const products={
 planilha_lucro:{name:"Planilha de Controle de Lucro Sanba",amount:990,description:"Acesso digital à ferramenta de custos, preço de venda, lucro e margem no Conversor Sanba."},
 kit_divulgacao:{name:"Kit de Divulgação para Revendedores Sanba",amount:1490,description:"Kit digital PDF com mensagens, legendas, status, campanhas e calendário de divulgação."},
 calculadora_precos:{name:"Calculadora de Preços e Lucros Sanba",amount:1990,description:"Ferramenta digital online para simular preços de venda, taxas, lucro por unidade, margem e resultado total."}
} as const;
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers});
 if(req.method!=="POST")return reply({error:"Método não permitido."},405);
 if(req.headers.get("origin")!==origin)return reply({error:"Origem não autorizada."},403);
 const auth=req.headers.get("Authorization")||"",token=auth.startsWith("Bearer ")?auth.slice(7):"";
 const url=Deno.env.get("SUPABASE_URL"),service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),stripeKey=Deno.env.get("STRIPE_SECRET_KEY");
 if(!url||!service)return reply({error:"Configuração do servidor incompleta."},503);
 if(!stripeKey||!stripeKey.startsWith("sk_live_"))return reply({error:"O checkout exige STRIPE_SECRET_KEY de produção (sk_live_) configurada no Supabase."},503);
 if(!token)return reply({error:"Entre na sua conta antes de comprar."},401);
 let body:{product_code?:unknown};try{body=await req.json()}catch{return reply({error:"Pedido inválido."},400)}
 const code=body.product_code;
 if(typeof code!=="string"||!Object.prototype.hasOwnProperty.call(products,code))return reply({error:"Produto não disponível."},400);
 const product=products[code as keyof typeof products];
 try{
  const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:authData,error:authError}=await admin.auth.getUser(token),user=authData?.user;
  if(authError||!user)return reply({error:"Sessão inválida. Entre novamente."},401);
  const {data:profile,error:pe}=await admin.from("reseller_profiles").select("user_id,username,email,access_status").eq("user_id",user.id).maybeSingle();
  if(pe)throw pe;if(!profile)return reply({error:"Não encontramos seu perfil Sanba."},404);
  if(profile.access_status==="suspended")return reply({error:"Sua conta está suspensa."},403);
  const email=user.email||profile.email;if(!email)return reply({error:"Adicione um e-mail válido à sua conta antes de comprar."},400);
  const {data:ent,error:ee}=await admin.from("product_entitlements").select("active").eq("user_id",user.id).eq("product_code",code).maybeSingle();
  if(ee)throw ee;if(ent?.active)return reply({error:"Você já tem acesso a este produto.",already_owned:true,product_code:code},409);
  const cutoff=new Date(Date.now()-3600000).toISOString();
  const {data:recent,error:re}=await admin.from("revenue_orders").select("id").eq("user_id",user.id).eq("product_code",code).gte("created_at",cutoff).in("status",["pending","payment_confirmed"]);
  if(re)throw re;if((recent||[]).length>=3)return reply({error:"Você já tem várias tentativas recentes. Aguarde e tente novamente."},429);
  const {data:order,error:oe}=await admin.from("revenue_orders").insert({user_id:user.id,product_code:code,product_name:product.name,amount:product.amount/100,currency:"BRL",customer_name:String(profile.username||user.user_metadata?.username||"Cliente Sanba").slice(0,120),customer_contact:String(email).slice(0,120),customer_notes:code==="kit_divulgacao"?"Entrega digital: download protegido do PDF após pagamento confirmado.":"Entrega digital: acesso à Planilha de Lucro dentro do site.",status:"pending",payment_method:"stripe_checkout",payment_provider:"stripe"}).select("id").single();
  if(oe||!order){console.error("product order insert failed",oe?.message);return reply({error:"Não foi possível registrar o pedido."},500)}
  const site="https://nandobrtv.github.io/Conversor-de-moedas/cliente.html",p=new URLSearchParams();
  p.set("mode","payment");p.set("success_url",site+"?product_payment=success&session_id={CHECKOUT_SESSION_ID}");p.set("cancel_url",site+"?product_payment=cancelled");p.set("customer_email",email);p.set("client_reference_id",order.id);
  p.set("line_items[0][quantity]","1");p.set("line_items[0][price_data][currency]","brl");p.set("line_items[0][price_data][unit_amount]",String(product.amount));
  p.set("line_items[0][price_data][product_data][name]",product.name);p.set("line_items[0][price_data][product_data][description]",product.description);
  for(const [k,v] of Object.entries({order_type:"revenue_product",order_id:order.id,supabase_user_id:user.id,product_code:code})){p.set("metadata["+k+"]",v);p.set("payment_intent_data[metadata]["+k+"]",v)}
  const response=await fetch("https://api.stripe.com/v1/checkout/sessions",{method:"POST",headers:{Authorization:"Bearer "+stripeKey,"Content-Type":"application/x-www-form-urlencoded"},body:p});
  const stripe=await response.json().catch(()=>({}));
  if(!response.ok||!stripe.id||!stripe.url){await admin.from("revenue_orders").update({status:"cancelled",updated_at:new Date().toISOString()}).eq("id",order.id);console.error("Stripe product checkout error",response.status,JSON.stringify({type:stripe?.error?.type,code:stripe?.error?.code,param:stripe?.error?.param}).slice(0,500));return reply({error:"O Stripe não conseguiu iniciar o pagamento. Confira a configuração e tente novamente."},502)}
  const {error:ue}=await admin.from("revenue_orders").update({stripe_checkout_session_id:String(stripe.id),stripe_payment_intent_id:typeof stripe.payment_intent==="string"?stripe.payment_intent:null,updated_at:new Date().toISOString()}).eq("id",order.id).eq("status","pending");
  if(ue){await admin.from("revenue_orders").update({status:"cancelled",updated_at:new Date().toISOString()}).eq("id",order.id);return reply({error:"Não foi possível salvar a sessão de pagamento."},500)}
  return reply({checkout_url:stripe.url,order_id:order.id,product_code:code});
 }catch(e){console.error("create-stripe-product-checkout",e instanceof Error?e.message:"unknown");return reply({error:"Não foi possível iniciar a compra agora."},500)}
});