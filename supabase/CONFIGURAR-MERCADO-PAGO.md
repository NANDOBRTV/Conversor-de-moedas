# Mercado Pago — integração legada do Conversor Sanba

## Estado atual

**Este documento descreve a integração antiga de Mercado Pago e não representa o checkout atual dos planos.** O checkout de Ouro (R$ 9,90 por 30 dias) e Diamante (R$ 49,90 em pagamento único) usa atualmente as funções Stripe documentadas em `STRIPE-PIX-CARTAO.md`, ainda restritas ao modo de teste.

As funções `create-checkout` e `mercadopago-webhook` permanecem no projeto como componentes legados/preparatórios, mas não devem ser confundidas com o fluxo Stripe atual. Não configure nem altere o checkout visível dos planos com base neste guia. Para a configuração atual, use `supabase/STRIPE-PIX-CARTAO.md`.

## Componentes preparados

- Tabela `public.payment_orders`.
- Edge Function `create-checkout`, protegida por autenticação.
- Edge Function `mercadopago-webhook`, destinada a validar notificações e consultar o pagamento no provedor.
- Segredos de servidor necessários para a integração, que devem permanecer fora do código público.

A página principal `index.html` não deve ser alterada durante esta etapa.

## Quando a integração for autorizada

1. Configurar credenciais de teste no painel Supabase, nunca no GitHub.
2. Configurar `MERCADOPAGO_ACCESS_TOKEN` e `MERCADOPAGO_WEBHOOK_SECRET` como secrets de servidor.
3. Confirmar a URL de notificação: `https://kllewmcyvjltfzqxnmyz.supabase.co/functions/v1/mercadopago-webhook`.
4. Testar pagamento aprovado, pendente, recusado, valor incorreto, plano divergente, assinatura inválida e notificação duplicada.
5. Confirmar idempotência e que a conta Desenvolvedor nunca é modificada pelo webhook.
6. Só depois de aprovação explícita, conectar a interface ao checkout e testar o retorno no site.

## Planos

- **Ouro:** R$ 9,90 por 30 dias; renovação não automática.
- **Diamante:** R$ 49,90, pagamento único, sem vencimento automático.
- **Desenvolvedor:** acesso administrativo, não pode ser comprado nem sobrescrito por uma notificação de pagamento.

Não use a URL de retorno do navegador como prova de pagamento. A liberação futura deverá depender da confirmação do servidor e de uma notificação verificada.
