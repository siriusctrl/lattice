#!/usr/bin/env node

import { resolve } from "node:path";

import { AcpSidecar, type PermissionMode } from "./sidecar.js";

interface CliOptions {
  agentCommand?: string;
  agentArgs: string[];
  preset?: "codex" | "claude";
  cwd: string;
  workspaceId?: string;
  host: string;
  port: number;
  token?: string;
  allowOrigin?: string;
  latticeUrl?: string;
  permissionMode: PermissionMode;
  permissionTimeoutMs: number;
  startupTimeoutMs: number;
  shutdownTimeoutMs: number;
  requestTimeoutMs: number;
  promptTimeoutMs: number;
  sseClientQueueBytes: number;
  allowClientMcpServers: boolean;
  help: boolean;
}

const PRESETS = {
  codex: {
    command: "npx",
    args: ["-y", "@agentclientprotocol/codex-acp"],
  },
  claude: {
    command: "npx",
    args: ["-y", "@agentclientprotocol/claude-agent-acp"],
  },
} as const;

async function main(): Promise<void> {
  const options = parseArguments(process.argv.slice(2), process.env);
  if (options.help) {
    process.stdout.write(helpText());
    return;
  }

  const selected = options.agentCommand
    ? { command: options.agentCommand, args: options.agentArgs }
    : options.preset
      ? {
          command: PRESETS[options.preset].command,
          args: [...PRESETS[options.preset].args, ...options.agentArgs],
        }
      : undefined;

  if (!selected) {
    throw new Error(
      "Specify --agent-command, --preset, or LATTICE_ACP_AGENT_COMMAND",
    );
  }

  const agentOptions = {
    command: selected.command,
    args: selected.args,
    cwd: options.cwd,
    startupTimeoutMs: options.startupTimeoutMs,
    shutdownTimeoutMs: options.shutdownTimeoutMs,
    requestTimeoutMs: options.requestTimeoutMs,
    promptTimeoutMs: options.promptTimeoutMs,
  };
  const latticeUrl = options.latticeUrl
    ? new URL(options.latticeUrl)
    : undefined;
  const sidecarOptions = {
    agent: agentOptions,
    projectDir: options.cwd,
    ...(options.workspaceId ? { workspaceId: options.workspaceId } : {}),
    host: options.host,
    port: options.port,
    permissionMode: options.permissionMode,
    permissionTimeoutMs: options.permissionTimeoutMs,
    sseClientQueueBytes: options.sseClientQueueBytes,
    allowClientMcpServers: options.allowClientMcpServers,
    ...(options.token ? { token: options.token } : {}),
    ...(options.allowOrigin
      ? { allowOrigin: options.allowOrigin }
      : latticeUrl
        ? { allowOrigin: latticeUrl.origin }
        : {}),
  };
  const sidecar = await AcpSidecar.start(sidecarOptions);

  const workspaceUrl = latticeUrl
    ? buildWorkspaceUrl(latticeUrl, {
        baseUrl: sidecar.info.baseUrl,
        token: sidecar.info.token,
        cwd: sidecar.info.projectDir,
        workspaceId: sidecar.info.workspaceId,
      })
    : undefined;
  process.stdout.write(`${JSON.stringify({
    event: "ready",
    ...sidecar.info,
    ...(workspaceUrl ? { workspaceUrl } : {}),
  })}\n`);

  let stopping = false;
  const stop = async (signal: string) => {
    if (stopping) {
      return;
    }
    stopping = true;
    process.stderr.write(`lattice-acp-sidecar: stopping after ${signal}\n`);
    await sidecar.shutdown();
  };

  process.once("SIGINT", () => {
    void stop("SIGINT");
  });
  process.once("SIGTERM", () => {
    void stop("SIGTERM");
  });
}

function parseArguments(
  arguments_: string[],
  environment: NodeJS.ProcessEnv,
): CliOptions {
  const envArgs = parseEnvironmentArgs(environment.LATTICE_ACP_AGENT_ARGS);
  const options: CliOptions = {
    agentArgs: envArgs,
    cwd: resolve(environment.LATTICE_ACP_CWD ?? process.cwd()),
    host: environment.LATTICE_ACP_HOST ?? "127.0.0.1",
    port: parseInteger(environment.LATTICE_ACP_PORT ?? "0", "port", 0),
    permissionMode: parsePermissionMode(
      environment.LATTICE_ACP_PERMISSION_MODE ?? "reject",
    ),
    permissionTimeoutMs: parseInteger(
      environment.LATTICE_ACP_PERMISSION_TIMEOUT_MS ?? "60000",
      "permission timeout",
      1,
    ),
    startupTimeoutMs: parseInteger(
      environment.LATTICE_ACP_STARTUP_TIMEOUT_MS ?? "15000",
      "startup timeout",
      1,
    ),
    shutdownTimeoutMs: parseInteger(
      environment.LATTICE_ACP_SHUTDOWN_TIMEOUT_MS ?? "2000",
      "shutdown timeout",
      1,
    ),
    requestTimeoutMs: parseInteger(
      environment.LATTICE_ACP_REQUEST_TIMEOUT_MS ?? "30000",
      "request timeout",
      1,
    ),
    promptTimeoutMs: parseInteger(
      environment.LATTICE_ACP_PROMPT_TIMEOUT_MS ?? "1800000",
      "prompt timeout",
      1,
    ),
    sseClientQueueBytes: parseInteger(
      environment.LATTICE_ACP_SSE_CLIENT_QUEUE_BYTES ?? "262144",
      "SSE client queue bytes",
      1,
    ),
    allowClientMcpServers: parseBoolean(
      environment.LATTICE_ACP_ALLOW_CLIENT_MCP_SERVERS ?? "false",
      "LATTICE_ACP_ALLOW_CLIENT_MCP_SERVERS",
    ),
    help: false,
    ...(environment.LATTICE_ACP_AGENT_COMMAND
      ? { agentCommand: environment.LATTICE_ACP_AGENT_COMMAND }
      : {}),
    ...(environment.LATTICE_ACP_TOKEN
      ? { token: environment.LATTICE_ACP_TOKEN }
      : {}),
    ...(environment.LATTICE_ACP_WORKSPACE_ID
      ? { workspaceId: environment.LATTICE_ACP_WORKSPACE_ID }
      : {}),
    ...(environment.LATTICE_ACP_ALLOW_ORIGIN
      ? { allowOrigin: environment.LATTICE_ACP_ALLOW_ORIGIN }
      : {}),
    ...(environment.LATTICE_ACP_LATTICE_URL
      ? { latticeUrl: environment.LATTICE_ACP_LATTICE_URL }
      : {}),
  };

  for (let index = 0; index < arguments_.length; index++) {
    const argument = arguments_[index];
    const next = () => {
      const value = arguments_[++index];
      if (value === undefined) {
        throw new Error(`${argument} requires a value`);
      }
      return value;
    };

    switch (argument) {
      case "--agent-command":
        options.agentCommand = next();
        delete options.preset;
        break;
      case "--agent-arg":
        options.agentArgs.push(next());
        break;
      case "--preset": {
        const preset = next();
        if (preset !== "codex" && preset !== "claude") {
          throw new Error("--preset must be codex or claude");
        }
        options.preset = preset;
        delete options.agentCommand;
        break;
      }
      case "--cwd":
        options.cwd = resolve(next());
        break;
      case "--workspace-id":
        options.workspaceId = next();
        break;
      case "--host":
        options.host = next();
        break;
      case "--port":
        options.port = parseInteger(next(), "port", 0);
        break;
      case "--token":
        options.token = next();
        break;
      case "--allow-origin":
        options.allowOrigin = next();
        break;
      case "--lattice-url":
        options.latticeUrl = next();
        break;
      case "--permission-mode":
        options.permissionMode = parsePermissionMode(next());
        break;
      case "--permission-timeout-ms":
        options.permissionTimeoutMs = parseInteger(
          next(),
          "permission timeout",
          1,
        );
        break;
      case "--startup-timeout-ms":
        options.startupTimeoutMs = parseInteger(next(), "startup timeout", 1);
        break;
      case "--shutdown-timeout-ms":
        options.shutdownTimeoutMs = parseInteger(next(), "shutdown timeout", 1);
        break;
      case "--request-timeout-ms":
        options.requestTimeoutMs = parseInteger(next(), "request timeout", 1);
        break;
      case "--prompt-timeout-ms":
        options.promptTimeoutMs = parseInteger(next(), "prompt timeout", 1);
        break;
      case "--sse-client-queue-bytes":
        options.sseClientQueueBytes = parseInteger(
          next(),
          "SSE client queue bytes",
          1,
        );
        break;
      case "--allow-client-mcp-servers":
        options.allowClientMcpServers = true;
        break;
      case "--help":
      case "-h":
        options.help = true;
        break;
      default:
        throw new Error(`Unknown argument: ${argument}`);
    }
  }

  return options;
}

function parseEnvironmentArgs(value: string | undefined): string[] {
  if (!value) {
    return [];
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error("LATTICE_ACP_AGENT_ARGS must be a JSON array of strings");
  }
  if (!Array.isArray(parsed) || !parsed.every((entry) => typeof entry === "string")) {
    throw new Error("LATTICE_ACP_AGENT_ARGS must be a JSON array of strings");
  }
  return parsed;
}

function parseInteger(value: string, name: string, minimum: number): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed) || parsed < minimum) {
    throw new Error(`${name} must be an integer greater than or equal to ${minimum}`);
  }
  return parsed;
}

function parsePermissionMode(value: string): PermissionMode {
  if (value !== "reject" && value !== "manual") {
    throw new Error("permission mode must be reject or manual");
  }
  return value;
}

function parseBoolean(value: string, name: string): boolean {
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  throw new Error(`${name} must be true or false`);
}

function buildWorkspaceUrl(
  pageUrl: URL,
  config: {
    baseUrl: string;
    token: string;
    cwd: string;
    workspaceId: string;
  },
): string {
  const encoded = Buffer.from(JSON.stringify(config), "utf8").toString("base64url");
  const result = new URL(pageUrl);
  result.hash = `acp=${encoded}`;
  return result.toString();
}

function helpText(): string {
  return `Lattice ACP v1 sidecar

Usage:
  lattice-acp-sidecar --preset codex [options]
  lattice-acp-sidecar --preset claude [options]
  lattice-acp-sidecar --agent-command <path> [--agent-arg <value> ...]

Agent:
  --preset <codex|claude>       Run the official npm ACP adapter with npx
  --agent-command <path>        Executable to launch without a shell
  --agent-arg <value>           Append one agent argument; repeat as needed
  --cwd <absolute-or-relative>  Agent and default project cwd
  --workspace-id <id>           Open an existing .lattice workspace

Sidecar:
  --host <host>                 Bind host (default: 127.0.0.1)
  --port <port>                 Bind port; 0 selects a free port
  --token <token>               Bearer token; generated when omitted
  --allow-origin <origin>       Exact browser origin allowed by CORS
  --lattice-url <url>           Print a fragment-only ACP workspace URL and
                                infer its exact CORS origin when not supplied
  --permission-mode <mode>      reject (default) or manual
  --permission-timeout-ms <ms>  Manual permission timeout (default: 60000)
  --startup-timeout-ms <ms>     ACP initialize timeout (default: 15000)
  --shutdown-timeout-ms <ms>    Process termination grace (default: 2000)
  --request-timeout-ms <ms>     Non-prompt RPC timeout (default: 30000)
  --prompt-timeout-ms <ms>      Prompt RPC timeout (default: 1800000)
  --sse-client-queue-bytes <n>  Slow-client queue cap (default: 262144)
  --allow-client-mcp-servers    Trust HTTP clients to supply MCP processes

Environment equivalents use the LATTICE_ACP_ prefix. Agent arguments are a
JSON string array in LATTICE_ACP_AGENT_ARGS. Existing harness credentials are
inherited from the process environment; this sidecar does not store them.
`;
}

main().catch((error) => {
  process.stderr.write(
    `lattice-acp-sidecar: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
