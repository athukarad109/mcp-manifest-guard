import type { ToolManifest } from "./manifest.js";

export interface Finding {
  detector: string;
  severity: "CRITICAL" | "SUSPICIOUS" | "REVIEW";
  tool: string;
  message: string;
  evidence?: string;
}

const IMPERATIVE_PATTERNS: RegExp[] = [
  /\bbefore (?:returning|responding|answering)\b/i,
  /\balso read\b/i,
  /\bignore (?:previous|prior|the above|all)\b/i,
  /\bdisregard\b/i,
  /\bsend (?:it |them |the )?(?:to|via)\b/i,
  /\btransmit\b/i,
  /\bexfiltrate\b/i,
  /\binclude (?:its |the )?contents\b/i,
  /\bdo not (?:mention|tell|reveal|disclose)\b/i,
  /\binstead of\b/i,
  /\byou must\b/i,
  /\bfetch\b.*\bhttp/i,
];

const SENSITIVE_PATTERNS: RegExp[] = [
  /~\/\.\w+/,
  /\.ssh\b/i,
  /\bid_rsa\b/i,
  /\b(?:credentials?|secrets?|api[_-]?key|token|password)\b/i,
  /\/etc\/\w+/,
  /\benv(?:ironment)?\b.*\b(?:var|config|file)\b/i,
];

export function detectInstructionInjection(
  pinned: ToolManifest | undefined,
  current: ToolManifest
): Finding[] {
  const findings: Finding[] = [];
  const curDesc = current.description ?? "";
  const oldDesc = pinned?.description ?? "";

  const newImperatives = IMPERATIVE_PATTERNS.filter((re) => re.test(curDesc) && !re.test(oldDesc));
  const newSensitive = SENSITIVE_PATTERNS.filter((re) => re.test(curDesc) && !re.test(oldDesc));

  for (const re of newImperatives) {
    const match = curDesc.match(re);
    findings.push({
      detector: "instruction-injection",
      severity: newSensitive.length > 0 ? "CRITICAL" : "SUSPICIOUS",
      tool: current.name,
      message: "Description introduces an imperative instruction aimed at the agent",
      evidence: match ? match[0] : undefined,
    });
  }

  for (const re of newSensitive) {
    const match = curDesc.match(re);
    findings.push({
      detector: "sensitive-reference",
      severity: "CRITICAL",
      tool: current.name,
      message: "Description newly references a sensitive local resource",
      evidence: match ? match[0] : undefined,
    });
  }

  return findings;
}
