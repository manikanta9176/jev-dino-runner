import { TypeSafeClient } from "@typesafe-ai/sdk";
import type { World } from "../game/types.ts";
import { askAction } from "./ask.ts";
import { PolicyNotConfiguredError, policyConfigError } from "./errors.ts";
import type { Decision, Policy } from "./types.ts";

/**
 * Hosted or self-hosted Laya. Same question as Jev.
 * Requires LAYA_BASE_URL and LAYA_API_KEY. There is no localhost default.
 */
export class LayaPolicy implements Policy {
  readonly name = "laya";
  private readonly client: TypeSafeClient;

  constructor(client?: TypeSafeClient) {
    if (!client) {
      const problem = policyConfigError("laya");
      if (problem) throw new PolicyNotConfiguredError(problem);
      client = new TypeSafeClient({
        apiKey: process.env.LAYA_API_KEY,
        baseURL: process.env.LAYA_BASE_URL,
        defaultModel: process.env.LAYA_MODEL || "laya",
        timeout: 8000,
      });
    }
    this.client = client;
  }

  choose(world: World): Promise<Decision> {
    return askAction(this.client, world);
  }
}
