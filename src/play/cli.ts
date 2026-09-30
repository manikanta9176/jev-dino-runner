import { loadLocalEnv } from "../config/env.ts";
import { explainFailure } from "../policy/errors.ts";
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
  if (value === "jev" || value === "laya" || value === "heuristic") return value;
  throw new Error(`Unknown policy "${value}". Use jev, laya, or heuristic.`);
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
    const message = explainFailure(policyName, caught);
    console.error(message);
    process.exit(1);
  }
})();

const summary = await play({
  policy,
  seed,
  seconds,
  onDecision: (event) => {
    const confidence =
      event.confidence === null ? "" : ` confidence=${event.confidence.toFixed(2)}`;
    console.log(`frame ${event.frame}  ${event.action}${confidence}  ${event.note}`);
  },
});

console.log(JSON.stringify(summary, null, 2));
if (summary.error) {
  console.error(summary.error);
  process.exitCode = 1;
}
