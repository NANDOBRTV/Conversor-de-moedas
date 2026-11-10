# Plano de implantação segura — Conversor Sanba

**Escopo:** branch `security/hardening-2026-11-10`, derivada de `main` no commit `2c16c6629f4754b8a54f378609d41a92cbb2034c`.

## O que foi implementado

1. A criação de checkout Stripe e Mercado Pago recusa revendedor pendente, suspenso ou expirado.
2. O webhook Stripe também confere aprovação, estado do perfil, origem do pedido, valor e sessão, além de tratar **reembolso integral** e **disputa iniciada**, revogando benefícios quando comprovadamente vinculados ao pedido.
3. O webhook Mercado Pago verifica origem do pagamento, metadados, janela temporal da assinatura e revoga o plano em reembolso ou chargeback.
4. O checkout Stripe usa chave de idempotência, controle de tentativas recentes e exige `STRIPE_MODE=test` ou `STRIPE_MODE=live` compatível com o secret.
5. A migração `20261110_recharge_integrity_and_stripe_compat.sql` recalcula o valor de recargas no Postgres, limita quantidade, rejeita inserções suspeitas e restringe as colunas editáveis. Preços iniciais por 1.500 moedas: BRL 6, USD 0,99, VES 1450.
6. A proteção de senhas usa o método de k-anonymity: somente **cinco caracteres do SHA-1** saem do navegador, e a conferência do sufixo é feita localmente. Cadastro/troca de senha exigem 12 caracteres na interface.
7. A lógica JS foi extraída das páginas principais para permitir CSP de scripts sem `unsafe-inline`.
8. As três páginas de produtos pagos não incluem mais o conteúdo de venda e chamam `get-premium-content`, que autentica e exige entitlement + pedido confirmado antes de buscar HTML em Storage privado.
9. Há testes automatizados de invariantes em `tests/security-hardening.test.js` e `.gitignore` para não publicar exports privados.

## Ordem de implantação obrigatória — homologação primeiro

**Não mescle nem publique enquanto os passos abaixo não estiverem testados.**

1. Faça backup do banco e verifique políticas/RLS de `reseller_profiles`, `payment_orders`, `revenue_orders`, `product_entitlements`, `recharge_orders` e `storage.objects`.
2. Aplique em **homologação** as migrações SQL `20261110_recharge_integrity_and_stripe_compat.sql` e `20261110_private_premium_bucket.sql`. Confirme que `premium-content` é **privado** e não há política RLS ampla que permita leitura pelos papéis `anon` ou `authenticated`.
3. Numa cópia local do repositório que tenha o histórico, execute `node scripts/prepare-private-premium.mjs`. Os arquivos gerados ficam em `private-artifacts/` e **não podem ser adicionados ao GitHub**. Confira conteúdo e funcionamento dos três HTMLs gerados.
4. Envie **somente** `kit_divulgacao.html`, `planilha_lucro.html` e `calculadora_precos.html` ao bucket privado `premium-content` no painel Supabase, com esses nomes exatos. Não use um bucket público nem faça upload do conteúdo completo para GitHub Pages.
5. Implante a Edge Function `get-premium-content` com verificação de JWT habilitada e variáveis `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` configuradas como secrets **somente no servidor**.
6. Configure as funções Stripe em ambiente isolado com `STRIPE_MODE=test`, `STRIPE_SECRET_KEY=sk_test_...`, `STRIPE_WEBHOOK_SECRET=whsec_...`. `create-stripe-plan-checkout`, `create-stripe-product-checkout`, `verify-product-payment` e `stripe-revenue-webhook` devem usar a MESMA configuração. Webhook deve manter validação de assinatura e receber eventos de `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `charge.refunded` e `charge.dispute.created`. Não mude para `live` sem uma rodada de testes separada.
7. Implante `create-checkout` e `mercadopago-webhook` revisados se o checkout legado for utilizado. Verifique credenciais e assinaturas; não envie webhooks falsos para produção.
8. Atualize `security/password-protection` e as páginas do site em uma janela coordenada: o protocolo novo `sha1_prefix` não é compatível com o anterior. Teste cadastro, troca de senha, senha vazada, falha do HIBP e rate limit.
9. Execute `npm test`, `npm run check:js` e os testes de navegador em Android. O CI do GitHub deve ficar verde antes de aceitar o PR.

## Matriz mínima de segurança

- **Contas:** anônimo, cliente comum, revendedor pendente, revendedor aprovado, suspenso, vencido, Ouro, Diamante e Desenvolvedor. Garanta que cada conta leia só seus dados e não promova seu próprio plano.
- **Checkout:** acesso negado para pendente, preço do servidor, sessão válida, status pendente, pagamento aprovado, Pix assíncrono, retorno cancelado, eventos repetidos, pagamento de valor divergente, sessão de outra conta e ambiente Stripe errado.
- **Reversão:** reembolso integral, disputa iniciada, evento duplicado, pagamento de outro usuário, pedido já cancelado, acessos de compra posterior e nova tentativa de liberar um pedido revertido. Reembolsos parciais precisam de revisão operacional explícita.
- **Recargas:** preço conforme moeda, quantidade inválida, ID composto por zeros, orçamento insuficiente, edição direta de quantidade/preço após criar o pedido, acesso sem login, conta suspensa e múltiplos pedidos em um minuto.
- **Produtos:** visitante não vê os arquivos, conta não pagante recebe HTTP 403, conta paga recebe somente o próprio produto, conta reembolsada perde acesso, bucket não oferece URL pública e iframe não tem `allow-same-origin`.
- **Infraestrutura:** headers CSP, HTTPS, limites de tamanho, rate limit, WAF/anti-bot, autenticação multifator para o Desenvolvedor e rotação dos secrets.

## Pendências que o código sozinho NÃO resolve

- **Migrações e deploy:** este PR não atualiza o banco de produção, funções Supabase, Render nem conteúdo do bucket. É necessário aplicar, conferir e testar cada etapa.
- **Histórico Git público:** os materiais pagos originalmente publicados em `main` permanecem consultáveis em commits antigos. Removê-los da página atual não os torna secretos retroativamente. Para exclusividade real, crie versões novas e mantenha os arquivos exclusivos somente no armazenamento privado. Reescrita de histórico requer planejamento separado e não garante eliminação de cópias.
- **Supabase Auth:** a checagem HIBP no cliente pode ser contornada por chamadas diretas à API de cadastro. A proteção obrigatória contra senhas vazadas requer controles do próprio Supabase ou um fluxo servidor impossível de contornar.
- **Revogação:** a reversão automática cobre reembolsos integrais e disputas iniciadas nos webhooks programados, não todas as situações (reembolso parcial, mudanças manuais, múltiplas compras, eventos não entregues). Configure conciliação periódica com Stripe/Mercado Pago.
- **Concorrência:** duas Edge Functions que atualizam perfis/pedidos em requisições simultâneas ainda podem apresentar janelas de inconsistência. Para garantias mais fortes, migrar transições críticas para procedimentos SQL transacionais idempotentes com bloqueio de linha e trilha de auditoria.
- **Hospedagem GitHub Pages:** políticas HTTP como HSTS e `frame-ancestors` precisam ser configuradas num host/proxy com controle de cabeçalhos; não podem ser totalmente garantidas somente pela meta CSP do HTML.
- **Proteção de IP:** um `X-Forwarded-For` não confiável não pode ser tratado como identidade de segurança. Configure um proxy/CDN confiável e rate limiting distribuído antes de internet pública em escala.
- **Credenciais:** nunca publicar `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, assinatura de webhook ou arquivos de `private-artifacts/` em issues, commits, logs ou navegador.

**Critério de liberação:** CI verde + teste no navegador Android + testes RLS + confirmação de cobrança de teste + reversão + revisão dos segredos. Sem isso, mantenha a versão principal inalterada.
