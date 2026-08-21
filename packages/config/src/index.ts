export const PRODUCT = {
  name: "PacketHalo",
  protocolVersion: 1,
  defaultServerPort: 8787,
  displayPort: 5173,
  controlPort: 5174,
  privacyPromise: "Packet contents are never inspected.",
} as const;

export function isLoopback(host: string): boolean {
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}
