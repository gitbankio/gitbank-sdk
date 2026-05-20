import { GitbankNetworkError, GitbankError } from "./errors.js";

export interface GitlawbClientOptions {
  node?: string;
  did?: string;
  keyPath?: string;
}

export interface GitlawbRepo {
  id: string;
  name: string;
  description: string;
  owner: string;
  defaultBranch: string;
  cloneUrl: string;
  createdAt: string;
  updatedAt: string;
}

export interface GitlawbIdentity {
  did: string;
  type: string;
  publicKey: string;
  trustScore?: number;
}

export interface GitlawbPR {
  id: string;
  number?: number;
  title: string;
  body: string;
  head: string;
  base: string;
  status: string;
  author: string;
  reviewStatus?: string;
  createdAt: string;
  mergedAt?: string;
}

export interface GitlawbPRReview {
  id: string;
  author: string;
  status: "approved" | "changes_requested" | "comment";
  body: string;
  createdAt: string;
}

export interface GitlawbIssue {
  id: string;
  number?: number;
  title: string;
  body: string;
  status: string;
  author: string;
  labels: string[];
  createdAt: string;
  closedAt?: string;
}

export interface GitlawbNodeStatus {
  online: boolean;
  did: string;
  region: string;
  peers: number;
  repos: number;
  writesAccepted: number;
  version?: string;
}

export interface GitlawbTrustScore {
  did: string;
  score: number;
  pushCount: number;
  registeredAt: string;
}

export interface GitlawbRegistration {
  did: string;
  ucan: string;
  registeredAt: string;
}

export class GitlawbClient {
  readonly node: string;
  readonly did: string | null;
  readonly keyPath: string | null;

  constructor(options: GitlawbClientOptions = {}) {
    this.node = (options.node ?? process.env["GITLAWB_NODE"] ?? "https://node.gitlawb.com").replace(/\/$/, "");
    this.did = options.did ?? process.env["GITLAWB_DID"] ?? null;
    this.keyPath = options.keyPath ?? process.env["GITLAWB_KEY"] ?? null;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.node}${path}`;
    let response: Response;
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json" };
      if (this.did) headers["X-Gitlawb-DID"] = this.did;
      response = await fetch(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (err) {
      throw new GitbankNetworkError(`Cannot reach Gitlawb node at ${this.node}`, err);
    }

    if (!response.ok) {
      let msg: string;
      try {
        const j = (await response.json()) as Record<string, unknown>;
        msg = String(j["error"] ?? j["message"] ?? `HTTP ${response.status}`);
      } catch {
        msg = `HTTP ${response.status}`;
      }
      throw new GitbankError(msg, response.status);
    }

    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  }

  private async requestText(method: string, path: string): Promise<string> {
    const url = `${this.node}${path}`;
    let response: Response;
    try {
      const headers: Record<string, string> = { Accept: "text/plain, */*" };
      if (this.did) headers["X-Gitlawb-DID"] = this.did;
      response = await fetch(url, { method, headers });
    } catch (err) {
      throw new GitbankNetworkError(`Cannot reach Gitlawb node at ${this.node}`, err);
    }
    if (!response.ok) {
      throw new GitbankError(`HTTP ${response.status}`, response.status);
    }
    return response.text();
  }

  async nodeStatus(): Promise<GitlawbNodeStatus> {
    return this.request<GitlawbNodeStatus>("GET", "/api/v1/status");
  }

  async register(): Promise<GitlawbRegistration> {
    if (!this.did) throw new GitbankError("No DID configured. Run: gitbank did new", 400);
    return this.request<GitlawbRegistration>("POST", "/api/v1/agents/register", { did: this.did });
  }

  async trustScore(did: string): Promise<GitlawbTrustScore> {
    return this.request<GitlawbTrustScore>("GET", `/api/v1/node/trust/${encodeURIComponent(did)}`);
  }

  async listRepos(ownerDid?: string): Promise<GitlawbRepo[]> {
    const qs = ownerDid ? `?owner=${encodeURIComponent(ownerDid)}` : "";
    return this.request<GitlawbRepo[]>("GET", `/api/v1/repos${qs}`);
  }

  async getRepo(name: string): Promise<GitlawbRepo> {
    return this.request<GitlawbRepo>("GET", `/api/v1/repos/${encodeURIComponent(name)}`);
  }

  async createRepo(name: string, description = ""): Promise<GitlawbRepo> {
    return this.request<GitlawbRepo>("POST", "/api/v1/repos", { name, description });
  }

  async listPRs(repo: string): Promise<GitlawbPR[]> {
    return this.request<GitlawbPR[]>("GET", `/api/v1/repos/${encodeURIComponent(repo)}/pulls`);
  }

  async getPR(repo: string, prId: string | number): Promise<GitlawbPR> {
    return this.request<GitlawbPR>("GET", `/api/v1/repos/${encodeURIComponent(repo)}/pulls/${prId}`);
  }

  async getPRDiff(repo: string, prId: string | number): Promise<string> {
    return this.requestText("GET", `/api/v1/repos/${encodeURIComponent(repo)}/pulls/${prId}/diff`);
  }

  async reviewPR(
    repo: string,
    prId: string | number,
    status: "approved" | "changes_requested" | "comment",
    body = ""
  ): Promise<GitlawbPRReview> {
    return this.request<GitlawbPRReview>(
      "POST",
      `/api/v1/repos/${encodeURIComponent(repo)}/pulls/${prId}/reviews`,
      { status, body }
    );
  }

  async mergePR(repo: string, prId: string | number): Promise<void> {
    return this.request<void>("POST", `/api/v1/repos/${encodeURIComponent(repo)}/pulls/${prId}/merge`);
  }

  async openPR(repo: string, head: string, base: string, title: string, body = ""): Promise<GitlawbPR> {
    return this.request<GitlawbPR>("POST", `/api/v1/repos/${encodeURIComponent(repo)}/pulls`, {
      head, base, title, body,
    });
  }

  async listIssues(repo: string): Promise<GitlawbIssue[]> {
    return this.request<GitlawbIssue[]>("GET", `/api/v1/repos/${encodeURIComponent(repo)}/issues`);
  }

  async getIssue(repo: string, issueId: string | number): Promise<GitlawbIssue> {
    return this.request<GitlawbIssue>("GET", `/api/v1/repos/${encodeURIComponent(repo)}/issues/${issueId}`);
  }

  async createIssue(repo: string, title: string, body = ""): Promise<GitlawbIssue> {
    return this.request<GitlawbIssue>("POST", `/api/v1/repos/${encodeURIComponent(repo)}/issues`, { title, body });
  }

  async closeIssue(repo: string, issueId: string | number): Promise<void> {
    return this.request<void>("PATCH", `/api/v1/repos/${encodeURIComponent(repo)}/issues/${issueId}`, {
      status: "closed",
    });
  }

  async readFile(repo: string, path: string, ref = "main"): Promise<string> {
    const r = await this.request<{ content: string }>(
      "GET",
      `/api/v1/repos/${encodeURIComponent(repo)}/contents/${encodeURIComponent(path)}?ref=${ref}`
    );
    return r.content;
  }

  cloneUrl(repo: string, ownerDid?: string): string {
    const did = ownerDid ?? this.did ?? "did:key:unknown";
    return `gitlawb://${did}/${repo}`;
  }

  profileUrl(did?: string): { profile: string; repos: string } {
    const d = did ?? this.did ?? "";
    const key = d.split(":")[2] ?? "";
    const short = key.slice(0, 8);
    return {
      profile: `https://gitlawb.com/${short}`,
      repos: "https://gitlawb.com/node/repos",
    };
  }
}
