import { choice, TypeSafeClient } from "@typesafe-ai/sdk";
import { DINO_W, DINO_X, DUCK_H, GROUND_Y, STAND_H } from "../game/constants.ts";
import { nearestObstacle } from "../game/engine.ts";
import type { Action, World } from "../game/types.ts";
import type { Decision, Policy } from "./types.ts";

const ACTIONS = ["jump", "duck", "run"] as const satisfies readonly Action[];

/** Fixed meanings of the actions. These do not say which one is safe right now. */
const ACTION_CRITERIA = {
  run: "Keep the current path. Stay standing when on the ground. Do not jump and do not crouch.",
  duck: "Crouch on the ground so the body becomes shorter. This does not leave the ground.",
  jump: "Leap upward if currently on the ground. The body leaves the ground and stays in the air for a short time.",
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
      space: "X increases to the right. Y increases downward. Altitude is pixels above the ground.",
      groundY: GROUND_Y,
      speedPxPerFrame: round(world.speed),
      dinosaur: {
        frontX: dinoRight,
        width: DINO_W,
        standingHeight: STAND_H,
        crouchingHeight: DUCK_H,
        altitudePx: round(world.dino.altitude),
        grounded: world.dino.altitude <= 0,
        ducking: world.dino.ducking,
      },
      nextObstacle: threat
        ? {
            kind: threat.kind,
            leftX: Math.round(threat.x),
            topY: threat.y,
            width: threat.w,
            height: threat.h,
            bottomY: threat.y + threat.h,
            pixelsAheadOfDinosaur: Math.round(threat.x - dinoRight),
          }
        : null,
    };

    const response = await this.client.systemOne({
      state,
      questions: {
        action: choice(
          "Which action should the dinosaur take on this frame so its body does not overlap the next obstacle?",
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
