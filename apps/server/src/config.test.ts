import { describe, expect, it } from "vitest";
import { authorized, readConfig } from "./config";

describe("server security defaults", () => {
  const token = "0123456789abcdef0123456789abcdef";

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
      PACKETHALO_CONTROL_TOKEN: token,
    });
    expect(authorized(token, config)).toBe(true);
    expect(authorized("abcdef0123456789abcdef0123456789", config)).toBe(false);
  });
  it("allows the local display while LAN control remains authenticated", () => {
    const config = readConfig({
      PACKETHALO_HOST: "0.0.0.0",
      PACKETHALO_CONTROL_TOKEN: token,
    });
    expect(authorized(undefined, config, "::ffff:127.0.0.1")).toBe(true);
    expect(authorized(undefined, config, "192.168.1.20")).toBe(false);
  });

  it("rejects weak tokens and invalid retention settings", () => {
    expect(() =>
      readConfig({
        PACKETHALO_HOST: "0.0.0.0",
        PACKETHALO_CONTROL_TOKEN: "too-short",
      }),
    ).toThrow(/32-256/);
    expect(() =>
      readConfig({ PACKETHALO_RETENTION_MINUTES: "not-a-number" }),
    ).toThrow(/integer/);
    expect(() => readConfig({ PACKETHALO_RETENTION_MINUTES: "0" })).toThrow(
      /1 to 10080/,
    );
    expect(() => readConfig({ PACKETHALO_CONTAINER_LOOPBACK: "yes" })).toThrow(
      /0 or 1/,
    );
  });
});
