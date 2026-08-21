import { SimulatorEngine, getScenario } from "@packethalo/simulator-core";

const scenarioId = process.env.PACKETHALO_SCENARIO || "movie-night";
const seed = process.env.PACKETHALO_SEED || "cli-halo-42";
const endpoint =
  process.env.PACKETHALO_SERVER || "http://127.0.0.1:8787/api/events";
const token = process.env.PACKETHALO_CONTROL_TOKEN;
const engine = new SimulatorEngine(scenarioId, seed);
const scenario = getScenario(scenarioId);

console.log(`PacketHalo simulator: ${scenario.name} (seed ${seed})`);

async function emit(): Promise<void> {
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(engine.next()),
    });
    if (!response.ok)
      console.error(`Simulator event rejected (${response.status})`);
  } catch {
    console.error(
      "Simulator cannot reach the local PacketHalo server; retrying.",
    );
  }
}

const cadence = Math.round((scenario.cadenceMs[0] + scenario.cadenceMs[1]) / 2);
const timer = setInterval(() => void emit(), cadence);
process.on("SIGINT", () => {
  clearInterval(timer);
  process.exit(0);
});
process.on("SIGTERM", () => {
  clearInterval(timer);
  process.exit(0);
});
