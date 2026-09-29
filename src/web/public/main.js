import {
  renderActionDonut,
  renderConfidenceChart,
  renderObstacleChart,
  renderProbabilityChart,
} from "./charts.js";

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
const reasonEl = document.querySelector("#reason");
const playButton = document.querySelector("#play");
const form = document.querySelector("#limits");
const policyChoice = document.querySelector("#policy-choice");
const secondsInput = document.querySelector("#seconds");
const seedInput = document.querySelector("#seed");
const analysis = document.querySelector("#analysis");
const analysisTitle = document.querySelector("#analysis-title");
const facts = document.querySelector("#facts");
const analysisRows = document.querySelector("#analysis-rows");
const meter = document.querySelector("#meter");
const livePanel = document.querySelector("#live");
const liveFrame = document.querySelector("#live-frame");
const liveSpeed = document.querySelector("#live-speed");
const liveDecisions = document.querySelector("#live-decisions");
const liveJump = document.querySelector("#live-jump");
const liveDuck = document.querySelector("#live-duck");
const liveRun = document.querySelector("#live-run");

let latest = null;
let policyName = "—";
const queue = [];
let live = emptyLive();

function emptyLive() {
  return {
    playing: false,
    survived: false,
    score: 0,
    frames: 0,
    seconds: Number(secondsInput.value) || 20,
    seed: Number(seedInput.value) || 7,
    policy: policyChoice.value,
    model: null,
    decisions: 0,
    actions: { jump: 0, duck: 0, run: 0 },
    hit: null,
    history: [],
    error: null,
  };
}

function drawGround(frame) {
  ctx.strokeStyle = "#1c1915";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, GROUND_Y + 1);
  ctx.lineTo(canvas.width, GROUND_Y + 1);
  ctx.stroke();

  const shift = frame ? Math.floor(frame * 2) % 28 : 0;
  ctx.fillStyle = "#d8c7a5";
  for (let x = -shift; x < canvas.width; x += 28) {
    ctx.fillRect(x, GROUND_Y + 10, 14, 2);
  }
}

function drawCloud(x, y) {
  ctx.fillStyle = "#e7e0d2";
  ctx.fillRect(x, y, 36, 8);
  ctx.fillRect(x + 8, y - 6, 16, 6);
}

function drawDino(frame) {
  const height = frame.ducking ? DUCK_H : STAND_H;
  const bottom = GROUND_Y - frame.altitude;
  const y = bottom - height;
  ctx.fillStyle = "#1c1915";
  ctx.fillRect(DINO_X + 4, y + height - 8, 8, 6);
  ctx.fillRect(DINO_X, y, DINO_W, height);
  if (!frame.ducking) ctx.fillRect(DINO_X - 8, y + 16, 8, 6);
  ctx.fillStyle = "#f7f3ea";
  ctx.fillRect(DINO_X + 26, y + 8, 6, 6);
}

function drawObstacle(obstacle) {
  if (obstacle.kind === "bird") {
    ctx.fillStyle = "#8c4a2f";
    ctx.fillRect(obstacle.x + 8, obstacle.y + 4, obstacle.w - 16, obstacle.h - 6);
    ctx.fillRect(obstacle.x, obstacle.y, 14, 6);
    ctx.fillRect(obstacle.x + obstacle.w - 14, obstacle.y, 14, 6);
    return;
  }
  ctx.fillStyle = "#2f6b45";
  ctx.fillRect(obstacle.x + 6, obstacle.y, obstacle.w - 12, obstacle.h);
  ctx.fillRect(obstacle.x, obstacle.y + 10, 8, 6);
  ctx.fillRect(obstacle.x + obstacle.w - 8, obstacle.y + 16, 8, 6);
}

function render() {
  ctx.fillStyle = "#f7f3ea";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const scroll = latest ? latest.frame : 0;
  drawCloud(80 - (scroll % 400), 36);
  drawCloud(280 - (scroll % 520), 58);
  drawCloud(520 - (scroll % 460), 28);
  drawGround(scroll);
  if (!latest) {
    drawDino({ altitude: 0, ducking: false });
    return;
  }
  for (const obstacle of latest.obstacles) drawObstacle(obstacle);
  drawDino(latest);
}

function applyFrame(frame) {
  latest = frame;
  live.score = frame.score;
  live.frames = frame.frame;
  scoreEl.textContent = String(frame.score);
  liveFrame.textContent = String(frame.frame);
  liveSpeed.textContent = String(frame.speed);
  if (!frame.alive) statusEl.textContent = `Crashed at score ${frame.score}.`;
}

function showMeter(probabilities) {
  for (const key of ["jump", "duck", "run"]) {
    const segment = meter.querySelector(`[data-action="${key}"]`);
    const value = probabilities?.[key];
    segment.style.flexGrow = typeof value === "number" ? String(Math.max(value, 0)) : "1";
    segment.style.opacity = typeof value === "number" ? "1" : "0.2";
  }
}

function enqueue(item) {
  queue.push(item);
}

function showDecision(decision) {
  live.history.push(decision);
  live.actions[decision.action] += 1;
  live.decisions += 1;
  if (decision.model) live.model = decision.model;
  actionEl.textContent = decision.action;
  confidenceEl.textContent = decision.confidence === null ? "—" : decision.confidence.toFixed(2);
  liveDecisions.textContent = String(live.decisions);
  liveJump.textContent = String(live.actions.jump);
  liveDuck.textContent = String(live.actions.duck);
  liveRun.textContent = String(live.actions.run);
  showMeter(decision.probabilities);
  const probabilities = decision.probabilities
    ? `  jump ${pct(decision.probabilities.jump)}  duck ${pct(decision.probabilities.duck)}  run ${pct(decision.probabilities.run)}`
    : "";
  reasonEl.textContent = `f${decision.frame}  ${decision.action}${probabilities}${decision.note ? `  ${decision.note}` : ""}`;
  paint(live);
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

function paint(summary) {
  analysisTitle.textContent = summary.playing ? "Live decisions" : "How this run was played";
  const confidences = summary.history
    .map((row) => row.confidence)
    .filter((value) => typeof value === "number");
  const average =
    confidences.length === 0
      ? "—"
      : (confidences.reduce((total, value) => total + value, 0) / confidences.length).toFixed(2);
  const ending = summary.playing ? "Playing" : summary.survived ? "Survived" : "Crashed";
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
    fact("Avg confidence", average),
    fact("Hit", crash),
  );

  renderActionDonut(document.querySelector("#chart-actions"), summary.actions);
  renderConfidenceChart(document.querySelector("#chart-confidence"), summary.history);
  renderObstacleChart(document.querySelector("#chart-obstacles"), summary.history);
  renderProbabilityChart(document.querySelector("#chart-probabilities"), summary.history);

  analysisRows.replaceChildren();
  for (const row of summary.history) {
    const tr = document.createElement("tr");
    tr.className = row.action;
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
  statusEl.textContent = `${ending} Score ${summary.score}. ${summary.decisions} decisions.${detail}`;
  live = { ...summary, playing: false };
  paint(live);
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
    reasonEl.textContent = "";
    showMeter(null);
    live = emptyLive();
    live.playing = true;
    live.policy = message.policy ?? live.policy;
    live.seconds = message.seconds ?? live.seconds;
    live.seed = message.seed ?? live.seed;
    liveFrame.textContent = "0";
    liveSpeed.textContent = "0";
    liveDecisions.textContent = "0";
    liveJump.textContent = "0";
    liveDuck.textContent = "0";
    liveRun.textContent = "0";
    livePanel.hidden = false;
    paint(live);
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
  if (message.type === "decision") showDecision(message.decision);
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
  reasonEl.textContent = "";
  showMeter(null);
  statusEl.textContent = "Starting…";
  livePanel.hidden = true;
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
