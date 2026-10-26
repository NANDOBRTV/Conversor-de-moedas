# Assistente de Segurança Sanba — alertas por WhatsApp

Este serviço envia alertas de segurança ao administrador por meio da WhatsApp Cloud API. Ele não consulta logs sozinho: uma fonte confiável do servidor (por exemplo, a Edge Function de login) deve enviar eventos ao endpoint protegido.

## Variáveis de ambiente no Render

Configure em **Render → serviço → Environment**. Nunca coloque esses valores no frontend, no GitHub ou em mensagens:

- `SECURITY_ALERT_WEBHOOK_SECRET`: segredo aleatório de pelo menos 32 caracteres, compartilhado apenas com a função emissora.
- `WHATSAPP_ACCESS_TOKEN`: token da Meta WhatsApp Cloud API.
- `WHATSAPP_PHONE_NUMBER_ID`: ID do número de WhatsApp Business na Meta.
- `SECURITY_ALERT_RECIPIENT`: número de destino em formato internacional, apenas dígitos (ex.: código do país + DDD + número).
- `WHATSAPP_SECURITY_TEMPLATE`: nome de um modelo de mensagem aprovado pela Meta (padrão `sanba_security_alert`).
- `WHATSAPP_TEMPLATE_LANGUAGE`: idioma aprovado do modelo (padrão `pt_BR`).

O modelo aprovado deve conter quatro variáveis no corpo, nesta ordem:
1. Gravidade
2. Tipo de atividade suspeita
3. Quantidade de tentativas/eventos
4. Data e hora UTC

A Meta pode recusar mensagens proativas sem um modelo aprovado. Não use uma mensagem livre como substituto em produção.

## Endpoint

- `GET /health`: informa se as variáveis obrigatórias estão presentes; não revela seus valores.
- `POST /v1/security-event`: exige `Authorization: Bearer <SECURITY_ALERT_WEBHOOK_SECRET>`.

Corpo permitido (sem senha, e-mail, telefone do cliente, IP ou conteúdo de requisição):
```json
{
  "type": "failed_login_burst",
  "severity": "high",
  "count": 8,
  "occurredAt": "2026-10-26T17:00:00Z"
}
```

Tipos aceitos: `failed_login_burst`, `auth_rate_limit`, `unauthorized_access`, `suspicious_api`.

## Limites e observações

- CORS não é autenticação; este endpoint usa segredo de servidor e comparação em tempo constante.
- A limitação e a deduplicação em memória são defesas básicas e reiniciam com o serviço. Para produção com volume, use armazenamento compartilhado e uma fila.
- O endpoint não bloqueia invasores; alerta é complementar a rate limiting, RLS, autenticação e monitoramento do Supabase.
- Antes de ativar alertas reais, conecte uma fonte de eventos confiável e configure os segredos no Render e na Edge Function. Sem essas configurações, nenhum alerta de WhatsApp é enviado.
