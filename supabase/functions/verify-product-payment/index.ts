import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const origin="https://nandobrtv.github.io";
const cors={"Access-Control-Allow-Origin":origin,"Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json","Vary":"Origin"};
const reply=(body:Record<string,unknown>,status=200)=>new Response(JSON.stringify(body),{status,headers:cors});
const products:Record<string,{amount:number,name:string}>={
 planilha_lucro:{amount:990,name:"Planilha de Controle de Lucro Sanba"},
 kit_divulgacao:{amount:1490,name:"Kit de Divulgação para Revendedores Sanba"},
 calculadora_precos:{amount:1990,name:"Calculadora de Preços e Lucros Sanba"}
};
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return reply({error:"Método não permitido."},405);
 if(req.headers.get("origin")!==origin)return reply({error:"Origem não autorizada."},403);
 const authorization=req.headers.get("Authorization")||"",token=authorization.startsWith("Bearer ")?authorization.slice(7):"";
 if(!token)return reply({error:"Entre na sua conta para confirmar o pagamento."},401);
 let body:{session_id?:unknown};try{body=await req.json()}catch{return reply({error:"Pedido inválido."},400)}
 const sessionId=typeof body.session_id==="string"?body.session_id:"";
 if(!/^cs_(live|test)_[A-Za-z0-9]+$/.test(sessionId))return reply({error:"Sessão de pagamento inválida."},400);
 const url=Deno.env.get("SUPABASE_URL"),service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),stripeKey=Deno.env.get("STRIPE_SECRET_KEY");
 if(!url||!service||!stripeKey||!stripeKey.startsWith("sk_live_"))return reply({error:"A confirmação de pagamento não está configurada em produção."},503);
 try{
  const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:authData,error:authError}=await admin.auth.getUser(token),user=authData?.user;
  if(authError||!user)return reply({error:"Sessão inválida. Entre novamente."},401);
  const stripeResponse=await fetch("https://api.stripe.com/v1/checkout/sessions/"+encodeURIComponent(sessionId),{headers:{Authorization:"Bearer "+stripeKey}});
  const stripe=await stripeResponse.json().catch(()=>({}));
  if(!stripeResponse.ok||!stripe.id)return reply({error:"Não foi possível consultar o pagamento no Stripe. Tente novamente."},502);
  if(stripe.payment_status!=="paid"||stripe.status!=="complete")return reply({error:"O Stripe ainda não confirmou o pagamento. Aguarde a confirmação antes de tentar novamente."},409);
  const metadata=stripe.metadata||{},orderId=String(metadata.order_id||""),userId=String(metadata.supabase_user_id||""),code=String(metadata.product_code||"");
  if(metadata.order_type!=="revenue_product"||userId!==user.id||!products[code])return reply({error:"Este pagamento não corresponde à sua conta ou a um produto válido."},403);
  const product=products[code],amount=Number(stripe.amount_total),currency=String(stripe.currency||"").toUpperCase();
  if(amount!==product.amount||currency!=="BRL")return reply({error:"O valor ou a moeda do pagamento não corresponde ao produto."},409);
  const {data:order,error:orderError}=await admin.from("revenue_orders").select("id,user_id,product_code,amount,currency,status,payment_provider,stripe_checkout_session_id").eq("id",orderId).maybeSingle();
  if(orderError)throw orderError;
  if(!order)return reply({error:"Pedido de compra não encontrado."},404);
  if(order.user_id!==user.id||order.product_code!==code||order.payment_provider!=="stripe"||order.stripe_checkout_session_id!==sessionId||Math.round(Number(order.amount)*100)!==amount||String(order.currency).toUpperCase()!==currency)return reply({error:"Os dados do pedido não correspondem ao pagamento confirmado."},409);
  if(!["pending","payment_confirmed","delivered"].includes(order.status))return reply({error:"Este pedido não pode liberar o produto neste estado."},409);
  const now=new Date().toISOString();
  const {error:entitlementError}=await admin.from("product_entitlements").upsert({user_id:user.id,product_code:code,source_order_id:order.id,active:true,granted_at:now},{onConflict:"user_id,product_code"});
  if(entitlementError)throw entitlementError;
  if(order.status==="pending"){
   const {error:updateError}=await admin.from("revenue_orders").update({status:"payment_confirmed",payment_confirmed_at:now,updated_at:now}).eq("id",order.id).eq("status","pending").eq("stripe_checkout_session_id",sessionId);
   if(updateError)throw updateError;
  }
  return reply({confirmed:true,product_code:code,product_name:product.name,access_granted:true});
 }catch(error){console.error("verify-product-payment",error instanceof Error?error.message:"unknown");return reply({error:"Não foi possível concluir a liberação automática agora. Tente atualizar o acesso em instantes."},500)}
});