import { describe, expect, it } from "vitest";
import type { FlowEvent } from "@packethalo/protocol";
import {
  constellationAnchor,
  easedProgress,
  eventMotionRate,
  polarDestination,
  stableHash,
} from "./index";

describe("renderer layout", () => {
  it("places the same destination consistently", () => {
    const event = {
      organization: "Cloudflare",
      geo: { countryCode: "US" },
    } as FlowEvent;
    expect(polarDestination(event, 1_920, 1_080)).toEqual(
      polarDestination(event, 1_920, 1_080),
    );
  });

  it("uses the whole hash space predictably", () => {
    expect(stableHash("PacketHalo")).toBe(stableHash("PacketHalo"));
    expect(stableHash("PacketHalo")).not.toBe(stableHash("packethalo"));
  });

  it("moves high-throughput flows faster than quiet metadata flows", () => {
    const quiet = { bytes: 800, durationMs: 10_000 } as FlowEvent;
    const busy = { bytes: 80_000_000, durationMs: 1_000 } as FlowEvent;
    expect(eventMotionRate(busy)).toBeGreaterThan(eventMotionRate(quiet));
  });

  it("gives service categories distinct constellation anchors", () => {
    expect(constellationAnchor("media")).not.toEqual(
      constellationAnchor("development"),
    );
    expect(constellationAnchor("communication")).not.toEqual(
      constellationAnchor("suspicious"),
    );
  });

  it("eases moving particles without changing their endpoints", () => {
    expect(easedProgress(0)).toBe(0);
    expect(easedProgress(0.25)).toBeLessThan(0.25);
    expect(easedProgress(0.75)).toBeGreaterThan(0.75);
    expect(easedProgress(1)).toBe(1);
  });
});
