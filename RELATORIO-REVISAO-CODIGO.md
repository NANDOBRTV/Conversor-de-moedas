# Relatório de revisão de código — Conversor Sanba

**Data:** 24/10/2026  
**Branch revisada:** `main`  
**Repositório:** `NANDOBRTV/Conversor-de-moedas`

## Escopo revisado

- Páginas `cliente.html`, `revendedor.html` e `admin-pedidos.html`.
- Configuração pública em `supabase-config.js`.
- Esquema SQL de perfis, convites, recargas, pedidos e limites de tentativas.
- Edge Functions ativas no Supabase: `login-by-username`, `create-checkout`, `mercadopago-webhook`, `create-customer-order`, `manage-customer-orders` e `manage-reseller-invites`.
- Documentação de configuração e de planos.
- Verificação da página pública no GitHub Pages e leitura dos avisos de segurança/desempenho do Supabase.

## Alterações concluídas

- **Correção do pós-login:** a sessão autenticada agora abre o painel imediatamente antes da consulta ao perfil. Se a consulta falhar, o usuário permanece no painel e recebe o diagnóstico na área da conta, em vez de ficar preso na tela de login. Commit: `51aba81edea3adf515f6e6adfa8613e5444ecd98`.

1. **Tela do revendedor:** a página padrão mostra apenas o login. O cadastro é mantido somente para quem abre um link com convite, para não quebrar o fluxo de convites individuais.
2. **Código-fonte sincronizado:** as versões de `login-by-username` e `create-checkout` no GitHub foram sincronizadas com as funções ativas do Supabase.
3. **Fontes faltantes adicionadas:** `create-customer-order`, `manage-customer-orders` e `manage-reseller-invites` agora têm seus arquivos no repositório. Isso reduz a divergência entre produção e código versionado.
4. **Esquema SQL completado:** foram documentadas as tabelas e regras de `customer_orders`, `recharge_orders`, `reseller_invites`, `bot_rate_limits`, além das colunas adicionais de perfil e das funções SQL usadas pelo backend.
5. **Permissões/RLS documentadas:** as políticas de leitura e gravação refletem o modelo atual; as tabelas internas de convites e rate limit não recebem acesso direto de `anon`/ `authenticated`.
6. **Documentação atualizada:** o guia de Supabase agora descreve os fluxos atuais de cliente, revendedor e desenvolvedor; a documentação do Mercado Pago deixa explícito que o fluxo visível de compra continua manual pelo WhatsApp.
7. **Relatório registrado no repositório** para futuras revisões.

## Verificações

- A página publicada do painel do revendedor foi aberta em navegador sem autenticação: o formulário de login estava visível e não havia aba/formulário de cadastro na tela inicial.
- Os logs recentes da Edge Function de login contêm respostas HTTP de sucesso; também existem respostas históricas `401` e `503`. Isso indica que a página alcança a função, mas não prova o resultado de cada conta ou senha.
- A análise estática não encontrou IDs HTML duplicados nas páginas cliente, revendedor e administração.
- A calculadora principal `index.html` também foi auditada em modo somente leitura: não há IDs duplicados, `eval`, `debugger`, redirecionamento anti-inspeção para `about:blank` nem o antigo painel público de ajuste de preços. O arquivo permaneceu inalterado.
- As tabelas expostas principais têm RLS habilitado.
- O aviso de tabelas internas sem políticas (`bot_rate_limits`, `reseller_invites`) é compatível com o modelo em que somente funções de servidor as acessam.

## Itens que continuam pendentes

1. **Proteção de senhas comprometidas:** o Supabase informa que a proteção contra senhas vazadas está desativada. Essa opção precisa ser habilitada no painel de autenticação; não foi alterada por esta revisão.
2. **Teste de login autenticado:** não foi feita tentativa de login com credenciais reais, e nenhuma senha foi solicitada ou exposta. Portanto, não se declara o login ponta a ponta totalmente validado.
3. **Teste completo de compras:** o fluxo manual por WhatsApp deve ser testado com uma conta de teste, conferindo criação do pedido, mensagem gerada e aprovação pelo Desenvolvedor.
4. **Mercado Pago automático:** não considerar a integração pronta para produção. O checkout automático não deve substituir o WhatsApp até haver autorização explícita e testes completos de pagamento/webhook.
5. **Advisors de desempenho:** o Supabase sinalizou índices ainda não usados. Como os dados e o volume são pequenos, os índices foram mantidos para não remover otimizações preventivamente.
6. **Esquema SQL:** o arquivo de referência foi atualizado no GitHub, mas não foi reexecutado no banco de produção durante esta revisão. O banco já continha as tabelas/funções verificadas; a revisão evitou uma migração desnecessária.

7. **Correção adicional do formulário de login (24/10/2026):** um teste de navegador mostrou que o formulário podia ser enviado como formulário HTML normal, sem mensagem de erro e sem executar o fluxo de autenticação. O módulo de autenticação foi movido de dentro do HTML para `revendedor-app.js`, com o carregador externo `revendedor-loader.js` e feedback visível caso o módulo falhe ao carregar. O formulário também deixou de permitir que o navegador acrescente usuário/senha à URL e mostra um estado inicial de conexão. A página e os arquivos externos foram confirmados no GitHub; ainda é necessário validar uma entrada real com a conta do proprietário, sem compartilhar senha no chat.

## Restrições preservadas

- `index.html` não foi alterado.
- Categorias Comum, Ouro, Diamante e Desenvolvedor preservadas.
- Ouro: R$ 9,90 por 30 dias.
- Diamante: R$ 49,90 em pagamento único.
- Compra e confirmação manual pelo WhatsApp mantidas.
- Nenhuma chave secreta foi adicionada ao código público.


---

## Atualização de desenvolvimento — 25/10/2026

### Stripe — Pix e cartão
- Confirmado que o painel do revendedor já chama a Edge Function `create-stripe-plan-checkout`.
- A criação da Checkout Session agora solicita explicitamente os meios `card` e `pix` em BRL.
- A função foi implantada no Supabase como versão 4 e permanece ACTIVE.
- Confirmado que o conteúdo da função implantada corresponde ao arquivo `supabase/functions/create-stripe-plan-checkout/index.ts` versionado no GitHub.
- Mantida a proteção de modo de teste: a função exige uma chave `sk_test_`. Não foi ativado modo live e nenhum pagamento real foi feito.
- O webhook `stripe-revenue-webhook` foi reimplantado como versão 5 ACTIVE. Na comparação entre o código implantado e o versionado, foi corrigida uma divergência no comparador da assinatura: cada caractere da assinatura recebida agora é comparado ao caractere correspondente do digest esperado. Processa `checkout.session.completed` e `checkout.session.async_payment_succeeded`, importante para pagamentos Pix assíncronos.
- Adicionados ao GitHub os arquivos-fonte `supabase/functions/create-stripe-plan-checkout/index.ts` e `supabase/functions/stripe-revenue-webhook/index.ts`, para rastrear o backend implantado.

### Documentação e interface
- Criado `supabase/STRIPE-PIX-CARTAO.md` com configuração de secrets, webhook e roteiro de testes.
- Atualizado `LEIA-ME-SUPABASE.md` para refletir o checkout Stripe atual e separar as recargas manuais.
- Atualizado `supabase/ADMINISTRAR-PLANOS.md` para descrever o checkout em modo de teste.
- Marcado `supabase/CONFIGURAR-MERCADO-PAGO.md` como documentação legada, pois não representa o checkout atual dos planos.
- Atualizado o texto de `revendedor.html` para avisar que o checkout está em modo de teste e que Pix depende da disponibilidade da conta Stripe. A calculadora principal `index.html` foi preservada.

### Banco de dados e desempenho
- Aplicada a migration `add_missing_order_foreign_key_indexes`, criando índices para `reseller_sales_orders.created_by` e `revenue_orders.user_id`.
- Aplicada a migration `optimize_reseller_sales_orders_rls_policy`, mantendo o acesso restrito ao Desenvolvedor ativo e otimizando a avaliação de `auth.uid()`.
- Arquivos SQL das duas migrations foram adicionados a `supabase/migrations/`.
- Após as alterações, o Performance Advisor não mostra mais os avisos de chaves estrangeiras sem índice nem o aviso de reavaliação de `auth.uid()`. Os índices novos podem aparecer como não utilizados até que haja consultas reais suficientes.

### Pendências antes de produção
1. Confirmar no Dashboard Stripe que Pix está habilitado e disponível para a conta comercial, além de cartões.
2. Confirmar que `STRIPE_SECRET_KEY` e `STRIPE_WEBHOOK_SECRET` no Supabase correspondem ao modo de teste e ao endpoint de webhook de teste.
3. Executar testes ponta a ponta de cartão e Pix, incluindo confirmação assíncrona e liberação correta do plano.
4. Testar cancelamento, pagamento não concluído, assinatura inválida, evento duplicado, valor divergente e plano divergente.
5. Confirmar Ouro com validade de 30 dias e Diamante sem vencimento automático.
6. Só depois avaliar a troca para chaves live e webhook de produção. A restrição `sk_test_` deve permanecer até essa revisão.
7. Habilitar proteção contra senhas comprometidas no painel Auth do Supabase.
8. Rever os avisos de RLS sem políticas nas tabelas internas `bot_rate_limits`, `reseller_invites` e `revenue_orders`. Não criar políticas públicas indiscriminadamente; confirmar que o acesso continua exclusivo às funções de servidor.

### Regras de preservação
- Não modificar `index.html` sem solicitação explícita.
- Nunca colocar chaves privadas, `service_role` ou segredos de webhook no front-end, GitHub ou mensagens.
- Não liberar plano com base apenas no retorno do navegador; a confirmação deve vir do webhook validado.
- Recargas Sanba continuam no fluxo manual; o checkout Stripe atual cobre somente Ouro e Diamante.


### Correção de segurança do webhook — 25/10/2026
- A comparação entre o código ativo do webhook e o arquivo versionado revelou uma divergência na verificação HMAC: o código implantado usava o índice errado ao ler os caracteres da assinatura.
- O webhook foi reimplantado a partir do código revisado no GitHub, versão 5 ACTIVE, usando comparação caractere a caractere correta.
- A alteração fortalece a validação da assinatura Stripe. Ainda é necessário testar uma assinatura válida e uma inválida no modo de teste antes de considerar a integração pronta para produção.
