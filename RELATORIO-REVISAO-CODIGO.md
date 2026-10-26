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


### Atualização de status — testes confirmados pelo proprietário (25/10/2026)
- O proprietário informou que já executou os testes do checkout e que estão funcionando bem.
- Status atualizado conforme confirmação do proprietário: **testes funcionais concluídos com resultado positivo**. Esta atualização registra o relato do teste; não significa que esta revisão tenha repetido independentemente cada cenário.
- No momento desta verificação, as Edge Functions create-stripe-plan-checkout (versão 4) e stripe-revenue-webhook (versão 5) aparecem como ACTIVE no Supabase.
- Os Advisors continuam mostrando um aviso de proteção contra senhas comprometidas desativada e três tabelas com RLS habilitado sem políticas: bot_rate_limits, reseller_invites e revenue_orders. Esses avisos precisam de avaliação cuidadosa; não criar políticas de acesso público sem confirmar o modelo de acesso.
- O Performance Advisor apresenta índices ainda não utilizados. Isso, isoladamente, não demonstra falha: o uso depende das consultas e do volume real.
- A restrição de checkout a chave Stripe de teste permanece. Não ativar pagamentos reais nem trocar para chaves live sem uma decisão explícita e uma revisão separada de produção.


---

## Atualização consolidada do projeto — 26/10/2026

Esta seção registra o que já existe no repositório, o que está em revisão e o que ainda precisa ser implementado/testado. **Código em branch/PR não deve ser considerado publicado nem implantado automaticamente.**

### Funcionalidades e estrutura existentes

- Conversor público Sanba com seleção de moedas e cálculo de valores; a página principal continua protegida pela regra do projeto de não alterar `index.html` sem necessidade explícita.
- Páginas separadas para cliente, revendedor e administração/desenvolvedor, além de fluxos de convites, aprovação de revendedores, pedidos e gestão.
- Níveis de acesso do projeto preservados: **Comum, Ouro, Diamante e Desenvolvedor**. O nível Comum é o revendedor básico; os níveis superiores devem respeitar os privilégios definidos no projeto, sem expor ferramentas avançadas a quem não tem permissão.
- Cadastro/login e dados de perfil apoiados pelo Supabase; tabelas e políticas RLS documentadas no repositório. O fluxo de aprovação manual continua sendo parte do processo para habilitar novos revendedores.
- O painel do revendedor utiliza o carregador externo `revendedor-loader.js` e o módulo `revendedor-app.js`; os formulários e IDs existentes devem ser preservados durante alterações de interface.
- O fluxo de recarga Sanba continua separado do checkout dos planos e permanece manual pelo WhatsApp, conforme decisão do proprietário.
- Documentação existente inclui `LEIA-ME-SUPABASE.md`, `DESIGN-SYSTEM-SANBA.md`, `supabase/STRIPE-PIX-CARTAO.md`, `supabase/ADMINISTRAR-PLANOS.md` e arquivos de migrations.

### Stripe — checkout de planos

- O código versionado inclui a Edge Function `create-stripe-plan-checkout` e o webhook `stripe-revenue-webhook`; as versões registradas anteriormente no Supabase estavam ACTIVE.
- O checkout foi configurado para solicitar Pix e cartão em BRL. O webhook considera eventos de checkout concluído e pagamento assíncrono confirmado, necessários para o fluxo Pix.
- O proprietário informou em 25/10 que os testes do checkout estavam funcionando. Isso registra a confirmação do proprietário, não substitui a repetição independente de todos os cenários.
- **PR #1 — aberto, ainda não mesclado:** [Segurar checkout Stripe em modo de teste com preço temporário de R$ 1](https://github.com/NANDOBRTV/Conversor-de-moedas/pull/1), branch `audit/stripe-checkout-safety`, commit `116646dfa7db3d3a9dd80cd3379321faad69f7ad`.
- O PR #1 limita o checkout à chave `sk_test_`, identifica os produtos como TESTE e define temporariamente Ouro e Diamante em R$ 1,00. **Essas alterações não estão aplicadas ao site nem implantadas no Supabase por meio desse PR.** O preço de R$ 1 é somente para teste e não pode ser usado em produção. Antes de produção, restaurar os preços comerciais e fazer revisão separada com chaves live.
- Antes de considerar o fluxo pronto para produção, testar cartão e Pix, confirmação assíncrona, assinatura válida/inválida, evento duplicado, cancelamento, pagamento incompleto, valor/plano divergente e liberação correta do acesso.

### Interface futurista Sanba

- **PR #2 — aberto, ainda não mesclado:** [Aplicar interface futurista Sanba ao conversor e painel](https://github.com/NANDOBRTV/Conversor-de-moedas/pull/2), branch `ui/futuristic-sanba-refresh`, head `4ba587e6f9aa8aa5999368acef1dcb2b04837c25`.
- O PR adiciona CSS ao final dos estilos de `index.html` e `revendedor.html`: fundo escuro azul-marinho, acentos ciano/violeta, cartões com aparência glass, campos mais legíveis, foco visível, ajustes para telas pequenas e respeito a `prefers-reduced-motion`.
- A mudança foi limitada à camada visual, preservando a lógica JavaScript, IDs, formulários, cálculos, autenticação, permissões, CSP e carregador externo do painel.
- A validação feita até agora é estática. Ainda falta revisão visual em dispositivos/navegadores reais e teste funcional depois de mesclar/publicar. Não afirmar que o novo visual já está no site publicado enquanto o PR estiver aberto.

### Proteção contra senhas comprometidas — alternativa gratuita em avaliação

- No painel do Supabase, a opção **“Prevent use of leaked passwords”** informa que exige plano Pro ou superior; portanto, não foi possível habilitar a proteção nativa no plano atual.
- Alternativa proposta para desenvolvimento: integrar a API gratuita **Pwned Passwords** do Have I Been Pwned ao fluxo de cadastro e de alteração de senha. A integração **ainda não foi implementada** e não ativa a opção nativa do Supabase.
- A implementação deve verificar a senha de forma cuidadosa, usando o modelo de consulta por prefixo/hash (k-anonymity), sem enviar a senha em texto puro nem registrar senhas nos logs. A checagem deve ocorrer num fluxo controlado pelo servidor e falhar de forma segura se o serviço estiver indisponível, sem bloquear indefinidamente cadastro/alteração de senha.
- É necessário verificar como impedir que o fluxo de autenticação seja contornado por chamadas diretas ao Supabase Auth. Se a verificação não puder ser garantida para todos os caminhos de cadastro e alteração, documentar claramente a limitação em vez de anunciar proteção equivalente à nativa.
- Enquanto isso, manter CAPTCHA ativado, impor senha mínima adequada e orientar o uso de senhas únicas e fortes. Essas medidas são complementares e não substituem uma verificação de senhas vazadas.

### Próximas etapas — ordem recomendada

1. Revisar e mesclar o PR #2 da interface após verificar conflitos e revisar o diff; em seguida, conferir a publicação e testar visualmente celular e computador.
2. Revisar o PR #1 separadamente; manter o preço de R$ 1 e a chave `sk_test_` estritamente no ambiente de teste. Não mesclar/implantar uma configuração de teste como produção.
3. Implementar e revisar a alternativa gratuita de verificação de senhas comprometidas, incluindo cadastro, alteração de senha, tratamento de falhas e proteção contra bypass; só então executar testes com conta de teste.
4. Realizar teste ponta a ponta do cadastro/login, aprovação manual de revendedor, permissões dos quatro níveis, área do cliente, criação de pedido e histórico/status.
5. Executar novamente a bateria de testes Stripe de cartão e Pix e confirmar os webhooks, incluindo pagamento Pix assíncrono e eventos duplicados.
6. Revisar avisos do Supabase/RLS sem criar políticas públicas indiscriminadamente; confirmar que tabelas internas continuam acessíveis somente pelos caminhos autorizados.
7. Confirmar o comportamento real da publicação GitHub Pages e do Supabase após cada mudança. Separar sempre o que está no código, o que foi mesclado, o que foi implantado e o que foi testado.
8. Antes de produção: restaurar preços comerciais, revisar chaves e webhook live, verificar segredos, permissões, logs e cenários de falha. Nenhuma chave privada, `service_role` ou segredo de webhook deve ir para o front-end ou para o repositório público.

### Critério de conclusão

O projeto só deve ser marcado como pronto para produção depois que os PRs relevantes forem revisados/mesclados, as mudanças necessárias forem implantadas no ambiente correto, os testes autenticados e de pagamento forem concluídos, e os avisos de segurança tiverem uma decisão documentada. Até lá, itens acima permanecem em desenvolvimento ou validação, conforme indicado.


---

## Atualização de navegação e layout — 26/10/2026

### Alterações concluídas
- Restaurado o comportamento visual original de seis páginas ao remover a referência à folha compartilhada `sanba-theme.css`, que estava interferindo nos estilos próprios dessas páginas:
  - `kit-divulgacao-online.html`
  - `kit-divulgacao.html`
  - `novas-receitas.html`
  - `pedidos-revendedores.html`
  - `planilha-lucro.html`
  - `revendedor.html`
- Os estilos próprios e as referências de favicon existentes foram preservados.
- Adicionado à `cliente.html` um link para **Kit de Divulgação Online**, que existia no repositório mas não estava ligado à navegação identificada.
- Revisadas 13 páginas HTML e 103 referências locais de `href`/`src`: não foram encontrados caminhos locais ausentes na verificação estática.
- Os commits das correções foram enviados à branch principal; a última alteração registrada nesta sequência foi `cae087b44c176ea71e3ee95b7ae33654a31ccb41`.

### Limites da verificação
- A verificação de caminhos e referências foi estática. Ainda não foi concluído um teste visual página por página em celular e computador.
- A existência de links locais válidos não garante que todos os botões, formulários, autenticação, permissões ou chamadas ao Supabase estejam funcionando em tempo real.
- A página principal `index.html` não foi modificada nesta correção.

### Próximas atualizações — ordem recomendada
1. **Teste visual das páginas restauradas:** abrir as seis páginas em celular e computador, verificar responsividade, cores, espaçamento, navegação e eventuais estilos quebrados.
2. **Teste de navegação completa:** percorrer os links entre Área do Cliente, Kit de Divulgação Online, kit tradicional, calculadora, planilha de lucro, pedidos, convites, aprovações e painel do revendedor; identificar páginas que ainda não têm entrada clara no fluxo.
3. **Teste funcional com conta de teste:** verificar login, sessão, permissões por nível, aprovação manual, criação/visualização de pedidos e tratamento de erros sem expor credenciais.
4. **Revisão de interface Sanba:** revisar separadamente o PR #2 da interface futurista; não declarar essa camada visual publicada até confirmar merge e publicação.
5. **Checkout Stripe:** manter o modo de teste e o preço temporário de R$ 1 restritos ao ambiente de testes; confirmar Pix/cartão, webhooks e liberação do plano antes de qualquer decisão de produção.
6. **Segurança e Supabase:** avaliar a proteção contra senhas comprometidas e os avisos de RLS com cuidado, sem criar políticas públicas indiscriminadas.
7. **Atualizar este relatório a cada lote de alterações**, registrando data, arquivos modificados, commits, testes realmente executados e pendências restantes.

### Estado resumido em 26/10/2026
- **Concluído:** restauração dos estilos originais das seis páginas e inclusão do link do Kit de Divulgação Online na Área do Cliente.
- **Verificado estaticamente:** 13 páginas e 103 referências locais, sem caminhos locais ausentes na checagem.
- **Pendente:** teste visual em dispositivos, validação dos fluxos interativos e confirmação ponta a ponta das funções autenticadas.
- **Regra de trabalho:** distinguir sempre alterações no código, commits enviados, publicação do site, implantação de funções e testes práticos; não marcar uma etapa como concluída sem evidência correspondente.


---

## Bateria de testes do conversor — 26/10/2026

### Verificações realizadas nesta etapa
Foi feita uma revisão direta do código atual de `index.html`, incluindo as rotinas `num`, `arredondarParaCima`, `calcC`, `calcR`, `isIdValid` e `wpp`. Também foram calculados casos de referência usando as tarifas atualmente declaradas no código. **Isto é uma verificação de código e de cálculos; não equivale a executar o site em um Android físico ou em um navegador desktop.**

### Casos de cálculo conferidos por referência
Tarifas atualmente codificadas: 1.500 moedas = R$ 6,00; US$ 0,99; ou Bs 1.450,00. O mínimo é 1.000 moedas.

| Caso | Resultado esperado pelo código | Avaliação |
|---|---:|---|
| 1.500 moedas em BRL | R$ 6,00 | Coerente com a tarifa configurada |
| 1.500 moedas em USD | US$ 0,99 | Coerente com a tarifa configurada |
| 1.500 moedas em VES | Bs 1.450,00 | Coerente com a tarifa configurada |
| Mínimo de 1.000 moedas em BRL | R$ 4,00 | Coerente com arredondamento monetário |
| Mínimo de 1.000 moedas em USD | US$ 0,66 | Coerente com arredondamento monetário |
| Mínimo de 1.000 moedas em VES | Bs 966,67 | Arredondado para cima a duas casas |
| ID com 7 dígitos | Não libera o link de compra | Validação prevista no código |
| ID com 8 dígitos não zerados | Aceito quanto ao formato | Não comprova que o ID exista no Sanba |
| ID `00000000` | Rejeitado | Validação prevista no código |
| Quantidade inferior a 1.000 | Mostra aviso de mínimo | Validação prevista no código |
| Quantidade fracionária | Mostra aviso de quantidade inteira | A entrada também é sanitizada para dígitos |
| Link de WhatsApp | Montado com `https://wa.me/` e texto codificado | Construção conferida no código; não foi aberta uma conversa real |

### Itens que ainda exigem teste real no navegador
- [ ] Android físico, preferencialmente Chrome: layout, teclado numérico, troca de moeda, cálculo, copiar resumo e abertura do WhatsApp.
- [ ] Desktop: Chrome/Edge/Firefox, larguras diferentes, abas de cálculo, formatação e links.
- [ ] Abrir cada link `wa.me` com um ID de teste válido e conferir destinatário, texto, moeda, quantidade e valor, sem enviar mensagem nem efetuar pagamento.
- [ ] Testar mudança de moeda durante um cálculo e confirmar que os valores e o texto do WhatsApp são atualizados.
- [ ] Testar orçamento abaixo do mínimo, campos vazios, pontuação decimal e separadores brasileiros (`1.234,56`).
- [ ] Confirmar em ambiente real a disponibilidade dos recursos externos e a publicação atual do GitHub Pages.

### Limitação operacional registrada
Nesta sessão não havia um navegador conectado com capacidade de navegar/interagir nem acesso de rede para abrir a publicação. Por isso, não afirmo que os testes físicos Android/desktop, a abertura externa do WhatsApp ou a publicação ao vivo tenham sido concluídos. Nenhuma compra, mensagem ou pagamento real foi iniciado.

### Próxima ação
Executar a matriz pendente em dispositivos/navegadores reais e registrar evidências e resultados antes de declarar o conversor concluído. Os preços são referências configuradas no código, não uma cotação cambial ao vivo; devem ser confirmados pelo operador antes do pagamento.


---

## Atualização de validação numérica e testes automatizados — 26/10/2026

### Alterações feitas
- Atualizada a função `num()` em `index.html` para validar melhor números com separadores brasileiros e rejeitar formatos malformados, como `1,2,3`, `12.34,56` e `1.234.56`, em vez de interpretá-los parcialmente.
- Atualizado o cálculo **Valor → Moedas** para exibir uma mensagem explícita quando a entrada não for um número válido ou quando o valor for zero/negativo.
- Criada a página `testes-conversor.html`, que carrega a página principal em um iframe e executa verificações contra as funções reais da aplicação: parsing numérico, preços configurados, arredondamento, validação de ID, cálculos nos dois sentidos e estrutura dos links de WhatsApp.
- A página de testes inspeciona os links sem clicar neles; não envia mensagens nem inicia pagamentos.

### Como executar
1. Abra https://nandobrtv.github.io/Conversor-de-moedas/testes-conversor.html
2. Aguarde o carregamento da página principal dentro do teste.
3. Confira a quantidade de testes aprovados e os casos individuais.
4. Repita no Chrome para Android e em um navegador desktop.
5. Se algum caso falhar, registre o nome do teste, o navegador e a mensagem apresentada antes de corrigir.

### Estado dos testes
- **Implementado no repositório:** parser mais rigoroso, validação explícita de valores inválidos e página de testes automatizados.
- **Ainda não executado por esta sessão:** a bateria dentro da página publicada, porque o acesso de navegação externa necessário para executar o JavaScript no site não estava disponível nesta sessão.
- **Ainda requer aparelho/navegador real:** visual responsivo, teclado, foco, rolagem, comportamento ao abrir WhatsApp, confirmação do número destinatário e comparação visual Android/desktop.
- Os testes automatizados conferem a construção dos links; não clicam neles e não provam que a conta WhatsApp está acessível ou que o número é o destinatário correto.

### Arquivos
- `index.html`: validação numérica e mensagens de erro.
- `testes-conversor.html`: testes de regressão que podem ser executados no navegador.
- Este relatório: registro das alterações e dos limites da validação.

### Critério para concluir esta etapa
Executar a página de testes publicada e obter aprovação em todos os casos, depois percorrer visualmente o conversor em Android e desktop e verificar manualmente os links de WhatsApp sem enviar mensagem. Não registrar como teste real aquilo que não foi executado.


---

## Seletor de idioma automático — 26/10/2026

### Alterações registradas
- Adicionado um seletor com ícone de globo no canto superior esquerdo da página principal.
- Idiomas disponíveis: Português, English e Español, além da opção Automático.
- Em Automático, o site usa o idioma preferido informado pelo navegador (navigator.language / navigator.languages): espanhol para navegadores em espanhol, inglês para navegadores em inglês e português como padrão para os demais.
- A escolha manual fica salva no armazenamento local deste navegador; o visitante pode voltar para Automático a qualquer momento.
- Incluídas traduções para os principais textos estáticos da calculadora, navegação, seleção de moeda, validações visíveis, ações de cálculo e avisos principais.
- O idioma declarado no documento (lang) é atualizado para apoiar acessibilidade e leitores de tela.

### Limites e testes pendentes
- A tradução implementada cobre os textos estáticos incluídos no dicionário da interface principal. Mensagens geradas dinamicamente por outras rotinas, conteúdos extensos dos relatórios e algumas informações auxiliares podem continuar no idioma original; a cobertura deve ser ampliada após revisão visual.
- A detecção usa o idioma configurado no navegador, não GPS nem localização física exata. Isso evita solicitar acesso à localização do visitante.
- Alteração gravada no index.html pelo commit a92f3c59f685036a53c7761803b6de16d56ca83e.
- Ainda falta abrir a publicação em navegador real, conferir a posição do seletor em Android e desktop, trocar manualmente entre os três idiomas e confirmar que a preferência persiste ao recarregar a página. Não registrar esses testes como concluídos até executá-los.


---

## Tradução compartilhada em todas as páginas — 26/10/2026

### Alterações registradas
- Criado o arquivo compartilhado `idiomas.js`, que exibe o seletor de idioma no canto superior esquerdo em todas as páginas HTML do repositório.
- Integrado o serviço Google Website Translator para traduzir a página completa, incluindo textos e conteúdos que não estavam no dicionário limitado da página principal.
- Aplicado o seletor a: `index.html`, `cliente.html`, `revendedor.html`, `admin-pedidos.html`, `aprovacoes-revendedores.html`, `desenvolvedor.html`, `convites-revendedores.html`, `calculadora-precos.html`, `kit-divulgacao.html`, `novas-receitas.html`, `pedidos-revendedores.html`, `planilha-lucro.html`, `kit-divulgacao-online.html` e `testes-conversor.html`.
- A escolha Português/English/Español ou Automático é compartilhada entre as páginas através de `localStorage` e do cookie de tradução. Em Automático, a língua preferida do navegador escolhe espanhol, inglês ou português como padrão.
- Ajustada a Content Security Policy nas páginas que a utilizam para permitir os recursos necessários do tradutor.

### Privacidade, dependências e limitações
- A tradução integral depende de um serviço externo do Google e de conexão com a internet. O conteúdo da página é processado pelo serviço de tradução; isso deve ser considerado antes de inserir informações pessoais ou privadas. Páginas autenticadas também recebem o seletor, mas não foram testadas com sessão de usuário.
- O serviço pode falhar por bloqueadores, restrições de rede ou mudanças do Google; nesses casos a página original continua disponível, mas pode não ser traduzida.
- Foi feita verificação estática de que as 14 páginas HTML carregam `idiomas.js` e que o seletor antigo exclusivo da página principal foi removido. Ainda falta testar a tradução real, a persistência e a navegação entre páginas em navegador Android e desktop; não registrar esses testes como concluídos até executá-los.
- Arquivo compartilhado criado no commit `98c061361c9f43a12532346682ef99ba9dd7b316`.
