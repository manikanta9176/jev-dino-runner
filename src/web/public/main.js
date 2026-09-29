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
const form = document.querySelector("#limits");
const policyChoice = document.querySelector("#policy-choice");
const secondsInput = document.querySelector("#seconds");
const seedInput = document.querySelector("#seed");
const analysis = document.querySelector("#analysis");
const facts = document.querySelector("#facts");
const analysisRows = document.querySelector("#analysis-rows");

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

function setFormLocked(locked) {
  playButton.disabled = locked;
  policyChoice.disabled = locked;
  secondsInput.disabled = locked;
  seedInput.disabled = locked;
}

function fact(label, value) {
  const cell = document.createElement("div");
  const name = document.createElement("span");
  const number = document.createElement("strong");
  name.textContent = label;
  number.textContent = value;
  cell.append(name, number);
  return cell;
}

function renderAnalysis(summary) {
  const confidences = summary.history
    .map((row) => row.confidence)
    .filter((value) => typeof value === "number");
  const average =
    confidences.length === 0
      ? "—"
      : (confidences.reduce((total, value) => total + value, 0) / confidences.length).toFixed(2);
  const ending = summary.survived ? "Survived" : "Crashed";
  const crash = summary.hit ? `${summary.hit.lane} ${summary.hit.kind}` : "—";

  facts.replaceChildren(
    fact("Result", ending),
    fact("Score", String(summary.score)),
    fact("Frames", String(summary.frames)),
    fact("Limit", `${summary.seconds}s`),
    fact("Seed", String(summary.seed)),
    fact("Policy", summary.policy),
    fact("Model", summary.model ?? "—"),
    fact("Decisions", String(summary.decisions)),
    fact("Jump", String(summary.actions.jump)),
    fact("Duck", String(summary.actions.duck)),
    fact("Run", String(summary.actions.run)),
    fact("Avg confidence", average),
    fact("Hit", crash),
  );

  analysisRows.replaceChildren();
  for (const row of summary.history) {
    const tr = document.createElement("tr");
    const obstacle = row.obstacle ? `${row.obstacle.lane} ${row.obstacle.kind}` : "—";
    const cells = [
      String(row.frame),
      obstacle,
      row.action,
      row.confidence === null ? "—" : row.confidence.toFixed(2),
      pct(row.probabilities?.jump),
      pct(row.probabilities?.duck),
      pct(row.probabilities?.run),
      row.note,
    ];
    for (const value of cells) {
      const td = document.createElement("td");
      td.textContent = value;
      tr.append(td);
    }
    analysisRows.append(tr);
  }
  analysis.hidden = false;
}

function finish(summary) {
  const ending = summary.survived ? "Survived the run." : "The run ended.";
  const detail = summary.error ? ` ${summary.error}` : "";
  statusEl.textContent = `${ending} Score ${summary.score}. Decisions ${summary.decisions}. The table below is every choice in order.${detail}`;
  renderAnalysis(summary);
  setFormLocked(false);
}

const events = new EventSource("/events");

events.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.type === "hello") {
    policyName = message.policy;
    policyEl.textContent = policyName;
    policyChoice.value = message.policy === "heuristic" ? "heuristic" : "jev";
    if (!message.hasApiKey) {
      statusEl.textContent =
        "No TYPESAFE_API_KEY in the environment. Choose heuristic, or add the key and restart the server to use Jev.";
    }
    return;
  }
  if (message.type === "status") {
    queue.length = 0;
    policyName = message.policy;
    policyEl.textContent = policyName;
    statusEl.textContent = message.message;
    logEl.replaceChildren();
    analysis.hidden = true;
    return;
  }
  if (message.type === "error") {
    statusEl.textContent = message.message;
    setFormLocked(false);
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

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const seconds = Number(secondsInput.value);
  const seed = Number(seedInput.value);
  if (!Number.isInteger(seconds) || seconds < 1 || seconds > 120) {
    statusEl.textContent = "Seconds must be a whole number from 1 to 120.";
    return;
  }
  if (!Number.isInteger(seed) || seed < 0 || seed > 1_000_000) {
    statusEl.textContent = "Seed must be a whole number from 0 to 1000000.";
    return;
  }

  setFormLocked(true);
  actionEl.textContent = "run";
  confidenceEl.textContent = "—";
  statusEl.textContent = "Starting…";
  analysis.hidden = true;

  const response = await fetch("/api/play", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      policy: policyChoice.value,
      seconds,
      seed,
    }),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: "Could not start the run." }));
    statusEl.textContent = payload.error ?? "Could not start the run.";
    setFormLocked(false);
  }
});

playback();
render();
