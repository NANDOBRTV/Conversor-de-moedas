# Configuração do Mercado Pago — Conversor Sanba

## O que já foi preparado
- Tabela `public.payment_orders` no Supabase.
- Edge Function `create-checkout` para criar checkout no servidor.
- Edge Function `mercadopago-webhook` para validar assinatura, consultar o pagamento na API oficial e ativar o plano após confirmação.
- Painel `revendedor.html` com botões de checkout. O `index.html` não é alterado.

## Secrets obrigatórios no Supabase
No Dashboard do projeto, abra **Edge Functions → Secrets** (ou Project Settings → Edge Functions, conforme a interface) e cadastre:
- `MERCADOPAGO_ACCESS_TOKEN`: Access Token de teste para validar a integração primeiro; depois substituir pelo token de produção.
- `MERCADOPAGO_WEBHOOK_SECRET`: segredo de assinatura de Webhooks exibido/configurado na aplicação do Mercado Pago.

Não coloque esses valores no GitHub, no HTML ou no chat. `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` são variáveis padrão da Edge Functions; `SUPABASE_ANON_KEY` também é usado para validar a configuração.

## URL de notificação
Configure o evento de pagamentos da aplicação Mercado Pago para:
`https://kllewmcyvjltfzqxnmyz.supabase.co/functions/v1/mercadopago-webhook`

O webhook valida o header `x-signature` com o segredo cadastrado, consulta o pagamento no Mercado Pago e só então considera aprovado. Não use o retorno do navegador como prova de pagamento.

## Planos nesta versão
- Ouro: R$ 9,90 por 30 dias. Pix/cartão no checkout; renovação não é cobrança recorrente automática nesta primeira versão.
- Diamante: R$ 49,90 em pagamento único.
- Conta Desenvolvedor: não pode ser comprada nem sobrescrita pelo webhook.

## Antes de produção
1. Cadastrar credenciais de teste no Supabase.
2. Configurar URL de notificação e segredo no Mercado Pago.
3. Testar compra, webhook válido/inválido, valor errado, notificação duplicada e perfis separados.
4. Só então trocar para credenciais reais e fazer uma transação real de baixo valor, se apropriado.
