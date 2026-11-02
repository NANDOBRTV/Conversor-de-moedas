# Revisão de branches e conflitos — 01/11/2026

**Repositório:** `NANDOBRTV/Conversor-de-moedas`  
**Branch principal auditada:** `main`  
**Commit principal consultado:** `b2facbc6f68ce09e1bc16d02b95beb072cbea1f2`

## Resultado executivo

Foram comparadas 14 branches com a `main`. Todas estão divergentes e atrás da principal (entre 2 e 129 commits). Divergência Git não significa, por si só, conflito textual ou falha de código.

A inspeção dos arquivos alterados mostrou que os recursos das branches abaixo já estão presentes na `main`, em versões idênticas ou mais recentes. Não fazer merge dessas branches antigas: isso poderia reintroduzir implementações ultrapassadas ou sobrescrever correções posteriores.

## Inventário

| Branch | Ahead / behind | Resultado da revisão |
|---|---:|---|
| `audit/stripe-checkout-safety` | 1 / 129 | Não integrar automaticamente: contém configuração de teste com preço temporário de R$ 1. PR #1 permanece aberto para decisão/teste específico. |
| `feat/prototipo-sanba-2` | 32 / 23 | Protótipo, tema, cotações e testes já existem na `main`; versões centrais do tema/protótipo foram atualizadas depois. |
| `feature/calculadora-precos-sanba` | 5 / 116 | Página, Edge Functions e migration já existem na `main`; checkout/webhook e migration comparados estão idênticos; HTML principal está mais atualizado. |
| `fix/automatic-product-delivery` | 3 / 114 | `verify-product-payment/index.ts` já existe e está idêntico na `main`. |
| `fix/contrast-text-all-pages` | 1 / 22 | CSS do tema já está na `main`; não substituir a versão atual pela branch antiga. |
| `improve/quality-docs-and-ci` | 9 / 24 | Workflow, package.json, histórico, script de checagem e teste de qualidade já existem e foram comparados como idênticos na `main`. |
| `maintenance/qa-navigation-and-index-20261101` | 3 / 2 | Relatório, migration de índice e teste de navegação/idioma já existem na `main`; migration e teste comparados como idênticos. |
| `products/automatic-kit-delivery` | 8 / 119 | Edge Function e migration já existem na `main`; migration idêntica e função atualizada na principal. |
| `products/kit-divulgacao` | 2 / 120 | Página do kit já existe na `main`, em versão diferente/mais recente. |
| `products/planilha-lucro` | 5 / 122 | Página, checkout e migration já existem na `main`; migration idêntica e checkout já sincronizado. |
| `security/password-check-integration` | 6 / 128 | Código de integração e serviço auxiliar já estão na `main`; não reaplicar arquivos antigos. |
| `security/render-password-protection` | 5 / 128 | Serviço auxiliar já está na `main`; versões atuais diferem das antigas. |
| `security/whatsapp-intrusion-alerts` | 5 / 123 | Servidor de monitoramento e função de login comparados como idênticos na `main`. |
| `ui/futuristic-sanba-refresh` | 2 / 129 | Alterações visuais antigas já foram substituídas pelo tema compartilhado atual na `main`. |

## Ações e decisões de segurança

1. Não foram mescladas branches antigas nem apagadas branches remotas; isso preserva histórico e permite recuperação.
2. PR #2 (interface antiga) e PR #3 (serviço auxiliar antigo) foram encerradas sem merge na revisão anterior, pois suas mudanças já estavam substituídas na `main`.
3. PR #1 continua aberta. O patch contém preços temporários de teste e deve permanecer isolado: não misturar preço de R$ 1 com credenciais live nem implantar sem validação explícita.
4. Não foram executados pagamentos, alterações de secrets, migrations no banco ou deploys nesta revisão.
5. A divergência entre código versionado do checkout Stripe e a configuração implantada no Supabase permanece como pendência operacional prioritária. Não foi possível confirmar o valor do secret nem alterar a função implantada com segurança nesta auditoria.
6. A proteção nativa contra senhas vazadas do Supabase Auth e os testes ponta a ponta de autenticação continuam exigindo validação separada.

## Testes e limitações

- Comparação de branches e inspeção de arquivos via GitHub concluídas.
- Não foi possível executar localmente a suíte nesta sessão: o ambiente não conseguiu resolver/acessar `github.com` para clonar o repositório.
- A consulta de status/checks para o commit auditado não retornou status nem execuções associadas; portanto, não se declara CI verde com base nesta revisão.
- Não foram feitos testes de navegador, pagamentos reais, autenticação com credenciais do proprietário ou implantação no Supabase.

## Conclusão

Não foi identificado motivo seguro para mesclar as 14 branches antigas: os arquivos funcionais relevantes já estão presentes na `main`, frequentemente em versões posteriores. O conflito operacional prioritário a resolver é a divergência de configuração Stripe entre repositório e Supabase, que requer uma janela de testes em ambiente Stripe de teste e verificação do ambiente implantado antes de qualquer alteração.
