import { TypeSafeClient } from "@typesafe-ai/sdk";
import type { World } from "../game/types.ts";
import { askAction } from "./ask.ts";
import type { Decision, Policy } from "./types.ts";

/**
 * Local or self-hosted Laya. Same question as Jev, different server.
 * Defaults to laya-serve on http://127.0.0.1:8000. Override with LAYA_BASE_URL.
 * The TypeSafe SDK requires some API key; "local" works unless the server sets LAYA_API_KEY.
 */
export class LayaPolicy implements Policy {
  readonly name = "laya";
  private readonly client: TypeSafeClient;

  constructor(
    client = new TypeSafeClient({
      apiKey: process.env.LAYA_API_KEY || "local",
      baseURL: process.env.LAYA_BASE_URL || "http://127.0.0.1:8000",
      defaultModel: process.env.LAYA_MODEL || "laya",
      timeout: 8000,
    }),
  ) {
    this.client = client;
  }

  choose(world: World): Promise<Decision> {
    return askAction(this.client, world);
  }
}
