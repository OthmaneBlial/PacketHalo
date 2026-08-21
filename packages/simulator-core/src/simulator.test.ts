import { describe, expect, it } from "vitest";
import { containsForbiddenContent } from "@packethalo/protocol";
import { SCENARIOS, SimulatorEngine, eventsAt } from "./index";

describe("simulator", () => {
  it("ships every promised scenario family", () => {
    expect(SCENARIOS).toHaveLength(24);
    expect(SCENARIOS.some((scenario) => scenario.id === "netflix")).toBe(true);
    expect(new Set(SCENARIOS.map((scenario) => scenario.id)).size).toBe(
      SCENARIOS.length,
    );
  });

  it("is repeatable for a scenario and seed", () => {
    const first = new SimulatorEngine("developer-laptop", "repeat-me", 1_000);
    const second = new SimulatorEngine("developer-laptop", "repeat-me", 1_000);
    expect(first.next()).toEqual(second.next());
    expect(first.next()).toEqual(second.next());
  });

  it("records metadata-only playback that can be scrubbed", () => {
    const engine = new SimulatorEngine("movie-night", "recording", 10_000);
    engine.startRecording();
    engine.next();
    engine.next();
    const recording = engine.stopRecording();
    expect(recording).toBeDefined();
    expect(containsForbiddenContent(recording)).toBe(false);
    expect(eventsAt(recording!, recording!.durationMs)).toHaveLength(
      recording!.events.length,
    );
  });
});
