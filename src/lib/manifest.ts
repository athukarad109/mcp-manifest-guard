import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { createHash } from "node:crypto";

// How to launch a stdio MCP server. 
// "npx tsx <file>" assumption: now the caller says exactly what to run.
export interface ServerSpec {
  command: string;            // e.g. "npx", "node", "python"
  args?: string[];            // e.g. ["-y", "some-mcp-server"]
  env?: Record<string, string>;
  cwd?: string;
}

export interface ToolManifest {
  name: string;
  description?: string;
  inputSchema: unknown;
}

export interface Manifest {
  server: { name?: string; version?: string };
  tools: ToolManifest[];
}

// Recursively sort object keys so serialization is byte-for-byte stable.
export function canonicalize(value: any): any {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((acc, k) => {
        acc[k] = canonicalize(value[k]);
        return acc;
      }, {} as Record<string, any>);
  }
  return value;
}

export function hashObject(obj: unknown): string {
  return createHash("sha256").update(JSON.stringify(canonicalize(obj))).digest("hex");
}

// Parse a single-string command ("npx -y some-mcp-server") into a ServerSpec.
// Naive whitespace split: good for the common case, does NOT handle quoted
// args. Callers needing quotes should build the ServerSpec directly.
export function parseServerCommand(input: string): ServerSpec {
  const parts = input.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) throw new Error("Empty server command");
  return { command: parts[0], args: parts.slice(1) };
}

export async function fetchManifest(spec: ServerSpec): Promise<Manifest> {
  const transport = new StdioClientTransport({
    command: spec.command,
    args: spec.args ?? [],
    // When env is supplied we keep PATH/HOME so `npx`/`node` still resolve;
    // when omitted, the SDK's own safe default environment is used.
    env: spec.env
      ? { PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? "", ...spec.env }
      : undefined,
    cwd: spec.cwd,
  });
  const client = new Client({ name: "mcp-manifest-guard", version: "0.1.0" });
  await client.connect(transport);
  const info = client.getServerVersion();
  const { tools } = await client.listTools();
  const manifest: Manifest = {
    server: { name: info?.name, version: info?.version },
    tools: tools.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })),
  };
  await client.close();
  return manifest;
}
