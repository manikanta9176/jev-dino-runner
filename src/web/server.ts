import { createServer, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
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
  if (requested === "jev") return "jev";
  return process.env.TYPESAFE_API_KEY ? "jev" : "heuristic";
}

function writeEvent(response: ServerResponse, payload: unknown) {
  response.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function broadcast(payload: unknown) {
  for (const client of clients) writeEvent(client, payload);
}

async function startRun(policyName: PolicyName, seed: number) {
  const token = ++generation;
  running = true;
  const keyNote =
    policyName === "heuristic" && !process.env.TYPESAFE_API_KEY
      ? " TYPESAFE_API_KEY is not set, so this run is the local heuristic instead of Jev."
      : "";
  broadcast({
    type: "status",
    message: `Playing with ${policyName}.${keyNote}`,
    policy: policyName,
  });

  try {
    const summary = await play({
      policy: createPolicy(policyName),
      seed,
      seconds: 24,
      frameStride: 2,
      onDecision: (decision, frame) => {
        if (token !== generation) return;
        broadcast({ type: "decision", frame, decision });
      },
      onFrame: (frame: FrameEvent) => {
        if (token !== generation) return;
        broadcast({ type: "frame", frame });
      },
    });
    if (token === generation) broadcast({ type: "done", summary: summary satisfies PlaySummary });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : String(caught);
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
      hasApiKey: Boolean(process.env.TYPESAFE_API_KEY),
      running,
    });
    return;
  }

  if (url.pathname === "/api/play" && request.method === "POST") {
    const policy = policyFromEnv();
    const seed = Number(url.searchParams.get("seed") ?? Date.now() % 100000);
    void startRun(policy, seed);
    response.writeHead(202, { "content-type": "application/json" });
    response.end(JSON.stringify({ started: true, policy, seed }));
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
