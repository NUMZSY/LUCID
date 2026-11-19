# LUCID community backend

This optional Cloudflare Worker provides launcher chat, announcements, bug reports, ranks, in-game presence and cape review. The repository ships no hosted endpoint or admin account; a build without `lucidApiUrl` makes no requests to a LUCID backend. You can deploy this Worker to your own Cloudflare account and use that deployment instead.

## What it does

- Proves Minecraft account identity using the player key issued by Minecraft Services. The account access token stays on the player's computer; only the proof and public identity are sent to this Worker.
- Stores chat state, ranks, presence, bug reports, announcements and cape approvals in a Cloudflare Durable Object owned by the deployer.
- Enforces chat moderation and rank permissions on the server. Client-side UI checks are not a substitute for these checks.
- Keeps player-presence badges short-lived and removes them when a game client disconnects or stops heartbeating.

The Worker uses the `ADMIN_UUID` environment secret as the owner identity. It is intentionally absent from the checked-in configuration; without it, no account is the owner and the admin actions stay unavailable.

## Deploy your own instance

1. From this directory, authenticate with your Cloudflare account and deploy:

   ```bash
   npx wrangler login
   npx wrangler deploy
   ```

2. Set the Minecraft UUID (without dashes) of your own owner account as a Worker secret:

   ```bash
   npx wrangler secret put ADMIN_UUID
   ```

   The command prompts for the value. Do not commit the UUID to Git. The new secret takes effect on the Worker deployment.

3. Wrangler prints a URL similar to `https://lucid-chat.<your-account>.workers.dev`. Set that URL as `lucidApiUrl` in `launcher/app-config.json`, then build the launcher. Leave it empty to keep backend-dependent features disabled. The launcher also no longer ships an admin UUID; the Worker is the authority for owner permissions.

The endpoint uses Cloudflare Durable Objects and may incur charges under Cloudflare's current plan and usage rules. Review those terms and the data your Worker stores before inviting players.

## Optional Stripe integration

The Worker contains an optional webhook handler for LUCID+ subscriptions. It is not connected to any Snowball account, product, checkout page or webhook by default. Do not enable it until you have configured your own Stripe product, checkout flow, webhook URL and `STRIPE_WEBHOOK_SECRET` in your own Cloudflare account.

## Tests

```bash
node --test test/
```
