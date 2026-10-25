# Conversor Sanba — guia técnico atual

Este repositório contém a calculadora pública, a área do cliente, o painel do revendedor, as áreas administrativas e as funções de backend do Supabase.

## Páginas publicadas

- Calculadora principal: index.html — preservar os cálculos e o atendimento manual de recargas pelo WhatsApp.
- Área do cliente: cliente.html — cadastro/login e consulta de pedidos vinculados à conta.
- Painel do revendedor: revendedor.html — login; o cadastro de revendedor aparece apenas por convite individual.
- Aprovação e administração: admin-pedidos.html e áreas administrativas acessíveis à conta Desenvolvedor.

## Fluxos atuais

### Cliente e recargas
1. A pessoa cria uma conta e pode consultar os pedidos vinculados a ela.
2. Recargas Sanba continuam com atendimento e confirmação manuais.
3. Um pedido pendente não é receita recebida e não deve ser tratado como pagamento confirmado.

### Revendedor
1. O Desenvolvedor ativo cria um convite individual.
2. O convite expira em 7 dias, só pode ser usado uma vez e pode ser vinculado a um e-mail.
3. A pessoa convidada cria a conta e solicita acesso.
4. A aprovação manual libera somente o acesso básico de revendedor; não concede Ouro ou Diamante.
5. Após a aprovação, a pessoa pode escolher Ouro (R$ 9,90 por 30 dias) ou Diamante (R$ 49,90 em pagamento único).

### Níveis e privilégios
- **Comum:** conta básica, sem ferramentas Premium.
- **Ouro:** calculadora de revenda e histórico local de até 50 cálculos durante 30 dias.
- **Diamante:** recursos do Ouro, além de copiar resultados, exportar CSV e relatórios adicionais; pagamento único, sem vencimento automático.
- **Desenvolvedor:** conta administrativa do proprietário, sem necessidade de comprar plano.

## Pagamentos Stripe — estado atual

O checkout de Ouro e Diamante é implementado em supabase/functions/create-stripe-plan-checkout/index.ts. Ele solicita os métodos card e pix, em BRL. A função continua deliberadamente limitada à chave sk_test_; não está liberada para vendas reais.

A função supabase/functions/stripe-revenue-webhook/index.ts valida a assinatura do Stripe e confere usuário, pedido, sessão, plano, moeda e valor antes de ativar o acesso. Ela processa checkout.session.completed e checkout.session.async_payment_succeeded, necessário para confirmar pagamentos assíncronos como Pix.

A presença dos métodos no código não garante que o Pix esteja habilitado para a conta. Antes de produção, siga supabase/STRIPE-PIX-CARTAO.md e valide checkout de teste, webhook, cancelamento, evento duplicado e liberação correta do plano. Não libere acesso apenas com base na URL de retorno do navegador.

As recargas Sanba não usam esse checkout de planos; continuam manuais.

## Supabase e arquivos de backend

- supabase-config.js: contém somente URL do projeto e chave pública publishable. Nunca colocar segredos nesse arquivo.
- supabase/schema.sql: esquema de referência para perfis, convites, pedidos, recargas, limites de tentativas e funções SQL. Revise e faça backup antes de executar em banco existente.
- supabase/functions/login-by-username/index.ts: login por usuário ou e-mail, validado pelo Supabase Auth.
- supabase/functions/manage-reseller-invites/index.ts: convites e aprovação; exige Desenvolvedor ativo.
- supabase/functions/create-customer-order/index.ts e manage-customer-orders/index.ts: fluxo manual de pedidos de plano pelo WhatsApp, mantido para compatibilidade/administração.
- supabase/functions/create-checkout/index.ts e mercadopago-webhook/index.ts: preparação legada de Mercado Pago; não confundir com o checkout Stripe atual.
- supabase/functions/create-stripe-plan-checkout/index.ts: cria checkout Stripe de Ouro/Diamante em modo de teste, com Pix e cartão solicitados.
- supabase/functions/stripe-revenue-webhook/index.ts: confirmação do pagamento Stripe no servidor.

As Edge Functions usam segredos do lado do servidor, incluindo SUPABASE_SERVICE_ROLE_KEY. Nunca coloque a service-role, chave secreta Stripe ou segredo de webhook no HTML, no GitHub ou no chat.

## Segurança implementada e pendências

- RLS habilitado nas tabelas principais.
- Perfis limitados à leitura da própria conta.
- Pedidos criados por funções de servidor.
- Ações administrativas validadas no backend.
- Convites armazenados como hash, com expiração e uso único.
- Limites de tentativas para login e operações sensíveis.

Os avisos de tabelas sem políticas RLS devem ser avaliados conforme o modelo de acesso; tabelas internas podem estar intencionalmente inacessíveis ao cliente e disponíveis apenas às funções privilegiadas. O Supabase também sinalizou proteção contra senhas comprometidas desativada e alguns índices/políticas que podem ser otimizados. Essas pendências devem ser tratadas sem abrir acesso direto às tabelas internas.

## Publicação e testes

1. Faça alterações no GitHub e aguarde a publicação do GitHub Pages.
2. Teste em janela privada e no celular.
3. Valide cadastro, login, saída, perfil, convites, aprovação e pedidos com contas de teste.
4. Rode os Security/Performance Advisors do Supabase após mudanças no banco.
5. Não considere pagamento automático aprovado até testar credenciais de teste, webhook válido/inválido, eventos duplicados e valor/plano divergentes.
6. Só avaliar modo de produção depois da validação de Pix e cartão, secrets de produção separados e endpoint de webhook correspondente.

**Regra de alteração:** preservar a calculadora principal index.html, a menos que uma mudança nela seja solicitada explicitamente.
