import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const origin="https://nandobrtv.github.io";
const cors={"Access-Control-Allow-Origin":origin,"Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Vary":"Origin"};
const json=(body:Record<string,unknown>,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
function ascii(s:string){return s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[–—]/g,"-").replace(/[“”]/g,'"').replace(/[’‘]/g,"'").replace(/[^\x20-\x7E]/g,"");}
function esc(s:string){return ascii(s).replace(/\\/g,"\\\\").replace(/\(/g,"\\(").replace(/\)/g,"\\)");}
function makePdf():Uint8Array{
 const sections:[string,string[]][]=[
 ["KIT DE DIVULGACAO SANBA",["PARA REVENDEDORES","Textos prontos, legendas, Status, campanhas e calendario de 7 dias","","COMO USAR","Personalize os campos entre colchetes com seus dados reais. Confirme preco, disponibilidade e prazo antes de publicar. Nao prometa vendas, renda ou entrega imediata. Respeite as regras de cada plataforma e a decisao de quem nao tiver interesse."]],
 ["10 MENSAGENS PARA WHATSAPP",[
 "1. Oi! Sou [seu nome] e estou atendendo consultas de recarga Sanba. Se quiser consultar as opcoes disponiveis, pode me chamar por aqui!",
 "2. Ola! Se voce precisa de recarga Sanba, envie uma mensagem para consultar valores e disponibilidade antes de confirmar o pedido.",
 "3. Estou recebendo consultas de recarga Sanba. Se tiver interesse, fale comigo e eu explico como funciona.",
 "4. Oi, pessoal! Para consultar recargas Sanba, e so me chamar no privado. Confirmo os detalhes antes de qualquer pagamento.",
 "5. Precisa tirar uma duvida sobre recarga Sanba? Pode falar comigo. Vou orientar sobre as opcoes disponiveis.",
 "6. Atendimento de recargas Sanba: consulte valores, condicoes e disponibilidade pelo WhatsApp. Me chama para conversar!",
 "7. Estou organizando os pedidos de recarga Sanba de hoje. Mande mensagem para verificar as condicoes atuais.",
 "8. Procurando informacoes sobre recarga Sanba? Posso ajudar a consultar as opcoes. Chama aqui!",
 "9. Bom dia! Estou a disposicao para tirar duvidas e consultar recargas Sanba. Fale comigo para verificar as condicoes atuais.",
 "10. Obrigado pelo interesse! Para confirmar um pedido, vamos conferir juntos o valor, a disponibilidade e os dados necessarios."
 ]],
 ["10 LEGENDAS PARA PUBLICACOES",[
 "1. Quer consultar uma recarga Sanba? Me chama no WhatsApp para conferir as opcoes e condicoes atuais. O valor e confirmado no atendimento.",
 "2. Atendimento de recargas Sanba. Envie mensagem para consultar disponibilidade, valor e orientacoes antes de concluir o pedido.",
 "3. Precisou de informacao sobre recarga Sanba? Estou aqui para ajudar. Consulte os detalhes pelo WhatsApp.",
 "4. Um atendimento claro comeca com as informacoes certas. Fale comigo e confirme os detalhes antes de pagar.",
 "5. Recargas Sanba: consulte opcoes pelo WhatsApp. Atendimento sujeito a disponibilidade e confirmacao das condicoes.",
 "6. Organizando pedidos com cuidado. Para consultar uma recarga Sanba, mande mensagem e verifique as condicoes atuais.",
 "7. Duvidas antes de pedir? Vamos conferir valor, disponibilidade e prazo antes de confirmar sua recarga.",
 "8. Envie uma mensagem, consulte as opcoes e confirme os detalhes do pedido.",
 "9. Atendimento pelo WhatsApp para consultas de recarga Sanba. Valores e disponibilidade precisam ser confirmados.",
 "10. Obrigado por acompanhar meu trabalho! Para saber mais sobre recargas Sanba, fale comigo no WhatsApp."
 ]],
 ["8 MENSAGENS PARA STATUS",[
 "1. Consultas de recarga Sanba. Chama no WhatsApp!",
 "2. Quer saber as opcoes disponiveis? Me manda mensagem.",
 "3. Antes de pagar, confirme valor e disponibilidade comigo.",
 "4. Atendimento Sanba: tire suas duvidas pelo WhatsApp.",
 "5. Estou recebendo consultas de recarga hoje. Fale comigo!",
 "6. Recarga Sanba? Vamos conferir as condicoes atuais.",
 "7. Atendimento com informacao clara e confirmacao dos detalhes.",
 "8. Tem alguma duvida? Pode chamar no privado."
 ]],
 ["5 MODELOS DE CAMPANHA",[
 "APRESENTACAO: Ola! Sou [nome] e estou atendendo consultas de recarga Sanba. Fale comigo pelo [contato]. Valores e disponibilidade sao confirmados no atendimento.",
 "DUVIDAS: Ficou com duvida sobre recarga Sanba? Me chame para consultar valor, disponibilidade e como funciona o pedido.",
 "DISPONIBILIDADE: Estou consultando pedidos de recarga Sanba hoje. Mande mensagem para verificar se a opcao esta disponivel.",
 "AGRADECIMENTO: Obrigado por confiar no meu atendimento! Se precisar consultar outra recarga, fale comigo.",
 "RETORNO RESPEITOSO: Oi, [nome]! Ainda precisa de informacoes sobre a recarga? Se nao precisar mais, sem problema."
 ]],
 ["CALENDARIO DE DIVULGACAO - 7 DIAS",[
 "DIA 1 - APRESENTACAO: Publique uma mensagem curta explicando que voce atende consultas de recarga.",
 "DIA 2 - PERGUNTAS: Convide as pessoas a enviar duvidas sobre o processo.",
 "DIA 3 - EXPLICACAO: Explique como consultar valor e disponibilidade, sem divulgar precos desatualizados.",
 "DIA 4 - LEMBRETE: Publique uma chamada simples para conversar pelo WhatsApp.",
 "DIA 5 - TRANSPARENCIA: Reforce que valor, disponibilidade e prazo sao confirmados no atendimento.",
 "DIA 6 - RELACIONAMENTO: Agradeca a quem conversou com voce, sem expor dados de clientes.",
 "DIA 7 - REVISAO: Veja quais mensagens foram mais claras e planeje variacoes para a proxima semana."
 ]],
 ["CHECKLIST ANTES DE PUBLICAR",[
 "[ ] Revisei ortografia e clareza.",
 "[ ] Substitui os campos entre colchetes pelos meus dados reais.",
 "[ ] Confirmei o preco ou informei que sera confirmado no atendimento.",
 "[ ] Nao prometi lucro, renda, entrega imediata ou disponibilidade garantida.",
 "[ ] Verifiquei se o contato esta correto.",
 "[ ] Evitei divulgar dados pessoais ou informacoes de clientes.",
 "[ ] Conferi as regras do grupo ou plataforma.",
 "[ ] Vou respeitar a decisao de quem nao demonstrar interesse.",
 "[ ] Vou confirmar os detalhes antes de orientar qualquer pagamento.",
 "RESPOSTA PARA CONFIRMAR PEDIDO: Vamos conferir a opcao solicitada, valor final, disponibilidade e prazo estimado. Depois que voce confirmar, explico os proximos passos.",
 "USO RESPONSAVEL: Material independente de apoio a comunicacao. Nao garante vendas, renda ou disponibilidade de recargas."
 ]]
 ];
 const pages:string[][]=[];let lines:string[]=[];
 const addLine=(s:string)=>{const words=ascii(s).split(/\s+/);let line="";for(const word of words){if((line+" "+word).trim().length>88){lines.push(line);line=word;}else line=(line+" "+word).trim();}if(line)lines.push(line);};
 for(const section of sections){if(lines.length>30){pages.push(lines);lines=[];}lines.push("");lines.push(section[0]);lines.push("=".repeat(Math.min(55,section[0].length)));for(const item of section[1]){addLine(item);lines.push("");if(lines.length>=43){pages.push(lines);lines=[];}}}
 if(lines.length)pages.push(lines);
 const objects:string[]=[];const add=(s:string)=>{objects.push(s);return objects.length;};
 const catalogId=add("<< /Type /Catalog /Pages 2 0 R >>");
 const pagesId=add("");
 const fontId=add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
 const pageIds:number[]=[];
 for(const pageLines of pages){
  let stream="BT\n/F1 10 Tf\n50 790 Td\n14 TL\n";
  pageLines.forEach((line,i)=>{stream+=(i===0?"(" + esc(line) + ") Tj\n":"T* (" + esc(line) + ") Tj\n");});
  stream+="ET";
  const streamId=add("<< /Length "+new TextEncoder().encode(stream).length+" >>\nstream\n"+stream+"\nendstream");
  const pageId=add("<< /Type /Page /Parent "+pagesId+" 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 "+fontId+" 0 R >> >> /Contents "+streamId+" 0 R >>");
  pageIds.push(pageId);
 }
 objects[pagesId-1]="<< /Type /Pages /Kids ["+pageIds.map(id=>id+" 0 R").join(" ")+"] /Count "+pageIds.length+" >>";
 let pdf="%PDF-1.4\n%SanbaPDF\n",offsets=[0];
 objects.forEach((obj,i)=>{offsets.push(new TextEncoder().encode(pdf).length);pdf+=(i+1)+" 0 obj\n"+obj+"\nendobj\n";});
 const xref=new TextEncoder().encode(pdf).length;pdf+="xref\n0 "+(objects.length+1)+"\n0000000000 65535 f \n";
 for(let i=1;i<offsets.length;i++)pdf+=String(offsets[i]).padStart(10,"0")+" 00000 n \n";
 pdf+="trailer\n<< /Size "+(objects.length+1)+" /Root "+catalogId+" 0 R >>\nstartxref\n"+xref+"\n%%EOF";
 return new TextEncoder().encode(pdf);
}
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return json({error:"Metodo nao permitido."},405);
 if(req.headers.get("origin")!==origin)return json({error:"Origem nao autorizada."},403);
 const auth=req.headers.get("Authorization")||"",token=auth.startsWith("Bearer ")?auth.slice(7):"";
 const url=Deno.env.get("SUPABASE_URL"),service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if(!url||!service)return json({error:"Configuracao do servidor incompleta."},503);
 if(!token)return json({error:"Entre na sua conta para baixar o produto."},401);
 try{
  const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
  const result=await admin.auth.getUser(token);
  if(result.error||!result.data.user)return json({error:"Sessao invalida. Entre novamente."},401);
  const access=await admin.from("product_entitlements").select("active").eq("user_id",result.data.user.id).eq("product_code","kit_divulgacao").maybeSingle();
  if(access.error)throw access.error;
  if(!access.data?.active)return json({error:"O Kit de Divulgacao ainda nao esta liberado nesta conta. Conclua a compra para baixar."},403);
  return new Response(makePdf(),{status:200,headers:{...cors,"Content-Type":"application/pdf","Content-Disposition":"inline; filename=\"Kit_de_Divulgacao_Sanba.pdf\"","Cache-Control":"private, no-store, max-age=0","X-Content-Type-Options":"nosniff"}});
 }catch(e){console.error("download-kit-divulgacao",e instanceof Error?e.message:"unknown");return json({error:"Nao foi possivel liberar o download agora."},500);}
});