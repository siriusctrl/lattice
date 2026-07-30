"use client";

import { useEffect, useState } from "react";

import { ResearchWorkspace } from "@/app/components/ResearchWorkspace";
import {
  AcpHost,
  type AcpHostOptions,
} from "@/app/lib/acp-host";
import { createDemoHost } from "@/app/lib/demo-host";
import type { LatticeHost } from "@/app/lib/lattice-host";

declare global {
  interface Window {
    __LATTICE_ACP_CONFIG__?: AcpHostOptions;
  }
}

const ACP_SESSION_KEY = "lattice.acp.config";

function decodeAcpHash(): AcpHostOptions | null {
  if (typeof window === "undefined") return null;
  const encoded = window.location.hash.startsWith("#acp=")
    ? window.location.hash.slice("#acp=".length)
    : "";
  if (encoded) {
    try {
      const base64 = encoded.replaceAll("-", "+").replaceAll("_", "/");
      const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
      const bytes = Uint8Array.from(atob(padded), (character) =>
        character.charCodeAt(0),
      );
      const value = JSON.parse(new TextDecoder().decode(bytes)) as AcpHostOptions;
      window.sessionStorage.setItem(ACP_SESSION_KEY, JSON.stringify(value));
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${window.location.search}`,
      );
      return value;
    } catch {
      return null;
    }
  }
  try {
    const stored = window.sessionStorage.getItem(ACP_SESSION_KEY);
    return stored ? JSON.parse(stored) as AcpHostOptions : null;
  } catch {
    return null;
  }
}

function demoHost(): LatticeHost {
  return createDemoHost();
}

function acpHostFromBrowser(): LatticeHost | null {
  if (typeof window !== "undefined") {
    const config = window.__LATTICE_ACP_CONFIG__ ?? decodeAcpHash();
    if (config) {
      try {
        return new AcpHost(config);
      } catch {
        window.sessionStorage.removeItem(ACP_SESSION_KEY);
      }
    }
  }
  return null;
}

/**
 * The published static site has no injected ACP config and therefore remains
 * the deterministic demo. A trusted local shell may inject the sidecar config
 * before hydration to turn the same workspace into an ACP-backed client.
 */
export function LatticeApp() {
  const [host, setHost] = useState<LatticeHost>(demoHost);
  useEffect(() => {
    let cancelled = false;
    const acpHost = acpHostFromBrowser();
    if (acpHost) {
      queueMicrotask(() => {
        if (!cancelled) setHost(acpHost);
      });
    }
    return () => {
      cancelled = true;
    };
  }, []);
  return <ResearchWorkspace host={host} />;
}
