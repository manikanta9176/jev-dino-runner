import { TypeSafeClient } from "@typesafe-ai/sdk";
import type { World } from "../game/types.ts";
import { askAction } from "./ask.ts";
import type { Decision, Policy } from "./types.ts";

/** TypeSafe Jev, hosted at api.typesafe.ai. Reads TYPESAFE_API_KEY. */
export class JevPolicy implements Policy {
  readonly name = "jev";
  private readonly client: TypeSafeClient;

  constructor(client = new TypeSafeClient({ timeout: 8000 })) {
    this.client = client;
  }

  choose(world: World): Promise<Decision> {
    return askAction(this.client, world);
  }
}
