import { describe, expect, it } from "vitest";
import { authorized, readConfig } from "./config";

describe("server security defaults", () => {
  it("binds to loopback by default", () =>
    expect(readConfig({}).host).toBe("127.0.0.1"));
  it("refuses unauthenticated LAN mode", () =>
    expect(() => readConfig({ PACKETHALO_HOST: "0.0.0.0" })).toThrow(/token/i));
  it("supports the loopback-published Docker profile explicitly", () =>
    expect(
      readConfig({
        PACKETHALO_HOST: "0.0.0.0",
        PACKETHALO_CONTAINER_LOOPBACK: "1",
      }).host,
    ).toBe("0.0.0.0"));
  it("accepts the configured token without logging it", () => {
    const config = readConfig({
      PACKETHALO_HOST: "0.0.0.0",
      PACKETHALO_CONTROL_TOKEN: "secret-value",
    });
    expect(authorized("secret-value", config)).toBe(true);
    expect(authorized("wrong-value", config)).toBe(false);
  });
  it("allows the local display while LAN control remains authenticated", () => {
    const config = readConfig({
      PACKETHALO_HOST: "0.0.0.0",
      PACKETHALO_CONTROL_TOKEN: "remote-secret",
    });
    expect(authorized(undefined, config, "::ffff:127.0.0.1")).toBe(true);
    expect(authorized(undefined, config, "192.168.1.20")).toBe(false);
  });
});
