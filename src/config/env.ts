import { readFileSync } from "node:fs";
import path from "node:path";

/** Loads `.env` from the project root without overriding variables already set in the shell. */
export function loadLocalEnv(fileName = ".env"): void {
  const filePath = path.resolve(fileName);
  let text: string;
  try {
    text = readFileSync(filePath, "utf8");
  } catch {
    return;
  }

  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}
