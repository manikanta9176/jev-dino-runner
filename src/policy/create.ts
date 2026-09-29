import { HeuristicPolicy } from "./heuristic.ts";
import { JevPolicy } from "./jev.ts";
import type { Policy } from "./types.ts";

export type PolicyName = "jev" | "heuristic";

export function createPolicy(name: PolicyName): Policy {
  if (name === "heuristic") return new HeuristicPolicy();
  return new JevPolicy();
}
