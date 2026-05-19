import { GitbankClient } from "./client.js";
import { GitlawbClient } from "./gitlawb.js";
import { loadDID } from "./did.js";

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (args: Record<string, unknown>) => Promise<MCPToolResult>;
}

export interface MCPToolResult {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

function ok(text: string): MCPToolResult {
  return { content: [{ type: "text", text }] };
}

function err(msg: string): MCPToolResult {
  return { content: [{ type: "text", text: `Error: ${msg}` }], isError: true };
}

export function buildGitbankMCPTools(
  gitbank: GitbankClient,
  gitlawb: GitlawbClient
): MCPTool[] {
  return [
    {
      name: "gitbank_ping",
      description: "Check Gitbank API health status",
      inputSchema: { type: "object", properties: {}, required: [] },
      handler: async () => {
        try {
          const r = await gitbank.healthz();
          return ok(`Gitbank API status: ${r.status}`);
        } catch (e) {
          return err(String(e));
        }
      },
    },
    {
      name: "gitbank_me",
      description: "Get the current authenticated Gitbank user info, vault address, and owner address",
      inputSchema: { type: "object", properties: {}, required: [] },
      handler: async () => {
        try {
          const u = await gitbank.me();
          return ok(JSON.stringify(u, null, 2));
        } catch (e) {
          return err(String(e));
        }
      },
    },
    {
      name: "gitbank_balance",
      description: "Get live vault token balances (USDC, WETH, cbBTC) from Base L2",
      inputSchema: { type: "object", properties: {}, required: [] },
      handler: async () => {
        try {
          const b = await gitbank.getBalance();
          return ok(JSON.stringify(b, null, 2));
        } catch (e) {
          return err(String(e));
        }
      },
    },
    {
      name: "gitbank_stats",
      description: "Get Gitbank platform-wide stats: total vaults, transactions, projects",
      inputSchema: { type: "object", properties: {}, required: [] },
      handler: async () => {
        try {
          const s = await gitbank.getStats();
          return ok(JSON.stringify(s, null, 2));
        } catch (e) {
          return err(String(e));
        }
      },
    },
    {
      name: "gitbank_deposit",
      description: "Lock tokens into the user's GitVault on Base L2",
      inputSchema: {
        type: "object",
        properties: {
          token: { type: "string", enum: ["USDC", "WETH", "cbBTC"], description: "Token to deposit" },
          amount: { type: "string", description: "Human-readable amount (e.g. '50' for 50 USDC)" },
        },
        required: ["token", "amount"],
      },
      handler: async (args) => {
        try {
          const r = await gitbank.lock(String(args["token"]), String(args["amount"]));
          return ok(JSON.stringify(r, null, 2));
        } catch (e) {
          return err(String(e));
        }
      },
    },
    {
      name: "gitbank_withdraw",
      description: "Withdraw tokens from GitVault to an external wallet address",
      inputSchema: {
        type: "object",
        properties: {
          token: { type: "string", enum: ["USDC", "WETH", "cbBTC"] },
          amount: { type: "string" },
        },
        required: ["token", "amount"],
      },
      handler: async (args) => {
        try {
          const r = await gitbank.unlock(String(args["token"]), String(args["amount"]));
          return ok(JSON.stringify(r, null, 2));
        } catch (e) {
          return err(String(e));
        }
      },
    },
    {
      name: "gitbank_swap",
      description: "Swap tokens inside GitVault via Uniswap v3 on Base L2",
      inputSchema: {
        type: "object",
        properties: {
          tokenIn: { type: "string", enum: ["USDC", "WETH"] },
          tokenOut: { type: "string", enum: ["USDC", "WETH"] },
          amountIn: { type: "string" },
          slippageBps: { type: "number", description: "Slippage in basis points (default 50)" },
        },
        required: ["tokenIn", "tokenOut", "amountIn"],
      },
      handler: async (args) => {
        try {
          const r = await gitbank.swap(
            String(args["tokenIn"]),
            String(args["tokenOut"]),
            String(args["amountIn"]),
            typeof args["slippageBps"] === "number" ? args["slippageBps"] : 50
          );
          return ok(JSON.stringify(r, null, 2));
        } catch (e) {
          return err(String(e));
        }
      },
    },
    {
      name: "gitbank_send",
      description: "Send tokens to another contributor's GitVault (2-step commit-reveal, front-run proof)",
      inputSchema: {
        type: "object",
        properties: {
          token: { type: "string", enum: ["USDC", "WETH"] },
          recipient: { type: "string", description: "Recipient vault address (0x...)" },
          amount: { type: "string" },
        },
        required: ["token", "recipient", "amount"],
      },
      handler: async (args) => {
        try {
          const init = await gitbank.initTransfer(String(args["token"]), String(args["recipient"]), String(args["amount"]));
          const final = await gitbank.finalizeTransfer(init.initHash);
          return ok(JSON.stringify({ init, final }, null, 2));
        } catch (e) {
          return err(String(e));
        }
      },
    },
    {
      name: "gitbank_list_projects",
      description: "List all Gitbank projects owned by the authenticated user",
      inputSchema: { type: "object", properties: {}, required: [] },
      handler: async () => {
        try {
          const p = await gitbank.getProjects();
          return ok(JSON.stringify(p, null, 2));
        } catch (e) {
          return err(String(e));
        }
      },
    },
    {
      name: "gitbank_get_project",
      description: "Get a Gitbank project by ID including all tasks and bounties",
      inputSchema: {
        type: "object",
        properties: { projectId: { type: "number" } },
        required: ["projectId"],
      },
      handler: async (args) => {
        try {
          const p = await gitbank.getProject(Number(args["projectId"]));
          return ok(JSON.stringify(p, null, 2));
        } catch (e) {
          return err(String(e));
        }
      },
    },
    {
      name: "gitbank_create_project",
      description: "Create a new on-chain project with a token budget on Base L2",
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string" },
          repo: { type: "string", description: "GitHub repo in owner/repo format" },
          token: { type: "string", enum: ["USDC", "WETH"] },
          budget: { type: "string", description: "Budget amount as decimal string" },
        },
        required: ["name", "repo", "token", "budget"],
      },
      handler: async (args) => {
        try {
          const p = await gitbank.createProject({
            name: String(args["name"]),
            repo: String(args["repo"]),
            token: String(args["token"]),
            budget: String(args["budget"]),
          });
          return ok(JSON.stringify(p, null, 2));
        } catch (e) {
          return err(String(e));
        }
      },
    },
    {
      name: "gitbank_assign_bounty",
      description: "Assign a bounty to a GitHub issue and lock funds on-chain",
      inputSchema: {
        type: "object",
        properties: {
          projectId: { type: "number" },
          issueNumber: { type: "number" },
          repo: { type: "string" },
          contributorGithubId: { type: "number" },
          bountyAmount: { type: "string" },
          token: { type: "string", enum: ["USDC", "WETH"] },
        },
        required: ["projectId", "issueNumber", "repo", "contributorGithubId", "bountyAmount", "token"],
      },
      handler: async (args) => {
        try {
          const t = await gitbank.createTask(Number(args["projectId"]), {
            issueNumber: Number(args["issueNumber"]),
            repo: String(args["repo"]),
            contributorGithubId: Number(args["contributorGithubId"]),
            bountyAmount: String(args["bountyAmount"]),
            token: String(args["token"]),
          });
          return ok(JSON.stringify(t, null, 2));
        } catch (e) {
          return err(String(e));
        }
      },
    },
    {
      name: "gitbank_cancel_task",
      description: "Cancel a task and reclaim the bounty back to the project budget",
      inputSchema: {
        type: "object",
        properties: {
          projectId: { type: "number" },
          taskId: { type: "number" },
        },
        required: ["projectId", "taskId"],
      },
      handler: async (args) => {
        try {
          const r = await gitbank.cancelTask(Number(args["projectId"]), Number(args["taskId"]));
          return ok(JSON.stringify(r, null, 2));
        } catch (e) {
          return err(String(e));
        }
      },
    },
    {
      name: "gitbank_transactions",
      description: "Get transaction history from the Gitbank vault",
      inputSchema: {
        type: "object",
        properties: {
          projectId: { type: "number" },
          limit: { type: "number" },
          offset: { type: "number" },
        },
        required: [],
      },
      handler: async (args) => {
        try {
          const txs = await gitbank.getTransactions({
            projectId: args["projectId"] ? Number(args["projectId"]) : undefined,
            limit: args["limit"] ? Number(args["limit"]) : 20,
            offset: args["offset"] ? Number(args["offset"]) : 0,
          });
          return ok(JSON.stringify(txs, null, 2));
        } catch (e) {
          return err(String(e));
        }
      },
    },
    {
      name: "gitbank_repos",
      description: "List GitHub repos where Gitbank GitHub App is installed",
      inputSchema: { type: "object", properties: {}, required: [] },
      handler: async () => {
        try {
          const repos = await gitbank.getRepos();
          return ok(JSON.stringify(repos, null, 2));
        } catch (e) {
          return err(String(e));
        }
      },
    },
    {
      name: "gitbank_deploy_vault",
      description: "Deploy a new GitVault smart contract on Base L2 for the authenticated user (one-time)",
      inputSchema: { type: "object", properties: {}, required: [] },
      handler: async () => {
        try {
          const r = await gitbank.deployVault();
          return ok(JSON.stringify(r, null, 2));
        } catch (e) {
          return err(String(e));
        }
      },
    },
    {
      name: "gitlawb_node_status",
      description: "Get the status of the connected Gitlawb decentralized git node",
      inputSchema: { type: "object", properties: {}, required: [] },
      handler: async () => {
        try {
          const s = await gitlawb.nodeStatus();
          return ok(JSON.stringify(s, null, 2));
        } catch (e) {
          return err(String(e));
        }
      },
    },
    {
      name: "gitlawb_list_repos",
      description: "List repositories on the Gitlawb decentralized git network",
      inputSchema: {
        type: "object",
        properties: { ownerDid: { type: "string", description: "Filter by DID owner (optional)" } },
        required: [],
      },
      handler: async (args) => {
        try {
          const repos = await gitlawb.listRepos(args["ownerDid"] ? String(args["ownerDid"]) : undefined);
          return ok(JSON.stringify(repos, null, 2));
        } catch (e) {
          return err(String(e));
        }
      },
    },
    {
      name: "gitlawb_create_repo",
      description: "Create a new repository on the Gitlawb decentralized git network",
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string" },
          description: { type: "string" },
        },
        required: ["name"],
      },
      handler: async (args) => {
        try {
          const r = await gitlawb.createRepo(String(args["name"]), args["description"] ? String(args["description"]) : "");
          return ok(JSON.stringify(r, null, 2));
        } catch (e) {
          return err(String(e));
        }
      },
    },
    {
      name: "gitlawb_open_pr",
      description: "Open a pull request on a Gitlawb decentralized repository",
      inputSchema: {
        type: "object",
        properties: {
          repo: { type: "string" },
          head: { type: "string" },
          base: { type: "string" },
          title: { type: "string" },
          body: { type: "string" },
        },
        required: ["repo", "head", "base", "title"],
      },
      handler: async (args) => {
        try {
          const pr = await gitlawb.openPR(String(args["repo"]), String(args["head"]), String(args["base"]), String(args["title"]), args["body"] ? String(args["body"]) : "");
          return ok(JSON.stringify(pr, null, 2));
        } catch (e) {
          return err(String(e));
        }
      },
    },
    {
      name: "gitlawb_read_file",
      description: "Read a file from a Gitlawb repository at a given ref",
      inputSchema: {
        type: "object",
        properties: {
          repo: { type: "string" },
          path: { type: "string" },
          ref: { type: "string", description: "Branch or commit (default: main)" },
        },
        required: ["repo", "path"],
      },
      handler: async (args) => {
        try {
          const content = await gitlawb.readFile(String(args["repo"]), String(args["path"]), args["ref"] ? String(args["ref"]) : "main");
          return ok(content);
        } catch (e) {
          return err(String(e));
        }
      },
    },
    {
      name: "gitbank_did_show",
      description: "Show the current local DID (Decentralized Identity) linked to this Gitbank installation",
      inputSchema: { type: "object", properties: {}, required: [] },
      handler: async () => {
        const doc = loadDID();
        if (!doc) return err("No DID found. Run: gitbank did new");
        return ok(JSON.stringify(doc, null, 2));
      },
    },
    {
      name: "gitbank_did_new",
      description: "Generate a new Ed25519 DID keypair for Gitbank/Gitlawb identity",
      inputSchema: { type: "object", properties: {}, required: [] },
      handler: async () => {
        const { generateDID } = await import("./did.js");
        const doc = generateDID();
        return ok(JSON.stringify(doc, null, 2));
      },
    },
  ];
}
