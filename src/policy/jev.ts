import { choice, TypeSafeClient } from "@typesafe-ai/sdk";
import { DINO_W, DINO_X } from "../game/constants.ts";
import { nearestObstacle } from "../game/engine.ts";
import { forecastAll } from "../game/forecast.ts";
import type { Action, World } from "../game/types.ts";
import type { Decision, Policy } from "./types.ts";

const ACTIONS = ["jump", "duck", "run"] as const satisfies readonly Action[];

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Asks Jev for one Choice: jump, duck, or run.
 * The state includes a short physics forecast so the model is judging a concrete situation.
 */
export class JevPolicy implements Policy {
  readonly name = "jev";
  private readonly client: TypeSafeClient;

  constructor(client = new TypeSafeClient({ timeout: 8000 })) {
    this.client = client;
  }

  async choose(world: World): Promise<Decision> {
    const threat = nearestObstacle(world);
    const outlook = forecastAll(world);
    const state = {
      game: "dinosaur runner",
      speedPxPerFrame: round(world.speed),
      dinosaur: {
        altitudePx: round(world.dino.altitude),
        ducking: world.dino.ducking,
        grounded: world.dino.altitude <= 0,
      },
      nextObstacle: threat
        ? {
            kind: threat.kind,
            lane: threat.lane,
            pixelsAhead: Math.round(threat.x - (DINO_X + DINO_W)),
            width: threat.w,
            height: threat.h,
          }
        : null,
      ifYouActNow: {
        run: outlook.run.summary,
        duck: outlook.duck.summary,
        jump: outlook.jump.summary,
      },
    };

    const response = await this.client.systemOne({
      state,
      questions: {
        action: choice("What should the dinosaur do on this frame?", {
          run: outlook.run.summary,
          duck: outlook.duck.summary,
          jump: outlook.jump.summary,
        }),
      },
    });

    const answer = response.answers.action;
    const picked = ACTIONS.includes(answer.choice as Action) ? (answer.choice as Action) : "run";

    return {
      action: picked,
      confidence: answer.confidence,
      probabilities: {
        jump: answer.probabilities.jump,
        duck: answer.probabilities.duck,
        run: answer.probabilities.run,
      },
      model: response.model,
      note: outlook[picked].summary,
    };
  }
}
