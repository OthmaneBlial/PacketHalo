import { describe, expect, it } from "vitest";
import {
  containsForbiddenContent,
  isDisplaySettings,
  isFlowEvent,
  isRecording,
  isSimulatorCommand,
  isSettingsPatch,
} from "./index";

const validFlow = {
  id: "flow-1",
  timestamp: 1_000,
  durationMs: 120,
  direction: "outbound",
  localIp: "192.168.1.42",
  remoteIp: "2001:db8::1",
  localPort: 52_000,
  remotePort: 443,
  protocol: "TLS",
  transport: "tcp",
  geo: {
    latitude: 50.11,
    longitude: 8.68,
    countryCode: "DE",
    country: "Germany",
    city: "Frankfurt",
  },
  asn: 64_496,
  organization: "Documentation network",
  process: "browser",
  deviceId: "test-device",
  deviceName: "Test device",
  deviceKind: "laptop",
  bytes: 4_096,
  packets: 4,
  confidence: 0.8,
  captureSource: "simulator",
  classification: {
    label: "Encrypted service",
    category: "unknown",
    confidence: 0.8,
  },
} as const;

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
    expect(isFlowEvent(validFlow)).toBe(true);
  });

  it("rejects undeclared fields and malformed bounded metadata", () => {
    expect(
      isFlowEvent({ ...validFlow, secret: "not part of the contract" }),
    ).toBe(false);
    expect(
      isFlowEvent({
        ...validFlow,
        geo: { ...validFlow.geo, hostname: "private.example" },
      }),
    ).toBe(false);
    expect(
      isFlowEvent({
        ...validFlow,
        classification: { ...validFlow.classification, detail: "extra" },
      }),
    ).toBe(false);
    expect(isFlowEvent({ ...validFlow, remoteIp: "not an address" })).toBe(
      false,
    );
    expect(
      isFlowEvent({ ...validFlow, geo: { ...validFlow.geo, latitude: 91 } }),
    ).toBe(false);
  });

  it("accepts bounded live settings and rejects unknown or dangerous values", () => {
    expect(
      isSettingsPatch({ mode: "globe", glow: 1.2, countryFilters: ["DE"] }),
    ).toBe(true);
    expect(isSettingsPatch({ theme: "invented" })).toBe(false);
    expect(isSettingsPatch({ payload: "not a setting" })).toBe(false);
    expect(isSettingsPatch({ retentionSeconds: 50_000 })).toBe(false);
    expect(isSettingsPatch({ countryFilters: Array(101).fill("DE") })).toBe(
      false,
    );
    expect(isDisplaySettings({ mode: "halo" })).toBe(false);
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
    expect(
      isSimulatorCommand({ action: "pause", undeclared: "ignored before" }),
    ).toBe(false);
  });
});
