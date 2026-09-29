import { REACT_FRAMES } from "../game/constants.ts";
import {
  createWorld,
  framesUntilContact,
  nearestObstacle,
  obstacleCleared,
  step,
} from "../game/engine.ts";
import type { Action, Obstacle, World } from "../game/types.ts";
import type { Decision, Policy } from "../policy/types.ts";

export interface FrameEvent {
  frame: number;
  score: number;
  speed: number;
  alive: boolean;
  altitude: number;
  ducking: boolean;
  obstacles: Array<Pick<Obstacle, "id" | "kind" | "lane" | "x" | "y" | "w" | "h">>;
  decision: Decision | null;
  hitObstacleId: number | null;
}

export interface DecisionEvent {
  frame: number;
  action: Action;
  confidence: number | null;
  probabilities: Decision["probabilities"];
  model: string | null;
  note: string;
  obstacle: { id: number; kind: Obstacle["kind"]; lane: Obstacle["lane"] } | null;
}

export interface PlaySummary {
  policy: string;
  seed: number;
  seconds: number;
  survived: boolean;
  score: number;
  frames: number;
  decisions: number;
  model: string | null;
  actions: Record<Action, number>;
  hitObstacleId: number | null;
  hit: { id: number; kind: Obstacle["kind"]; lane: Obstacle["lane"] } | null;
  history: DecisionEvent[];
  error: string | null;
}

export interface PlayOptions {
  policy: Policy;
  seed: number;
  seconds: number;
  onFrame?: (event: FrameEvent) => void;
  onDecision?: (event: DecisionEvent) => void;
  frameStride?: number;
}

function snapshot(world: World, decision: Decision | null): FrameEvent {
  return {
    frame: world.frame,
    score: world.score,
    speed: Math.round(world.speed * 10) / 10,
    alive: world.alive,
    altitude: Math.round(world.dino.altitude * 10) / 10,
    ducking: world.dino.ducking,
    obstacles: world.obstacles.map((obstacle) => ({
      id: obstacle.id,
      kind: obstacle.kind,
      lane: obstacle.lane,
      x: Math.round(obstacle.x),
      y: obstacle.y,
      w: obstacle.w,
      h: obstacle.h,
    })),
    decision,
    hitObstacleId: world.hitObstacleId,
  };
}

export async function play(options: PlayOptions): Promise<PlaySummary> {
  const world = createWorld(options.seed);
  const maxFrames = Math.round(options.seconds * 60);
  const stride = options.frameStride ?? 2;
  const actions: Record<Action, number> = { jump: 0, duck: 0, run: 0 };
  let decisions = 0;
  let model: string | null = null;
  let error: string | null = null;
  let committed: { id: number; action: Action; jumped: boolean } | null = null;
  let lastDecision: Decision | null = null;
  const history: DecisionEvent[] = [];

  const emit = (force: boolean) => {
    if (!options.onFrame) return;
    if (force || world.frame % stride === 0) options.onFrame(snapshot(world, lastDecision));
  };

  emit(true);

  try {
    while (world.alive && world.frame < maxFrames) {
      if (committed && obstacleCleared(world, committed.id)) committed = null;

      const threat = nearestObstacle(world);

      let action: Action = "run";
      if (committed) {
        if (committed.action === "jump") {
          action = committed.jumped ? "run" : "jump";
          committed.jumped = true;
        } else {
          action = committed.action;
        }
      } else if (threat && framesUntilContact(world, threat) <= REACT_FRAMES) {
        const decision = await options.policy.choose(world);
        lastDecision = decision;
        const event: DecisionEvent = {
          frame: world.frame,
          action: decision.action,
          confidence: decision.confidence,
          probabilities: decision.probabilities,
          model: decision.model,
          note: decision.note,
          obstacle: threat
            ? { id: threat.id, kind: threat.kind, lane: threat.lane }
            : null,
        };
        history.push(event);
        options.onDecision?.(event);
        decisions += 1;
        actions[decision.action] += 1;
        if (decision.model) model = decision.model;
        committed = { id: threat.id, action: decision.action, jumped: decision.action === "jump" };
        action = decision.action;
      }

      step(world, action);
      emit(false);
    }
  } catch (caught) {
    error = caught instanceof Error ? caught.message : String(caught);
    world.alive = false;
  }

  emit(true);

  const hitObstacle = world.hitObstacleId
    ? world.obstacles.find((obstacle) => obstacle.id === world.hitObstacleId)
    : undefined;

  return {
    policy: options.policy.name,
    seed: options.seed,
    seconds: options.seconds,
    survived: world.alive && error === null,
    score: world.score,
    frames: world.frame,
    decisions,
    model,
    actions,
    hitObstacleId: world.hitObstacleId,
    hit: hitObstacle
      ? { id: hitObstacle.id, kind: hitObstacle.kind, lane: hitObstacle.lane }
      : null,
    history,
    error,
  };
}
