
// O botão de WhatsApp só fica disponível quando há uma sessão autenticada.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const cfg = window.SANBA_SUPABASE_CONFIG || {};
if (cfg.url && cfg.anonKey) {
  const authClient = createClient(cfg.url, cfg.anonKey, {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  const syncCustomerAccess = async () => {
    try {
      const {data,error} = await authClient.auth.getSession();
      if (error) throw error;
      document.body.classList.toggle('customer-authenticated', Boolean(data.session && data.session.user));
    } catch (_) {
      document.body.classList.remove('customer-authenticated');
    }
  };
  await syncCustomerAccess();
  authClient.auth.onAuthStateChange((_event, session) => {
    document.body.classList.toggle('customer-authenticated', Boolean(session && session.user));
  });
} else {
  document.body.classList.remove('customer-authenticated');
}
