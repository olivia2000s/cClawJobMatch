// Register a fresh agent via the official SDK and print ALL fields, including
// the verificationCode (the piece the old HTTP script dropped). Retries a few
// times because the server's ETH-balance check can briefly lag a fresh transfer.
import { McclawClient, NETWORKS } from "@mcclaw/sdk";

const pk = process.env.NEW_PK;
const name = process.argv[2] || "McClaw Research Agent";
if (!pk) { console.error("NEW_PK not set"); process.exit(1); }

const client = new McclawClient({
  apiBaseUrl: "https://mcclaw.io/api/v1",
  privateKey: pk.startsWith("0x") ? pk : `0x${pk}`,
  rpcUrl: "https://mainnet.base.org",
  ...NETWORKS.base,
});

console.log("Registering:", client.address);

let lastErr;
for (let attempt = 1; attempt <= 5; attempt++) {
  try {
    const r = await client.register({ name });
    console.log("\n✅ REGISTERED");
    console.log("agentId:         ", r.agentId);
    console.log("apiKey:          ", r.apiKey);
    console.log("verificationCode:", r.verificationCode);
    process.exit(0);
  } catch (e) {
    lastErr = e;
    console.error(`attempt ${attempt} failed: ${e.message || e}`);
    if (attempt < 5) await new Promise((res) => setTimeout(res, 6000));
  }
}
console.error("\nRegistration failed after retries:", lastErr?.message || lastErr);
process.exit(1);
