const GROUND_Y = 188;
const DINO_X = 56;
const DINO_W = 40;
const STAND_H = 44;
const DUCK_H = 24;

const canvas = document.querySelector("#field");
const ctx = canvas.getContext("2d");
const scoreEl = document.querySelector("#score");
const policyEl = document.querySelector("#policy");
const actionEl = document.querySelector("#action");
const confidenceEl = document.querySelector("#confidence");
const statusEl = document.querySelector("#status");
const logEl = document.querySelector("#log");
const playButton = document.querySelector("#play");

let latest = null;
let policyName = "—";
const queue = [];

function drawGround() {
  ctx.strokeStyle = "#1c1915";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, GROUND_Y + 1);
  ctx.lineTo(canvas.width, GROUND_Y + 1);
  ctx.stroke();

  ctx.fillStyle = "#d8c7a5";
  for (let x = 0; x < canvas.width; x += 28) {
    ctx.fillRect(x, GROUND_Y + 8, 12, 2);
  }
}

function drawDino(frame) {
  const height = frame.ducking ? DUCK_H : STAND_H;
  const bottom = GROUND_Y - frame.altitude;
  const y = bottom - height;
  ctx.fillStyle = "#1c1915";
  ctx.fillRect(DINO_X, y, DINO_W, height);
  ctx.fillStyle = "#f7f3ea";
  ctx.fillRect(DINO_X + 26, y + 8, 6, 6);
}

function drawObstacle(obstacle) {
  ctx.fillStyle = obstacle.kind === "bird" ? "#8c4a2f" : "#2f6b45";
  ctx.fillRect(obstacle.x, obstacle.y, obstacle.w, obstacle.h);
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#f7f3ea";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawGround();
  if (!latest) {
    drawDino({ altitude: 0, ducking: false });
    return;
  }
  for (const obstacle of latest.obstacles) drawObstacle(obstacle);
  drawDino(latest);
}

function applyFrame(frame) {
  latest = frame;
  scoreEl.textContent = String(frame.score);
  if (!frame.alive) statusEl.textContent = `Crashed at score ${frame.score}.`;
}

function pushLog(text) {
  const item = document.createElement("li");
  item.textContent = text;
  logEl.prepend(item);
  while (logEl.children.length > 8) logEl.lastChild.remove();
}

function enqueue(item) {
  queue.push(item);
}

function showDecision(frameNumber, decision) {
  actionEl.textContent = decision.action;
  confidenceEl.textContent = decision.confidence === null ? "—" : decision.confidence.toFixed(2);
  const probabilities = decision.probabilities
    ? `  jump ${pct(decision.probabilities.jump)}  duck ${pct(decision.probabilities.duck)}  run ${pct(decision.probabilities.run)}`
    : "";
  pushLog(`f${frameNumber}  ${decision.action}${probabilities}`);
}

function finish(summary) {
  const ending = summary.survived ? "Survived the run." : "The run ended.";
  const detail = summary.error ? ` ${summary.error}` : "";
  statusEl.textContent = `${ending} Score ${summary.score}. Decisions ${summary.decisions}.${detail}`;
  playButton.disabled = false;
}

const events = new EventSource("/events");

events.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.type === "hello") {
    policyName = message.policy;
    policyEl.textContent = policyName;
    if (!message.hasApiKey && policyName !== "jev") {
      statusEl.textContent =
        "No TYPESAFE_API_KEY in the environment, so this window uses the local heuristic. Add the key and restart to let Jev play.";
    }
    return;
  }
  if (message.type === "status") {
    queue.length = 0;
    policyName = message.policy;
    policyEl.textContent = policyName;
    statusEl.textContent = message.message;
    logEl.replaceChildren();
    return;
  }
  if (message.type === "error") {
    statusEl.textContent = message.message;
    playButton.disabled = false;
    return;
  }
  enqueue(message);
});

function playback() {
  requestAnimationFrame(playback);
  const message = queue.shift();
  if (!message) return;
  if (message.type === "frame") applyFrame(message.frame);
  if (message.type === "decision") showDecision(message.frame, message.decision);
  if (message.type === "done") finish(message.summary);
  render();
}

function pct(value) {
  if (typeof value !== "number") return "—";
  return `${Math.round(value * 100)}%`;
}

playButton.addEventListener("click", async () => {
  playButton.disabled = true;
  actionEl.textContent = "run";
  confidenceEl.textContent = "—";
  statusEl.textContent = "Starting…";
  await fetch("/api/play", { method: "POST" });
});

playback();
render();
