import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { realpath } from "node:fs/promises";
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";

import {
  AcpClient,
  type AcpClientOptions,
  type AcpPermissionContext,
} from "./client.js";
import {
  type AcpContentBlock,
  type AcpMcpServer,
  type AcpPermissionRequest,
  type AcpPermissionResponse,
  isAcpContentBlock,
  isAcpMcpServer,
  isRecord,
  safeRejectPermission,
} from "./protocol.js";
import { LatticeProjectStorage } from "./lattice-storage.js";

export type PermissionMode = "reject" | "manual";

export interface AcpSidecarOptions {
  agent: AcpClientOptions;
  projectDir?: string;
  workspaceId?: string;
  host?: string;
  port?: number;
  token?: string;
  allowOrigin?: string;
  permissionMode?: PermissionMode;
  permissionTimeoutMs?: number;
  eventHistoryLimit?: number;
  sseClientQueueBytes?: number;
  allowClientMcpServers?: boolean;
}

export interface AcpSidecarInfo {
  host: string;
  port: number;
  baseUrl: string;
  token: string;
  projectDir: string;
  workspaceId: string;
  agentPid?: number;
  agent: unknown;
}

export interface SidecarEvent {
  sequence: number;
  timestamp: string;
  type: string;
  sessionId?: string;
  turnId?: string;
  data: unknown;
}

interface SseSubscriber {
  response: ServerResponse;
  sessionId?: string;
  queue: string[];
  queueBytes: number;
  blocked: boolean;
  closed: boolean;
  onDrain: () => void;
}

interface ManualPermission {
  request: AcpPermissionRequest;
  resolve: (response: AcpPermissionResponse) => void;
  timer: NodeJS.Timeout;
}

class EventBus {
  #sequence = 0;
  #history: SidecarEvent[] = [];
  #subscribers = new Set<SseSubscriber>();

  constructor(
    readonly historyLimit: number,
    readonly clientQueueBytes: number,
  ) {}

  get subscriberCount(): number {
    return this.#subscribers.size;
  }

  publish(
    event: Omit<SidecarEvent, "sequence" | "timestamp">,
  ): SidecarEvent {
    const complete: SidecarEvent = {
      ...event,
      sequence: ++this.#sequence,
      timestamp: new Date().toISOString(),
    };
    this.#history.push(complete);
    if (this.#history.length > this.historyLimit) {
      this.#history.splice(0, this.#history.length - this.historyLimit);
    }

    for (const subscriber of this.#subscribers) {
      if (
        subscriber.sessionId &&
        complete.sessionId &&
        complete.sessionId !== subscriber.sessionId
      ) {
        continue;
      }
      this.#send(subscriber, formatSse(complete));
    }
    return complete;
  }

  subscribe(
    response: ServerResponse,
    afterSequence: number,
    sessionId?: string,
  ): () => void {
    const subscriber: SseSubscriber = {
      response,
      queue: [],
      queueBytes: 0,
      blocked: false,
      closed: false,
      onDrain: () => this.#flush(subscriber),
      ...(sessionId ? { sessionId } : {}),
    };
    this.#subscribers.add(subscriber);
    response.on("drain", subscriber.onDrain);

    for (const event of this.#history) {
      if (event.sequence <= afterSequence) {
        continue;
      }
      if (sessionId && event.sessionId && event.sessionId !== sessionId) {
        continue;
      }
      this.#send(subscriber, formatSse(event));
      if (subscriber.closed) {
        break;
      }
    }

    return () => this.#remove(subscriber, false);
  }

  close(): void {
    for (const subscriber of [...this.#subscribers]) {
      this.#remove(subscriber, true);
    }
  }

  #send(subscriber: SseSubscriber, frame: string): void {
    if (
      subscriber.closed ||
      subscriber.response.destroyed ||
      subscriber.response.writableEnded
    ) {
      this.#remove(subscriber, false);
      return;
    }

    if (subscriber.blocked) {
      const bytes = Buffer.byteLength(frame);
      if (subscriber.queueBytes + bytes > this.clientQueueBytes) {
        this.#remove(subscriber, false);
        subscriber.response.destroy();
        return;
      }
      subscriber.queue.push(frame);
      subscriber.queueBytes += bytes;
      return;
    }

    try {
      if (!subscriber.response.write(frame)) {
        subscriber.blocked = true;
      }
    } catch {
      this.#remove(subscriber, false);
    }
  }

  #flush(subscriber: SseSubscriber): void {
    if (subscriber.closed) {
      return;
    }
    subscriber.blocked = false;
    while (subscriber.queue.length > 0) {
      const frame = subscriber.queue.shift();
      if (frame === undefined) {
        break;
      }
      subscriber.queueBytes -= Buffer.byteLength(frame);
      try {
        if (!subscriber.response.write(frame)) {
          subscriber.blocked = true;
          return;
        }
      } catch {
        this.#remove(subscriber, false);
        return;
      }
    }
  }

  #remove(subscriber: SseSubscriber, end: boolean): void {
    if (subscriber.closed) {
      return;
    }
    subscriber.closed = true;
    subscriber.queue = [];
    subscriber.queueBytes = 0;
    subscriber.response.off("drain", subscriber.onDrain);
    this.#subscribers.delete(subscriber);
    if (end && !subscriber.response.writableEnded) {
      subscriber.response.end();
    }
  }
}

class PermissionBroker {
  #pending = new Map<string, ManualPermission>();

  constructor(
    readonly mode: PermissionMode,
    readonly timeoutMs: number,
    readonly events: EventBus,
  ) {}

  handle = async (
    request: AcpPermissionRequest,
    context: AcpPermissionContext,
  ): Promise<AcpPermissionResponse> => {
    const permissionId = String(context.requestId);
    this.events.publish({
      type: "permission.requested",
      sessionId: request.sessionId,
      data: {
        permissionId,
        toolCall: request.toolCall,
        options: request.options,
      },
    });

    if (this.mode === "reject") {
      const response = safeRejectPermission(request);
      this.events.publish({
        type: "permission.resolved",
        sessionId: request.sessionId,
        data: { permissionId, response, policy: "reject" },
      });
      return response;
    }

    return new Promise<AcpPermissionResponse>((resolve) => {
      const finish = (response: AcpPermissionResponse, policy: string) => {
        const pending = this.#pending.get(permissionId);
        if (!pending) {
          return;
        }
        clearTimeout(pending.timer);
        this.#pending.delete(permissionId);
        context.signal.removeEventListener("abort", onAbort);
        this.events.publish({
          type: "permission.resolved",
          sessionId: request.sessionId,
          data: { permissionId, response, policy },
        });
        resolve(response);
      };

      const onAbort = () => {
        finish({ outcome: { outcome: "cancelled" } }, "cancel");
      };
      const timer = setTimeout(() => {
        finish(safeRejectPermission(request), "timeout");
      }, this.timeoutMs);
      timer.unref();

      this.#pending.set(permissionId, {
        request,
        resolve: (response) => finish(response, "manual"),
        timer,
      });
      context.signal.addEventListener("abort", onAbort, { once: true });
    });
  };

  resolve(permissionId: string, optionId: string): void {
    const pending = this.#pending.get(permissionId);
    if (!pending) {
      throw new HttpError(404, "permission_not_found", "Permission is not pending");
    }

    if (!pending.request.options.some((option) => option.optionId === optionId)) {
      throw new HttpError(
        400,
        "invalid_permission_option",
        "optionId is not one of the choices offered by the agent",
      );
    }

    pending.resolve({
      outcome: {
        outcome: "selected",
        optionId,
      },
    });
  }

  cancelAll(): void {
    for (const pending of [...this.#pending.values()]) {
      pending.resolve({ outcome: { outcome: "cancelled" } });
    }
  }
}

class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export class AcpSidecar {
  readonly client: AcpClient;
  readonly token: string;

  #options: AcpSidecarOptions;
  #events: EventBus;
  #permissions: PermissionBroker;
  #storage: LatticeProjectStorage;
  #server: Server;
  #sessions = new Set<string>();
  #activeTurns = new Map<string, string>();
  #info: AcpSidecarInfo | undefined;
  #closing = false;

  private constructor(
    options: AcpSidecarOptions,
    client: AcpClient,
    events: EventBus,
    permissions: PermissionBroker,
    storage: LatticeProjectStorage,
  ) {
    this.#options = options;
    this.client = client;
    this.#events = events;
    this.#permissions = permissions;
    this.#storage = storage;
    this.token = options.token ?? randomBytes(24).toString("base64url");
    this.#server = createServer((request, response) => {
      void this.#handleHttp(request, response);
    });
  }

  static async start(options: AcpSidecarOptions): Promise<AcpSidecar> {
    validateSidecarOptions(options);
    const storage = await LatticeProjectStorage.open(
      options.projectDir ?? options.agent.cwd ?? process.cwd(),
      options.workspaceId,
    );
    const events = new EventBus(
      options.eventHistoryLimit ?? 500,
      options.sseClientQueueBytes ?? 256 * 1024,
    );
    const permissions = new PermissionBroker(
      options.permissionMode ?? "reject",
      options.permissionTimeoutMs ?? 60_000,
      events,
    );
    const client = await AcpClient.start({
      ...options.agent,
      permissionHandler: permissions.handle,
    });
    const sidecar = new AcpSidecar(
      options,
      client,
      events,
      permissions,
      storage,
    );
    sidecar.#bindClientEvents();
    try {
      await sidecar.#listen();
    } catch (error) {
      await client.shutdown();
      throw error;
    }
    sidecar.#events.publish({
      type: "sidecar.ready",
      data: sidecar.info,
    });
    return sidecar;
  }

  get info(): AcpSidecarInfo {
    if (!this.#info) {
      throw new Error("ACP sidecar is not listening");
    }
    return this.#info;
  }

  async shutdown(): Promise<void> {
    if (this.#closing) {
      return;
    }
    this.#closing = true;
    this.#permissions.cancelAll();

    for (const sessionId of this.#activeTurns.keys()) {
      try {
        this.client.cancelSession(sessionId);
      } catch {
        // The agent may already have exited.
      }
    }

    this.#events.publish({
      type: "sidecar.stopping",
      data: {},
    });
    this.#events.close();

    await Promise.all([
      this.client.shutdown(),
      new Promise<void>((resolve) => {
        this.#server.close(() => resolve());
        this.#server.closeAllConnections();
      }),
    ]);
  }

  #bindClientEvents(): void {
    this.client.on("sessionUpdate", (params) => {
      const update = params as {
        sessionId: string;
        update: unknown;
      };
      const turnId = this.#activeTurns.get(update.sessionId);
      this.#events.publish({
        type: "session.update",
        sessionId: update.sessionId,
        ...(turnId ? { turnId } : {}),
        data: update.update,
      });
    });
    this.client.on("stderr", (chunk) => {
      this.#events.publish({
        type: "agent.stderr",
        data: { text: String(chunk) },
      });
    });
    this.client.on("protocolError", (error) => {
      this.#events.publish({
        type: "agent.protocol_error",
        data: {
          message: error instanceof Error ? error.message : String(error),
        },
      });
    });
    this.client.on("exit", (exit) => {
      this.#events.publish({
        type: "agent.exit",
        data: exit,
      });
    });
  }

  async #listen(): Promise<void> {
    const host = this.#options.host ?? "127.0.0.1";
    const port = this.#options.port ?? 0;
    await new Promise<void>((resolve, reject) => {
      this.#server.once("error", reject);
      this.#server.listen(port, host, () => {
        this.#server.off("error", reject);
        resolve();
      });
    });

    const address = this.#server.address();
    if (!address || typeof address === "string") {
      throw new Error("ACP sidecar did not receive a TCP address");
    }
    this.#info = {
      host,
      port: address.port,
      baseUrl: `http://${formatHostForUrl(host)}:${address.port}`,
      token: this.token,
      projectDir: this.#storage.projectDir,
      workspaceId: this.#storage.workspaceId,
      ...(this.client.pid === undefined ? {} : { agentPid: this.client.pid }),
      agent: this.client.initialized,
    };
  }

  async #handleHttp(
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> {
    try {
      this.#setCors(request, response);
      if (request.method === "OPTIONS") {
        response.writeHead(204);
        response.end();
        return;
      }
      this.#authorize(request);

      let url: URL;
      try {
        url = new URL(request.url ?? "/", this.info.baseUrl);
      } catch {
        throw new HttpError(400, "invalid_url", "Request URL is invalid");
      }
      if (request.method === "GET" && url.pathname === "/v1/status") {
        this.#json(response, 200, {
          ok: true,
          data: {
            running: this.client.running,
            agentPid: this.client.pid,
            agent: this.client.initialized,
            sessions: [...this.#sessions],
            activeTurns: Object.fromEntries(this.#activeTurns),
            permissionMode: this.#permissions.mode,
            allowClientMcpServers:
              this.#options.allowClientMcpServers === true,
            projectDir: this.#storage.projectDir,
            workspaceId: this.#storage.workspaceId,
            sseSubscribers: this.#events.subscriberCount,
          },
        });
        return;
      }

      if (request.method === "GET" && url.pathname === "/v1/events") {
        this.#openEventStream(request, response, url);
        return;
      }

      if (request.method === "POST" && url.pathname === "/v1/lattice/state") {
        const body = await readJsonBody(request);
        this.#json(response, 200, {
          ok: true,
          data: await this.#storage.read(
            optionalStringField(body, "workspaceId") ??
              this.#storage.workspaceId,
          ),
        });
        return;
      }

      if (
        request.method === "POST" &&
        url.pathname === "/v1/lattice/workspaces"
      ) {
        await readJsonBody(request);
        this.#json(response, 200, {
          ok: true,
          data: await this.#storage.list(),
        });
        return;
      }

      if (
        request.method === "POST" &&
        url.pathname === "/v1/lattice/workspaces/create"
      ) {
        const body = await readJsonBody(request);
        const origin = optionalStringField(body, "origin");
        const title = optionalStringField(body, "title");
        if (
          origin !== undefined &&
          origin !== "blank" &&
          origin !== "conversation"
        ) {
          throw new HttpError(
            400,
            "invalid_body",
            "origin must be blank or conversation",
          );
        }
        this.#json(response, 201, {
          ok: true,
          data: await this.#storage.create({
            ...(title ? { title } : {}),
            ...(origin ? { origin } : {}),
          }),
        });
        return;
      }

      if (request.method === "POST" && url.pathname === "/v1/lattice/patch") {
        const body = await readJsonBody(request);
        const workspaceId = stringField(body, "workspaceId");
        const patch = recordField(body, "patch");
        const expectedRevision = revisionField(
          body,
          "expectedRevision",
        );
        try {
          const result = await this.#storage.apply(
            expectedRevision,
            patch,
            workspaceId,
          );
          this.#json(response, 200, { ok: true, data: result });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          throw new HttpError(
            message.startsWith("Revision conflict:") ? 409 : 422,
            message.startsWith("Revision conflict:")
              ? "revision_conflict"
              : "invalid_lattice_patch",
            message,
          );
        }
        return;
      }

      if (
        request.method === "POST" &&
        url.pathname === "/v1/lattice/ui-state"
      ) {
        const body = await readJsonBody(request);
        const workspaceId = stringField(body, "workspaceId");
        const uiState = recordField(body, "uiState");
        try {
          const result = await this.#storage.saveUiState(
            uiState,
            workspaceId,
          );
          this.#json(response, 200, { ok: true, data: result });
        } catch (error) {
          throw new HttpError(
            422,
            "invalid_lattice_ui_state",
            error instanceof Error ? error.message : String(error),
          );
        }
        return;
      }

      if (request.method === "POST" && url.pathname === "/v1/sessions") {
        const body = await readJsonBody(request);
        const cwd = stringField(body, "cwd");
        const sessionProjectDir = await realpath(cwd).catch(() => null);
        if (sessionProjectDir !== this.#storage.projectDir) {
          throw new HttpError(
            403,
            "session_project_mismatch",
            "ACP sessions must use the project selected when the sidecar started",
          );
        }
        const mcpServers = mcpServersField(body);
        if (
          mcpServers.length > 0 &&
          this.#options.allowClientMcpServers !== true
        ) {
          throw new HttpError(
            403,
            "client_mcp_servers_forbidden",
            "Client-provided MCP servers require an explicit trusted opt-in",
          );
        }
        const additionalDirectories = stringArrayField(
          body,
          "additionalDirectories",
        );
        const result = await this.client.newSession({
          cwd,
          mcpServers,
          additionalDirectories,
        });
        this.#sessions.add(result.sessionId);
        this.#events.publish({
          type: "session.created",
          sessionId: result.sessionId,
          data: result,
        });
        this.#json(response, 201, { ok: true, data: result });
        return;
      }

      const promptMatch = url.pathname.match(
        /^\/v1\/sessions\/([^/]+)\/prompts$/,
      );
      if (request.method === "POST" && promptMatch) {
        const sessionId = decodePathSegment(promptMatch[1] ?? "");
        if (!this.#sessions.has(sessionId)) {
          throw new HttpError(404, "session_not_found", "Session is unknown");
        }
        if (this.#activeTurns.has(sessionId)) {
          throw new HttpError(
            409,
            "turn_in_progress",
            "This session already has a prompt in progress",
          );
        }

        const body = await readJsonBody(request);
        const prompt = promptFromBody(body);
        const turnId = randomUUID();
        this.#activeTurns.set(sessionId, turnId);
        this.#events.publish({
          type: "turn.started",
          sessionId,
          turnId,
          data: { prompt },
        });

        void this.client
          .prompt(sessionId, prompt)
          .then((result) => {
            this.#events.publish({
              type: "turn.completed",
              sessionId,
              turnId,
              data: result,
            });
          })
          .catch((error) => {
            this.#events.publish({
              type: "turn.failed",
              sessionId,
              turnId,
              data: {
                message: error instanceof Error ? error.message : String(error),
              },
            });
          })
          .finally(() => {
            if (this.#activeTurns.get(sessionId) === turnId) {
              this.#activeTurns.delete(sessionId);
            }
          });

        this.#json(response, 202, {
          ok: true,
          data: { turnId },
        });
        return;
      }

      const cancelMatch = url.pathname.match(
        /^\/v1\/sessions\/([^/]+)\/cancel$/,
      );
      if (request.method === "POST" && cancelMatch) {
        const sessionId = decodePathSegment(cancelMatch[1] ?? "");
        if (!this.#sessions.has(sessionId)) {
          throw new HttpError(404, "session_not_found", "Session is unknown");
        }
        this.client.cancelSession(sessionId);
        const activeTurnId = this.#activeTurns.get(sessionId);
        this.#events.publish({
          type: "turn.cancel_requested",
          sessionId,
          ...(activeTurnId ? { turnId: activeTurnId } : {}),
          data: {},
        });
        this.#json(response, 202, { ok: true, data: {} });
        return;
      }

      const permissionMatch = url.pathname.match(
        /^\/v1\/permissions\/([^/]+)\/resolve$/,
      );
      if (request.method === "POST" && permissionMatch) {
        if (this.#permissions.mode !== "manual") {
          throw new HttpError(
            409,
            "permission_policy_fixed",
            "Sidecar is using the automatic reject policy",
          );
        }
        const permissionId = decodePathSegment(permissionMatch[1] ?? "");
        const body = await readJsonBody(request);
        this.#permissions.resolve(permissionId, stringField(body, "optionId"));
        this.#json(response, 200, { ok: true, data: {} });
        return;
      }

      if (request.method === "POST" && url.pathname === "/v1/shutdown") {
        this.#json(response, 202, { ok: true, data: {} });
        setImmediate(() => {
          void this.shutdown();
        });
        return;
      }

      throw new HttpError(404, "route_not_found", "Route not found");
    } catch (error) {
      if (response.headersSent) {
        response.end();
        return;
      }
      const httpError =
        error instanceof HttpError
          ? error
          : new HttpError(
              500,
              "internal_error",
              error instanceof Error ? error.message : String(error),
            );
      this.#json(response, httpError.status, {
        ok: false,
        error: {
          code: httpError.code,
          message: httpError.message,
        },
      });
    }
  }

  #authorize(request: IncomingMessage): void {
    const authorization = request.headers.authorization;
    if (!authorization?.startsWith("Bearer ")) {
      throw new HttpError(401, "unauthorized", "Bearer token is required");
    }
    const supplied = Buffer.from(authorization.slice("Bearer ".length));
    const expected = Buffer.from(this.token);
    if (
      supplied.length !== expected.length ||
      !timingSafeEqual(supplied, expected)
    ) {
      throw new HttpError(401, "unauthorized", "Bearer token is invalid");
    }
  }

  #setCors(request: IncomingMessage, response: ServerResponse): void {
    if (!this.#options.allowOrigin) {
      return;
    }
    const origin = request.headers.origin;
    if (origin === this.#options.allowOrigin) {
      response.setHeader("Access-Control-Allow-Origin", origin);
      response.setHeader("Vary", "Origin");
      response.setHeader(
        "Access-Control-Allow-Headers",
        "Authorization, Content-Type, Last-Event-ID",
      );
      response.setHeader(
        "Access-Control-Allow-Methods",
        "GET, POST, OPTIONS",
      );
    }
  }

  #openEventStream(
    request: IncomingMessage,
    response: ServerResponse,
    url: URL,
  ): void {
    const headerSequence = request.headers["last-event-id"];
    const rawSequence =
      url.searchParams.get("after") ??
      (Array.isArray(headerSequence) ? headerSequence[0] : headerSequence) ??
      "0";
    if (!/^\d+$/.test(rawSequence)) {
      throw new HttpError(
        400,
        "invalid_event_cursor",
        "Event cursor must be a non-negative integer",
      );
    }
    const afterSequence = Number.parseInt(rawSequence, 10);
    const sessionId = url.searchParams.get("sessionId") ?? undefined;
    response.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    response.write(": lattice-acp-sidecar\n\n");
    const unsubscribe = this.#events.subscribe(
      response,
      Number.isFinite(afterSequence) ? afterSequence : 0,
      sessionId,
    );
    request.once("close", unsubscribe);
    response.once("close", unsubscribe);
    response.once("error", unsubscribe);
  }

  #json(response: ServerResponse, status: number, body: unknown): void {
    const encoded = JSON.stringify(body);
    response.writeHead(status, {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Length": Buffer.byteLength(encoded),
      "Cache-Control": "no-store",
    });
    response.end(encoded);
  }
}

function formatSse(event: SidecarEvent): string {
  return `id: ${event.sequence}\nevent: ${event.type}\ndata: ${JSON.stringify(
    event,
  )}\n\n`;
}

function formatHostForUrl(host: string): string {
  return host.includes(":") && !host.startsWith("[") ? `[${host}]` : host;
}

async function readJsonBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > 1_048_576) {
      throw new HttpError(413, "body_too_large", "Request body exceeds 1 MiB");
    }
    chunks.push(buffer);
  }

  if (chunks.length === 0) {
    return {};
  }
  let value: unknown;
  try {
    value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpError(400, "invalid_json", "Request body must be valid JSON");
  }
  if (!isRecord(value)) {
    throw new HttpError(400, "invalid_body", "Request body must be an object");
  }
  return value;
}

function stringField(body: Record<string, unknown>, field: string): string {
  const value = body[field];
  if (typeof value !== "string" || !value) {
    throw new HttpError(
      400,
      "invalid_body",
      `${field} must be a non-empty string`,
    );
  }
  return value;
}

function optionalStringField(
  body: Record<string, unknown>,
  field: string,
): string | undefined {
  const value = body[field];
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !value) {
    throw new HttpError(
      400,
      "invalid_body",
      `${field} must be a non-empty string`,
    );
  }
  return value;
}

function recordField(
  body: Record<string, unknown>,
  field: string,
): Record<string, unknown> {
  const value = body[field];
  if (!isRecord(value)) {
    throw new HttpError(400, "invalid_body", `${field} must be an object`);
  }
  return value;
}

function revisionField(
  body: Record<string, unknown>,
  field: string,
): number {
  const value = body[field];
  if (!Number.isSafeInteger(value) || Number(value) < 0) {
    throw new HttpError(
      400,
      "invalid_body",
      `${field} must be a non-negative integer`,
    );
  }
  return Number(value);
}

function stringArrayField(
  body: Record<string, unknown>,
  field: string,
): string[] {
  const value = body[field];
  if (value === undefined) {
    return [];
  }
  if (
    !Array.isArray(value) ||
    !value.every((entry) => typeof entry === "string")
  ) {
    throw new HttpError(
      400,
      "invalid_body",
      `${field} must be an array of strings`,
    );
  }
  return value;
}

function mcpServersField(body: Record<string, unknown>): AcpMcpServer[] {
  const value = body.mcpServers;
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value) || !value.every(isAcpMcpServer)) {
    throw new HttpError(
      400,
      "invalid_body",
      "mcpServers must contain valid ACP stdio or HTTP server definitions",
    );
  }
  return value;
}

function decodePathSegment(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    throw new HttpError(
      400,
      "invalid_path_encoding",
      "Path contains invalid percent encoding",
    );
  }
}

function validateSidecarOptions(options: AcpSidecarOptions): void {
  for (const [name, value] of [
    ["permissionTimeoutMs", options.permissionTimeoutMs],
    ["sseClientQueueBytes", options.sseClientQueueBytes],
  ] as const) {
    if (
      value !== undefined &&
      (!Number.isSafeInteger(value) || value <= 0)
    ) {
      throw new Error(`${name} must be a positive integer`);
    }
  }
  if (
    options.eventHistoryLimit !== undefined &&
    (!Number.isSafeInteger(options.eventHistoryLimit) ||
      options.eventHistoryLimit < 0)
  ) {
    throw new Error("eventHistoryLimit must be a non-negative integer");
  }
}

function promptFromBody(body: Record<string, unknown>): AcpContentBlock[] {
  if (typeof body.text === "string" && body.text) {
    return [{ type: "text", text: body.text }];
  }
  if (
    Array.isArray(body.prompt) &&
    body.prompt.length > 0 &&
    body.prompt.every(isAcpContentBlock)
  ) {
    return body.prompt as AcpContentBlock[];
  }
  throw new HttpError(
    400,
    "invalid_body",
    "Provide non-empty text or a non-empty ACP prompt array",
  );
}
