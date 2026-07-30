import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { EventEmitter } from "node:events";
import { isAbsolute } from "node:path";
import { createInterface, type Interface as ReadlineInterface } from "node:readline";

import {
  type AcpContentBlock,
  type AcpImplementationInfo,
  type AcpInitializeResponse,
  type AcpNewSessionRequest,
  type AcpNewSessionResponse,
  type AcpPermissionRequest,
  type AcpPermissionResponse,
  type AcpPromptResponse,
  type JsonRpcFailure,
  type JsonRpcId,
  type JsonRpcMessage,
  isAcpPermissionRequest,
  isAcpInitializeResponse,
  isAcpContentBlock,
  isAcpMcpServer,
  isAcpNewSessionResponse,
  isAcpPromptResponse,
  isJsonRpcId,
  isPermissionResponseForRequest,
  isRecord,
  isSessionUpdateParams,
  safeRejectPermission,
} from "./protocol.js";

export interface AcpPermissionContext {
  requestId: JsonRpcId;
  signal: AbortSignal;
}

export type AcpPermissionHandler = (
  request: AcpPermissionRequest,
  context: AcpPermissionContext,
) => Promise<AcpPermissionResponse> | AcpPermissionResponse;

export interface AcpClientOptions {
  command: string;
  args?: string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  clientInfo?: AcpImplementationInfo;
  startupTimeoutMs?: number;
  shutdownTimeoutMs?: number;
  requestTimeoutMs?: number;
  promptTimeoutMs?: number;
  permissionHandler?: AcpPermissionHandler;
}

interface PendingRequest {
  method: string;
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer?: NodeJS.Timeout;
}

interface PendingPermission {
  sessionId: string;
  controller: AbortController;
  responded: boolean;
}

export class AcpRpcError extends Error {
  readonly code: number;
  readonly data: unknown;

  constructor(error: JsonRpcFailure["error"]) {
    super(error.message);
    this.name = "AcpRpcError";
    this.code = error.code;
    this.data = error.data;
  }
}

export class AcpRequestTimeoutError extends Error {
  constructor(
    readonly method: string,
    readonly timeoutMs: number,
  ) {
    super(`ACP request ${method} timed out after ${timeoutMs}ms`);
    this.name = "AcpRequestTimeoutError";
  }
}

export class AcpProtocolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AcpProtocolError";
  }
}

export class AcpClient extends EventEmitter {
  readonly options: Readonly<AcpClientOptions>;

  #child: ChildProcessWithoutNullStreams | undefined;
  #lineReader: ReadlineInterface | undefined;
  #nextId = 1;
  #pending = new Map<JsonRpcId, PendingRequest>();
  #permissions = new Map<JsonRpcId, PendingPermission>();
  #initialized: AcpInitializeResponse | undefined;
  #exitPromise: Promise<{ code: number | null; signal: NodeJS.Signals | null }>;
  #resolveExit:
    | ((value: { code: number | null; signal: NodeJS.Signals | null }) => void)
    | undefined;
  #exited = false;
  #shuttingDown = false;
  #transportFailed = false;

  constructor(options: AcpClientOptions) {
    super();
    if (typeof options.command !== "string" || !options.command.trim()) {
      throw new Error("ACP agent command must not be empty");
    }
    for (const [name, value] of [
      ["startupTimeoutMs", options.startupTimeoutMs],
      ["shutdownTimeoutMs", options.shutdownTimeoutMs],
      ["requestTimeoutMs", options.requestTimeoutMs],
      ["promptTimeoutMs", options.promptTimeoutMs],
    ] as const) {
      if (
        value !== undefined &&
        (!Number.isSafeInteger(value) || value <= 0)
      ) {
        throw new Error(`${name} must be a positive integer`);
      }
    }

    this.options = options;
    this.#exitPromise = new Promise((resolve) => {
      this.#resolveExit = resolve;
    });
  }

  get initialized(): AcpInitializeResponse | undefined {
    return this.#initialized;
  }

  get pid(): number | undefined {
    return this.#child?.pid;
  }

  get running(): boolean {
    return (
      this.#child !== undefined && !this.#exited && !this.#transportFailed
    );
  }

  static async start(options: AcpClientOptions): Promise<AcpClient> {
    const client = new AcpClient(options);
    await client.start();
    return client;
  }

  async start(): Promise<AcpInitializeResponse> {
    if (this.#child) {
      throw new Error("ACP client has already been started");
    }

    const spawnOptions: {
      cwd?: string;
      env: NodeJS.ProcessEnv;
      stdio: ["pipe", "pipe", "pipe"];
    } = {
      env: this.options.env ?? process.env,
      stdio: ["pipe", "pipe", "pipe"],
    };
    if (this.options.cwd) {
      spawnOptions.cwd = this.options.cwd;
    }

    const child = spawn(this.options.command, this.options.args ?? [], spawnOptions);
    this.#child = child;
    this.#lineReader = createInterface({
      input: child.stdout,
      crlfDelay: Infinity,
    });

    this.#lineReader.on("line", (line) => this.#acceptLine(line));
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => this.emit("stderr", chunk));
    child.stdin.on("error", (error) => this.#handleStdinError(error));
    child.once("error", (error) => this.#handleProcessError(error));
    child.once("exit", (code, signal) => this.#handleExit(code, signal));

    try {
      const rawResponse = await this.request<unknown>(
        "initialize",
        {
          protocolVersion: 1,
          clientCapabilities: {},
          clientInfo: this.options.clientInfo ?? {
            name: "lattice-acp-sidecar",
            title: "Lattice ACP Sidecar",
            version: "0.1.0",
          },
        },
        this.options.startupTimeoutMs ?? 15_000,
      );
      if (!isAcpInitializeResponse(rawResponse)) {
        throw this.#invalidResponse("initialize");
      }
      const response: AcpInitializeResponse = rawResponse;

      if (response.protocolVersion !== 1) {
        throw new Error(
          `ACP protocol mismatch: agent selected v${response.protocolVersion}, client supports v1`,
        );
      }

      this.#initialized = response;
      return response;
    } catch (error) {
      await this.shutdown().catch(() => undefined);
      throw error;
    }
  }

  async newSession(
    request: AcpNewSessionRequest,
  ): Promise<AcpNewSessionResponse> {
    if (
      !request ||
      typeof request.cwd !== "string" ||
      !isAbsolute(request.cwd)
    ) {
      throw new Error("ACP session cwd must be an absolute path");
    }
    if (
      request.additionalDirectories !== undefined &&
      !Array.isArray(request.additionalDirectories)
    ) {
      throw new Error("ACP additionalDirectories must be an array");
    }
    for (const directory of request.additionalDirectories ?? []) {
      if (typeof directory !== "string" || !isAbsolute(directory)) {
        throw new Error("ACP additionalDirectories entries must be absolute paths");
      }
    }
    if (
      request.mcpServers !== undefined &&
      (!Array.isArray(request.mcpServers) ||
        !request.mcpServers.every(isAcpMcpServer))
    ) {
      throw new Error("ACP mcpServers entries must match the v1 schema");
    }

    const params: Record<string, unknown> = {
      cwd: request.cwd,
      mcpServers: request.mcpServers ?? [],
    };
    if (request.additionalDirectories?.length) {
      params.additionalDirectories = request.additionalDirectories;
    }
    if (request._meta) {
      params._meta = request._meta;
    }

    const response = await this.request<unknown>("session/new", params);
    if (!isAcpNewSessionResponse(response)) {
      throw this.#invalidResponse("session/new");
    }
    return response;
  }

  async prompt(
    sessionId: string,
    prompt: AcpContentBlock[],
  ): Promise<AcpPromptResponse> {
    if (typeof sessionId !== "string" || !sessionId) {
      throw new Error("ACP sessionId must not be empty");
    }
    if (
      !Array.isArray(prompt) ||
      prompt.length === 0 ||
      !prompt.every(isAcpContentBlock)
    ) {
      throw new Error(
        "ACP prompt must contain valid v1 content blocks",
      );
    }

    try {
      const response = await this.request<unknown>(
        "session/prompt",
        {
          sessionId,
          prompt,
        },
        this.options.promptTimeoutMs ?? 30 * 60_000,
      );
      if (!isAcpPromptResponse(response)) {
        throw this.#invalidResponse("session/prompt");
      }
      return response;
    } catch (error) {
      if (error instanceof AcpRequestTimeoutError && this.running) {
        try {
          this.cancelSession(sessionId);
        } catch {
          // The timeout is the primary failure; transport failure is handled separately.
        }
      }
      throw error;
    }
  }

  cancelSession(sessionId: string): void {
    if (typeof sessionId !== "string" || !sessionId) {
      throw new Error("ACP sessionId must not be empty");
    }
    this.notify("session/cancel", { sessionId });

    for (const [requestId, permission] of this.#permissions) {
      if (permission.sessionId !== sessionId || permission.responded) {
        continue;
      }
      permission.responded = true;
      permission.controller.abort();
      this.#permissions.delete(requestId);
      this.#write({
        jsonrpc: "2.0",
        id: requestId,
        result: { outcome: { outcome: "cancelled" } },
      });
    }
  }

  request<T>(
    method: string,
    params?: unknown,
    timeoutMs?: number,
  ): Promise<T> {
    if (typeof method !== "string" || !method) {
      return Promise.reject(new Error("ACP method must not be empty"));
    }
    if (!this.running || this.#shuttingDown) {
      return Promise.reject(new Error("ACP agent process is not running"));
    }

    const id = this.#nextId++;
    return new Promise<T>((resolve, reject) => {
      const pending: PendingRequest = {
        method,
        resolve: (value) => resolve(value as T),
        reject,
      };

      const effectiveTimeoutMs =
        timeoutMs ?? this.options.requestTimeoutMs ?? 30_000;
      if (
        !Number.isSafeInteger(effectiveTimeoutMs) ||
        effectiveTimeoutMs <= 0
      ) {
        reject(new Error("ACP request timeout must be a positive integer"));
        return;
      }
      pending.timer = setTimeout(() => {
        this.#pending.delete(id);
        reject(new AcpRequestTimeoutError(method, effectiveTimeoutMs));
      }, effectiveTimeoutMs);
      pending.timer.unref();

      this.#pending.set(id, pending);
      try {
        this.#write({
          jsonrpc: "2.0",
          id,
          method,
          ...(params === undefined ? {} : { params }),
        });
      } catch (error) {
        this.#pending.delete(id);
        if (pending.timer) {
          clearTimeout(pending.timer);
        }
        reject(asError(error));
      }
    });
  }

  notify(method: string, params?: unknown): void {
    if (!this.running || this.#shuttingDown) {
      throw new Error("ACP agent process is not running");
    }
    this.#write({
      jsonrpc: "2.0",
      method,
      ...(params === undefined ? {} : { params }),
    });
  }

  async shutdown(): Promise<void> {
    if (this.#shuttingDown || !this.#child || this.#exited) {
      return;
    }
    this.#shuttingDown = true;

    for (const [requestId, permission] of this.#permissions) {
      if (!permission.responded) {
        permission.responded = true;
        permission.controller.abort();
        try {
          this.#write({
            jsonrpc: "2.0",
            id: requestId,
            result: { outcome: { outcome: "cancelled" } },
          });
        } catch {
          // Closing stdin can race the final permission response.
        }
      }
    }
    this.#permissions.clear();

    try {
      this.#child.stdin.end();
    } catch {
      this.#child.kill("SIGTERM");
    }
    const graceMs = this.options.shutdownTimeoutMs ?? 2_000;
    if (await this.#waitForExit(graceMs)) {
      return;
    }

    this.#child.kill("SIGTERM");
    if (await this.#waitForExit(graceMs)) {
      return;
    }

    this.#child.kill("SIGKILL");
    await this.#exitPromise;
  }

  #write(message: JsonRpcMessage): void {
    if (!this.#child?.stdin.writable) {
      throw new Error("ACP agent stdin is not writable");
    }
    try {
      this.#child.stdin.write(`${JSON.stringify(message)}\n`, (error) => {
        if (error) {
          this.#handleStdinError(error);
        }
      });
    } catch (error) {
      const normalized = asError(error);
      this.#handleStdinError(normalized);
      throw normalized;
    }
  }

  #acceptLine(line: string): void {
    if (!line.trim()) {
      return;
    }

    let message: unknown;
    try {
      message = JSON.parse(line);
    } catch {
      this.#protocolFailure(new Error("ACP agent wrote non-JSON data to stdout"));
      return;
    }

    if (!isRecord(message) || message.jsonrpc !== "2.0") {
      this.#protocolFailure(new Error("ACP agent wrote an invalid JSON-RPC message"));
      return;
    }

    if (typeof message.method === "string") {
      if (isJsonRpcId(message.id)) {
        void this.#handleAgentRequest(
          message.id,
          message.method,
          message.params,
        ).catch((error) => this.#transportFailure(asError(error)));
      } else {
        this.#handleAgentNotification(message.method, message.params);
      }
      return;
    }

    if (!isJsonRpcId(message.id)) {
      this.#protocolFailure(new Error("ACP response is missing a valid id"));
      return;
    }

    const pending = this.#pending.get(message.id);
    if (!pending) {
      this.emit("protocolError", new Error(`Unexpected ACP response id ${message.id}`));
      return;
    }
    this.#pending.delete(message.id);
    if (pending.timer) {
      clearTimeout(pending.timer);
    }

    const hasResult = Object.hasOwn(message, "result");
    const hasError = Object.hasOwn(message, "error");
    if (hasResult === hasError) {
      const error = new AcpProtocolError(
        `ACP response for ${pending.method} must contain exactly one of result or error`,
      );
      pending.reject(error);
      this.#protocolFailure(error);
      return;
    }

    if (hasError) {
      if (
        !isRecord(message.error) ||
        typeof message.error.code !== "number" ||
        typeof message.error.message !== "string"
      ) {
        const error = new AcpProtocolError(
          `ACP error response for ${pending.method} is malformed`,
        );
        pending.reject(error);
        this.#protocolFailure(error);
        return;
      }
      pending.reject(
        new AcpRpcError({
          code: message.error.code,
          message: message.error.message,
          ...(message.error.data === undefined
            ? {}
            : { data: message.error.data }),
        }),
      );
      return;
    }

    pending.resolve(message.result);
  }

  #handleAgentNotification(method: string, params: unknown): void {
    if (method === "session/update") {
      if (!isSessionUpdateParams(params)) {
        this.emit("protocolError", new Error("Invalid ACP session/update params"));
        return;
      }
      this.emit("sessionUpdate", params);
      return;
    }

    this.emit("notification", { method, params });
  }

  async #handleAgentRequest(
    id: JsonRpcId,
    method: string,
    params: unknown,
  ): Promise<void> {
    if (method !== "session/request_permission") {
      this.#write({
        jsonrpc: "2.0",
        id,
        error: {
          code: -32_601,
          message: `Method not supported by Lattice ACP client: ${method}`,
        },
      });
      return;
    }

    if (!isAcpPermissionRequest(params)) {
      this.#write({
        jsonrpc: "2.0",
        id,
        error: {
          code: -32_602,
          message: "Invalid session/request_permission params",
        },
      });
      return;
    }

    const permission: PendingPermission = {
      sessionId: params.sessionId,
      controller: new AbortController(),
      responded: false,
    };
    this.#permissions.set(id, permission);

    let response: AcpPermissionResponse;
    try {
      const handlerResult = Promise.resolve(
        (this.options.permissionHandler ?? safeRejectPermission)(params, {
          requestId: id,
          signal: permission.controller.signal,
        }),
      );
      const cancelled = new Promise<AcpPermissionResponse>((resolve) => {
        permission.controller.signal.addEventListener(
          "abort",
          () => resolve({ outcome: { outcome: "cancelled" } }),
          { once: true },
        );
      });
      const candidate = await Promise.race([handlerResult, cancelled]);
      if (!isPermissionResponseForRequest(candidate, params)) {
        this.emit(
          "protocolError",
          new AcpProtocolError(
            "Permission handler returned an invalid or unoffered option",
          ),
        );
        response = safeRejectPermission(params);
      } else {
        response = candidate;
      }
    } catch (error) {
      this.emit("protocolError", error);
      response = safeRejectPermission(params);
    }

    if (permission.responded) {
      return;
    }
    permission.responded = true;
    this.#permissions.delete(id);
    this.#write({
      jsonrpc: "2.0",
      id,
      result: response,
    });
  }

  #protocolFailure(error: Error): void {
    this.emit("protocolError", error);
    this.#transportFailure(error);
  }

  #failConnection(error: Error): void {
    for (const pending of this.#pending.values()) {
      if (pending.timer) {
        clearTimeout(pending.timer);
      }
      pending.reject(error);
    }
    this.#pending.clear();
  }

  #abortPermissions(): void {
    for (const permission of this.#permissions.values()) {
      permission.responded = true;
      permission.controller.abort();
    }
    this.#permissions.clear();
  }

  #handleStdinError(error: Error): void {
    if (this.#shuttingDown || this.#exited) {
      return;
    }
    this.#transportFailure(error);
  }

  #handleProcessError(error: Error): void {
    this.#finishConnection(error, null, null);
  }

  #transportFailure(error: Error): void {
    if (this.#exited || this.#transportFailed) {
      return;
    }
    this.#transportFailed = true;
    this.#failConnection(error);
    this.#abortPermissions();
    this.#child?.kill("SIGTERM");
    const forceKill = setTimeout(() => {
      if (!this.#exited) {
        this.#child?.kill("SIGKILL");
      }
    }, this.options.shutdownTimeoutMs ?? 2_000);
    forceKill.unref();
  }

  #handleExit(code: number | null, signal: NodeJS.Signals | null): void {
    this.#finishConnection(
      new Error(
        `ACP agent exited${code === null ? "" : ` with code ${code}`}${
          signal === null ? "" : ` from ${signal}`
        }`,
      ),
      code,
      signal,
    );
  }

  #finishConnection(
    error: Error,
    code: number | null,
    signal: NodeJS.Signals | null,
  ): void {
    if (this.#exited) {
      return;
    }
    this.#exited = true;
    this.#lineReader?.close();
    this.#abortPermissions();
    this.#failConnection(error);
    this.#resolveExit?.({ code, signal });
    this.emit("exit", { code, signal });
  }

  #invalidResponse(method: string): AcpProtocolError {
    const error = new AcpProtocolError(
      `ACP ${method} response does not match the v1 schema`,
    );
    this.#protocolFailure(error);
    return error;
  }

  async #waitForExit(timeoutMs: number): Promise<boolean> {
    if (this.#exited) {
      return true;
    }

    let timer: NodeJS.Timeout | undefined;
    const timedOut = new Promise<false>((resolve) => {
      timer = setTimeout(() => resolve(false), timeoutMs);
      timer.unref();
    });
    const exited = this.#exitPromise.then(() => true);
    const result = await Promise.race([exited, timedOut]);
    if (timer) {
      clearTimeout(timer);
    }
    return result;
  }
}

function asError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}
