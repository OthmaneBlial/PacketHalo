import type { GeoPoint } from "@packethalo/protocol";

export interface GeoProvider {
  readonly id: string;
  readonly name: string;
  lookup(ip: string): GeoPoint | undefined | Promise<GeoPoint | undefined>;
}

/** A deliberately tiny offline fallback. Real deployments can install a local MaxMind adapter. */
export class OfflineGeoProvider implements GeoProvider {
  public readonly id = "offline-prefixes";
  public readonly name = "Bundled offline prefixes";

  public lookup(ip: string): GeoPoint | undefined {
    if (isPrivateIp(ip))
      return {
        latitude: 0,
        longitude: 0,
        countryCode: "LAN",
        country: "Local network",
      };
    const match = PREFIXES.find(([prefix]) => ip.startsWith(prefix));
    return match?.[1];
  }
}

export function isPrivateIp(ip: string): boolean {
  return (
    ip.startsWith("10.") ||
    ip.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ||
    ip === "127.0.0.1" ||
    ip === "::1"
  );
}

const PREFIXES: readonly (readonly [string, GeoPoint])[] = [
  [
    "1.1.1.",
    {
      latitude: 39.04,
      longitude: -77.49,
      countryCode: "US",
      country: "United States",
      city: "Ashburn",
    },
  ],
  [
    "17.",
    {
      latitude: 37.77,
      longitude: -122.42,
      countryCode: "US",
      country: "United States",
      city: "San Francisco",
    },
  ],
  [
    "45.57.",
    {
      latitude: 37.77,
      longitude: -122.42,
      countryCode: "US",
      country: "United States",
      city: "San Francisco",
    },
  ],
  [
    "140.82.",
    {
      latitude: 39.04,
      longitude: -77.49,
      countryCode: "US",
      country: "United States",
      city: "Ashburn",
    },
  ],
  [
    "142.250.",
    {
      latitude: 50.11,
      longitude: 8.68,
      countryCode: "DE",
      country: "Germany",
      city: "Frankfurt",
    },
  ],
  [
    "151.101.",
    {
      latitude: 37.77,
      longitude: -122.42,
      countryCode: "US",
      country: "United States",
      city: "San Francisco",
    },
  ],
  [
    "155.133.",
    {
      latitude: 52.37,
      longitude: 4.9,
      countryCode: "NL",
      country: "Netherlands",
      city: "Amsterdam",
    },
  ],
];
