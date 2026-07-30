#!/usr/bin/env node

import { createInterface } from "node:readline";
import { closeSync } from "node:fs";

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
        protocolVersion: 1,
        agentCapabilities: {},
        agentInfo: { name: "closed-stdin-agent", version: "1.0.0" },
      },
    })}\n`,
    () => {
      reader.close();
      closeSync(0);
    },
  );
});

setInterval(() => {}, 1_000);
