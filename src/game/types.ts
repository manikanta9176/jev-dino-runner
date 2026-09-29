export type Action = "jump" | "duck" | "run";

export type ObstacleKind = "cactus" | "bird";

export type Lane = "ground" | "low" | "high";

export interface Obstacle {
  id: number;
  kind: ObstacleKind;
  lane: Lane;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Dino {
  altitude: number;
  vy: number;
  ducking: boolean;
}

export interface World {
  dino: Dino;
  obstacles: Obstacle[];
  speed: number;
  distance: number;
  score: number;
  frame: number;
  alive: boolean;
  untilSpawn: number;
  nextObstacleId: number;
  rngState: number;
  hitObstacleId: number | null;
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}
