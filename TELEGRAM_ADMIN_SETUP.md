# RUBWAY Telegram Admin Setup

The bot now supports:

- Full Russian recipient details in every new transfer message.
- Confirm EGP payment from Telegram.
- Reject a transfer from Telegram.
- Mark RUB as sent.
- Complete a transfer.
- View the latest 10 transfers.
- List payment accounts.
- Activate/deactivate payment accounts.
- View daily/monthly account usage.

## Required backend environment values

```env
TELEGRAM_BOT_TOKEN=your_existing_bot_token
TELEGRAM_CHAT_ID=your_admin_chat_id
TELEGRAM_WEBHOOK_SECRET=choose-a-long-random-secret
BACKEND_PUBLIC_URL=https://your-render-backend.onrender.com
FRONTEND_URL=https://your-vercel-site.vercel.app
```

## Local testing note

Telegram cannot call `127.0.0.1`. The webhook buttons work after the backend has a public HTTPS URL (Render), or while testing through an HTTPS tunnel.

## Set the webhook after deployment

Open this URL in a browser after replacing the values:

```text
https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=https://<BACKEND_DOMAIN>/api/v1/telegram/webhook&secret_token=<TELEGRAM_WEBHOOK_SECRET>
```

Expected response:

```json
{"ok":true,"result":true,"description":"Webhook was set"}
```

Then send `/start` to the existing bot.
