import {
  SCENARIOS,
  SimulatorEngine,
  getScenario,
} from "@packethalo/simulator-core";
import { eventEndpoint } from "./config";

const scenarioId = process.env.PACKETHALO_SCENARIO || "movie-night";
const seed = process.env.PACKETHALO_SEED || "cli-halo-42";
if (!SCENARIOS.some((scenario) => scenario.id === scenarioId))
  throw new Error(
    `Unknown PACKETHALO_SCENARIO. Choose one of: ${SCENARIOS.map(({ id }) => id).join(", ")}`,
  );
if (!seed.trim() || seed.length > 120)
  throw new Error("PACKETHALO_SEED must contain 1-120 characters");
const endpoint = eventEndpoint(
  process.env.PACKETHALO_SERVER || "http://127.0.0.1:8787/api/events",
  process.env.PACKETHALO_ALLOW_REMOTE === "1",
);
const token = process.env.PACKETHALO_CONTROL_TOKEN;
const engine = new SimulatorEngine(scenarioId, seed);
const scenario = getScenario(scenarioId);
const shutdownController = new AbortController();
let inFlight = false;
let consecutiveFailures = 0;

console.log(`PacketHalo simulator: ${scenario.name} (seed ${seed})`);

async function emit(): Promise<void> {
  if (inFlight) return;
  inFlight = true;
  const timeout = AbortSignal.timeout(5_000);
  const signal = AbortSignal.any([shutdownController.signal, timeout]);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(engine.next()),
      signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    if (consecutiveFailures > 0)
      console.log("PacketHalo simulator reconnected to the local server.");
    consecutiveFailures = 0;
  } catch {
    consecutiveFailures += 1;
    if (consecutiveFailures === 1 || consecutiveFailures % 20 === 0)
      console.error(
        "Simulator cannot reach the local PacketHalo server; retrying.",
      );
  } finally {
    inFlight = false;
  }
}

const cadence = Math.round((scenario.cadenceMs[0] + scenario.cadenceMs[1]) / 2);
const timer = setInterval(() => void emit(), cadence);
const shutdown = () => {
  clearInterval(timer);
  shutdownController.abort();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
