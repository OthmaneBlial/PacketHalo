import { spawn, type ChildProcess } from "node:child_process";
import { rmSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import WebSocket from "ws";
import type { FlowEvent } from "@packethalo/protocol";

const port = 20_000 + (process.pid % 20_000);
const database = `/tmp/packethalo-integration-${process.pid}.db`;
const baseUrl = `http://127.0.0.1:${port}`;
let server: ChildProcess;

beforeAll(async () => {
  server = spawn(process.execPath, ["--import", "tsx", "src/index.ts"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PACKETHALO_PORT: String(port),
      PACKETHALO_DATABASE: database,
    },
    stdio: "ignore",
  });
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      if ((await fetch(`${baseUrl}/health`)).ok) return;
    } catch {
      // The server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("Integration server did not become healthy");
}, 10_000);

afterAll(async () => {
  server.kill("SIGTERM");
  await new Promise<void>((resolve) => server.once("exit", () => resolve()));
  for (const suffix of ["", "-shm", "-wal"])
    rmSync(`${database}${suffix}`, { force: true });
});

describe("local server integration", () => {
  it("persists and streams a validated metadata event", async () => {
    const socket = new WebSocket(`ws://127.0.0.1:${port}/stream`);
    await new Promise<void>((resolve, reject) => {
      socket.once("open", () => resolve());
      socket.once("error", reject);
    });
    const received = new Promise<FlowEvent>((resolve) => {
      socket.on("message", (raw) => {
        const message = JSON.parse(String(raw)) as {
          type: string;
          event?: FlowEvent;
        };
        if (message.type === "flow" && message.event) resolve(message.event);
      });
    });
    const event = fixtureFlow();
    const response = await fetch(`${baseUrl}/api/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(event),
    });
    expect(response.status).toBe(202);
    expect((await received).id).toBe(event.id);
    socket.close();

    const timeline = (await (
      await fetch(`${baseUrl}/api/timeline?since=0`)
    ).json()) as { events: FlowEvent[] };
    expect(timeline.events.some((entry) => entry.id === event.id)).toBe(true);
  });

  it("rejects application content at the HTTP boundary", async () => {
    const response = await fetch(`${baseUrl}/api/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...fixtureFlow(), payload: "never accepted" }),
    });
    expect(response.status).toBe(422);
  });

  it("applies authenticated control changes to a live display without restart", async () => {
    const display = new WebSocket(`ws://127.0.0.1:${port}/stream`);
    const control = new WebSocket(`ws://127.0.0.1:${port}/control`);
    await Promise.all(
      [display, control].map(
        (socket) =>
          new Promise<void>((resolve, reject) => {
            socket.once("open", resolve);
            socket.once("error", reject);
          }),
      ),
    );
    const changed = new Promise<{ mode?: string }>((resolve) => {
      display.on("message", (raw) => {
        const message = JSON.parse(String(raw)) as {
          type: string;
          settings?: { mode?: string };
        };
        if (message.type === "settings" && message.settings?.mode === "globe")
          resolve(message.settings);
      });
    });
    control.send(
      JSON.stringify({
        type: "settings.update",
        patch: { mode: "globe", theme: "deep-space" },
      }),
    );
    expect((await changed).mode).toBe("globe");
    const simulatorCommand = new Promise<string>((resolve) => {
      display.on("message", (raw) => {
        const message = JSON.parse(String(raw)) as {
          type: string;
          command?: { action?: string };
        };
        if (message.type === "simulator.control" && message.command?.action)
          resolve(message.command.action);
      });
    });
    control.send(
      JSON.stringify({
        type: "simulator.update",
        command: {
          action: "scenario",
          scenarioId: "netflix",
          seed: "remote-demo",
        },
      }),
    );
    expect(await simulatorCommand).toBe("scenario");
    control.send(
      JSON.stringify({
        type: "settings.update",
        patch: { mode: "halo", theme: "ambient-black" },
      }),
    );
    display.close();
    control.close();
  });
});

function fixtureFlow(): FlowEvent {
  return {
    id: `integration-${process.pid}`,
    timestamp: Date.now(),
    durationMs: 120,
    direction: "outbound",
    localIp: "192.168.1.42",
    remoteIp: "203.0.113.7",
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
    process: "integration-test",
    processIcon: "I",
    deviceId: "test-device",
    deviceName: "Test device",
    deviceKind: "laptop",
    bytes: 4_096,
    packets: 4,
    confidence: 0.4,
    captureSource: "simulator",
    classification: {
      label: "Unclassified test network",
      category: "unknown",
      confidence: 0.4,
    },
  };
}
