#!/usr/bin/env node
/**
 * McClaw agent bot — the AI-agent side of the marketplace.
 *
 * Built on the official @mcclaw/sdk (github:mcclawio/sdk-ts), which handles
 * wallet signing, EIP-2612 permits, and the multi-step on-chain escrow flow.
 *
 * What it does:
 *   - create-task   post + fund a task (locks MCLAW escrow on-chain)
 *   - watch         stream on-chain events for your agent (read-only)
 *   - run           autonomous loop: auto-accept applications, surface
 *                   submissions for review (and optionally auto-approve)
 *   - plus: whoami, balance, list-tasks, applications, accept, reject,
 *           approve, dispute, cancel
 *
 * ─── MONEY SAFETY ───────────────────────────────────────────────────────────
 * Three actions move value or gas on Base mainnet:
 *   create-task / accept / cancel  → on-chain tx, costs ETH gas
 *   approve                        → RELEASES the escrowed MCLAW to the human,
 *                                    irreversibly. There is no undo.
 * The `run` loop will auto-accept applications (you asked for that), but it will
 * NEVER auto-approve (release funds) unless you pass --auto-approve AND a
 * --max-approve cap. Default behaviour just notifies you about submissions.
 *
 * Config (env, or agent/.env.agent — see .env.agent.example):
 *   MCCLAW_PRIVATE_KEY   0x... agent wallet key (alias: MCCLAW_PK). Never logged.
 *   MCCLAW_RPC_URL       Base RPC. wss:// = realtime events; https:// = ~12s poll.
 *   MCCLAW_API_URL       default https://mcclaw.io/api/v1
 *   MCCLAW_API_KEY       agent X-API-Key (optional once registered; printed by `register`)
 */

import process from "node:process";
import { createInterface } from "node:readline";
import { config as loadEnv } from "dotenv";
import {
  McclawClient,
  NETWORKS,
  parseMclaw,
  formatMclaw,
  createWallet,
  McclawApiError,
  McclawContractError,
} from "@mcclaw/sdk";

// Load agent/.env.agent first, then a local .env, without clobbering real env.
loadEnv({ path: new URL(".env.agent", import.meta.url).pathname });
loadEnv();

// ─── arg parsing ─────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const cmd = argv[0];
const positionals = [];
const flags = {};
for (let i = 1; i < argv.length; i++) {
  const a = argv[i];
  if (a.startsWith("--")) {
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) flags[key] = true;
    else flags[key] = argv[++i];
  } else {
    positionals.push(a);
  }
}

// ─── helpers ─────────────────────────────────────────────────────────────────
const API_URL = process.env.MCCLAW_API_URL || "https://mcclaw.io/api/v1";
const RPC_URL = process.env.MCCLAW_RPC_URL || "https://mainnet.base.org";

function die(msg) {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
}

/** Build a client. `needKey` requires an API key; `needWallet` requires a PK. */
function getClient({ needKey = true } = {}) {
  const pk = process.env.MCCLAW_PRIVATE_KEY || process.env.MCCLAW_PK;
  if (!pk) {
    die(
      "Missing wallet key. Set MCCLAW_PRIVATE_KEY in agent/.env.agent or the env.\n" +
        "  (Generate a fresh agent wallet with:  node agent-bot.mjs new-wallet )",
    );
  }
  const apiKey = process.env.MCCLAW_API_KEY;
  if (needKey && !apiKey) {
    die(
      "Missing MCCLAW_API_KEY. Register first (register-mcclaw.mjs in the parent\n" +
        "dir, or the mcclaw-agent CLI), then put the X-API-Key in agent/.env.agent.",
    );
  }
  return new McclawClient({
    apiBaseUrl: API_URL,
    privateKey: pk.startsWith("0x") ? pk : `0x${pk}`,
    rpcUrl: RPC_URL,
    apiKey,
    ...NETWORKS.base,
  });
}

/** Accept "10 MCLAW", "0.5 MCLAW", or a raw wei integer → wei string. */
function toWei(amount) {
  if (!amount || amount === true) die("Provide an amount, e.g. --amount '10 MCLAW'");
  const s = String(amount).trim();
  const m = s.match(/^([\d.]+)\s*MCLAW$/i);
  if (m) return parseMclaw(m[1]);
  if (/^\d+$/.test(s)) return s; // raw wei
  die(`Bad amount "${amount}". Use "10 MCLAW", "0.5 MCLAW", or raw wei.`);
}

const mclaw = (wei) => `${formatMclaw(String(wei))} MCLAW`;

/** JSON.stringify that survives bigints (for `watch` output). */
const jsonLine = (o) =>
  JSON.stringify(o, (_k, v) => (typeof v === "bigint" ? v.toString() : v));

function ask(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((res) =>
    rl.question(question, (a) => {
      rl.close();
      res(a.trim());
    }),
  );
}

/** Run an API call, retrying once on 429 using the server's Retry-After. */
async function withRetry(fn) {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof McclawApiError && e.isRateLimited) {
      const wait = (e.retryAfter ?? 5) * 1000;
      console.error(`  rate limited — waiting ${wait / 1000}s`);
      await new Promise((r) => setTimeout(r, wait));
      return fn();
    }
    throw e;
  }
}

function explainError(e) {
  if (e instanceof McclawApiError) {
    return `API ${e.status}: ${e.message}${e.isUnauthorized ? " (check MCCLAW_API_KEY)" : ""}`;
  }
  if (e instanceof McclawContractError) {
    return `on-chain tx failed: ${e.message}${e.txHash ? ` (tx ${e.txHash})` : ""}`;
  }
  return e?.message || String(e);
}

// ─── commands ────────────────────────────────────────────────────────────────

async function cmdNewWallet() {
  const w = createWallet();
  console.log("\nNew agent wallet (fund it with ~0.001 ETH + MCLAW on Base):\n");
  console.log("  Address:     ", w.address);
  console.log("  Private key: ", w.privateKey);
  console.log(
    "\nSave the private key into agent/.env.agent as MCCLAW_PRIVATE_KEY — it is shown once.\n",
  );
}

async function cmdWhoami() {
  const c = getClient();
  const me = await withRetry(() => c.getProfile());
  console.log("\nAgent:", me.name || me.username, `(@${me.username})`);
  console.log("  wallet     ", me.walletAddress);
  console.log("  verified   ", me.isVerified, "| X-verified", me.isXVerified);
  console.log("  MCLAW      ", mclaw(me.balance));
  console.log("  gas (ETH)  ", me.gasBalance);
  console.log("  can post   ", me.readiness?.canCreateTasks);
  if (me.readiness?.blockers?.length) {
    console.log("  blockers:  ", me.readiness.blockers.join("; "));
  }
  console.log();
}

async function cmdBalance() {
  const c = getClient({ needKey: false });
  const bal = await c.getTokenBalance();
  console.log(`\n${mclaw(bal)}  (wallet ${c.address})\n`);
}

async function cmdCreateTask() {
  const title = flags.title;
  if (!title || title === true) die('Need --title "..."');
  const escrowAmount = toWei(flags.amount ?? flags["escrow-amount"]);
  const c = getClient();

  // Pre-flight balance check so we fail before touching the chain.
  const bal = await c.getTokenBalance();
  if (BigInt(bal) < BigInt(escrowAmount)) {
    die(`Insufficient MCLAW: have ${mclaw(bal)}, need ${mclaw(escrowAmount)}.`);
  }

  console.log(
    `\nCreating "${title}" with ${mclaw(escrowAmount)} escrow.\n` +
      "This signs an EIP-2612 permit and locks the escrow on Base (costs ETH gas).",
  );
  if (!flags.yes) {
    const ans = await ask("Proceed? [y/N] ");
    if (ans.toLowerCase() !== "y") die("Aborted.");
  }

  const task = await withRetry(() =>
    c.createTask({
      title,
      description: flags.description === true ? undefined : flags.description,
      escrowAmount,
      deadline: flags.deadline === true ? undefined : flags.deadline,
    }),
  );
  console.log(`\n✅ Task created: ${task.id}`);
  console.log(`   status ${task.status} · escrow ${mclaw(task.escrowAmount)} · on-chain id ${task.escrowTaskId}`);
  console.log(`   watch it with:  node agent-bot.mjs watch\n`);
}

async function cmdListTasks() {
  const c = getClient();
  const status = flags.status === true ? undefined : flags.status;
  const res = await withRetry(() => c.listTasks({ status, pageSize: 50 }));
  console.log(`\n${res.total} task(s)${status ? ` [${status}]` : ""}:\n`);
  for (const t of res.tasks) {
    const apps = t.applicationCount ? ` · ${t.applicationCount} application(s)` : "";
    console.log(`  ${t.id}  [${t.status}]  ${mclaw(t.escrowAmount)}  ${t.title}${apps}`);
  }
  console.log();
}

async function cmdApplications() {
  const taskId = positionals[0];
  if (!taskId) die("Usage: applications <task-id>");
  const c = getClient();
  const apps = await withRetry(() => c.listApplications(taskId));
  console.log(`\n${apps.length} application(s) for task ${taskId}:\n`);
  for (const a of apps) {
    console.log(`  ${a.id}  [${a.status}]  human ${a.humanWallet || a.humanId}`);
    if (a.applicationMessage) console.log(`      "${a.applicationMessage}"`);
  }
  console.log();
}

async function cmdAccept() {
  const [taskId, appId] = positionals;
  if (!taskId || !appId) die("Usage: accept <task-id> <application-id>");
  const c = getClient();
  console.log(`\nAccepting application ${appId} on task ${taskId} (on-chain, costs gas)…`);
  const r = await withRetry(() => c.acceptAndFundApplication(taskId, appId));
  console.log(`✅ bound on-chain. tx ${r.txHash}\n`);
}

async function cmdReject() {
  const [taskId, appId] = positionals;
  if (!taskId || !appId) die("Usage: reject <task-id> <application-id> [reason]");
  const reason = positionals.slice(2).join(" ") || (flags.reason === true ? undefined : flags.reason);
  const c = getClient();
  await withRetry(() => c.rejectApplication(taskId, appId, reason));
  console.log(`\n✅ rejected application ${appId}\n`);
}

async function cmdApprove() {
  const taskId = positionals[0];
  if (!taskId) die("Usage: approve <task-id>");
  const c = getClient();
  const task = await withRetry(() => c.getTask(taskId));
  console.log(
    `\n⚠️  Approving task ${taskId} RELEASES ${mclaw(task.escrowAmount)} to the human.\n` +
      "   This is irreversible — there is no refund after approval.",
  );
  if (!flags.yes) {
    const ans = await ask(`Type the amount in MCLAW to confirm release [${formatMclaw(task.escrowAmount)}]: `);
    if (ans !== formatMclaw(task.escrowAmount)) die("Confirmation did not match. Aborted.");
  }
  const r = await withRetry(() => c.approveSubmission(taskId));
  console.log(`\n✅ released. tx ${r.txHash}\n`);
}

async function cmdDispute() {
  const taskId = positionals[0];
  const reason = positionals.slice(1).join(" ") || (flags.reason === true ? undefined : flags.reason);
  if (!taskId || !reason) die('Usage: dispute <task-id> "reason"');
  const c = getClient();
  const r = await withRetry(() => c.disputeTask(taskId, reason));
  console.log(`\n✅ disputed. dispute ${r.disputeId} · tx ${r.txHash}\n`);
}

async function cmdCancel() {
  const taskId = positionals[0];
  if (!taskId) die("Usage: cancel <task-id>");
  const c = getClient();
  const r = await withRetry(() => c.cancelTask(taskId));
  console.log(`\n✅ cancelled & refunded. tx ${r.txHash}\n`);
}

async function cmdWatch() {
  const c = getClient({ needKey: false });
  const realtime = RPC_URL.startsWith("wss://") || RPC_URL.startsWith("ws://");
  console.error(
    `# watching events for ${c.address}\n# mode: ${realtime ? "websocket (realtime)" : "http polling (~12s)"} — Ctrl-C to stop`,
  );
  const unwatch = c.watch({
    onApplication: (e) => console.log(jsonLine({ type: "application", ...e })),
    onTaskEvent: (e) => console.log(jsonLine({ type: "task_event", ...e })),
    onError: (err) => console.error(`# watcher error: ${err.message}`),
  });
  const stop = () => {
    unwatch();
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

/**
 * Autonomous loop. Polls the API and acts per McClaw's priority order:
 *   1. submissions awaiting review  → notify (or auto-approve if opted in + capped)
 *   2. expired tasks                → notify (or auto-cancel if opted in)
 *   3. pending applications         → AUTO-ACCEPT (capped), one per task
 * Read-only by default for anything that releases funds.
 */
async function cmdRun() {
  const c = getClient();
  const intervalMs = Number(flags.interval ?? 30) * 1000;
  // Default: auto-accept ON (the requested behaviour), money-release OFF.
  const doAutoAccept = !flags["no-auto-accept"];
  const maxAccepts = Number(flags["max-accepts"] ?? 10);
  const doAutoApprove = flags["auto-approve"] === true || typeof flags["auto-approve"] === "string";
  const approveCapWei = doAutoApprove ? BigInt(toWei(flags["max-approve"] ?? die("--auto-approve requires --max-approve, e.g. --max-approve '5 MCLAW'"))) : 0n;
  const doAutoCancel = flags["auto-cancel"] === true;

  const me = await withRetry(() => c.getProfile());
  console.log(
    `\n● mcclaw bot for @${me.username} (${c.address})\n` +
      `  MCLAW ${mclaw(me.balance)} · gas ${me.gasBalance} ETH · poll every ${intervalMs / 1000}s\n` +
      `  auto-accept applications: ${doAutoAccept ? `ON (max ${maxAccepts}/cycle)` : "OFF — surfaced for manual accept"}\n` +
      `  auto-approve (release funds): ${doAutoApprove ? `ON, cap ${mclaw(approveCapWei)}/task` : "OFF — submissions surfaced for manual review"}\n` +
      `  auto-cancel expired: ${doAutoCancel ? "ON" : "OFF"}\n`,
  );

  const handledApps = new Set();
  let stopped = false;
  const stop = () => {
    stopped = true;
    console.log("\nstopping…");
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);

  const ts = () => new Date().toISOString().slice(11, 19);

  async function cycle() {
    let accepts = 0;
    // --- Priority 1 & 2: pending actions (submissions, expirations, reviews)
    try {
      const { actions } = await withRetry(() => c.listPendingActions());
      for (const a of actions) {
        if (a.actionType === "review_submission") {
          if (doAutoApprove && a.amount && BigInt(a.amount) <= approveCapWei) {
            console.log(`[${ts()}] auto-approving "${a.taskTitle}" (${mclaw(a.amount)})`);
            try {
              const r = await withRetry(() => c.approveSubmission(a.taskId));
              console.log(`         ✅ released, tx ${r.txHash}`);
            } catch (e) {
              console.error(`         ✖ approve failed: ${explainError(e)}`);
            }
          } else {
            console.log(
              `[${ts()}] ⏳ submission awaiting review: "${a.taskTitle}" (${a.amount ? mclaw(a.amount) : "?"})` +
                `  → node agent-bot.mjs approve ${a.taskId}`,
            );
          }
        } else if (a.actionType === "cancel_expired_task") {
          if (doAutoCancel) {
            console.log(`[${ts()}] cancelling expired "${a.taskTitle}"`);
            try {
              const r = await withRetry(() => c.cancelTask(a.taskId));
              console.log(`         ✅ refunded, tx ${r.txHash}`);
            } catch (e) {
              console.error(`         ✖ cancel failed: ${explainError(e)}`);
            }
          } else {
            console.log(`[${ts()}] ⌛ expired task: "${a.taskTitle}"  → node agent-bot.mjs cancel ${a.taskId}`);
          }
        } else if (a.actionType === "leave_review") {
          console.log(`[${ts()}] ✎ review owed for "${a.taskTitle}"  → node agent-bot.mjs ... (review)`);
        }
      }
    } catch (e) {
      console.error(`[${ts()}] pending-actions poll failed: ${explainError(e)}`);
    }

    // --- Priority 3: applications awaiting accept on funded tasks
    try {
      const { tasks } = await withRetry(() => c.listTasks({ pageSize: 50 }));
      for (const t of tasks) {
        // Only tasks that are funded/posted and not yet bound to a human accept apps.
        if (!["funded", "new"].includes(t.status)) continue;
        if (!t.applicationCount) continue;
        const apps = await withRetry(() => c.listApplications(t.id));
        const pending = apps.filter(
          (a) => !handledApps.has(a.id) && /pending|applied|new|open/i.test(a.status),
        );
        if (!pending.length) continue;

        if (!doAutoAccept) {
          for (const a of pending) {
            console.log(
              `[${ts()}] 👤 application ${a.id} on "${t.title}" (${mclaw(t.escrowAmount)})` +
                `  → node agent-bot.mjs accept ${t.id} ${a.id}`,
            );
          }
          continue;
        }

        // Auto-accept the first eligible application (one human per task).
        const pick = pending[0];
        if (accepts >= maxAccepts) {
          console.log(`[${ts()}] reached max-accepts (${maxAccepts}) this cycle; deferring rest`);
          break;
        }
        console.log(`[${ts()}] accepting application ${pick.id} on "${t.title}" (${mclaw(t.escrowAmount)})`);
        try {
          const r = await withRetry(() => c.acceptAndFundApplication(t.id, pick.id));
          handledApps.add(pick.id);
          accepts++;
          console.log(`         ✅ bound on-chain, tx ${r.txHash}`);
        } catch (e) {
          console.error(`         ✖ accept failed: ${explainError(e)}`);
          handledApps.add(pick.id); // don't hammer a permanently-failing app
        }
      }
    } catch (e) {
      console.error(`[${ts()}] task poll failed: ${explainError(e)}`);
    }
  }

  // First pass immediately, then on an interval.
  await cycle();
  while (!stopped) {
    await new Promise((r) => setTimeout(r, intervalMs));
    if (!stopped) await cycle();
  }
}

const HELP = `
McClaw agent bot — the AI-agent side of the marketplace.

Setup:
  1) node agent-bot.mjs new-wallet          # generate a wallet (or reuse one)
  2) fund it with ~0.001 ETH + MCLAW on Base
  3) register it (see ../register-mcclaw.mjs) and put keys in agent/.env.agent
  4) node agent-bot.mjs whoami              # confirm it's verified & can post

Read-only:
  whoami                                    profile, balances, readiness
  balance                                   on-chain MCLAW balance (no API key needed)
  list-tasks [--status funded|active|...]   your tasks
  applications <task-id>                     applications on a task
  watch                                      stream on-chain events as JSON (no API key)

Acts on-chain (costs ETH gas):
  create-task --title "..." --amount "10 MCLAW" [--description "..."] [--deadline <RFC3339>] [--yes]
  accept <task-id> <application-id>          bind a human to the task
  reject <task-id> <application-id> [reason]
  cancel <task-id>                          cancel + reclaim escrow
  dispute <task-id> "reason"

Releases funds (irreversible):
  approve <task-id>                          release escrow to the human (asks for confirmation)

Autonomous loop:
  run [--interval 30] [--no-auto-accept] [--max-accepts 10]
      [--auto-approve --max-approve "5 MCLAW"] [--auto-cancel]
    • auto-accepts applications by default (one per task, capped)
    • surfaces submissions for manual approval UNLESS you opt into --auto-approve
    • never releases funds without --auto-approve + --max-approve cap
`;

const COMMANDS = {
  "new-wallet": cmdNewWallet,
  whoami: cmdWhoami,
  balance: cmdBalance,
  "create-task": cmdCreateTask,
  "list-tasks": cmdListTasks,
  applications: cmdApplications,
  accept: cmdAccept,
  reject: cmdReject,
  approve: cmdApprove,
  dispute: cmdDispute,
  cancel: cmdCancel,
  watch: cmdWatch,
  run: cmdRun,
};

const handler = COMMANDS[cmd];
if (!handler) {
  if (cmd && cmd !== "help" && cmd !== "--help") console.error(`Unknown command: ${cmd}`);
  console.log(HELP);
  process.exit(cmd && cmd !== "help" && cmd !== "--help" ? 1 : 0);
}

handler().catch((e) => {
  die(explainError(e));
});
