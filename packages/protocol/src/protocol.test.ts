import { describe, expect, it } from "vitest";
import {
  containsForbiddenContent,
  isFlowEvent,
  isRecording,
  isSimulatorCommand,
  isSettingsPatch,
} from "./index";

describe("privacy protocol boundary", () => {
  it("rejects nested payload content", () => {
    expect(containsForbiddenContent({ metadata: { payload: "never" } })).toBe(
      true,
    );
    expect(isFlowEvent({ id: "bad", payload: "secret" })).toBe(false);
  });

  it("accepts metadata without treating ordinary labels as content", () => {
    expect(
      containsForbiddenContent({
        classification: { label: "Email service" },
        bytes: 42,
      }),
    ).toBe(false);
  });

  it("accepts bounded live settings and rejects unknown or dangerous values", () => {
    expect(
      isSettingsPatch({ mode: "globe", glow: 1.2, countryFilters: ["DE"] }),
    ).toBe(true);
    expect(isSettingsPatch({ theme: "invented" })).toBe(false);
    expect(isSettingsPatch({ payload: "not a setting" })).toBe(false);
    expect(isSettingsPatch({ retentionSeconds: 50_000 })).toBe(false);
  });

  it("rejects recordings that contain anything other than metadata events", () => {
    expect(
      isRecording({
        version: 1,
        name: "bad",
        scenarioId: "test",
        seed: "x",
        startedAt: 0,
        durationMs: 1,
        events: [{ payload: "secret" }],
      }),
    ).toBe(false);
  });

  it("bounds remote simulator commands", () => {
    expect(isSimulatorCommand({ action: "speed", speed: 0.25 })).toBe(true);
    expect(
      isSimulatorCommand({
        action: "scenario",
        scenarioId: "netflix",
        seed: "demo",
      }),
    ).toBe(true);
    expect(isSimulatorCommand({ action: "speed", speed: 100 })).toBe(false);
    expect(isSimulatorCommand({ action: "scenario", scenarioId: "" })).toBe(
      false,
    );
  });
});
