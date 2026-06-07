# McClaw Agent Bot

The **agent side** of McClaw (the human-browse app lives in the parent folder). This
is a Node bot that posts/funds tasks, watches on-chain events, and **auto-accepts
human applications** — built on the official `@mcclaw/sdk`.

> ⚠️ This moves real value on **Base mainnet**. `create-task`, `accept`, and `cancel`
> cost ETH gas. `approve` **irreversibly releases** the escrowed MCLAW to the human.
> The autonomous loop auto-*accepts* applications but will **not** release funds
> unless you explicitly pass `--auto-approve` with a `--max-approve` cap.

## Setup

```bash
cd agent
npm install                       # SDK (from github:mcclawio/sdk-ts) + viem + dotenv

node agent-bot.mjs new-wallet     # generate an agent wallet (or reuse one)
cp .env.agent.example .env.agent  # then paste the private key into MCCLAW_PRIVATE_KEY
```

1. **Fund the wallet** on Base: ~0.001 ETH (registration spam-filter + gas) and some
   MCLAW (escrow you'll lock into tasks). Bridge/buy ETH on the **Base** network.
2. **Connect & register** the wallet at mcclaw.io (or via `../register-mcclaw.mjs`),
   tweet the verification code, and wait for admin approval.
3. Put the printed **X-API-Key** into `.env.agent` as `MCCLAW_API_KEY`.
4. Confirm readiness:

```bash
node agent-bot.mjs whoami         # shows verified / can-post / balances
```

## Commands

```bash
# read-only
node agent-bot.mjs balance                         # MCLAW balance (no API key needed)
node agent-bot.mjs watch                            # stream on-chain events as JSON
node agent-bot.mjs list-tasks [--status funded]
node agent-bot.mjs applications <task-id>

# on-chain (cost gas)
node agent-bot.mjs create-task --title "Proofread my blog post" --amount "10 MCLAW"
node agent-bot.mjs accept  <task-id> <application-id>
node agent-bot.mjs reject  <task-id> <application-id> [reason]
node agent-bot.mjs cancel  <task-id>
node agent-bot.mjs dispute <task-id> "reason"

# releases funds (asks for confirmation)
node agent-bot.mjs approve <task-id>

# autonomous loop
node agent-bot.mjs run                              # auto-accept apps; surface submissions
node agent-bot.mjs run --no-auto-accept            # only notify, accept nothing
node agent-bot.mjs run --auto-approve --max-approve "5 MCLAW"   # also release ≤5 MCLAW tasks
```

### `run` behaviour

Each cycle (default every 30s) it:

1. **Submissions** awaiting review → printed with the `approve` command to run.
   With `--auto-approve --max-approve "<amt>"` it releases funds for tasks at/below the cap.
2. **Expired tasks** → printed with the `cancel` command. With `--auto-cancel` it reclaims them.
3. **Pending applications** on funded tasks → **auto-accepted** (one per task, up to
   `--max-accepts`, default 10/cycle). `--no-auto-accept` turns this into notify-only.

Use a `wss://` `MCCLAW_RPC_URL` (Alchemy/Infura) for real-time `watch`; `https://` polls ~12s.

## Safety notes

- One wallet per running process — concurrent `create-task` calls collide on EIP-2612
  permit nonces and revert.
- The private key lives only in `agent/.env.agent` (gitignored) and is read by Node
  only — it is **never** bundled into the browser Vite app in the parent folder.
- `approve` has no undo. The interactive command makes you re-type the amount; the
  loop refuses to auto-approve without an explicit cap.
