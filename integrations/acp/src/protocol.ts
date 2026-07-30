export type JsonRpcId = number | string;

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: JsonRpcId;
  method: string;
  params?: unknown;
}

export interface JsonRpcNotification {
  jsonrpc: "2.0";
  method: string;
  params?: unknown;
}

export interface JsonRpcSuccess {
  jsonrpc: "2.0";
  id: JsonRpcId;
  result: unknown;
}

export interface JsonRpcErrorObject {
  code: number;
  message: string;
  data?: unknown;
}

export interface JsonRpcFailure {
  jsonrpc: "2.0";
  id: JsonRpcId | null;
  error: JsonRpcErrorObject;
}

export type JsonRpcMessage =
  | JsonRpcRequest
  | JsonRpcNotification
  | JsonRpcSuccess
  | JsonRpcFailure;

export interface AcpImplementationInfo {
  name: string;
  title?: string;
  version: string;
}

export interface AcpInitializeResponse {
  protocolVersion: number;
  agentCapabilities?: Record<string, unknown>;
  agentInfo?: AcpImplementationInfo;
  authMethods?: unknown[];
  _meta?: Record<string, unknown>;
}

export interface AcpMcpServer {
  name: string;
  command?: string;
  args?: string[];
  env?: Array<{ name: string; value: string }>;
  url?: string;
  headers?: Array<{ name: string; value: string }>;
  [key: string]: unknown;
}

export interface AcpNewSessionRequest {
  cwd: string;
  mcpServers?: AcpMcpServer[];
  additionalDirectories?: string[];
  _meta?: Record<string, unknown>;
}

export interface AcpNewSessionResponse {
  sessionId: string;
  modes?: unknown;
  configOptions?: unknown[];
  _meta?: Record<string, unknown>;
}

export interface AcpTextContent {
  type: "text";
  text: string;
  annotations?: unknown;
  _meta?: Record<string, unknown>;
}

export type AcpContentBlock =
  | AcpTextContent
  | {
      type: string;
      [key: string]: unknown;
    };

export interface AcpPromptResponse {
  stopReason:
    | "end_turn"
    | "max_tokens"
    | "max_turn_requests"
    | "refusal"
    | "cancelled"
    | string;
  _meta?: Record<string, unknown>;
}

const ACP_STOP_REASONS = new Set([
  "end_turn",
  "max_tokens",
  "max_turn_requests",
  "refusal",
  "cancelled",
]);

export interface AcpSessionUpdateParams {
  sessionId: string;
  update: {
    sessionUpdate: string;
    [key: string]: unknown;
  };
  _meta?: Record<string, unknown>;
}

export type AcpPermissionOptionKind =
  | "allow_once"
  | "allow_always"
  | "reject_once"
  | "reject_always"
  | string;

export interface AcpPermissionOption {
  optionId: string;
  name: string;
  kind: AcpPermissionOptionKind;
  _meta?: Record<string, unknown>;
}

export interface AcpPermissionRequest {
  sessionId: string;
  toolCall: {
    toolCallId: string;
    [key: string]: unknown;
  };
  options: AcpPermissionOption[];
  _meta?: Record<string, unknown>;
}

export type AcpPermissionResponse =
  | {
      outcome: {
        outcome: "selected";
        optionId: string;
      };
    }
  | {
      outcome: {
        outcome: "cancelled";
      };
    };

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isJsonRpcId(value: unknown): value is JsonRpcId {
  return typeof value === "number" || typeof value === "string";
}

export function isAcpPermissionRequest(
  value: unknown,
): value is AcpPermissionRequest {
  if (!isRecord(value) || typeof value.sessionId !== "string") {
    return false;
  }

  if (!isRecord(value.toolCall) || typeof value.toolCall.toolCallId !== "string") {
    return false;
  }

  return (
    Array.isArray(value.options) &&
    value.options.every(
      (option) =>
        isRecord(option) &&
        typeof option.optionId === "string" &&
        typeof option.name === "string" &&
        typeof option.kind === "string",
    )
  );
}

export function isSessionUpdateParams(
  value: unknown,
): value is AcpSessionUpdateParams {
  return (
    isRecord(value) &&
    typeof value.sessionId === "string" &&
    isRecord(value.update) &&
    typeof value.update.sessionUpdate === "string"
  );
}

export function isAcpInitializeResponse(
  value: unknown,
): value is AcpInitializeResponse {
  if (
    !isRecord(value) ||
    !Number.isSafeInteger(value.protocolVersion) ||
    (value.agentCapabilities !== undefined &&
      !isRecord(value.agentCapabilities)) ||
    (value.authMethods !== undefined && !Array.isArray(value.authMethods))
  ) {
    return false;
  }

  if (value.agentInfo === undefined) {
    return true;
  }
  return (
    isRecord(value.agentInfo) &&
    typeof value.agentInfo.name === "string" &&
    value.agentInfo.name.length > 0 &&
    typeof value.agentInfo.version === "string" &&
    value.agentInfo.version.length > 0 &&
    (value.agentInfo.title === undefined ||
      typeof value.agentInfo.title === "string")
  );
}

export function isAcpNewSessionResponse(
  value: unknown,
): value is AcpNewSessionResponse {
  return (
    isRecord(value) &&
    typeof value.sessionId === "string" &&
    value.sessionId.length > 0 &&
    (value.configOptions === undefined || Array.isArray(value.configOptions))
  );
}

export function isAcpPromptResponse(
  value: unknown,
): value is AcpPromptResponse {
  return (
    isRecord(value) &&
    typeof value.stopReason === "string" &&
    ACP_STOP_REASONS.has(value.stopReason)
  );
}

export function isAcpMcpServer(value: unknown): value is AcpMcpServer {
  if (
    !isRecord(value) ||
    typeof value.name !== "string" ||
    value.name.length === 0
  ) {
    return false;
  }

  const hasCommand = typeof value.command === "string" && value.command.length > 0;
  const hasUrl = typeof value.url === "string" && value.url.length > 0;
  if (hasCommand === hasUrl) {
    return false;
  }
  if (
    value.args !== undefined &&
    (!Array.isArray(value.args) ||
      !value.args.every((argument) => typeof argument === "string"))
  ) {
    return false;
  }
  if (
    value.env !== undefined &&
    (!Array.isArray(value.env) ||
      !value.env.every(
        (entry) =>
          isRecord(entry) &&
          typeof entry.name === "string" &&
          typeof entry.value === "string",
      ))
  ) {
    return false;
  }
  if (
    value.headers !== undefined &&
    (!Array.isArray(value.headers) ||
      !value.headers.every(
        (entry) =>
          isRecord(entry) &&
          typeof entry.name === "string" &&
          typeof entry.value === "string",
      ))
  ) {
    return false;
  }
  if (hasUrl) {
    try {
      const url = new URL(value.url as string);
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        return false;
      }
    } catch {
      return false;
    }
  }
  return true;
}

export function isAcpContentBlock(value: unknown): value is AcpContentBlock {
  if (!isRecord(value) || typeof value.type !== "string") {
    return false;
  }

  switch (value.type) {
    case "text":
      return typeof value.text === "string";
    case "image":
      return (
        typeof value.data === "string" &&
        typeof value.mimeType === "string" &&
        (value.uri === undefined || typeof value.uri === "string")
      );
    case "audio":
      return (
        typeof value.data === "string" && typeof value.mimeType === "string"
      );
    case "resource_link":
      return (
        typeof value.name === "string" &&
        value.name.length > 0 &&
        typeof value.uri === "string" &&
        value.uri.length > 0
      );
    case "resource": {
      if (
        !isRecord(value.resource) ||
        typeof value.resource.uri !== "string" ||
        value.resource.uri.length === 0
      ) {
        return false;
      }
      const hasText = typeof value.resource.text === "string";
      const hasBlob = typeof value.resource.blob === "string";
      return hasText !== hasBlob;
    }
    default:
      return false;
  }
}

export function isPermissionResponseForRequest(
  value: unknown,
  request: AcpPermissionRequest,
): value is AcpPermissionResponse {
  if (!isRecord(value) || !isRecord(value.outcome)) {
    return false;
  }
  const outcome = value.outcome;
  if (outcome.outcome === "cancelled") {
    return true;
  }
  return (
    outcome.outcome === "selected" &&
    typeof outcome.optionId === "string" &&
    request.options.some(
      (option) => option.optionId === outcome.optionId,
    )
  );
}

export function safeRejectPermission(
  request: AcpPermissionRequest,
): AcpPermissionResponse {
  const rejection =
    request.options.find((option) => option.kind === "reject_once") ??
    request.options.find((option) => option.kind === "reject_always");

  if (!rejection) {
    return { outcome: { outcome: "cancelled" } };
  }

  return {
    outcome: {
      outcome: "selected",
      optionId: rejection.optionId,
    },
  };
}
