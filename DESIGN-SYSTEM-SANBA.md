# Design System — Conversor Sanba

Documento de referência visual e funcional para manter o site consistente entre a página principal, o painel do revendedor e os materiais do Canva.

## Direção visual
- **Personalidade:** fintech simples, segura, acessível e brasileira.
- **Prioridade:** celular primeiro; botões e campos fáceis de tocar.
- **Tom de voz:** direto, transparente e sem prometer recursos que ainda não estejam ativos.
- **Estilo:** cartões com cantos arredondados, sombras discretas, hierarquia clara e animações sutis.

## Paleta
| Token | Cor | Uso |
|---|---|---|
| Azul-marinho | `#0F172A` | cabeçalhos, texto forte e áreas de destaque |
| Verde-petróleo | `#0F766E` | ação principal e links de ação |
| Verde escuro | `#115E59` | hover e variações de ação |
| Verde menta | `#CCFBF1` | fundos de apoio e estados positivos |
| Fundo claro | `#F4F7FB` | fundo geral |
| Branco | `#FFFFFF` | cartões e campos |
| Texto secundário | `#63748A` | instruções e metadados |
| Erro | `#9F1239` | erros e alertas que exigem atenção |

## Componentes
- **Botão primário:** verde-petróleo, texto branco, rótulo com verbo e ação clara.
- **Botão secundário:** branco com borda suave.
- **Cartão:** fundo branco, borda cinza clara, raio entre 15 e 20 px.
- **Campo:** rótulo acima do campo, foco visível e mensagem de erro próxima.
- **Resultado de cálculo:** valor principal em destaque; indicar moeda, premissas e que é uma estimativa.
- **Status:** usar texto além de cor/ícone para não depender só da cor.

## Regras de experiência
1. Não mostrar botão sem ação funcional.
2. Sempre explicar quando um preço é estimado e precisa de confirmação manual.
3. No celular, usar uma coluna quando duas colunas comprimirem os campos.
4. Não afirmar que pagamento foi aprovado até a confirmação pelo servidor/webhook.
5. Nunca colocar chaves privadas, tokens secretos ou dados sensíveis no front-end.
6. Manter foco de teclado visível e respeitar `prefers-reduced-motion`.
7. Preservar o fluxo de atendimento manual pelo WhatsApp enquanto o pagamento automático não estiver testado.

## Próximas melhorias de produto
- Testar a calculadora com moedas, valores mínimos, números grandes e entrada inválida.
- Confirmar se o histórico de cálculos está identificado corretamente como armazenamento local.
- Fazer testes ponta a ponta do cadastro, login, expiração de sessão e saída.
- Configurar os segredos do Mercado Pago no Supabase e validar pagamento de teste e webhook antes de anunciar a compra como automática.
- Revisar acessibilidade, links, estados de carregamento e mensagens de erro.
- A página principal `index.html` exige autorização explícita antes de qualquer alteração.
