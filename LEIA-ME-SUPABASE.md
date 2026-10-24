# Configurar o login seguro do Painel do Revendedor Sanba

A interface e os arquivos de integração foram preparados, mas o login só funcionará depois de configurar um projeto Supabase. O GitHub Pages sozinho não autentica usuários.

## 1. Criar o projeto Supabase

1. Crie um projeto em https://supabase.com/.
2. No painel do projeto, copie a **Project URL** e a chave pública **anon/publishable**.
3. Abra o arquivo `supabase-config.js` neste repositório e substitua os dois valores de exemplo:
   - `url`: Project URL do Supabase.
   - `anonKey`: chave pública anon/publishable.
4. Nunca coloque a chave `service_role` nesse arquivo, no HTML, no GitHub ou em qualquer código do navegador.

## 2. Criar a tabela de perfis e o cadastro automático

No painel Supabase, abra **SQL Editor**, cole o conteúdo atualizado de `supabase/schema.sql` e execute. Isso cria/atualiza a tabela de perfis e um gatilho que cria o perfil como `pending` quando alguém se cadastra no site.

O cadastro pelo painel pede e-mail, nome de usuário e senha. A senha é gerenciada pelo Supabase Auth; este projeto não armazena senhas em texto puro. Se a confirmação de e-mail estiver ativada no Supabase, a pessoa precisará confirmar o endereço antes de entrar.

## 3. Publicar a função de login

A função está em `supabase/functions/login-by-username/index.ts`. Com o Supabase CLI instalado e autenticado, na pasta do repositório execute:

```sh
supabase login
supabase link --project-ref SEU_PROJECT_REF
supabase functions deploy login-by-username
```

A função usa as variáveis de ambiente do projeto Supabase:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Confirme no painel de Edge Functions/Secrets que estão disponíveis. A chave `service_role` deve permanecer apenas no ambiente do servidor. Se precisar cadastrá-la como secret, faça isso no painel Supabase, nunca no GitHub.

## 4. Como o cadastro e a compra funcionam

1. O cliente cria a conta na página do painel usando e-mail, nome de usuário e senha.
2. O perfil é criado automaticamente com acesso `pending`.
3. Depois de entrar, o cliente solicita um dos planos pelos botões dentro da conta. O WhatsApp abre com o nome de usuário e o e-mail para você identificar a conta.
4. Você confirma o recebimento do pagamento e ativa o perfil manualmente no SQL Editor.

O nome de usuário deve ter de 3 a 30 caracteres, ser escrito em letras minúsculas e usar letras, números, ponto, hífen ou sublinhado. O login converte o que for digitado para minúsculas.

## 5. Liberar o Premium após confirmar pagamento

Como os pagamentos serão confirmados manualmente, mantenha a conta como `pending` enquanto o pagamento não for confirmado. Depois de verificar o recebimento, um administrador pode ativar o acesso no SQL Editor:

```sql
-- Pagamento único: sem data de vencimento
update public.reseller_profiles
set access_status = 'active',
    plan_name = 'pagamento_unico',
    access_until = null
where lower(email) = lower('EMAIL_DO_CLIENTE');

-- Plano mensal: defina vencimento para 30 dias após a confirmação
update public.reseller_profiles
set access_status = 'active',
    plan_name = 'mensal',
    access_until = now() + interval '30 days'
where lower(email) = lower('EMAIL_DO_CLIENTE');
```

Para suspender o acesso, use `access_status = 'suspended'`. Para renovar um plano mensal, atualize `access_until = now() + interval '30 days'` após confirmar o pagamento. Não libere acesso apenas com base em uma mensagem ou comprovante sem verificar o pagamento.

## 6. Verificar

1. Aguarde a publicação do GitHub Pages.
2. Abra https://nandobrtv.github.io/Conversor-de-moedas/revendedor.html.
3. Entre com o nome de usuário cadastrado e a senha criada no Supabase.
4. Uma conta `pending` consegue autenticar, mas verá aviso de acesso pendente. Uma conta `active` e não expirada verá as ferramentas planejadas.

## Limites importantes

- O formulário e a função de login foram integrados no código, mas não podem ser considerados operacionais até que você crie/configure o projeto Supabase e publique a Edge Function.
- O estado Premium é consultado com Row Level Security, mas esconder elementos no navegador não protege sozinho funcionalidades futuras. Qualquer cálculo, dado ou operação realmente exclusiva deve validar o acesso também no servidor antes de disponibilizar o recurso.
- Não compartilhe chaves secretas, senhas administrativas ou credenciais do Supabase no chat nem em repositórios públicos.
- A função limita a origem ao site GitHub Pages deste projeto. Se mudar o domínio, atualize a configuração CORS no arquivo da função.
