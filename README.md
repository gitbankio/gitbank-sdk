# @gitbank/sdk

TypeScript SDK for [Gitbank](https://gitbank.io) — the Web3 payment and project management layer built on Base L2 via GitHub.

- **GitVault** — lock, withdraw, swap, and send USDC/WETH/cbBTC on Base L2
- **Projects & Bounties** — create on-chain projects, assign bounties to GitHub issues
- **Gitlawb** — decentralized git network with DID identity and IPFS storage
- **DID Identity** — generate and manage Ed25519 decentralized identifiers (did:key)
- **MCP Tools** — 23 ready-to-use Model Context Protocol tools for Claude and AI agents

## Install

```bash
npm install @gitbank/sdk
# or
pnpm add @gitbank/sdk
# or
yarn add @gitbank/sdk
```

Requires **Node.js 18+**. No external runtime dependencies — only Node built-ins.

---

## Quick Start

```typescript
import { GitbankClient } from "@gitbank/sdk";

const client = new GitbankClient({
  baseUrl: "https://gitbank.io",   // default
  cookie: "connect.sid=...",       // session cookie from OAuth
});

// Check vault balances
const balance = await client.getBalance();
console.log(balance.totalUsdValue); // "1,250.00"
console.log(balance.balances);
// [{ token: "USDC", balance: "1000.00", usdValue: "1000.00" }, ...]

// Get current user
const user = await client.me();
console.log(user.githubLogin); // "octocat"
console.log(user.vaultAddress); // "0xAbC..."
```

---

## Authentication

Gitbank uses **GitHub OAuth** for authentication. The session cookie is returned after the OAuth redirect.

```typescript
const client = new GitbankClient({
  onCookieUpdate: (cookie) => {
    // persist cookie to disk or env
    fs.writeFileSync("~/.gitbank/session.json", JSON.stringify({ cookie }), { mode: 0o600 });
  },
});

// Redirect user to this URL to start GitHub OAuth
const loginUrl = client.getLoginUrl();
// → https://gitbank.io/api/auth/github

// After the redirect, the session cookie is automatically captured
// via onCookieUpdate and attached to all subsequent requests.

// Restore a saved cookie
client.setCookie(savedCookie);
```

---

## GitbankClient API

### Auth

```typescript
// Get current user (requires auth)
const user: User = await client.me();
// { githubId, githubLogin, role, vaultAddress, ownerAddress }

// Logout
await client.logout();
```

### Vault Operations

```typescript
// Get vault balance
const balance: VaultBalance = await client.getBalance();
// { vaultAddress, balances: TokenBalance[], totalUsdValue }

// Deploy vault (one-time, on-chain)
const deploy: DeployResponse = await client.deployVault();
// { vaultAddress, ownerAddress, txHash }

// Deposit tokens into vault
const tx: TxResponse = await client.lock("USDC", "100");
// { txHash, status: "pending" | "confirmed" | "failed" }

// Withdraw tokens from vault
const tx = await client.unlock("USDC", "50");

// Swap inside vault (Uniswap v3 on Base L2)
const tx = await client.swap("USDC", "WETH", "500", 50); // 50 bps slippage

// Send to another contributor (commit-reveal, front-run proof)
const init: TransferInitResponse = await client.initTransfer("USDC", "0xRecipient", "25");
const final: TxResponse = await client.finalizeTransfer(init.initHash);

// Export vault private key
const key: KeyResponse = await client.getKey();
// { address, privateKey }
```

### Projects & Bounties

```typescript
// List projects
const projects: Project[] = await client.getProjects();

// Create a project
const project: Project = await client.createProject({
  name: "My Project",
  repo: "owner/repo",
  token: "USDC",
  budget: "5000",
});

// Get project with all tasks
const project = await client.getProject(42);

// Assign a bounty to a GitHub issue
const task: Task = await client.createTask(project.id, {
  issueNumber: 123,
  repo: "owner/repo",
  contributorGithubId: 456789,
  bountyAmount: "200",
  token: "USDC",
});

// Cancel a task (reclaim funds)
await client.cancelTask(project.id, task.id);
```

### Transactions & Repos

```typescript
// Get transaction history
const txs: Transaction[] = await client.getTransactions({
  projectId: 42,   // optional
  limit: 20,       // default 20
  offset: 0,
});

// List connected GitHub repos
const repos: Repo[] = await client.getRepos();

// Platform stats
const stats: Stats = await client.getStats();
// { totalVaults, totalTransactions, totalProjects }

// Health check
const { status } = await client.healthz();
```

---

## GitlawbClient

Connect to the [Gitlawb](https://gitlawb.com) decentralized git network.

```typescript
import { GitlawbClient } from "@gitbank/sdk";

const gl = new GitlawbClient({
  node: "https://node.gitlawb.com",    // or GITLAWB_NODE env var
  did: "did:key:z6Mk...",              // or GITLAWB_DID env var
});

// Node status
const status: GitlawbNodeStatus = await gl.nodeStatus();
// { online, did, region, peers, repos, writesAccepted }

// List repos (filter by DID owner)
const repos: GitlawbRepo[] = await gl.listRepos("did:key:z6Mk...");

// Create a repo
const repo = await gl.createRepo("my-project", "A decentralized repo");

// Clone URL
const url = gl.cloneUrl("my-project", "did:key:z6Mk...");
// → gitlawb://did:key:z6Mk.../my-project

// Pull requests
const prs: GitlawbPR[] = await gl.listPRs("my-project");
const pr = await gl.openPR("my-project", "feature", "main", "Add feature", "Description");

// Issues
const issues: GitlawbIssue[] = await gl.listIssues("my-project");

// Read a file from a repo
const content = await gl.readFile("my-project", "src/index.ts", "main");
```

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `GITLAWB_NODE` | `https://node.gitlawb.com` | Gitlawb node URL |
| `GITLAWB_DID` | — | Your DID identifier |
| `GITLAWB_KEY` | — | Path to your identity key file |

---

## DID Identity

Generate and manage Ed25519 decentralized identifiers (did:key spec).

```typescript
import { generateDID, loadDID, clearDID } from "@gitbank/sdk";

// Generate a new Ed25519 DID keypair
// Saved to ~/.gitbank/did/identity.json (mode 0600)
const doc = generateDID();
// {
//   did: "did:key:z6Mk...",
//   type: "ed25519",
//   publicKeyHex: "09a3bb...",
//   createdAt: "2024-01-01T00:00:00.000Z"
// }

// Load existing DID from disk
const doc = loadDID(); // DIDDocument | null

// Delete stored DID
clearDID();
```

The keypair is stored at `~/.gitbank/did/identity.json` with `0600` permissions (owner read/write only). The private key is stored as a PEM-encoded PKCS#8 string and never leaves your machine.

---

## MCP Tools (Model Context Protocol)

Build AI agent integrations with 23 ready-made tools covering all Gitbank and Gitlawb operations.

```typescript
import { GitbankClient, GitlawbClient, buildGitbankMCPTools } from "@gitbank/sdk";

const gitbank = new GitbankClient({ cookie: savedCookie });
const gitlawb = new GitlawbClient();

const tools = buildGitbankMCPTools(gitbank, gitlawb);
// Returns MCPTool[] — each tool has name, description, inputSchema, and handler

// Use with any MCP server
for (const tool of tools) {
  console.log(tool.name, tool.description);
}

// Call a tool directly
const result = await tools.find(t => t.name === "gitbank_balance")!.handler({});
console.log(result.content[0].text); // JSON vault balance
```

### Available Tools (23)

**Gitbank:**

| Tool | Description |
|---|---|
| `gitbank_ping` | Check API health |
| `gitbank_me` | Current user info |
| `gitbank_balance` | Vault token balances |
| `gitbank_stats` | Platform stats |
| `gitbank_deposit` | Lock tokens into vault |
| `gitbank_withdraw` | Withdraw from vault |
| `gitbank_swap` | Swap via Uniswap v3 |
| `gitbank_send` | Send to contributor |
| `gitbank_list_projects` | List projects |
| `gitbank_get_project` | Project + tasks by ID |
| `gitbank_create_project` | Create on-chain project |
| `gitbank_assign_bounty` | Assign bounty to issue |
| `gitbank_cancel_task` | Cancel & reclaim bounty |
| `gitbank_transactions` | Transaction history |
| `gitbank_repos` | Connected GitHub repos |
| `gitbank_deploy_vault` | Deploy GitVault contract |
| `gitbank_did_show` | Show local DID |
| `gitbank_did_new` | Generate new DID |

**Gitlawb:**

| Tool | Description |
|---|---|
| `gitlawb_node_status` | Node status |
| `gitlawb_list_repos` | List repos by DID |
| `gitlawb_create_repo` | Create decentralized repo |
| `gitlawb_open_pr` | Open pull request |
| `gitlawb_read_file` | Read file from repo |

### Claude Desktop Integration

The `gitbank` CLI ships a complete MCP stdio server. To expose these tools to Claude, add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "gitbank": {
      "command": "gitbank",
      "args": ["mcp", "serve"],
      "env": {
        "GITLAWB_DID": "did:key:z6Mk...",
        "GITLAWB_NODE": "https://node.gitlawb.com"
      }
    }
  }
}
```

Or generate the config automatically:

```bash
gitbank mcp config
```

---

## Error Handling

```typescript
import {
  GitbankError,
  GitbankAuthError,
  GitbankNotFoundError,
  GitbankNetworkError,
} from "@gitbank/sdk";

try {
  await client.getBalance();
} catch (e) {
  if (e instanceof GitbankAuthError) {
    // 401 — not logged in
    console.log("Run: gitbank auth login");
  } else if (e instanceof GitbankNotFoundError) {
    // 404
  } else if (e instanceof GitbankNetworkError) {
    // fetch failed — server unreachable
    console.log(e.cause);
  } else if (e instanceof GitbankError) {
    // other API error
    console.log(e.statusCode, e.message);
  }
}
```

---

## Type Reference

```typescript
interface User {
  githubId: number;
  githubLogin: string;
  role: "member" | "manager";
  vaultAddress: string | null;
  ownerAddress: string | null;
}

interface VaultBalance {
  vaultAddress: string | null;
  balances: TokenBalance[];
  totalUsdValue: string;
}

interface TokenBalance {
  token: string;
  symbol: string;
  gitToken: string;
  balance: string;
  usdValue: string;
}

interface Project {
  id: number;
  onchainProjectId: number;
  repo: string;
  name: string;
  token: string;
  totalBudget: string;
  spentBudget: string;
  status: string;
  tasks?: Task[];
}

interface Task {
  id: number;
  issueNumber: number;
  repo: string;
  contributorGithubId: number;
  bountyAmount: string;
  token: string;
  status: "assigned" | "completed" | "cancelled";
}

interface Transaction {
  id: number;
  type: "lock" | "unlock" | "swap" | "transfer" | "bounty_assign" | "bounty_payout" | "bounty_reclaim" | "project_create";
  status: "pending" | "confirmed" | "failed";
  tokenIn: string | null;
  tokenOut: string | null;
  amountIn: string | null;
  amountOut: string | null;
  txHash: string | null;
  createdAt: string;
}

interface DIDDocument {
  did: string;
  type: "ed25519";
  publicKeyHex: string;
  createdAt: string;
}
```

---

## Links

- [Gitbank](https://gitbank.io) — platform
- [gitbank CLI](https://www.npmjs.com/package/gitbank) — terminal interface
- [Gitlawb](https://gitlawb.com) — decentralized git network
- [GitHub](https://github.com/gitbankio/gitbank-sdk) — source code

## License

MIT
