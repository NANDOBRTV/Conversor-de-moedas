# Mercado Pago — integração futura do Conversor Sanba

## Estado atual

**O fluxo de compra atual continua manual pelo WhatsApp.** Ouro custa R$ 9,90 por 30 dias e Diamante custa R$ 49,90 em pagamento único. O acesso só deve ser liberado depois da conferência manual do pagamento.

O repositório e o projeto Supabase contêm funções preparatórias para checkout/webhook, mas isso **não significa que o pagamento automático esteja validado ou liberado para uso real**. Não altere o fluxo visível para checkout automático sem pedido explícito e testes completos.

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
