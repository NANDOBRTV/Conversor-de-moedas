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
