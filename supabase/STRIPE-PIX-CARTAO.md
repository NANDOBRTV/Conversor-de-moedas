# Stripe no Conversor Sanba — Pix e cartão

## Estado atual

- O checkout do Painel do Revendedor cria sessões Stripe para Ouro (R$ 9,90 por 30 dias) e Diamante (R$ 49,90 em pagamento único).
- A função de checkout exige uma chave `sk_test_`. O checkout permanece em modo de teste; não use para vendas reais ainda.
- A sessão pede explicitamente os métodos `card` e `pix`. A exibição do Pix depende de a conta Stripe estar elegível e de o método estar habilitado no Dashboard.
- O webhook verifica a assinatura Stripe e confirma o pagamento no servidor. Ele processa `checkout.session.completed` e `checkout.session.async_payment_succeeded`, importante para métodos assíncronos como Pix.
- Não foi realizado um pagamento de teste nesta alteração. A presença dos métodos no código não comprova que o Pix está habilitado na conta.

## Secrets necessários no Supabase

Configure somente em Supabase → Edge Functions → Secrets:

- `STRIPE_SECRET_KEY`: chave de teste que começa com `sk_test_`.
- `STRIPE_WEBHOOK_SECRET`: segredo do endpoint de webhook, que começa com `whsec_`.
- `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`: segredos de servidor; nunca os coloque no front-end ou no GitHub.

## Webhook

O endpoint é a função Supabase `stripe-revenue-webhook`. Configure no Dashboard Stripe o endpoint correspondente à URL dessa função e assine pelo menos estes eventos:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`

A função valida valor, moeda, ID do pedido, usuário, plano e sessão antes de liberar acesso. Não libere planos com base apenas no parâmetro `payment=success` da URL de retorno.

## Roteiro de validação antes da produção

1. Confirme no Dashboard Stripe em modo de teste que Pix e cartões estão disponíveis para a conta.
2. Verifique que os secrets do Supabase são de teste e que o webhook usa o segredo de teste correspondente.
3. Faça um checkout de Ouro com cartão de teste e confira o pedido em `payment_orders` e o plano no perfil.
4. Faça um checkout com Pix de teste e confirme que o webhook assíncrono liberou o plano somente depois da confirmação.
5. Teste cancelamento, pagamento não concluído, assinatura inválida e reenvio de evento.
6. Confirme que Ouro expira em 30 dias e Diamante não recebe vencimento automático.
7. Só depois de todos os testes, avalie separadamente a migração para chaves e webhook de produção. Não remova a restrição `sk_test_` antes de uma revisão explícita.

## Limitações

- A disponibilidade do Pix depende do país da conta, moeda BRL, categoria comercial, elegibilidade e configuração Stripe.
- Um Pix pode ficar aguardando confirmação; a tela de retorno do checkout não prova pagamento.
- Esta integração cobre Ouro e Diamante. As recargas Sanba continuam no fluxo manual.
