// One-off: generate a fresh agent wallet and move MCLAW + ETH to it from the
// current (human-registered) wallet. Reads the source key from OLD_PK env.
// Prints the new wallet's key + address and the two tx hashes.
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { base } from "viem/chains";

const OLD_PK = process.env.OLD_PK;
if (!OLD_PK) { console.error("OLD_PK not set"); process.exit(1); }
const TOKEN = "0x7a1c46ca55a420c2c7111e505acdc8b4cdca7e9b";
const RPC = process.env.MCCLAW_RPC_URL || "https://mainnet.base.org";

const ERC20 = [
  { type: "function", name: "transfer", stateMutability: "nonpayable",
    inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }],
    outputs: [{ type: "bool" }] },
  { type: "function", name: "balanceOf", stateMutability: "view",
    inputs: [{ name: "account", type: "address" }], outputs: [{ type: "uint256" }] },
];

const old = privateKeyToAccount(OLD_PK.startsWith("0x") ? OLD_PK : `0x${OLD_PK}`);
const newPk = generatePrivateKey();
const newAcct = privateKeyToAccount(newPk);

const pub = createPublicClient({ chain: base, transport: http(RPC) });
const wallet = createWalletClient({ account: old, chain: base, transport: http(RPC) });

console.log("FROM (human):", old.address);
console.log("TO   (agent):", newAcct.address);

// 1) Move all MCLAW
const mclaw = await pub.readContract({ address: TOKEN, abi: ERC20, functionName: "balanceOf", args: [old.address] });
console.log(`MCLAW to move: ${Number(mclaw) / 1e18}`);
if (mclaw > 0n) {
  const tx1 = await wallet.writeContract({ address: TOKEN, abi: ERC20, functionName: "transfer", args: [newAcct.address, mclaw], chain: base, account: old });
  console.log("MCLAW transfer tx:", tx1);
  const r1 = await pub.waitForTransactionReceipt({ hash: tx1 });
  console.log("  status:", r1.status);
}

// 2) Move most of the ETH (leave a small gas reserve on the old wallet)
const ethBal = await pub.getBalance({ address: old.address });
const gasPrice = await pub.getGasPrice();
const reserve = 21000n * gasPrice * 4n; // generous buffer for this 1 send
const sendValue = ethBal - reserve;
console.log(`ETH balance: ${Number(ethBal) / 1e18}, sending ${Number(sendValue) / 1e18}`);
if (sendValue > 0n) {
  const tx2 = await wallet.sendTransaction({ account: old, to: newAcct.address, value: sendValue, chain: base });
  console.log("ETH transfer tx:", tx2);
  const r2 = await pub.waitForTransactionReceipt({ hash: tx2 });
  console.log("  status:", r2.status);
}

// 3) Report final balances on the new wallet
const newMclaw = await pub.readContract({ address: TOKEN, abi: ERC20, functionName: "balanceOf", args: [newAcct.address] });
const newEth = await pub.getBalance({ address: newAcct.address });
console.log("\n=== NEW AGENT WALLET ===");
console.log("NEW_ADDRESS:", newAcct.address);
console.log("NEW_PRIVATE_KEY:", newPk);
console.log(`NEW_BALANCES: ${Number(newMclaw) / 1e18} MCLAW, ${Number(newEth) / 1e18} ETH`);
