# Conversor de Moedas Sanba

Aplicação web mobile-first para estimar recargas Sanba, consultar valores de referência e preparar pedidos que são finalizados manualmente pelo WhatsApp. O repositório também contém áreas de cliente/revendedor, funções Supabase e ferramentas operacionais.

> **Importante:** os valores exibidos são estimativas. Não representam cotação financeira oficial nem confirmam pagamento. A confirmação do pedido e do pagamento depende dos fluxos configurados no backend.

## Estrutura principal

| Caminho | Responsabilidade |
| --- | --- |
| `index.html` | Conversor principal, cálculo, validação do ID Sanba e preparação do pedido |
| `sanba-theme.css` | Estilos compartilhados do tema |
| `idiomas.js` | Seletor de idioma e integração de tradução |
| `supabase-config.js` | URL e chave pública de cliente do Supabase; nunca deve conter segredos |
| `cliente.html` | Área de cliente e acesso aos pedidos |
| `revendedor.html`, `revendedor-app.js`, `revendedor-loader.js` | Área e carregamento do painel de revendedor |
| `admin-pedidos.html`, `aprovacoes-revendedores.html`, `convites-revendedores.html` | Ferramentas administrativas e de operação |
| `supabase/schema.sql`, `supabase/migrations/` | Referência do esquema e alterações incrementais do banco |
| `supabase/functions/` | Edge Functions para pedidos, acesso, checkout e webhooks |
| `security/` | Serviços auxiliares de proteção e monitoramento |
| `testes-conversor.html` | Testes manuais/automatizados executados no navegador, sem realizar pagamentos |
| `tests/` | Verificações de qualidade executáveis no CI |

Os arquivos HTML são páginas estáticas; não mova páginas ou recursos sem atualizar os caminhos relativos e testar links entre elas.

## Executar localmente

1. Clone o repositório.
2. Sirva a pasta por um servidor HTTP local (por exemplo, `python -m http.server 8000`).
3. Abra `http://localhost:8000/`.
4. Para a validação de regressão no navegador, abra `/testes-conversor.html`.

Alguns fluxos dependem de configuração externa do Supabase e não funcionam sem um projeto válido. Não abra arquivos com `file://` para validar autenticação, módulos ou chamadas de API.

## Verificações automatizadas

Requer Node.js 20 ou superior.

```bash
npm test
npm run check:js
```

- `npm test` verifica invariantes importantes do HTML principal e de segurança.
- `npm run check:js` valida a sintaxe dos arquivos JavaScript do repositório.
- O workflow GitHub Actions executa as verificações em pull requests e atualizações de branches.

Essas verificações são uma rede de segurança, não substituem testes reais de autenticação, RLS, convites, pedidos, checkout e webhooks.

## Configuração e segurança

- Use somente a chave pública/publishable do Supabase no navegador.
- Nunca versione `SUPABASE_SERVICE_ROLE_KEY`, segredos de Stripe, segredos de webhook, tokens privados ou senhas.
- Configure segredos de produção no ambiente de execução/Secrets do provedor, nunca em HTML ou JavaScript público.
- Confirme políticas RLS e autorizações dentro das Edge Functions; esconder botões na interface não é controle de acesso.
- Não ative cobrança real até validar os valores, os modos de teste/produção, a assinatura dos webhooks, idempotência e o tratamento de pagamentos pendentes/falhos.
- O fluxo manual por WhatsApp não deve ser apresentado como pagamento automaticamente confirmado.

## Checklist antes de publicar

- [ ] CI verde e revisão do diff.
- [ ] Conversor testado em celular e desktop.
- [ ] Autenticação, recuperação de sessão e permissões RLS testadas com contas reais de teste.
- [ ] Pedidos duplicados e falhas de rede tratados.
- [ ] Webhooks testados com eventos repetidos, inválidos e fora de ordem.
- [ ] Variáveis e chaves conferidas para o ambiente correto.
- [ ] Migrações revisadas e aplicadas de forma controlada.
- [ ] Testes de regressão do navegador executados após publicar.

## Processo de contribuição

Faça alterações em uma branch, mantenha páginas e recursos nos caminhos atuais, rode os comandos de qualidade e abra um pull request. Mudanças em preços, autenticação, permissões, banco ou pagamentos precisam de revisão específica e teste no ambiente de homologação antes de produção.
