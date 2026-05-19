export interface User {
  githubId: number;
  githubLogin: string;
  role: "member" | "manager";
  vaultAddress: string | null;
  ownerAddress: string | null;
}

export interface TokenBalance {
  token: string;
  symbol: string;
  gitToken: string;
  balance: string;
  usdValue: string;
}

export interface VaultBalance {
  vaultAddress: string | null;
  balances: TokenBalance[];
  totalUsdValue: string;
}

export interface DeployResponse {
  vaultAddress: string;
  ownerAddress: string;
  txHash: string;
}

export interface TxResponse {
  txHash: string;
  status: "pending" | "confirmed" | "failed";
  blockNumber?: number | null;
}

export interface TransferInitResponse {
  initHash: string;
  expiresAt: string;
}

export interface KeyResponse {
  address: string;
  privateKey: string;
}

export interface Project {
  id: number;
  onchainProjectId: number;
  ownerGithubId: number;
  repo: string;
  name: string;
  token: string;
  totalBudget: string;
  spentBudget: string;
  status: string;
  txHash: string;
  createdAt: string;
  updatedAt: string;
  tasks?: Task[];
}

export interface Task {
  id: number;
  issueNumber: number;
  repo: string;
  contributorGithubId: number;
  bountyAmount: string;
  token: string;
  status: "assigned" | "completed" | "cancelled";
  assignTxHash: string;
  payoutTxHash: string | null;
  assignedAt: string;
  completedAt: string | null;
}

export type TransactionType =
  | "lock"
  | "unlock"
  | "swap"
  | "transfer"
  | "bounty_assign"
  | "bounty_payout"
  | "bounty_reclaim"
  | "project_create";

export type TransactionStatus = "pending" | "confirmed" | "failed";

export interface Transaction {
  id: number;
  type: TransactionType;
  githubId: number;
  tokenIn: string | null;
  tokenOut: string | null;
  amountIn: string | null;
  amountOut: string | null;
  feeAmount: string | null;
  txHash: string | null;
  status: TransactionStatus;
  blockNumber: number | null;
  projectDbId: number | null;
  taskDbId: number | null;
  createdAt: string;
}

export interface Repo {
  installationId: number;
  repoFullName: string;
  repoId: number;
  private: boolean;
  defaultBranch: string;
  htmlUrl: string;
}

export interface Stats {
  totalVaults: number;
  totalTransactions: number;
  totalProjects: number;
}

export interface CreateProjectInput {
  name: string;
  repo: string;
  token: string;
  budget: string;
}

export interface CreateTaskInput {
  issueNumber: number;
  repo: string;
  contributorGithubId: number;
  bountyAmount: string;
  token: string;
}

export interface GetTransactionsParams {
  projectId?: number;
  limit?: number;
  offset?: number;
}

export interface GitbankClientOptions {
  baseUrl?: string;
  cookie?: string;
  onCookieUpdate?: (cookie: string) => void;
}
