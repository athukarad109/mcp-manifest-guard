import { mkdir, writeFile, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fetchManifest, hashObject, type ServerSpec, type ToolManifest } from "./manifest.js";

export interface PinnedTool extends ToolManifest {
  hash: string;
}

export interface Pin {
  pinnedAt: string;
  server: { name?: string; version?: string };
  spec: { command: string; args: string[] };
  manifestHash: string;
  tools: PinnedTool[];
}

export const DEFAULT_PIN_DIR = "pins";

// Fetch the server's current manifest and freeze it as an approved baseline.
export async function createPin(spec: ServerSpec): Promise<Pin> {
  const manifest = await fetchManifest(spec);
  const tools = manifest.tools.map((t) => ({ ...t, hash: hashObject(t) }));
  return {
    pinnedAt: new Date().toISOString(),
    server: manifest.server,
    // Persist ONLY command+args, never env: a pin file must not carry secrets.
    spec: { command: spec.command, args: spec.args ?? [] },
    manifestHash: hashObject(manifest),
    tools,
  };
}

export async function writePin(pin: Pin, pinName: string, pinDir = DEFAULT_PIN_DIR): Promise<string> {
  const dir = resolve(pinDir);
  await mkdir(dir, { recursive: true });
  const pinPath = resolve(dir, `${pinName}.json`);
  await writeFile(pinPath, JSON.stringify(pin, null, 2));
  return pinPath;
}

export async function readPin(pinName: string, pinDir = DEFAULT_PIN_DIR): Promise<Pin> {
  const pinPath = resolve(pinDir, `${pinName}.json`);
  return JSON.parse(await readFile(pinPath, "utf8")) as Pin;
}
