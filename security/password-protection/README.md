# Conversor Sanba — verificação de senha comprometida

Este serviço **não recebe senhas em texto claro nem o hash SHA-1 completo**.
A página calcula SHA-1 localmente e envia somente os cinco primeiros caracteres
hexadecimais no campo `sha1_prefix`. O serviço consulta o Have I Been Pwned
com esse prefixo e retorna apenas os sufixos de hashes comprometidos.
A comparação do sufixo (35 caracteres) ocorre **no navegador**.

## API

- `GET /health`: saúde do processo (não garante acesso ao HIBP).
- `POST /v1/password-check`: JSON `{"sha1_prefix":"ABCDE"}`.
- Resposta: `{"ok":true,"suffixes":["..."]}`; cada sufixo tem 35 caracteres hexadecimais.
- Entrada sem prefixo válido: HTTP 400.
- Rate limit por IP + limite global; em caso de sobrecarga: HTTP 429.
- HIBP indisponível: HTTP 503. O cliente deve falhar fechado.
- CORS limitado à origem do site; **CORS não autentica clientes**.

## Dependências e limitações

O endereço do serviço precisa ser o mesmo configurado em `cliente-app.js` e
`revendedor-app.js`. Atualize o serviço e os dois clientes de forma coordenada:
o protocolo antigo não é compatível.

**Importante:** a validação no JavaScript público pode ser ignorada por chamadas
diretas ao Supabase Auth. Para proteção obrigatória, habilite o controle
nativo de senhas comprometidas no Supabase, quando disponível, ou use uma política
servidora equivalente que cubra TODAS as rotas de cadastro e troca de senha.
Não afirme que a verificação é obrigatória enquanto isso não estiver comprovado.

Não registrar cabeçalhos ou corpos de requisição. Use HTTPS, proteção de proxy,
limites do provedor e monitoramento de erros. O armazenamento de contadores em
memória é uma proteção complementar, não distribuída.
