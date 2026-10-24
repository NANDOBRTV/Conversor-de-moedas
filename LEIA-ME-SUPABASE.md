# Conversor Sanba — guia técnico atual

Este repositório contém a calculadora pública, a área do cliente, o painel do revendedor, a área administrativa de pedidos e os arquivos do Supabase.

## Páginas publicadas

- Calculadora principal: `index.html` — manter os cálculos e o atendimento manual pelo WhatsApp.
- Área do cliente: `cliente.html` — cadastro/login e consulta de pedidos vinculados à conta.
- Painel do revendedor: `revendedor.html` — a página normal mostra apenas o login. O cadastro de revendedor só é exibido quando a pessoa chega por um convite individual.
- Aprovação de pedidos: `admin-pedidos.html` — acesso restrito à conta Desenvolvedor, validado novamente no servidor.

## Fluxos atuais

### Cliente
1. Cria uma conta na Área do Cliente.
2. A conta comum não recebe automaticamente recursos pagos de revendedor.
3. Os pedidos de recarga são vinculados à conta e consultados pelo próprio cliente.
4. O atendimento e a confirmação de pagamento da recarga continuam manuais.

### Revendedor
1. O Desenvolvedor ativo cria um convite individual no painel.
2. O convite vale 7 dias e só pode ser usado uma vez; pode ser vinculado a um e-mail.
3. A pessoa convidada cria a conta por esse link.
4. A conta fica aguardando aprovação. O cadastro, por si só, não libera o painel.
5. Após a aprovação, a pessoa pode escolher Ouro (R$ 9,90 por 30 dias) ou Diamante (R$ 49,90 em pagamento único). O atendimento e a conferência do Pix são manuais pelo WhatsApp.

### Níveis
- **Comum:** conta básica.
- **Ouro:** recursos de revenda por 30 dias.
- **Diamante:** recursos do Ouro, além de copiar resultados e exportar CSV; pagamento único, sem vencimento automático.
- **Desenvolvedor:** conta administrativa do proprietário; não deve ser convertida em Ouro ou Diamante.

## Supabase e arquivos de backend

- `supabase-config.js`: contém apenas a URL do projeto e a chave pública publishable. Não colocar secrets nesse arquivo.
- `supabase/schema.sql`: esquema de referência para perfis, convites, pedidos, recargas, limite de tentativas e funções SQL. O arquivo é idempotente em grande parte, mas revise e faça backup antes de executá-lo num banco já utilizado.
- `supabase/functions/login-by-username/index.ts`: login por usuário ou e-mail; a senha é validada pelo Supabase Auth.
- `supabase/functions/manage-reseller-invites/index.ts`: cria/revoga convites e aprova solicitações; exige Desenvolvedor ativo.
- `supabase/functions/create-customer-order/index.ts`: grava o pedido de plano e prepara a mensagem manual para o WhatsApp.
- `supabase/functions/manage-customer-orders/index.ts`: lista e processa pedidos de planos com autorização de Desenvolvedor.
- `supabase/functions/create-checkout/index.ts` e `mercadopago-webhook/index.ts`: preparação de integração automática futura. Não considerar o checkout automático pronto para produção; a interface atual deve continuar no fluxo manual até testes explícitos e autorização para ativá-lo.

As Edge Functions usam secrets do lado do servidor, incluindo `SUPABASE_SERVICE_ROLE_KEY`. Nunca coloque a chave de serviço, token do Mercado Pago ou segredo de webhook no HTML, em `supabase-config.js`, no GitHub ou no chat.

## Segurança implementada

- RLS ativado nas tabelas expostas.
- Perfis limitados à leitura da própria conta.
- Pedidos criados por funções de servidor, não por gravação direta do cliente.
- Ações administrativas validadas no backend.
- Convites armazenados como hash e com expiração/uso único.
- Limite de tentativas para login e operações sensíveis.

O aviso do Supabase sobre tabelas internas sem políticas (por exemplo, `bot_rate_limits` e `reseller_invites`) é esperado quando o acesso direto fica revogado e apenas as funções privilegiadas as utilizam. A proteção de senha comprometida deve ser habilitada no painel Auth do Supabase.

## Diagnóstico de login

- **401:** geralmente usuário/e-mail ou senha incorretos, ou perfil não localizado.
- **503:** serviço ou configuração temporariamente indisponível. Verifique os secrets e os logs da Edge Function; não compartilhe senhas pelo chat.
- Se a autenticação for aceita, mas o painel não carregar, confira se o perfil correspondente existe e se a política RLS permite que a conta leia apenas seu próprio perfil.

## Publicação e testes

1. Faça alterações no GitHub e aguarde a publicação do GitHub Pages.
2. Teste em janela privada e no celular.
3. Verifique login, saída, perfil, convites, aprovação e pedidos com contas de teste.
4. Confirme as permissões e rode os Security/Performance Advisors do Supabase após mudanças no banco.
5. Não considere o fluxo de pagamento automático aprovado até testar credenciais de teste, webhook válido/inválido, notificações duplicadas e valor/plano divergentes.

**Regra de alteração:** a calculadora principal `index.html` deve ser preservada, a menos que uma mudança nela seja solicitada explicitamente.
