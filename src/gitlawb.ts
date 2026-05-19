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
  title: string;
  body: string;
  head: string;
  base: string;
  status: string;
  author: string;
  createdAt: string;
}

export interface GitlawbIssue {
  id: string;
  title: string;
  body: string;
  status: string;
  author: string;
  labels: string[];
  createdAt: string;
}

export interface GitlawbNodeStatus {
  online: boolean;
  did: string;
  region: string;
  peers: number;
  repos: number;
  writesAccepted: number;
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

  async nodeStatus(): Promise<GitlawbNodeStatus> {
    return this.request<GitlawbNodeStatus>("GET", "/api/v1/status");
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

  async openPR(repo: string, head: string, base: string, title: string, body = ""): Promise<GitlawbPR> {
    return this.request<GitlawbPR>("POST", `/api/v1/repos/${encodeURIComponent(repo)}/pulls`, {
      head, base, title, body,
    });
  }

  async listIssues(repo: string): Promise<GitlawbIssue[]> {
    return this.request<GitlawbIssue[]>("GET", `/api/v1/repos/${encodeURIComponent(repo)}/issues`);
  }

  async createIssue(repo: string, title: string, body = ""): Promise<GitlawbIssue> {
    return this.request<GitlawbIssue>("POST", `/api/v1/repos/${encodeURIComponent(repo)}/issues`, { title, body });
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
}
