import { cloneWorld, nearestObstacle, obstacleCleared, step } from "./engine.ts";
import type { Action, World } from "./types.ts";

export interface Forecast {
  action: Action;
  collided: boolean;
  framesAlive: number;
  summary: string;
}

const SIM_LIMIT = 80;

/**
 * Roll one committed action forward until the nearest obstacle is passed.
 * A jump is pressed only on the first simulated frame.
 */
export function forecast(world: World, action: Action): Forecast {
  const threat = nearestObstacle(world);
  const sim = cloneWorld(world);
  let lived = 0;

  for (let i = 0; i < SIM_LIMIT && sim.alive; i += 1) {
    const frameAction: Action = action === "jump" && i > 0 ? "run" : action;
    step(sim, frameAction);
    lived += 1;
    if (!sim.alive) break;
    if (threat && obstacleCleared(sim, threat.id)) {
      const label = `${threat.lane} ${threat.kind}`;
      return {
        action,
        collided: false,
        framesAlive: lived,
        summary: `Safe. ${action} passes the ${label}.`,
      };
    }
  }

  const label = threat ? `${threat.lane} ${threat.kind}` : "open ground";
  if (!threat) {
    return {
      action,
      collided: false,
      framesAlive: lived,
      summary: `Safe. Nothing is close enough to hit.`,
    };
  }

  return {
    action,
    collided: true,
    framesAlive: lived,
    summary: sim.alive
      ? `Unsafe. ${action} does not get past the ${label} in time.`
      : `Collision. ${action} hits the ${label}.`,
  };
}

export function forecastAll(world: World): Record<Action, Forecast> {
  return {
    run: forecast(world, "run"),
    duck: forecast(world, "duck"),
    jump: forecast(world, "jump"),
  };
}
