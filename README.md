# Sijil

Sijil (سجل) turns a customer conversation into an order the seller approves before it is saved.

The deployed app is at https://sijil-web.onrender.com.

Small shops take orders in chat and then lose the quantity, the district, or whether the customer has paid. Sijil keeps the catalog, the chat, and the order in one place. The seller decides what must be collected. The model reads the chat only when the seller presses Extract. Nothing is sent to the customer, and nothing is saved, until the seller presses the button.

## What a seller can do

- Create a shop, add products and prices, and choose which gaps to collect.
- Share a customer link. A message sent there appears in the inbox.
- Extract an order with Meta's Muse Spark (`muse-spark-1.3`). Catalog prices replace a missing or invented price. The total and the missing fields are computed in code.
- Copy a follow-up for the missing details and send it. A later reply can be extracted again.
- Approve the order. It is stored in Postgres with its own number. Payment and fulfillment are tracked separately.

The customer link is a real channel. It is not WhatsApp.

## WhatsApp

Sijil can receive a message on a Meta WhatsApp Cloud API test number and show it in the same inbox. A seller reply on that thread is sent through the Cloud API, then saved. This is a single test number configured with server environment variables. It is limited to approved test recipients.

Connecting a merchant's own WhatsApp Business number is not available. That needs Meta Tech Provider approval, or an approved provider, including Embedded Signup. Sijil does not sync WhatsApp history and does not use an unofficial WhatsApp Web session.

## Stack

- `apps/web` — Vite, React, TypeScript
- `apps/api` — Hono, Postgres
- `packages/shared` — order schema, catalog matching, and the seller's field choices

The API calls `https://api.meta.ai/v1` with the chat-completions endpoint and a JSON schema. Temperature is 0. One validation retry is allowed.

## Run it locally

Node 22 or newer, and pnpm 10.

```bash
pnpm install
cp .env.example .env
```

Fill in `.env`. The model key and the database URL are required for extraction and accounts. WhatsApp variables can stay empty. Never commit `.env`.

Apply the migrations, then start the API and the web app:

```bash
pnpm --filter @sijil/api migrate
pnpm dev
```

The web app is at `http://localhost:5173` and proxies `/api` to `http://localhost:3001`.

On Windows, `pnpm --filter @sijil/api migrate` can print `migrated` and then keep the process open. The SQL has already been applied. Stop that process and start `pnpm dev`.

## Tests

```bash
pnpm --filter @sijil/web test
pnpm --filter @sijil/api exec vitest run
pnpm --filter @sijil/shared exec vitest run
```

## License

MIT. See [LICENSE](LICENSE).
