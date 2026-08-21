import {
  MAX_RECORDING_EVENTS,
  type DeviceKind,
  type FlowEvent,
  type Recording,
  type Transport,
} from "@packethalo/protocol";

export type ScenarioMood =
  "calm" | "social" | "focused" | "intense" | "watchful";
export type SimulationSpeed = 0.25 | 1 | 2 | 5 | 20;

interface ServiceProfile {
  readonly name: string;
  readonly organization: string;
  readonly asn: number;
  readonly country: string;
  readonly countryCode: string;
  readonly city: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly ipPrefix: string;
  readonly port: number;
  readonly transport: Transport;
  readonly protocol: string;
  readonly category: FlowEvent["classification"]["category"];
  readonly process: string;
  readonly confidence: number;
  readonly bytes: readonly [number, number];
}

export interface Scenario {
  readonly id: string;
  readonly name: string;
  readonly eyebrow: string;
  readonly description: string;
  readonly mood: ScenarioMood;
  readonly cadenceMs: readonly [number, number];
  readonly burst: readonly [number, number];
  readonly services: readonly ServiceProfile[];
}

const service = (
  name: string,
  organization: string,
  asn: number,
  location: readonly [string, string, string, number, number],
  ipPrefix: string,
  port: number,
  transport: Transport,
  protocol: string,
  category: ServiceProfile["category"],
  process: string,
  confidence: number,
  bytes: readonly [number, number],
): ServiceProfile => ({
  name,
  organization,
  asn,
  country: location[0],
  countryCode: location[1],
  city: location[2],
  latitude: location[3],
  longitude: location[4],
  ipPrefix,
  port,
  transport,
  protocol,
  category,
  process,
  confidence,
  bytes,
});

const US_WEST = [
  "United States",
  "US",
  "San Francisco",
  37.77,
  -122.42,
] as const;
const US_EAST = ["United States", "US", "Ashburn", 39.04, -77.49] as const;
const IRELAND = ["Ireland", "IE", "Dublin", 53.35, -6.26] as const;
const GERMANY = ["Germany", "DE", "Frankfurt", 50.11, 8.68] as const;
const NETHERLANDS = ["Netherlands", "NL", "Amsterdam", 52.37, 4.9] as const;
const JAPAN = ["Japan", "JP", "Tokyo", 35.68, 139.69] as const;
const SINGAPORE = ["Singapore", "SG", "Singapore", 1.35, 103.82] as const;
const FINLAND = ["Finland", "FI", "Helsinki", 60.17, 24.94] as const;
const SWEDEN = ["Sweden", "SE", "Stockholm", 59.33, 18.07] as const;

const netflix = service(
  "Netflix Open Connect",
  "Netflix, Inc.",
  2906,
  US_WEST,
  "45.57.8",
  443,
  "quic",
  "HTTPS/3",
  "media",
  "tv-player",
  0.98,
  [90_000, 1_800_000],
);
const youtube = service(
  "Google Network",
  "Google LLC",
  15169,
  GERMANY,
  "142.250.18",
  443,
  "quic",
  "HTTPS/3",
  "media",
  "browser",
  0.92,
  [45_000, 1_200_000],
);
const spotify = service(
  "Spotify Edge",
  "Spotify AB",
  8403,
  SWEDEN,
  "35.186.224",
  443,
  "tcp",
  "TLS",
  "media",
  "spotify",
  0.97,
  [12_000, 240_000],
);
const discord = service(
  "Discord Voice",
  "Cloudflare, Inc.",
  13335,
  US_EAST,
  "162.159.13",
  50020,
  "udp",
  "RTP",
  "communication",
  "discord",
  0.88,
  [8_000, 85_000],
);
const zoom = service(
  "Zoom Media",
  "Zoom Video Communications",
  30103,
  US_WEST,
  "170.114.52",
  8801,
  "udp",
  "SRTP",
  "communication",
  "zoom",
  0.96,
  [35_000, 420_000],
);
const steam = service(
  "Steam Content",
  "Valve Corporation",
  32590,
  NETHERLANDS,
  "155.133.248",
  443,
  "tcp",
  "HTTPS",
  "gaming",
  "steam",
  0.98,
  [280_000, 3_800_000],
);
const cloudflare = service(
  "Cloudflare Edge",
  "Cloudflare, Inc.",
  13335,
  US_EAST,
  "104.18.32",
  443,
  "quic",
  "HTTPS/3",
  "system",
  "browser",
  0.72,
  [2_000, 120_000],
);
const github = service(
  "GitHub",
  "GitHub, Inc.",
  36459,
  US_EAST,
  "140.82.112",
  443,
  "tcp",
  "TLS",
  "development",
  "git",
  0.99,
  [12_000, 2_200_000],
);
const docker = service(
  "Docker Registry",
  "Amazon.com, Inc.",
  16509,
  IRELAND,
  "52.208.128",
  443,
  "tcp",
  "TLS",
  "development",
  "docker",
  0.94,
  [180_000, 3_500_000],
);
const microsoft = service(
  "Microsoft Update",
  "Microsoft Corporation",
  8075,
  NETHERLANDS,
  "13.107.4",
  443,
  "tcp",
  "Delivery Optimization",
  "system",
  "svchost",
  0.95,
  [200_000, 4_000_000],
);
const apple = service(
  "Apple iCloud",
  "Apple Inc.",
  714,
  US_WEST,
  "17.248.192",
  443,
  "quic",
  "HTTPS/3",
  "system",
  "backupd",
  0.91,
  [18_000, 1_700_000],
);
const npm = service(
  "npm Registry",
  "Cloudflare, Inc.",
  13335,
  US_EAST,
  "104.16.24",
  443,
  "tcp",
  "TLS",
  "development",
  "node",
  0.94,
  [8_000, 780_000],
);
const rust = service(
  "crates.io",
  "Fastly, Inc.",
  54113,
  US_WEST,
  "151.101.2",
  443,
  "tcp",
  "TLS",
  "development",
  "cargo",
  0.93,
  [10_000, 950_000],
);
const camera = service(
  "Camera Relay",
  "Amazon.com, Inc.",
  16509,
  IRELAND,
  "52.31.64",
  443,
  "tcp",
  "TLS",
  "iot",
  "camera",
  0.64,
  [45_000, 900_000],
);
const beacon = service(
  "Unclassified VPS",
  "Hetzner Online GmbH",
  24940,
  FINLAND,
  "65.21.88",
  8443,
  "tcp",
  "TLS",
  "suspicious",
  "unknown",
  0.41,
  [380, 1_400],
);
const dns = service(
  "Public DNS",
  "Cloudflare, Inc.",
  13335,
  US_EAST,
  "1.1.1",
  53,
  "udp",
  "DNS",
  "system",
  "resolver",
  1,
  [90, 850],
);
const game = service(
  "Game Session",
  "Amazon.com, Inc.",
  16509,
  GERMANY,
  "18.197.44",
  27015,
  "udp",
  "Game UDP",
  "gaming",
  "game-client",
  0.73,
  [2_000, 42_000],
);
const backup = service(
  "Cloud Backup",
  "Google LLC",
  15169,
  US_EAST,
  "172.217.12",
  443,
  "quic",
  "HTTPS/3",
  "system",
  "backup-agent",
  0.82,
  [120_000, 2_800_000],
);
const cdnAsia = service(
  "Global CDN",
  "Akamai Technologies",
  20940,
  SINGAPORE,
  "23.44.18",
  443,
  "quic",
  "HTTPS/3",
  "unknown",
  "browser",
  0.66,
  [4_000, 180_000],
);
const cdnJapan = service(
  "Tokyo Edge",
  "Fastly, Inc.",
  54113,
  JAPAN,
  "151.101.66",
  443,
  "tcp",
  "TLS",
  "unknown",
  "browser",
  0.76,
  [5_000, 250_000],
);

function scenario(
  id: string,
  name: string,
  eyebrow: string,
  description: string,
  mood: ScenarioMood,
  cadenceMs: readonly [number, number],
  burst: readonly [number, number],
  services: readonly ServiceProfile[],
): Scenario {
  return { id, name, eyebrow, description, mood, cadenceMs, burst, services };
}

export const SCENARIOS: readonly Scenario[] = [
  scenario(
    "movie-night",
    "Movie night",
    "Living room · 21:14",
    "A 4K stream settles into a steady transatlantic glow.",
    "calm",
    [260, 760],
    [1, 3],
    [netflix, dns, spotify],
  ),
  scenario(
    "netflix",
    "Netflix premiere",
    "One episode became four",
    "Open Connect traffic rises in broad 4K waves, then settles between episodes.",
    "calm",
    [190, 540],
    [2, 4],
    [netflix, dns, cloudflare],
  ),
  scenario(
    "youtube",
    "YouTube evening",
    "Creator rabbit hole",
    "Adaptive video, thumbnails and edge caches in quick succession.",
    "social",
    [180, 520],
    [1, 4],
    [youtube, cloudflare, dns],
  ),
  scenario(
    "spotify",
    "Spotify session",
    "Kitchen speakers",
    "Small, rhythmic audio transfers with occasional artwork bursts.",
    "calm",
    [480, 1_200],
    [1, 2],
    [spotify, cloudflare, dns],
  ),
  scenario(
    "discord-call",
    "Discord call",
    "Friends online",
    "A persistent low-latency voice orbit with chat activity.",
    "social",
    [160, 420],
    [1, 3],
    [discord, cloudflare, dns],
  ),
  scenario(
    "zoom-meeting",
    "Zoom meeting",
    "Remote stand-up",
    "Bidirectional media streams form a bright, stable braid.",
    "focused",
    [120, 340],
    [2, 5],
    [zoom, cloudflare, dns],
  ),
  scenario(
    "gaming-session",
    "Gaming session",
    "Match in progress",
    "Fast UDP pulses orbit a nearby regional game host.",
    "intense",
    [90, 260],
    [2, 5],
    [game, discord, dns],
  ),
  scenario(
    "steam-download",
    "Steam download",
    "Library update",
    "Large content blocks arrive from European edge nodes.",
    "intense",
    [90, 240],
    [3, 7],
    [steam, cloudflare, dns],
  ),
  scenario(
    "software-update",
    "Software update",
    "Devices synchronizing",
    "Signed packages arrive from several trusted networks.",
    "focused",
    [220, 620],
    [1, 4],
    [apple, microsoft, cloudflare],
  ),
  scenario(
    "smart-home-morning",
    "Smart home morning",
    "Home waking up",
    "Brief IoT check-ins accompany music and weather requests.",
    "social",
    [360, 940],
    [1, 3],
    [spotify, camera, dns, cloudflare],
  ),
  scenario(
    "security-camera",
    "Security camera upload",
    "Front porch · live",
    "A sustained encrypted upload leaves the camera orbit.",
    "watchful",
    [180, 460],
    [1, 3],
    [camera, dns],
  ),
  scenario(
    "phone-backup",
    "Phone backup",
    "Charging · Wi-Fi",
    "Photos move quietly to the cloud in dense encrypted bursts.",
    "calm",
    [160, 540],
    [2, 5],
    [apple, backup, dns],
  ),
  scenario(
    "large-git-clone",
    "Large Git clone",
    "New workspace",
    "Repository objects arrive, followed by dependency lookups.",
    "focused",
    [130, 400],
    [2, 6],
    [github, npm, dns],
  ),
  scenario(
    "rust-build",
    "Rust build",
    "Compiling the universe",
    "Crates and source indexes form a focused developer cluster.",
    "focused",
    [210, 720],
    [1, 4],
    [rust, github, dns],
  ),
  scenario(
    "docker-pull",
    "Docker pull",
    "Layers incoming",
    "Registry manifests fan into several large image layers.",
    "intense",
    [110, 360],
    [2, 7],
    [docker, cloudflare, dns],
  ),
  scenario(
    "windows-update",
    "Windows update",
    "Background maintenance",
    "Delivery Optimization creates broad, weighty transfers.",
    "focused",
    [170, 520],
    [2, 6],
    [microsoft, cloudflare, dns],
  ),
  scenario(
    "linux-update",
    "Linux package update",
    "System refresh",
    "Mirrors and signing servers appear in a clean sequence.",
    "focused",
    [180, 560],
    [1, 5],
    [cloudflare, github, dns],
  ),
  scenario(
    "suspicious-beacon",
    "Suspicious beacon",
    "Unusual regularity",
    "A low-confidence endpoint calls home at exact intervals.",
    "watchful",
    [620, 680],
    [1, 1],
    [beacon, dns],
  ),
  scenario(
    "iot-device",
    "IoT device",
    "Unknown device joined",
    "Tiny periodic exchanges reveal an otherwise silent object.",
    "watchful",
    [460, 1_100],
    [1, 2],
    [camera, beacon, dns],
  ),
  scenario(
    "night-mode",
    "Night mode",
    "02:43 · house asleep",
    "Only maintenance traffic and quiet device heartbeats remain.",
    "calm",
    [760, 1_800],
    [1, 2],
    [apple, camera, dns],
  ),
  scenario(
    "airport-wifi",
    "Airport Wi-Fi",
    "Gate B42",
    "Captive services and global CDNs create a restless sky.",
    "social",
    [140, 440],
    [2, 6],
    [cdnAsia, cdnJapan, cloudflare, dns],
  ),
  scenario(
    "coffee-shop",
    "Coffee shop",
    "Shared network",
    "Messaging, browsing and code traffic overlap in close orbit.",
    "social",
    [180, 520],
    [1, 5],
    [github, discord, cloudflare, dns],
  ),
  scenario(
    "office-network",
    "Office network",
    "Tuesday · 10:06",
    "Calls, updates and developer tools coexist across devices.",
    "intense",
    [120, 360],
    [2, 7],
    [zoom, github, microsoft, cloudflare, dns],
  ),
  scenario(
    "developer-laptop",
    "Developer laptop",
    "Local build loop",
    "Registries, source hosts and containers form a working constellation.",
    "focused",
    [130, 420],
    [2, 6],
    [github, npm, rust, docker, dns],
  ),
];

const DEVICES: readonly {
  id: string;
  name: string;
  kind: DeviceKind;
  ip: string;
  processes: readonly string[];
}[] = [
  {
    id: "macbook",
    name: "Studio MacBook",
    kind: "laptop",
    ip: "192.168.1.42",
    processes: [
      "browser",
      "git",
      "cargo",
      "docker",
      "discord",
      "zoom",
      "spotify",
    ],
  },
  {
    id: "living-room",
    name: "Living room TV",
    kind: "tv",
    ip: "192.168.1.51",
    processes: ["tv-player"],
  },
  {
    id: "phone",
    name: "Phone",
    kind: "phone",
    ip: "192.168.1.64",
    processes: ["backupd", "browser"],
  },
  {
    id: "console",
    name: "Game console",
    kind: "console",
    ip: "192.168.1.73",
    processes: ["game-client"],
  },
  {
    id: "porch-camera",
    name: "Porch camera",
    kind: "unknown",
    ip: "192.168.1.81",
    processes: ["camera"],
  },
  {
    id: "home-nas",
    name: "Home NAS",
    kind: "nas",
    ip: "192.168.1.90",
    processes: ["backup-agent", "docker"],
  },
  {
    id: "router",
    name: "Home router",
    kind: "router",
    ip: "192.168.1.1",
    processes: ["resolver"],
  },
];

function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export class SeededRandom {
  private state: number;

  public constructor(seed: string) {
    this.state = hashSeed(seed) || 0x6d2b79f5;
  }

  public next(): number {
    this.state += 0x6d2b79f5;
    let value = this.state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  }

  public integer(minimum: number, maximum: number): number {
    return Math.floor(this.next() * (maximum - minimum + 1)) + minimum;
  }

  public pick<T>(values: readonly T[]): T {
    const value = values[Math.floor(this.next() * values.length)];
    if (value === undefined)
      throw new Error("Cannot pick from an empty collection");
    return value;
  }
}

export interface SimulatorSnapshot {
  readonly scenario: Scenario;
  readonly seed: string;
  readonly sequence: number;
  readonly elapsedMs: number;
  readonly paused: boolean;
  readonly speed: SimulationSpeed;
  readonly recording: boolean;
}

export class SimulatorEngine {
  private scenarioValue: Scenario;
  private seedValue: string;
  private random: SeededRandom;
  private sequence = 0;
  private elapsedMs = 0;
  private pausedValue = false;
  private speedValue: SimulationSpeed = 1;
  private recordingEvents: FlowEvent[] | undefined;
  private recordingStartedAt: number | undefined;
  private readonly epoch: number;

  public constructor(
    scenarioId = "movie-night",
    seed = "halo-42",
    epoch = Date.now(),
  ) {
    this.scenarioValue = getScenario(scenarioId);
    this.seedValue = seed;
    this.random = new SeededRandom(`${scenarioId}:${seed}`);
    this.epoch = epoch;
  }

  public get snapshot(): SimulatorSnapshot {
    return {
      scenario: this.scenarioValue,
      seed: this.seedValue,
      sequence: this.sequence,
      elapsedMs: this.elapsedMs,
      paused: this.pausedValue,
      speed: this.speedValue,
      recording: !!this.recordingEvents,
    };
  }

  public setScenario(scenarioId: string, seed = this.seedValue): void {
    this.scenarioValue = getScenario(scenarioId);
    this.seedValue = seed;
    this.random = new SeededRandom(`${scenarioId}:${seed}`);
    this.sequence = 0;
    this.elapsedMs = 0;
    this.recordingEvents = undefined;
    this.recordingStartedAt = undefined;
  }

  public setSpeed(speed: SimulationSpeed): void {
    this.speedValue = speed;
  }
  public pause(): void {
    this.pausedValue = true;
  }
  public resume(): void {
    this.pausedValue = false;
  }
  public togglePause(): void {
    this.pausedValue = !this.pausedValue;
  }

  public next(): readonly FlowEvent[] {
    if (this.pausedValue) return [];
    const burst = this.random.integer(
      this.scenarioValue.burst[0],
      this.scenarioValue.burst[1],
    );
    const events = Array.from({ length: burst }, () => this.createFlow());
    const cadence = this.random.integer(
      this.scenarioValue.cadenceMs[0],
      this.scenarioValue.cadenceMs[1],
    );
    this.elapsedMs += Math.max(16, cadence / this.speedValue);
    if (this.recordingEvents) {
      this.recordingEvents.push(...events);
      if (this.recordingEvents.length > MAX_RECORDING_EVENTS)
        this.recordingEvents.splice(
          0,
          this.recordingEvents.length - MAX_RECORDING_EVENTS,
        );
    }
    return events;
  }

  public startRecording(): void {
    this.recordingEvents = [];
    this.recordingStartedAt = this.epoch + this.elapsedMs;
  }

  public stopRecording(
    name = `${this.scenarioValue.name} capture`,
  ): Recording | undefined {
    if (!this.recordingEvents) return undefined;
    const startedAt =
      this.recordingEvents[0]?.timestamp ??
      this.recordingStartedAt ??
      this.epoch + this.elapsedMs;
    const recording: Recording = {
      version: 1,
      name,
      scenarioId: this.scenarioValue.id,
      seed: this.seedValue,
      startedAt,
      durationMs: Math.max(1, this.epoch + this.elapsedMs - startedAt),
      events: this.recordingEvents,
    };
    this.recordingEvents = undefined;
    this.recordingStartedAt = undefined;
    return recording;
  }

  private createFlow(): FlowEvent {
    const profile = this.random.pick(this.scenarioValue.services);
    const eligible = DEVICES.filter((device) =>
      device.processes.includes(profile.process),
    );
    const device = this.random.pick(eligible.length > 0 ? eligible : DEVICES);
    const bytes = this.random.integer(profile.bytes[0], profile.bytes[1]);
    const inbound = profile.process !== "camera" && this.random.next() > 0.18;
    const sequence = this.sequence++;
    const confidence = Math.max(
      0.25,
      Math.min(1, profile.confidence + (this.random.next() - 0.5) * 0.08),
    );

    return {
      id: `${this.epoch.toString(36)}-${this.seedValue}-${sequence.toString(36)}-${this.random.integer(100, 999)}`,
      timestamp: this.epoch + this.elapsedMs,
      durationMs: this.random.integer(280, 7_600),
      direction: inbound ? "inbound" : "outbound",
      localIp: device.ip,
      remoteIp: `${profile.ipPrefix}.${this.random.integer(1, 254)}`,
      localPort: this.random.integer(49_152, 65_535),
      remotePort: profile.port,
      protocol: profile.protocol,
      transport: profile.transport,
      geo: {
        latitude: profile.latitude,
        longitude: profile.longitude,
        countryCode: profile.countryCode,
        country: profile.country,
        city: profile.city,
      },
      asn: profile.asn,
      organization: profile.organization,
      process: profile.process,
      processIcon: profile.process.slice(0, 1).toUpperCase(),
      deviceId: device.id,
      deviceName: device.name,
      deviceKind: device.kind,
      bytes,
      packets: Math.max(1, Math.ceil(bytes / this.random.integer(780, 1_440))),
      confidence,
      captureSource: "simulator",
      classification: {
        label: profile.name,
        ...(confidence > 0.74 ? { service: profile.name.split(" ")[0]! } : {}),
        category: profile.category,
        confidence,
      },
    };
  }
}

export function getScenario(id: string): Scenario {
  return SCENARIOS.find((entry) => entry.id === id) ?? SCENARIOS[0]!;
}

export function eventsAt(
  recording: Recording,
  elapsedMs: number,
  previousElapsedMs = 0,
): readonly FlowEvent[] {
  const start = recording.startedAt + previousElapsedMs;
  const end = recording.startedAt + elapsedMs;
  return recording.events.filter(
    (event) =>
      (previousElapsedMs === 0
        ? event.timestamp >= start
        : event.timestamp > start) && event.timestamp <= end,
  );
}
