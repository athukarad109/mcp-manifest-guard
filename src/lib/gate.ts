import { fetchManifest, hashObject, type Manifest, type ToolManifest, type ServerSpec } from "./manifest.js";
import { detectInstructionInjection, type Finding } from "./detectors.js";
import { readPin, DEFAULT_PIN_DIR } from "./pins.js";

export interface GateOptions {
  server: ServerSpec;
  pinName: string;
  pinDir?: string;
}

export interface GateResult {
  verdict: "CLEAN" | "REVIEW" | "SUSPICIOUS" | "CRITICAL";
  structural: string[];
  findings: Finding[];
  currentManifestHash: string;
  pinnedManifestHash: string;
}

const order = { CRITICAL: 4, SUSPICIOUS: 3, REVIEW: 2, CLEAN: 1 } as const;

export async function gateCheck(opts: GateOptions): Promise<GateResult> {
  const pin = await readPin(opts.pinName, opts.pinDir ?? DEFAULT_PIN_DIR);
  const current: Manifest = await fetchManifest(opts.server);
  const currentManifestHash = hashObject(current);

  if (currentManifestHash === pin.manifestHash) {
    return {
      verdict: "CLEAN",
      structural: [],
      findings: [],
      currentManifestHash,
      pinnedManifestHash: pin.manifestHash,
    };
  }

  const pinnedByName = new Map<string, any>(pin.tools.map((t) => [t.name, t]));
  const currentByName = new Map<string, ToolManifest>(current.tools.map((t) => [t.name, t]));
  const structural: string[] = [];
  const findings: Finding[] = [];

  for (const [name] of currentByName) if (!pinnedByName.has(name)) structural.push(`ADDED tool: "${name}"`);
  for (const [name] of pinnedByName) if (!currentByName.has(name)) structural.push(`REMOVED tool: "${name}"`);
  for (const [name, cur] of currentByName) {
    const pinned = pinnedByName.get(name);
    if (pinned && hashObject(cur) !== pinned.hash) {
      structural.push(`CHANGED tool: "${name}"`);
      findings.push(...detectInstructionInjection(pinned, cur));
    }
  }

  const verdict: GateResult["verdict"] =
    findings.length > 0
      ? findings.reduce<GateResult["verdict"]>(
          (acc, f) => (order[f.severity] > order[acc] ? f.severity : acc),
          "REVIEW"
        )
      : "REVIEW";

  return { verdict, structural, findings, currentManifestHash, pinnedManifestHash: pin.manifestHash };
}
