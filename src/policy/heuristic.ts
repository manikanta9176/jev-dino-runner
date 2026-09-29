import { nearestObstacle } from "../game/engine.ts";
import { forecastAll } from "../game/forecast.ts";
import type { Action, World } from "../game/types.ts";
import type { Decision, Policy } from "./types.ts";

/**
 * Local stand-in used when you want to see the runner without an API key.
 * Prefers running, then ducking under a low bird, then jumping.
 */
export class HeuristicPolicy implements Policy {
  readonly name = "heuristic";

  async choose(world: World): Promise<Decision> {
    const outlook = forecastAll(world);
    const threat = nearestObstacle(world);
    let action: Action = "run";

    if (outlook.run.collided) {
      if (threat?.lane === "low" && !outlook.duck.collided) action = "duck";
      else if (!outlook.jump.collided) action = "jump";
      else if (!outlook.duck.collided) action = "duck";
      else {
        const ranked = [outlook.duck, outlook.jump, outlook.run].sort(
          (a, b) => b.framesAlive - a.framesAlive,
        );
        action = ranked[0]?.action ?? "jump";
      }
    }

    return {
      action,
      confidence: null,
      probabilities: null,
      model: null,
      note: outlook[action].summary,
    };
  }
}
