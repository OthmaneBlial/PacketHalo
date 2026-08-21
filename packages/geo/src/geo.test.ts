import { describe, expect, it } from "vitest";
import { isPrivateIp, OfflineGeoProvider } from "./index";

describe("offline geo", () => {
  it("never sends a lookup away from the machine", () => {
    const provider = new OfflineGeoProvider();
    expect(provider.lookup("142.250.18.1")?.countryCode).toBe("DE");
    expect(provider.lookup("203.0.113.2")).toBeUndefined();
  });
  it("recognizes local addresses", () =>
    expect(isPrivateIp("192.168.1.20")).toBe(true));
});
