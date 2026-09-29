const COLORS = {
  jump: "#1c1915",
  duck: "#8c4a2f",
  run: "#2f6b45",
};

function el(name, attrs = {}, text) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", name);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  if (text !== undefined) node.textContent = text;
  return node;
}

function cardMessage(container, text) {
  container.replaceChildren();
  const note = document.createElement("p");
  note.className = "chart-empty";
  note.textContent = text;
  container.append(note);
}

export function renderActionDonut(container, actions) {
  const order = ["jump", "duck", "run"];
  const total = order.reduce((sum, key) => sum + (actions[key] ?? 0), 0);
  container.replaceChildren();
  if (total === 0) {
    cardMessage(container, "No decisions in this run.");
    return;
  }

  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  let cursor = 0;
  const layout = document.createElement("div");
  layout.className = "donut-layout";
  const svg = el("svg", { viewBox: "0 0 140 140", role: "img" });
  svg.append(
    el(
      "title",
      {},
      `Jump ${actions.jump}, duck ${actions.duck}, run ${actions.run}`,
    ),
  );
  const ring = el("g", { transform: "translate(70 70) rotate(-90)" });
  for (const key of order) {
    const value = actions[key] ?? 0;
    if (value === 0) continue;
    const length = (value / total) * circumference;
    ring.append(
      el("circle", {
        r: radius,
        fill: "none",
        stroke: COLORS[key],
        "stroke-width": 18,
        "stroke-dasharray": `${length} ${circumference - length}`,
        "stroke-dashoffset": -cursor,
      }),
    );
    cursor += length;
  }
  svg.append(ring);
  svg.append(el("text", { x: 70, y: 66, "text-anchor": "middle", class: "donut-total" }, String(total)));
  svg.append(el("text", { x: 70, y: 84, "text-anchor": "middle", class: "donut-label" }, "choices"));

  const legend = document.createElement("ul");
  legend.className = "donut-legend";
  for (const key of order) {
    const value = actions[key] ?? 0;
    const item = document.createElement("li");
    const swatch = document.createElement("i");
    swatch.style.background = COLORS[key];
    const text = document.createElement("span");
    text.textContent = `${key} ${value} · ${Math.round((value / total) * 100)}%`;
    item.append(swatch, text);
    legend.append(item);
  }
  layout.append(svg, legend);
  container.append(layout);
}

export function renderConfidenceChart(container, history) {
  const known = history.filter((row) => typeof row.confidence === "number");
  container.replaceChildren();
  if (history.length === 0) {
    cardMessage(container, "Waiting for the first decision.");
    return;
  }
  if (known.length === 0) {
    cardMessage(container, "This policy does not report confidence.");
    return;
  }

  const width = 320;
  const height = 140;
  const pad = { left: 28, right: 8, top: 12, bottom: 22 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const svg = el("svg", { viewBox: `0 0 ${width} ${height}`, role: "img" });
  svg.append(el("title", {}, "Confidence for each decision"));

  for (const tick of [0, 0.5, 1]) {
    const y = pad.top + innerH - tick * innerH;
    svg.append(
      el("line", {
        x1: pad.left,
        x2: width - pad.right,
        y1: y,
        y2: y,
        stroke: "#d9d0c0",
      }),
    );
    svg.append(el("text", { x: 0, y: y + 3, class: "axis-text" }, String(tick)));
  }

  const stepX = known.length === 1 ? 0 : innerW / (known.length - 1);
  const coords = known.map((row, index) => {
    const x = pad.left + index * stepX;
    const y = pad.top + innerH - row.confidence * innerH;
    return { x, y, row };
  });
  const line = coords.map((point) => `${point.x},${point.y}`).join(" ");
  svg.append(
    el("polyline", {
      points: line,
      fill: "none",
      stroke: "#1c1915",
      "stroke-width": 2,
    }),
  );
  for (const point of coords) {
    svg.append(el("circle", { cx: point.x, cy: point.y, r: 3.5, fill: COLORS[point.row.action] }));
  }
  svg.append(el("text", { x: pad.left, y: height - 4, class: "axis-text" }, "first"));
  svg.append(
    el("text", { x: width - pad.right, y: height - 4, "text-anchor": "end", class: "axis-text" }, "last"),
  );
  container.append(svg);
}

export function renderProbabilityChart(container, history) {
  const rows = history.filter((row) => row.probabilities);
  container.replaceChildren();
  if (history.length === 0) {
    cardMessage(container, "Waiting for the first decision.");
    return;
  }
  if (rows.length === 0) {
    cardMessage(container, "This policy does not report probabilities.");
    return;
  }

  const list = document.createElement("ol");
  list.className = "prob-list";
  for (const row of rows) {
    const item = document.createElement("li");
    const label = document.createElement("span");
    const obstacle = row.obstacle ? `${row.obstacle.lane} ${row.obstacle.kind}` : "open";
    label.textContent = `f${row.frame} ${obstacle}`;
    const bar = document.createElement("span");
    bar.className = "stack";
    for (const key of ["jump", "duck", "run"]) {
      const value = row.probabilities[key] ?? 0;
      const segment = document.createElement("span");
      segment.style.width = `${Math.max(0, value) * 100}%`;
      segment.style.background = COLORS[key];
      segment.title = `${key} ${Math.round(value * 100)}%`;
      bar.append(segment);
    }
    item.append(label, bar);
    list.append(item);
  }
  container.append(list);
}

export function renderObstacleChart(container, history) {
  const counts = new Map();
  for (const row of history) {
    const name = row.obstacle ? `${row.obstacle.lane} ${row.obstacle.kind}` : "none";
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  const entries = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  container.replaceChildren();
  if (history.length === 0) {
    cardMessage(container, "Waiting for the first decision.");
    return;
  }
  if (entries.length === 0) {
    cardMessage(container, "No obstacles were judged.");
    return;
  }

  const max = entries[0][1];
  const list = document.createElement("ul");
  list.className = "bar-list";
  for (const [name, count] of entries) {
    const item = document.createElement("li");
    const label = document.createElement("span");
    label.textContent = name;
    const track = document.createElement("span");
    track.className = "bar-track";
    const fill = document.createElement("span");
    fill.className = "bar-fill";
    fill.style.width = `${(count / max) * 100}%`;
    const value = document.createElement("b");
    value.textContent = String(count);
    track.append(fill);
    item.append(label, track, value);
    list.append(item);
  }
  container.append(list);
}
