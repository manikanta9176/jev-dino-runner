import type { Action } from "../game/types.ts";

export interface Decision {
  action: Action;
  /** Null when the choice did not come from Jev. */
  confidence: number | null;
  probabilities: Partial<Record<Action, number>> | null;
  model: string | null;
  note: string;
}

export interface Policy {
  readonly name: string;
  choose(world: import("../game/types.ts").World): Promise<Decision>;
}
