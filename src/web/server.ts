import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { explainFailure, policyConfigError, policyReady } from "../policy/errors.ts";
import { createPolicy, type PolicyName } from "../policy/create.ts";
import { play, type FrameEvent, type PlaySummary } from "../play/session.ts";
import { loadLocalEnv } from "../config/env.ts";

loadLocalEnv();

const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "public");
const port = Number(process.env.PORT ?? 4173);

const files: Record<string, string> = {
  "/": "index.html",
  "/index.html": "index.html",
  "/styles.css": "styles.css",
  "/main.js": "main.js",
  "/charts.js": "charts.js",
};

const types: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
};

const clients = new Set<ServerResponse>();
let generation = 0;
let running = false;

function policyFromEnv(): PolicyName {
  const requested = process.argv.includes("--policy")
    ? process.argv[process.argv.indexOf("--policy") + 1]
    : process.env.DINO_POLICY;
  if (requested === "heuristic") return "heuristic";
  if (requested === "laya") return "laya";
  if (requested === "jev") return "jev";
  return process.env.TYPESAFE_API_KEY ? "jev" : "heuristic";
}

function writeEvent(response: ServerResponse, payload: unknown) {
  response.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function broadcast(payload: unknown) {
  for (const client of clients) writeEvent(client, payload);
}

interface PlayRequest {
  policy: PolicyName;
  seconds: number;
  seed: number;
}

function parsePlayRequest(body: string, fallbackPolicy: PolicyName): PlayRequest | { error: string } {
  let raw: Record<string, unknown> = {};
  if (body.trim()) {
    try {
      const parsed: unknown = JSON.parse(body);
      if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
        return { error: "Request body must be a JSON object." };
      }
      raw = parsed as Record<string, unknown>;
    } catch {
      return { error: "Request body must be JSON." };
    }
  }

  const policy = raw.policy ?? fallbackPolicy;
  if (policy !== "jev" && policy !== "laya" && policy !== "heuristic") {
    return { error: "Policy must be jev, laya, or heuristic." };
  }
  const seconds = Number(raw.seconds ?? 20);
  const seed = Number(raw.seed ?? 7);
  if (!Number.isInteger(seconds) || seconds < 1 || seconds > 120) {
    return { error: "Seconds must be a whole number from 1 to 120." };
  }
  if (!Number.isInteger(seed) || seed < 0 || seed > 1_000_000) {
    return { error: "Seed must be a whole number from 0 to 1000000." };
  }
  return { policy, seconds, seed };
}

function readBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    request.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > 10_000) {
        reject(new Error("Body too large"));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    request.on("error", reject);
  });
}

async function startRun(settings: PlayRequest) {
  const token = ++generation;
  running = true;
  const { policy: policyName, seed, seconds } = settings;
  const keyNote =
    policyName === "heuristic" && !process.env.TYPESAFE_API_KEY
      ? " TYPESAFE_API_KEY is not set, so this run is the local heuristic instead of Jev."
      : "";
  broadcast({
    type: "status",
    message: `Playing with ${policyName} for ${seconds}s, seed ${seed}.${keyNote}`,
    policy: policyName,
    seconds,
    seed,
  });

  try {
    const summary = await play({
      policy: createPolicy(policyName),
      seed,
      seconds,
      frameStride: 2,
      onDecision: (event) => {
        if (token !== generation) return;
        broadcast({ type: "decision", decision: event });
      },
      onFrame: (frame: FrameEvent) => {
        if (token !== generation) return;
        broadcast({ type: "frame", frame });
      },
    });
    if (token === generation) broadcast({ type: "done", summary: summary satisfies PlaySummary });
  } catch (caught) {
    const message = explainFailure(policyName, caught);
    if (token === generation) broadcast({ type: "error", message });
  } finally {
    if (token === generation) running = false;
  }
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

  if (url.pathname === "/events") {
    response.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
    });
    clients.add(response);
    request.on("close", () => clients.delete(response));
    writeEvent(response, {
      type: "hello",
      policy: policyFromEnv(),
      hasApiKey: Boolean(process.env.TYPESAFE_API_KEY?.trim()),
      policies: policyReady(),
      running,
    });
    return;
  }

  if (url.pathname === "/api/play" && request.method === "POST") {
    if (running) {
      response.writeHead(409, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: "A run is already in progress." }));
      return;
    }
    const parsed = parsePlayRequest(await readBody(request), policyFromEnv());
    if ("error" in parsed) {
      response.writeHead(400, { "content-type": "application/json" });
      response.end(JSON.stringify(parsed));
      return;
    }
    const configError = policyConfigError(parsed.policy);
    if (configError) {
      response.writeHead(400, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: configError }));
      return;
    }
    void startRun(parsed);
    response.writeHead(202, { "content-type": "application/json" });
    response.end(JSON.stringify({ started: true, ...parsed }));
    return;
  }

  const fileName = files[url.pathname];
  if (!fileName) {
    response.writeHead(404).end("Not found");
    return;
  }

  const body = await readFile(path.join(publicDir, fileName));
  const extension = path.extname(fileName);
  response.writeHead(200, { "content-type": types[extension] ?? "text/plain" });
  response.end(body);
});

server.listen(port, () => {
  console.log(`Dino runner at http://127.0.0.1:${port}`);
  console.log(`Policy: ${policyFromEnv()}`);
});
