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

const versusChoice = document.querySelector("#versus-choice");
const boards = document.querySelector("#boards");
const boardB = document.querySelector("#board-b");
const match = document.querySelector("#match");
const matchSummary = document.querySelector("#match-summary");
const matchRows = document.querySelector("#match-rows");
const matchHeadA = document.querySelector("#match-head-a");
const matchHeadB = document.querySelector("#match-head-b");

function makeSide(id) {
  const canvas = document.querySelector(`#field-${id}`);
  return {
    id,
    canvas,
    ctx: canvas.getContext("2d"),
    latest: null,
    queue: [],
    finished: false,
    summary: null,
    scoreEl: document.querySelector(`#score-${id}`),
    actionEl: document.querySelector(`#action-${id}`),
    confidenceEl: document.querySelector(`#confidence-${id}`),
    meter: document.querySelector(`#meter-${id}`),
    reasonEl: document.querySelector(`#reason-${id}`),
    titleEl: document.querySelector(`#board-title-${id}`),
    live: null,
  };
}

const sideA = makeSide("a");
const sideB = makeSide("b");
let comparing = false;

function emptyLive(policy) {
  return {
    playing: false,
    survived: false,
    score: 0,
    frames: 0,
    seconds: Number(secondsInput.value) || 20,
    seed: Number(seedInput.value) || 7,
    policy: policy || policyChoice.value,
    model: null,
    decisions: 0,
    actions: { jump: 0, duck: 0, run: 0 },
    hit: null,
    history: [],
    error: null,
  };
}

function activeSides() {
  return comparing ? [sideA, sideB] : [sideA];
}
const notice = document.querySelector("#notice");
const noticeTitle = document.querySelector("#notice-title");
const noticeBody = document.querySelector("#notice-body");
const statusEl = document.querySelector("#status");
const playButton = document.querySelector("#play");
const form = document.querySelector("#limits");
const policyChoice = document.querySelector("#policy-choice");
const secondsInput = document.querySelector("#seconds");
const seedInput = document.querySelector("#seed");
const analysis = document.querySelector("#analysis");
const analysisTitle = document.querySelector("#analysis-title");
const facts = document.querySelector("#facts");
const analysisRows = document.querySelector("#analysis-rows");
const livePanel = document.querySelector("#live");
const liveFrame = document.querySelector("#live-frame");
const liveSpeed = document.querySelector("#live-speed");
const liveDecisions = document.querySelector("#live-decisions");
const liveJump = document.querySelector("#live-jump");
const liveDuck = document.querySelector("#live-duck");
const liveRun = document.querySelector("#live-run");

let policyName = "—";
sideA.live = emptyLive("jev");
sideB.live = emptyLive("heuristic");

function drawGround(ctx, canvas, frame) {
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

function drawCloud(ctx, x, y) {
  ctx.fillStyle = "#e7e0d2";
  ctx.fillRect(x, y, 36, 8);
  ctx.fillRect(x + 8, y - 6, 16, 6);
}

function drawDino(ctx, frame) {
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

function drawObstacle(ctx, obstacle) {
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

function renderSide(side) {
  const ctx = side.ctx;
  const canvas = side.canvas;
  ctx.fillStyle = "#f7f3ea";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const scroll = side.latest ? side.latest.frame : 0;
  drawCloud(ctx, 80 - (scroll % 400), 36);
  drawCloud(ctx, 280 - (scroll % 520), 58);
  drawCloud(ctx, 520 - (scroll % 460), 28);
  drawGround(ctx, canvas, scroll);
  if (!side.latest) {
    drawDino(ctx, { altitude: 0, ducking: false });
    return;
  }
  for (const obstacle of side.latest.obstacles) drawObstacle(ctx, obstacle);
  drawDino(ctx, side.latest);
}

function applyFrame(side, frame) {
  side.latest = frame;
  side.live.score = frame.score;
  side.live.frames = frame.frame;
  side.scoreEl.textContent = String(frame.score);
  if (side.id === "a") {
    liveFrame.textContent = String(frame.frame);
    liveSpeed.textContent = String(frame.speed);
  }
  if (!frame.alive) side.reasonEl.textContent = `Crashed at score ${frame.score}.`;
}

function showMeter(meter, probabilities) {
  for (const key of ["jump", "duck", "run"]) {
    const segment = meter.querySelector(`[data-action="${key}"]`);
    const value = probabilities?.[key];
    segment.style.flexGrow = typeof value === "number" ? String(Math.max(value, 0)) : "1";
    segment.style.opacity = typeof value === "number" ? "1" : "0.2";
  }
}

function showDecision(side, decision) {
  const record = side.live;
  record.history.push(decision);
  record.actions[decision.action] += 1;
  record.decisions += 1;
  if (decision.model) record.model = decision.model;
  side.actionEl.textContent = decision.action;
  side.confidenceEl.textContent = decision.confidence === null ? "—" : decision.confidence.toFixed(2);
  if (side.id === "a") {
    liveDecisions.textContent = String(record.decisions);
    liveJump.textContent = String(record.actions.jump);
    liveDuck.textContent = String(record.actions.duck);
    liveRun.textContent = String(record.actions.run);
  }
  showMeter(side.meter, decision.probabilities);
  side.reasonEl.textContent = decision.note;
  if (!comparing && side.id === "a") paint(record);
  if (comparing) renderMatch();
}

function renderMatch() {
  const byKey = new Map();
  for (const row of sideA.live.history) byKey.set(row.obstacle?.id ?? `f${row.frame}`, { a: row });
  for (const row of sideB.live.history) {
    const key = row.obstacle?.id ?? `f${row.frame}`;
    const slot = byKey.get(key) ?? {};
    slot.b = row;
    byKey.set(key, slot);
  }
  matchRows.replaceChildren();
  let same = 0;
  let total = 0;
  for (const slot of byKey.values()) {
    const obstacle = slot.a?.obstacle ?? slot.b?.obstacle;
    const label = obstacle ? `${obstacle.lane} ${obstacle.kind}` : "—";
    const left = slot.a ? `${slot.a.action}${slot.a.confidence === null ? "" : ` ${slot.a.confidence.toFixed(2)}`}` : "…";
    const right = slot.b ? `${slot.b.action}${slot.b.confidence === null ? "" : ` ${slot.b.confidence.toFixed(2)}`}` : "…";
    const both = slot.a && slot.b;
    const agree = both && slot.a.action === slot.b.action;
    if (both) {
      total += 1;
      if (agree) same += 1;
    }
    const tr = document.createElement("tr");
    if (both && !agree) tr.className = "differ";
    for (const value of [label, left, right, both ? (agree ? "same" : "different") : "…"]) {
      const td = document.createElement("td");
      td.textContent = value;
      tr.append(td);
    }
    matchRows.append(tr);
  }
  matchSummary.textContent = total === 0 ? "Waiting for both sides to choose." : `${same} of ${total} shared obstacles got the same action.`;
}

function setFormLocked(locked) {
  playButton.disabled = locked;
  policyChoice.disabled = locked;
  versusChoice.disabled = locked;
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

function finishSide(side, summary) {
  if (side.finished) return;
  side.finished = true;
  side.summary = summary;
  side.live = { ...summary, playing: false };
  if (!comparing && side.id === "a") {
    paint(side.live);
    if (summary.error) showNotice(summary.error);
    else clearNotice();
    const ending = summary.survived ? "Survived the run." : "The run ended.";
    statusEl.classList.remove("problem");
    statusEl.textContent = `${ending} Score ${summary.score}. ${summary.decisions} decisions.`;
  }
  if (comparing) {
    renderMatch();
    if (sideA.finished && sideB.finished) {
      const left = sideA.summary;
      const right = sideB.summary;
      statusEl.classList.remove("problem");
      statusEl.textContent = `${sideA.live.policy} ${left?.survived ? "survived" : "ended"} at ${left?.score ?? 0}. ${sideB.live.policy} ${right?.survived ? "survived" : "ended"} at ${right?.score ?? 0}.`;
      const problem = left?.error || right?.error;
      if (problem) showNotice(problem);
      else clearNotice();
    }
  }
  if (activeSides().every((item) => item.finished)) setFormLocked(false);
}

function failSide(side, message) {
  side.reasonEl.textContent = message;
  showNotice(message);
  finishSide(side, { ...side.live, playing: false, survived: false, error: message });
  if (!comparing) statusEl.textContent = "The run stopped.";
}

let ready = { jev: true, laya: false, heuristic: true };

const DEFAULT_STATUS =
  "Set the limits, then press Play. A decision is made each time an obstacle gets close.";

function noticeKind(message) {
  if (/not configured/i.test(message)) return ["Not configured", "setup"];
  if (/credit/i.test(message)) return ["Credits used up", "credits"];
  if (/rate limit/i.test(message)) return ["Rate limit", "limit"];
  if (/rejected the API key|refused this key/i.test(message)) return ["API key", "auth"];
  if (/could not reach/i.test(message)) return ["Can't reach the API", "down"];
  if (/whole number/i.test(message)) return ["Check the limits", "limit"];
  return ["Couldn't play", "setup"];
}

function showNotice(message) {
  const [title, kind] = noticeKind(message);
  notice.hidden = false;
  notice.dataset.kind = kind;
  noticeTitle.textContent = title;
  noticeBody.textContent = message;
}

function clearNotice() {
  notice.hidden = true;
  noticeTitle.textContent = "";
  noticeBody.textContent = "";
  statusEl.classList.remove("problem");
}

function statusIsWarning(text) {
  return /not configured|credits left|rejected the API key|refused this key|rate limited|Could not reach|The run stopped|Couldn't play/i.test(
    text,
  );
}

function syncPolicyNotice() {
  const other = versusChoice.value && versusChoice.value !== policyChoice.value ? versusChoice.value : "";
  const problem = policyProblem(policyChoice.value) || (other ? policyProblem(other) : "");
  if (problem) showNotice(problem);
  else clearNotice();
  statusEl.classList.remove("problem");
  if (!problem || statusIsWarning(statusEl.textContent)) {
    if (problem || statusIsWarning(statusEl.textContent)) statusEl.textContent = DEFAULT_STATUS;
  }
}

function policyProblem(name) {
  if (name === "jev" && !ready.jev) {
    return "Jev is not configured. Add TYPESAFE_API_KEY to .env, then restart the server.";
  }
  if (name === "laya" && !ready.laya) {
    return "Laya is not configured. Add LAYA_BASE_URL and LAYA_API_KEY to .env, then restart the server.";
  }
  return "";
}

policyChoice.addEventListener("change", () => {
  syncPolicyNotice();
});
versusChoice.addEventListener("change", () => {
  syncPolicyNotice();
});

function sideById(id) {
  return id === "b" ? sideB : sideA;
}

function resetSide(side, policy) {
  side.queue.length = 0;
  side.latest = null;
  side.finished = false;
  side.summary = null;
  side.live = emptyLive(policy);
  side.live.playing = true;
  side.titleEl.textContent = policy;
  side.scoreEl.textContent = "0";
  side.actionEl.textContent = "run";
  side.confidenceEl.textContent = "—";
  side.reasonEl.textContent = "";
  showMeter(side.meter, null);
  renderSide(side);
}

const events = new EventSource("/events");

events.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.type === "hello") {
    policyName = message.policy;
    policyChoice.value = ["jev", "laya", "heuristic"].includes(message.policy) ? message.policy : "jev";
    if (message.policies) ready = message.policies;
    else ready = { jev: Boolean(message.hasApiKey), laya: false, heuristic: true };
    sideA.titleEl.textContent = policyChoice.value;
    syncPolicyNotice();
    return;
  }
  if (message.type === "status") {
    comparing = Boolean(message.against);
    boards.classList.toggle("compare", comparing);
    boardB.hidden = !comparing;
    match.hidden = !comparing;
    analysis.hidden = true;
    matchRows.replaceChildren();
    matchSummary.textContent = comparing ? "Waiting for both sides to choose." : "";
    if (comparing) {
      matchHeadA.textContent = message.policy;
      matchHeadB.textContent = message.against;
    }
    resetSide(sideA, message.policy);
    if (comparing) resetSide(sideB, message.against);
    clearNotice();
    statusEl.classList.remove("problem");
    statusEl.textContent = message.message;
    liveFrame.textContent = "0";
    liveSpeed.textContent = "0";
    liveDecisions.textContent = "0";
    liveJump.textContent = "0";
    liveDuck.textContent = "0";
    liveRun.textContent = "0";
    livePanel.hidden = comparing;
    if (!comparing) paint(sideA.live);
    return;
  }
  if (message.type === "error") {
    failSide(sideById(message.side), message.message);
    return;
  }
  sideById(message.side).queue.push(message);
});

function playback() {
  requestAnimationFrame(playback);
  for (const side of [sideA, sideB]) {
    const message = side.queue.shift();
    if (!message) continue;
    if (message.type === "frame") applyFrame(side, message.frame);
    if (message.type === "decision") showDecision(side, message.decision);
    if (message.type === "done") finishSide(side, message.summary);
  }
  for (const side of activeSides()) renderSide(side);
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
    showNotice("Seconds must be a whole number from 1 to 120.");
    return;
  }
  if (!Number.isInteger(seed) || seed < 0 || seed > 1_000_000) {
    showNotice("Seed must be a whole number from 0 to 1000000.");
    return;
  }

  const against = versusChoice.value;
  const problem = policyProblem(policyChoice.value) || (against && against !== policyChoice.value ? policyProblem(against) : "");
  if (problem) {
    showNotice(problem);
    statusEl.textContent = DEFAULT_STATUS;
    return;
  }

  setFormLocked(true);
  clearNotice();
  statusEl.textContent = "Starting…";
  livePanel.hidden = true;
  analysis.hidden = true;

  const response = await fetch("/api/play", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      policy: policyChoice.value,
      against: against && against !== policyChoice.value ? against : "",
      seconds,
      seed,
    }),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: "Could not start the run." }));
    showNotice(payload.error ?? "Could not start the run.");
    statusEl.textContent = "The run stopped.";
    setFormLocked(false);
  }
});

playback();
renderSide(sideA);
