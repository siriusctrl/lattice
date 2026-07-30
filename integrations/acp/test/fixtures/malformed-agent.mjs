#!/usr/bin/env node

import { createInterface } from "node:readline";

const reader = createInterface({
  input: process.stdin,
  crlfDelay: Infinity,
});

reader.once("line", (line) => {
  const message = JSON.parse(line);
  process.stdout.write(
    `${JSON.stringify({
      jsonrpc: "2.0",
      id: message.id,
      result: {
        protocolVersion: "one",
        agentCapabilities: [],
      },
    })}\n`,
  );
});

reader.on("close", () => process.exit(0));
