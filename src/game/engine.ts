import {
  ACCEL_PER_FRAME,
  DINO_W,
  DINO_X,
  DUCK_H,
  GRAVITY,
  GROUND_Y,
  HIT_INSET,
  JUMP_SPEED,
  MAX_SPEED,
  STAND_H,
  START_SPEED,
  WORLD_WIDTH,
} from "./constants.ts";
import { nextRandom } from "./rng.ts";
import type { Action, Box, Obstacle, World } from "./types.ts";

export function createWorld(seed: number): World {
  const rngState = seed >>> 0 || 1;
  return {
    dino: { altitude: 0, vy: 0, ducking: false },
    obstacles: [],
    speed: START_SPEED,
    distance: 0,
    score: 0,
    frame: 0,
    alive: true,
    untilSpawn: 150,
    nextObstacleId: 1,
    rngState,
    hitObstacleId: null,
  };
}

export function cloneWorld(world: World): World {
  return {
    ...world,
    dino: { ...world.dino },
    obstacles: world.obstacles.map((obstacle) => ({ ...obstacle })),
  };
}

export function dinoBox(world: World): Box {
  const height = world.dino.ducking ? DUCK_H : STAND_H;
  const bottom = GROUND_Y - world.dino.altitude;
  return {
    x: DINO_X + HIT_INSET,
    y: bottom - height + HIT_INSET,
    w: DINO_W - HIT_INSET * 2,
    h: height - HIT_INSET * 2,
  };
}

export function obstacleBox(obstacle: Obstacle): Box {
  return {
    x: obstacle.x + HIT_INSET,
    y: obstacle.y + HIT_INSET,
    w: obstacle.w - HIT_INSET * 2,
    h: obstacle.h - HIT_INSET * 2,
  };
}

function overlaps(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function obstacleCleared(world: World, obstacleId: number): boolean {
  const obstacle = world.obstacles.find((item) => item.id === obstacleId);
  if (!obstacle) return true;
  return obstacle.x + obstacle.w < DINO_X;
}

export function nearestObstacle(world: World): Obstacle | null {
  const dinoRight = DINO_X + DINO_W;
  let nearest: Obstacle | null = null;
  for (const obstacle of world.obstacles) {
    if (obstacle.x + obstacle.w < dinoRight - 4) continue;
    if (!nearest || obstacle.x < nearest.x) nearest = obstacle;
  }
  return nearest;
}

/** Frames until the dinosaur's front meets the obstacle, at the current speed. */
export function framesUntilContact(world: World, obstacle: Obstacle): number {
  const gap = obstacle.x - (DINO_X + DINO_W);
  return gap / world.speed;
}

function random(world: World): number {
  const rolled = nextRandom(world.rngState);
  world.rngState = rolled.state;
  return rolled.value;
}

function spawnObstacle(world: World): Obstacle {
  const id = world.nextObstacleId++;
  const roll = random(world);
  const x = WORLD_WIDTH + 8;

  if (roll < 0.68) {
    const large = random(world) > 0.55;
    const w = large ? 28 : 18;
    const h = large ? 46 : 32;
    return { id, kind: "cactus", lane: "ground", x, y: GROUND_Y - h, w, h };
  }

  const w = 46;
  const h = 16;
  if (roll < 0.86) {
    const y = GROUND_Y - 40;
    return { id, kind: "bird", lane: "low", x, y, w, h };
  }

  const y = GROUND_Y - 86;
  return { id, kind: "bird", lane: "high", x, y, w, h };
}

export function step(world: World, action: Action): void {
  if (!world.alive) return;

  const dino = world.dino;
  const grounded = dino.altitude <= 0;
  if (grounded && action === "jump") {
    dino.vy = JUMP_SPEED;
    dino.ducking = false;
  } else {
    dino.ducking = grounded && action === "duck";
  }

  dino.vy -= GRAVITY;
  dino.altitude += dino.vy;
  if (dino.altitude <= 0) {
    dino.altitude = 0;
    dino.vy = 0;
    if (action !== "duck") dino.ducking = false;
  } else {
    dino.ducking = false;
  }

  for (const obstacle of world.obstacles) obstacle.x -= world.speed;
  world.obstacles = world.obstacles.filter((obstacle) => obstacle.x + obstacle.w > -30);

  world.distance += world.speed;
  world.speed = Math.min(MAX_SPEED, world.speed + ACCEL_PER_FRAME);
  world.untilSpawn -= world.speed;
  if (world.untilSpawn <= 0) {
    world.obstacles.push(spawnObstacle(world));
    world.untilSpawn = world.speed * 46 + random(world) * 70;
  }

  world.frame += 1;
  world.score = Math.floor(world.distance / 8);

  const body = dinoBox(world);
  for (const obstacle of world.obstacles) {
    if (overlaps(body, obstacleBox(obstacle))) {
      world.alive = false;
      world.hitObstacleId = obstacle.id;
      break;
    }
  }
}
