import { describe, expect, it } from "vitest";
import { eventEndpoint, localHostname } from "./config";

describe("headless simulator endpoint safety", () => {
  it("allows loopback, private-LAN, mDNS, and container endpoints", () => {
    for (const host of [
      "localhost",
      "127.0.0.1",
      "192.168.1.20",
      "172.20.0.2",
      "halo.local",
      "server",
    ])
      expect(localHostname(host)).toBe(true);
  });

  it("requires an explicit opt-in and TLS for a public collector", () => {
    expect(() =>
      eventEndpoint("https://collector.example/api/events", false),
    ).toThrow(/must be local/);
    expect(() =>
      eventEndpoint("http://collector.example/api/events", true),
    ).toThrow(/HTTPS/);
    expect(
      eventEndpoint("https://collector.example/api/events", true).hostname,
    ).toBe("collector.example");
  });

  it("rejects credentials and unsupported URL schemes", () => {
    expect(() => eventEndpoint("file:///tmp/events", false)).toThrow(/HTTP/);
    expect(() =>
      eventEndpoint("http://name:secret@localhost:8787/api/events", false),
    ).toThrow(/credentials/);
  });
});
