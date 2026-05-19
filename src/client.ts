import {
  User,
  VaultBalance,
  DeployResponse,
  TxResponse,
  TransferInitResponse,
  KeyResponse,
  Project,
  Task,
  Transaction,
  Repo,
  Stats,
  CreateProjectInput,
  CreateTaskInput,
  GetTransactionsParams,
  GitbankClientOptions,
} from "./types.js";
import {
  GitbankError,
  GitbankAuthError,
  GitbankNetworkError,
} from "./errors.js";

export class GitbankClient {
  private baseUrl: string;
  private cookie: string | null;
  private onCookieUpdate?: (cookie: string) => void;

  constructor(options: GitbankClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? "https://gitbank.io").replace(/\/$/, "");
    this.cookie = options.cookie ?? null;
    this.onCookieUpdate = options.onCookieUpdate;
  }

  setCookie(cookie: string): void {
    this.cookie = cookie;
  }

  getCookie(): string | null {
    return this.cookie;
  }

  getLoginUrl(): string {
    return `${this.baseUrl}/api/auth/github`;
  }

  private buildHeaders(extra?: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    if (this.cookie) {
      headers["Cookie"] = this.cookie;
    }
    return { ...headers, ...extra };
  }

  private extractSetCookie(response: Response): void {
    const setCookie = response.headers.get("set-cookie");
    if (setCookie) {
      const sessionMatch = setCookie.match(/connect\.sid=[^;]+/);
      if (sessionMatch) {
        this.cookie = sessionMatch[0];
        this.onCookieUpdate?.(this.cookie);
      }
    }
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers: this.buildHeaders(),
        body: body !== undefined ? JSON.stringify(body) : undefined,
        redirect: "manual",
      });
    } catch (err) {
      throw new GitbankNetworkError(
        `Network error connecting to ${this.baseUrl}`,
        err
      );
    }

    this.extractSetCookie(response);

    if (response.status === 401) {
      throw new GitbankAuthError();
    }

    if (!response.ok) {
      let errorBody: unknown;
      try {
        errorBody = await response.json();
      } catch {
        errorBody = await response.text().catch(() => null);
      }
      const message =
        typeof errorBody === "object" &&
        errorBody !== null &&
        "message" in errorBody
          ? String((errorBody as Record<string, unknown>)["message"])
          : `HTTP ${response.status} ${response.statusText}`;
      throw new GitbankError(message, response.status, errorBody);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json() as Promise<T>;
  }

  private get<T>(path: string): Promise<T> {
    return this.request<T>("GET", path);
  }

  private post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("POST", path, body);
  }

  private delete<T>(path: string): Promise<T> {
    return this.request<T>("DELETE", path);
  }

  async me(): Promise<User> {
    return this.get<User>("/api/auth/me");
  }

  async logout(): Promise<{ message: string }> {
    const result = await this.post<{ message: string }>("/api/auth/logout");
    this.cookie = null;
    return result;
  }

  async getBalance(): Promise<VaultBalance> {
    return this.get<VaultBalance>("/api/vault/balance");
  }

  async deployVault(): Promise<DeployResponse> {
    return this.post<DeployResponse>("/api/vault/deploy");
  }

  async lock(token: string, amount: string): Promise<TxResponse> {
    return this.post<TxResponse>("/api/vault/lock", { token, amount });
  }

  async unlock(token: string, amount: string): Promise<TxResponse> {
    return this.post<TxResponse>("/api/vault/unlock", { token, amount });
  }

  async swap(
    tokenIn: string,
    tokenOut: string,
    amountIn: string,
    slippageBps = 50
  ): Promise<TxResponse> {
    return this.post<TxResponse>("/api/vault/swap", {
      tokenIn,
      tokenOut,
      amountIn,
      slippageBps,
    });
  }

  async initTransfer(
    token: string,
    recipient: string,
    amount: string
  ): Promise<TransferInitResponse> {
    return this.post<TransferInitResponse>("/api/vault/transfer/init", {
      token,
      recipient,
      amount,
    });
  }

  async finalizeTransfer(initHash: string): Promise<TxResponse> {
    return this.post<TxResponse>("/api/vault/transfer/finalize", { initHash });
  }

  async getKey(): Promise<KeyResponse> {
    return this.get<KeyResponse>("/api/vault/key");
  }

  async getProjects(): Promise<Project[]> {
    return this.get<Project[]>("/api/projects");
  }

  async createProject(data: CreateProjectInput): Promise<Project> {
    return this.post<Project>("/api/projects", data);
  }

  async getProject(projectId: number): Promise<Project> {
    return this.get<Project>(`/api/projects/${projectId}`);
  }

  async createTask(projectId: number, data: CreateTaskInput): Promise<Task> {
    return this.post<Task>(`/api/projects/${projectId}/tasks`, data);
  }

  async cancelTask(projectId: number, taskId: number): Promise<TxResponse> {
    return this.delete<TxResponse>(
      `/api/projects/${projectId}/tasks/${taskId}`
    );
  }

  async getTransactions(params: GetTransactionsParams = {}): Promise<Transaction[]> {
    const qs = new URLSearchParams();
    if (params.projectId !== undefined)
      qs.set("projectId", String(params.projectId));
    if (params.limit !== undefined) qs.set("limit", String(params.limit));
    if (params.offset !== undefined) qs.set("offset", String(params.offset));
    const query = qs.toString() ? `?${qs.toString()}` : "";
    return this.get<Transaction[]>(`/api/transactions${query}`);
  }

  async getRepos(): Promise<Repo[]> {
    return this.get<Repo[]>("/api/repos");
  }

  async removeRepo(installationId: number): Promise<void> {
    return this.delete<void>(`/api/repos/${installationId}`);
  }

  async getStats(): Promise<Stats> {
    return this.get<Stats>("/api/stats");
  }

  async healthz(): Promise<{ status: string }> {
    return this.get<{ status: string }>("/api/healthz");
  }
}
