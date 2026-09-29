# Jev dino runner

A small dinosaur runner. When an obstacle gets close, [Jev](https://typesafe.ai/) (via [`@typesafe-ai/sdk`](https://docs.typesafe.ai/sdk/javascript)) chooses `jump`, `duck`, or `run`. The game keeps moving between those decisions.

Jev is a decision model: the runner sends the current state plus a short physics forecast, and Jev returns one labeled action with probabilities. It does not write the game.

## Layout

```
src/
  config/     local .env loading
  game/       world, physics, and action forecasts
  policy/     Jev client and the offline heuristic
  play/       the match loop and CLI
  web/        browser view and the local server that owns the API key
```

The browser never sees the API key. It draws frames that the server streams over server-sent events.

## Run

```bash
pnpm install
cp .env.example .env
# put a key from https://console.typesafe.ai/settings/keys in .env

pnpm play -- --policy jev --seconds 20 --seed 7
pnpm watch
```

Open http://127.0.0.1:4173 and press Play.

Without `TYPESAFE_API_KEY`, the watch page falls back to `--policy heuristic`, a local rule that uses the same forecasts. The CLI stays on Jev unless you pass `--policy heuristic`.

```bash
pnpm play -- --policy heuristic --seconds 20 --seed 7
```
