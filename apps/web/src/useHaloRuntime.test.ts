import { describe, expect, it } from "vitest";
import { resolveStreamUrl } from "./useHaloRuntime";

describe("observatory stream routing", () => {
  it("uses the same-origin authenticated reverse proxy in containers", () => {
    expect(
      resolveStreamUrl("same-origin", {
        protocol: "http:",
        host: "127.0.0.1:8080",
      }),
    ).toBe("ws://127.0.0.1:8080/stream");
    expect(
      resolveStreamUrl("same-origin", {
        protocol: "https:",
        host: "halo.local",
      }),
    ).toBe("wss://halo.local/stream");
  });

  it("keeps the immediate development server default", () => {
    expect(
      resolveStreamUrl(undefined, {
        protocol: "http:",
        host: "127.0.0.1:5173",
      }),
    ).toBe("ws://127.0.0.1:8787/stream");
  });
});
