import { HeuristicPolicy } from "./heuristic.ts";
import { JevPolicy } from "./jev.ts";
import { LayaPolicy } from "./laya.ts";
import type { Policy } from "./types.ts";

export type PolicyName = "jev" | "laya" | "heuristic";

export function createPolicy(name: PolicyName): Policy {
  if (name === "heuristic") return new HeuristicPolicy();
  if (name === "laya") return new LayaPolicy();
  return new JevPolicy();
}
