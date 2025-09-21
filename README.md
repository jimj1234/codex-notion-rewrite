# Notion Rewriter by Codex

Service that listens to Notion comment webhooks and rewrites a page whenever a comment contains the trigger keyword (default: `ty`). The rewrite is delegated to Claude Sonnet via OpenRouter with "knowledge architect" framing that preserves facts while restructuring the page into nested toggles for easier scanning.

## Features
- Validates Notion webhook signatures before processing events.
- Detects `ty` (or custom keyword) inside new comments and merges any extra instructions into the rewrite prompt.
- Recursively retrieves the full page content, serialises it to markdown-like text, and provides it to the LLM for transformation guidance.
- Calls OpenRouter (default model `anthropic/claude-sonnet-4`) and expects pure JSON describing the new block tree.
- Replaces the page’s child blocks with the returned structure and optionally updates the page title.

## Project Structure
- `src/index.ts` – Express entrypoint and routing.
- `src/webhook/notionRouter.ts` – Notion webhook endpoint with signature verification.
- `src/services/notionWebhookService.ts` – Comment handling, trigger detection, rewrite orchestration.
- `src/services/rewriteService.ts` – Prompt assembly, OpenRouter call, page mutation.
- `src/utils/notionBlocks.ts` – Helpers to fetch/expand blocks and render markdown.
- `src/utils/blockSpec.ts` – Converts LLM block specs into Notion block requests.
- `src/utils/signature.ts` – HMAC verification for Notion webhook payloads.

## Prerequisites
- Node.js 18+ and npm.
- A Notion integration with the **comment** and **content** capabilities.
- Registered webhook endpoint in Notion (beta feature) pointing to `POST /webhook/notion`.
- OpenRouter account with an API key and access to the Claude Sonnet model family.

## Configuration
Copy `.env.example` to `.env` and fill in the values:

| Variable | Description |
| --- | --- |
| `PORT` | Port for the Express server (default 3000). |
| `NOTION_API_KEY` | Internal integration token from Notion. |
| `NOTION_WEBHOOK_SECRET` | Secret used by Notion to sign webhook deliveries. |
| `OPENROUTER_API_KEY` | OpenRouter API key. |
| `OPENROUTER_MODEL` | Model to call (defaults to `anthropic/claude-sonnet-4`; override if needed). |
| `TRIGGER_KEYWORD` | Case-insensitive keyword that activates rewrites (default `ty`). |

## Local Development
```bash
npm install
npm run dev
```
Expose the local port to the internet (e.g., `ngrok http 3000`) and register the public URL as the webhook target inside Notion’s developer console. Notion will deliver events as soon as a comment is created.

Because the service deletes and replaces all top-level page blocks during a rewrite, test on sample pages first.

## Notion Webhook Notes
1. Ensure the integration is added to the target workspace and granted access to the pages you want rewritten.
2. Register the webhook with the same secret set in `NOTION_WEBHOOK_SECRET` so signature validation succeeds.
3. Notion sends batched events. The handler inspects all `comment` events in the payload and skips anything missing the trigger.
4. When commenting on a block, the handler walks up the parent chain until it finds the hosting page; the full page is always rewritten.

## Prompt Behaviour
- Default system prompt frames the assistant as a knowledge architect who uses nested toggles heavily.
- Any extra words in the triggering comment (beyond the keyword) are forwarded to the LLM as override instructions.
- The LLM must respond with JSON in the agreed schema; empty responses abort to protect against wiping the page.

## Deployment (DigitalOcean/DigitalRiver droplet)
1. Provision a small Ubuntu-based droplet.
2. Install Node.js 18+ (`curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -`, then `sudo apt-get install -y nodejs`).
3. Clone this repository and populate the `.env` file with production credentials.
4. Use `pm2` or `systemd` to run `npm run start` on boot. Example with `pm2`:
   ```bash
   npm install --production
   npx pm2 start npm --name notion-rewriter -- run start
   npx pm2 save
   ```
5. Configure an HTTPS reverse proxy (e.g., Nginx + Let’s Encrypt) in front of the Node process and point your Notion webhook to the public URL.
6. Keep the OpenRouter API key secret; consider setting network firewall rules so only Notion can reach `/webhook/notion`.

## Future Enhancements
- Add persistence to avoid reprocessing the same comment multiple times.
- Build richer error reporting back to Notion (e.g., post a follow-up comment when rewrite fails).
- Expand block-spec schema to support images, databases, and advanced formatting returned by the LLM.
