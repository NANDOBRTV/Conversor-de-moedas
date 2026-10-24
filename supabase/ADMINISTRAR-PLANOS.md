# Administração dos planos do Painel Sanba

Este procedimento é para o proprietário do projeto, dentro do SQL Editor do Supabase. **Nunca coloque uma chave service_role no navegador ou no GitHub.**

## Categorias e benefícios

- **Comum:** cadastro gratuito, sem ferramentas Premium. Só esta categoria vê as opções de compra.
- **Ouro — R$ 9,90/mês:** acesso à calculadora de revenda e ao histórico de cálculos salvos.
- **Diamante — R$ 49,90, pagamento único:** inclui os recursos do Ouro, além de copiar resultados e exportar cálculos em CSV.

Os pedidos continuam sendo combinados manualmente pelo WhatsApp. Confirme o pagamento antes de executar uma ativação.

## Ativar Ouro por um mês

Substitua `usuario_exato` pelo nome de usuário cadastrado e execute no SQL Editor:

```sql
update public.reseller_profiles
set membership_tier = 'gold',
    plan_name = 'Ouro',
    access_status = 'active',
    access_until = now() + interval '1 month'
where username = lower('usuario_exato');
```

## Ativar Diamante sem vencimento automático

Substitua `usuario_exato` pelo nome de usuário cadastrado:

```sql
update public.reseller_profiles
set membership_tier = 'diamond',
    plan_name = 'Diamante',
    access_status = 'active',
    access_until = null
where username = lower('usuario_exato');
```

## Voltar uma conta para Comum

Use somente se for necessário remover o acesso Premium:

```sql
update public.reseller_profiles
set membership_tier = 'common',
    plan_name = 'Comum',
    access_status = 'pending',
    access_until = null
where username = lower('usuario_exato');
```

## Conferir o resultado

```sql
select username, email, membership_tier, plan_name, access_status, access_until
from public.reseller_profiles
where username = lower('usuario_exato');
```

Se o comando não atualizar nenhuma linha, confira se o nome de usuário está correto. Essas instruções não criam pagamento automático nem confirmam uma compra por conta própria.
