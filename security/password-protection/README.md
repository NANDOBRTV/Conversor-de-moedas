# Conversor Sanba Protection API

Serviço auxiliar para verificar se uma senha apareceu em vazamentos conhecidos usando a API Pwned Passwords do Have I Been Pwned.

## Endpoints
- `GET /health`: estado do serviço.
- `POST /v1/password-check`: recebe JSON `{"sha1":"..." }` e responde `{"ok":true,"compromised":true|false,"occurrences":N}`.

## Privacidade e limites
- A senha completa não é enviada ao Have I Been Pwned. O serviço calcula SHA-1 localmente e envia apenas os primeiros cinco caracteres do hash (modelo k-anonymity).
- Não grava senhas nem hashes em logs.
- Limita o tamanho da requisição e aplica rate limit simples por IP.
- CORS é restrito às origens configuradas em `server.js`. CORS não é autenticação e não impede chamadas feitas por scripts fora do navegador.
- Rate limit em memória é básico e reinicia ao reiniciar a instância; não substitui um limitador compartilhado.
- A indisponibilidade do HIBP retorna erro temporário, não uma resposta dizendo que a senha é segura.

## Importante
Este serviço é apenas um componente auxiliar. **Ele ainda não está conectado ao fluxo de cadastro/alteração de senha do Supabase**, portanto sua implantação isolada não impede que um usuário cadastre uma senha comprometida por outros caminhos. A integração de autenticação e os testes ponta a ponta são etapas separadas antes de anunciar essa proteção como ativa.

## Render
Runtime Node, build command `npm install`, start command `npm start`, plano Free. O Render fornece a variável `PORT`.


## Privacidade da verificação

O navegador calcula o resumo SHA-1 da senha localmente e envia somente o resumo hexadecimal de 40 caracteres ao serviço. O serviço não recebe a senha em texto puro; consulta o Have I Been Pwned enviando somente os primeiros cinco caracteres do resumo (modelo de k-anonymity). Não registre o resumo nem a senha em logs.
