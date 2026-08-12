# MCP Manifest Guard

A load-time integrity gate for [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server manifests. Detect tool-poisoning attacks and malicious changes to MCP server configurations before an agent ingests them.

## Overview

MCP Manifest Guard helps secure your AI agent's tool supply chain by:

- **Pinning** trusted MCP server manifests as baselines
- **Detecting structural changes** (added/removed/modified tools)
- **Identifying injection attacks** in tool descriptions through pattern matching for:
  - Imperative instructions hidden in descriptions
  - References to sensitive resources (.ssh, credentials, env files)
  - Attempts to manipulate agent behavior

## Features

### Manifest Pinning
Create and store approved snapshots of MCP server configurations. Pins capture:
- Server name and version
- Tool names, descriptions, and input schemas
- SHA-256 hashes for integrity verification
- Launch command specifications

### Change Detection
Automatically identify and report:
- **Structural changes**: Added, removed, or modified tools
- **Suspicious patterns**: Imperative language attempting to override agent behavior
- **Sensitive references**: Unsafe paths or credential patterns injected into descriptions

### Severity Levels
Findings are classified by risk:
- **CRITICAL**: Sensitive resource references or imperative instructions combined with sensitive patterns
- **SUSPICIOUS**: Imperative instructions attempting to manipulate agent behavior
- **REVIEW**: Structural changes requiring manual inspection

## Installation

```bash
npm install mcp-manifest-guard
```

Or use globally:

```bash
npm install -g mcp-manifest-guard
```

## Usage

### Creating a Pin

Capture the current state of an MCP server as a trusted baseline:

```typescript
import { createPin, writePin } from "mcp-manifest-guard";

const pin = await createPin({
  command: "npx",
  args: ["tsx", "./my-mcp-server.ts"],
});

await writePin(pin, "my-server");
```

This creates a `pins/my-server.json` file containing the approved manifest.

### Verifying a Manifest

Check if an MCP server matches its pinned baseline:

```typescript
import { gateCheck } from "mcp-manifest-guard";

const result = await gateCheck({
  server: { command: "npx", args: ["tsx", "./my-mcp-server.ts"] },
  pinName: "my-server",
  pinDir: "pins",
});

console.log(result.verdict); // "CLEAN" | "REVIEW" | "SUSPICIOUS" | "CRITICAL"
console.log(result.structural); // List of structural changes
console.log(result.findings); // List of detected threats
```

### Gate Result

The `GateResult` includes:

- **verdict**: One of "CLEAN", "REVIEW", "SUSPICIOUS", "CRITICAL"
- **structural**: Array of structural changes (e.g., "ADDED tool: 'xyz'")
- **findings**: Array of security findings with severity levels
- **currentManifestHash**: SHA-256 hash of the current manifest
- **pinnedManifestHash**: SHA-256 hash of the pinned baseline

## Threat Detection

### Injection Patterns

Tool descriptions are scanned for suspicious imperative instructions:
- "before returning", "also read"
- "ignore previous", "disregard"
- "send to", "transmit", "exfiltrate"
- "you must", "instead of"
- "fetch http://" patterns

### Sensitive References

Descriptions are checked for references to:
- SSH keys and private key files (`~/.ssh`, `id_rsa`)
- Environment files and configuration paths
- Credential and secret patterns
- API keys and tokens

## Pin Format

A pin file (`pins/my-server.json`) contains:

```json
{
  "pinnedAt": "2026-08-11T20:03:21.932Z",
  "server": {
    "name": "my-server",
    "version": "1.0.0"
  },
  "spec": {
    "command": "npx",
    "args": ["tsx", "/path/to/server.ts"]
  },
  "manifestHash": "sha256-hash...",
  "tools": [
    {
      "name": "tool_name",
      "description": "Tool description",
      "inputSchema": {...},
      "hash": "sha256-hash..."
    }
  ]
}
```

**Note**: Pin files intentionally do not store environment variables to prevent accidentally persisting secrets.

## API

### `createPin(spec: ServerSpec): Promise<Pin>`
Fetch and create a new pin from a running MCP server.

### `writePin(pin: Pin, pinName: string, pinDir?: string): Promise<string>`
Write a pin to disk. Returns the path to the created pin file.

### `readPin(pinName: string, pinDir?: string): Promise<Pin>`
Load a previously created pin from disk.

### `gateCheck(opts: GateOptions): Promise<GateResult>`
Verify a running MCP server against its pinned baseline.

### `fetchManifest(spec: ServerSpec): Promise<Manifest>`
Fetch a manifest from a running MCP server without creating a pin.

### `detectInstructionInjection(pinned: ToolManifest, current: ToolManifest): Finding[]`
Analyze a tool for suspicious changes between pinned and current versions.

## License

MIT
