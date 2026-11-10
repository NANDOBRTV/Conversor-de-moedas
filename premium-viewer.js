
import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';
const config=window.SANBA_SUPABASE_CONFIG||{};
const status=document.getElementById('status');
const frame=document.getElementById('premiumFrame');
function fail(message){status.className='error';status.textContent=message;}
try{
  if(!config.url||!config.anonKey)throw new Error('Configuração de autenticação indisponível.');
  const client=createClient(config.url,config.anonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  const {data:{session},error:sessionError}=await client.auth.getSession();
  if(sessionError||!session)throw new Error('Entre na sua conta para abrir este produto.');
  const {data,error}=await client.functions.invoke('get-premium-content',{body:{product_code:document.body.dataset.productCode}});
  if(error||!data?.ok||typeof data.html!=='string')
    throw new Error(data?.error||'Não foi possível confirmar a licença ou carregar o conteúdo.');
  if(data.html.length>1024*1024)throw new Error('O conteúdo excede o tamanho permitido.');
  frame.srcdoc=data.html;
  frame.classList.add('ready');
  status.remove();
}catch(error){fail(error?.message||'Não foi possível abrir o conteúdo protegido.');}
