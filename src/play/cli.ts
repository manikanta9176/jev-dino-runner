import { loadLocalEnv } from "../config/env.ts";
import { createPolicy, type PolicyName } from "../policy/create.ts";
import { play } from "./session.ts";

loadLocalEnv();

function readFlag(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function readPolicy(): PolicyName {
  const value = readFlag("policy") ?? "jev";
  if (value === "jev" || value === "heuristic") return value;
  throw new Error(`Unknown policy "${value}". Use jev or heuristic.`);
}

const seed = Number(readFlag("seed") ?? 7);
const seconds = Number(readFlag("seconds") ?? 20);
const policyName = readPolicy();

if (!Number.isFinite(seed) || !Number.isFinite(seconds) || seconds <= 0) {
  throw new Error("Seed and seconds must be positive numbers.");
}

const policy = (() => {
  try {
    return createPolicy(policyName);
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : String(caught);
    console.error(message);
    console.error("Set TYPESAFE_API_KEY, or run with --policy heuristic.");
    process.exit(1);
  }
})();

const summary = await play({
  policy,
  seed,
  seconds,
  onDecision: (decision, frame) => {
    const confidence =
      decision.confidence === null ? "" : ` confidence=${decision.confidence.toFixed(2)}`;
    console.log(`frame ${frame}  ${decision.action}${confidence}  ${decision.note}`);
  },
});

console.log(JSON.stringify(summary, null, 2));
if (summary.error) process.exitCode = 1;
