import { choice, TypeSafeClient } from "@typesafe-ai/sdk";
import { DINO_W, DINO_X, DUCK_H, STAND_H } from "../game/constants.ts";
import { nearestObstacle } from "../game/engine.ts";
import type { Action, World } from "../game/types.ts";
import type { Decision, Policy } from "./types.ts";

const ACTIONS = ["jump", "duck", "run"] as const satisfies readonly Action[];

/**
 * What each action is for. These describe kinds of obstacles, not the result of a simulation.
 * Jev matches `nextObstacle` to one of these descriptions.
 */
const ACTION_CRITERIA = {
  run: "The next obstacle is a high bird, above a standing dinosaur. Staying on the current path goes under it. Also choose this when no obstacle is close.",
  duck: "The next obstacle is a low bird. A standing dinosaur meets it. Crouching goes under it.",
  jump: "The next obstacle is a cactus on the ground. A standing or crouching dinosaur meets it. A jump goes over it.",
} as const;

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Asks Jev which action fits the current scene.
 * The state is measured geometry. The option text only defines what each action does.
 */
export class JevPolicy implements Policy {
  readonly name = "jev";
  private readonly client: TypeSafeClient;

  constructor(client = new TypeSafeClient({ timeout: 8000 })) {
    this.client = client;
  }

  async choose(world: World): Promise<Decision> {
    const threat = nearestObstacle(world);
    const dinoRight = DINO_X + DINO_W;
    const state = {
      game: "dinosaur runner",
      speedPxPerFrame: round(world.speed),
      dinosaur: {
        standingHeight: STAND_H,
        crouchingHeight: DUCK_H,
        altitudePx: round(world.dino.altitude),
        grounded: world.dino.altitude <= 0,
        ducking: world.dino.ducking,
      },
      nextObstacle: threat
        ? {
            kind: threat.kind,
            lane: threat.lane,
            pixelsAhead: Math.round(threat.x - dinoRight),
          }
        : null,
    };

    const response = await this.client.systemOne({
      state,
      questions: {
        action: choice(
          "Which action fits `nextObstacle`? Match its kind and lane to the option descriptions.",
          ACTION_CRITERIA,
        ),
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
      note: ACTION_CRITERIA[picked],
    };
  }
}
