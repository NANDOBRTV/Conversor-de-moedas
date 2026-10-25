# Administração dos planos do Painel Sanba

Este documento descreve os níveis e o fluxo atual. **Não coloque chaves secretas no navegador, no GitHub ou em mensagens.**

## Categorias e benefícios

- **Comum:** conta básica; não inclui as ferramentas Premium.
- **Ouro — R$ 9,90 por 30 dias:** calculadora de revenda e histórico local de cálculos.
- **Diamante — R$ 49,90 em pagamento único:** recursos do Ouro, além de copiar resultados, exportar CSV e relatórios adicionais.
- **Desenvolvedor:** conta administrativa do proprietário; não precisa comprar plano.

## Como funciona a compra

O checkout de Ouro e Diamante está integrado ao Stripe em **modo de teste**. A função de servidor solicita Pix e cartão, mas o Pix só aparece se a conta Stripe estiver elegível e com esse meio habilitado. O acesso é liberado pelo webhook validado no servidor depois da confirmação do pagamento, nunca apenas pela página de retorno.

Consulte o documento STRIPE-PIX-CARTAO.md nesta pasta para configurar secrets, validar o webhook e executar testes. A função de checkout exige uma chave sk_test_; não altere essa proteção para usar vendas reais antes de concluir os testes.

As recargas Sanba e os pedidos de serviços adicionais continuam com atendimento manual pelo WhatsApp. Não marque pedidos como pagos sem verificar o recebimento real.

## Ativação administrativa excepcional

Use ativação manual somente para corrigir uma conta após verificar a situação. Substitua usuario_exato pelo nome de usuário real e confira o resultado.

### Ativar Ouro por 30 dias

~~~sql
update public.reseller_profiles
set membership_tier = 'gold',
    plan_name = 'Ouro',
    access_status = 'active',
    access_until = now() + interval '30 days'
where username = lower('usuario_exato');
~~~

### Ativar Diamante sem vencimento automático

~~~sql
update public.reseller_profiles
set membership_tier = 'diamond',
    plan_name = 'Diamante',
    access_status = 'active',
    access_until = null
where username = lower('usuario_exato');
~~~

### Voltar uma conta para Comum

Execute somente quando for necessário remover o acesso Premium e depois de conferir os pedidos relacionados.

~~~sql
update public.reseller_profiles
set membership_tier = 'common',
    plan_name = 'Comum',
    access_status = 'active',
    access_until = null
where username = lower('usuario_exato');
~~~

## Conferir uma conta

~~~sql
select username, email, membership_tier, plan_name, access_status, access_until
from public.reseller_profiles
where username = lower('usuario_exato');
~~~

Não use estas instruções para simular pagamento. Elas não criam nem confirmam uma transação Stripe.
