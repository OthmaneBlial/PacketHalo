/** Metadata-only flow contract. Payload fields are intentionally impossible to express. */
export type FlowDirection = "inbound" | "outbound";
export type Transport = "tcp" | "udp" | "quic" | "icmp";
export type CaptureSource =
  "simulator" | "linux-host" | "pcap-metadata" | "recording";
export type DeviceKind =
  "laptop" | "phone" | "tv" | "console" | "nas" | "router" | "unknown";

export interface GeoPoint {
  readonly latitude: number;
  readonly longitude: number;
  readonly countryCode: string;
  readonly country: string;
  readonly city?: string;
}

export interface Classification {
  readonly label: string;
  readonly service?: string;
  readonly category:
    | "media"
    | "communication"
    | "gaming"
    | "development"
    | "system"
    | "iot"
    | "unknown"
    | "suspicious";
  readonly confidence: number;
}

export interface FlowEvent {
  readonly id: string;
  readonly timestamp: number;
  readonly durationMs: number;
  readonly direction: FlowDirection;
  readonly localIp: string;
  readonly remoteIp: string;
  readonly localPort: number;
  readonly remotePort: number;
  readonly protocol: string;
  readonly transport: Transport;
  readonly geo: GeoPoint;
  readonly asn: number;
  readonly organization: string;
  readonly process?: string;
  readonly processIcon?: string;
  readonly deviceId: string;
  readonly deviceName: string;
  readonly deviceKind: DeviceKind;
  readonly bytes: number;
  readonly packets: number;
  readonly confidence: number;
  readonly captureSource: CaptureSource;
  readonly classification: Classification;
}

export interface DisplaySettings {
  readonly mode: "halo" | "globe" | "constellation" | "ambient" | "forensic";
  readonly theme:
    | "ambient-black"
    | "midnight-blue"
    | "aurora"
    | "cyber-green"
    | "deep-space"
    | "monochrome"
    | "projector"
    | "oled"
    | "accessibility";
  readonly animationSpeed: number;
  readonly glow: number;
  readonly particleCount: number;
  readonly retentionSeconds: number;
  readonly projectionRotation: 0 | 90 | 180 | 270;
  readonly privacyMode: boolean;
  readonly reducedMotion: boolean;
  readonly countryFilters: readonly string[];
  readonly asnFilters: readonly number[];
  readonly deviceFilters: readonly string[];
}

export interface Recording {
  readonly version: 1;
  readonly name: string;
  readonly scenarioId: string;
  readonly seed: string;
  readonly startedAt: number;
  readonly durationMs: number;
  readonly events: readonly FlowEvent[];
}

export type SimulatorCommand =
  | { readonly action: "pause" | "resume" | "record.toggle" | "replay" }
  | { readonly action: "speed"; readonly speed: 0.25 | 1 | 2 | 5 | 20 }
  | {
      readonly action: "scenario";
      readonly scenarioId: string;
      readonly seed?: string;
    }
  | { readonly action: "seed"; readonly seed: string };

export type ClientMessage =
  | { readonly type: "flow"; readonly event: FlowEvent }
  | { readonly type: "settings"; readonly settings: DisplaySettings }
  | { readonly type: "simulator.control"; readonly command: SimulatorCommand }
  | { readonly type: "hello"; readonly version: 1; readonly serverTime: number }
  | { readonly type: "error"; readonly code: string; readonly message: string };

export type ServerMessage =
  | {
      readonly type: "settings.update";
      readonly patch: Partial<DisplaySettings>;
    }
  | { readonly type: "simulator.update"; readonly command: SimulatorCommand }
  | { readonly type: "recording.replay"; readonly recording: Recording }
  | { readonly type: "ping"; readonly timestamp: number };

const forbiddenFields = new Set([
  "payload",
  "body",
  "requestBody",
  "responseBody",
  "cookie",
  "cookies",
  "password",
  "token",
  "webpage",
  "email",
  "message",
]);

export function containsForbiddenContent(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  return Object.entries(value).some(
    ([key, child]) =>
      forbiddenFields.has(key) || containsForbiddenContent(child),
  );
}

export function isFlowEvent(value: unknown): value is FlowEvent {
  if (!value || typeof value !== "object" || containsForbiddenContent(value))
    return false;
  const flow = value as Partial<FlowEvent>;
  const geo = flow.geo as Partial<GeoPoint> | undefined;
  const classification = flow.classification as
    Partial<Classification> | undefined;
  const finite = (entry: unknown): entry is number =>
    typeof entry === "number" && Number.isFinite(entry);
  const port = (entry: unknown): entry is number =>
    finite(entry) && Number.isInteger(entry) && entry >= 0 && entry <= 65_535;
  return (
    typeof flow.id === "string" &&
    flow.id.length > 0 &&
    finite(flow.timestamp) &&
    finite(flow.durationMs) &&
    flow.durationMs >= 0 &&
    (flow.direction === "inbound" || flow.direction === "outbound") &&
    typeof flow.localIp === "string" &&
    typeof flow.remoteIp === "string" &&
    port(flow.localPort) &&
    port(flow.remotePort) &&
    typeof flow.protocol === "string" &&
    ["tcp", "udp", "quic", "icmp"].includes(String(flow.transport)) &&
    !!geo &&
    finite(geo.latitude) &&
    finite(geo.longitude) &&
    typeof geo.countryCode === "string" &&
    typeof geo.country === "string" &&
    finite(flow.asn) &&
    typeof flow.organization === "string" &&
    (flow.process === undefined || typeof flow.process === "string") &&
    (flow.processIcon === undefined || typeof flow.processIcon === "string") &&
    typeof flow.deviceId === "string" &&
    typeof flow.deviceName === "string" &&
    ["laptop", "phone", "tv", "console", "nas", "router", "unknown"].includes(
      String(flow.deviceKind),
    ) &&
    finite(flow.bytes) &&
    flow.bytes >= 0 &&
    finite(flow.packets) &&
    flow.packets >= 0 &&
    finite(flow.confidence) &&
    flow.confidence >= 0 &&
    flow.confidence <= 1 &&
    ["simulator", "linux-host", "pcap-metadata", "recording"].includes(
      String(flow.captureSource),
    ) &&
    !!classification &&
    typeof classification.label === "string" &&
    [
      "media",
      "communication",
      "gaming",
      "development",
      "system",
      "iot",
      "unknown",
      "suspicious",
    ].includes(String(classification.category)) &&
    finite(classification.confidence) &&
    classification.confidence >= 0 &&
    classification.confidence <= 1
  );
}

export function isSettingsPatch(
  value: unknown,
): value is Partial<DisplaySettings> {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    containsForbiddenContent(value)
  )
    return false;
  const patch = value as Record<string, unknown>;
  const allowed = new Set([
    "mode",
    "theme",
    "animationSpeed",
    "glow",
    "particleCount",
    "retentionSeconds",
    "projectionRotation",
    "privacyMode",
    "reducedMotion",
    "countryFilters",
    "asnFilters",
    "deviceFilters",
  ]);
  if (Object.keys(patch).some((key) => !allowed.has(key))) return false;
  if (
    patch.mode !== undefined &&
    !["halo", "globe", "constellation", "ambient", "forensic"].includes(
      String(patch.mode),
    )
  )
    return false;
  if (
    patch.theme !== undefined &&
    ![
      "ambient-black",
      "midnight-blue",
      "aurora",
      "cyber-green",
      "deep-space",
      "monochrome",
      "projector",
      "oled",
      "accessibility",
    ].includes(String(patch.theme))
  )
    return false;
  if (
    patch.animationSpeed !== undefined &&
    (typeof patch.animationSpeed !== "number" ||
      patch.animationSpeed <= 0 ||
      patch.animationSpeed > 20)
  )
    return false;
  if (
    patch.glow !== undefined &&
    (typeof patch.glow !== "number" || patch.glow < 0 || patch.glow > 1.5)
  )
    return false;
  if (
    patch.particleCount !== undefined &&
    (typeof patch.particleCount !== "number" ||
      patch.particleCount < 0 ||
      patch.particleCount > 500)
  )
    return false;
  if (
    patch.retentionSeconds !== undefined &&
    (typeof patch.retentionSeconds !== "number" ||
      patch.retentionSeconds < 1 ||
      patch.retentionSeconds > 300)
  )
    return false;
  if (
    patch.projectionRotation !== undefined &&
    ![0, 90, 180, 270].includes(Number(patch.projectionRotation))
  )
    return false;
  if (patch.privacyMode !== undefined && typeof patch.privacyMode !== "boolean")
    return false;
  if (
    patch.reducedMotion !== undefined &&
    typeof patch.reducedMotion !== "boolean"
  )
    return false;
  if (
    patch.countryFilters !== undefined &&
    (!Array.isArray(patch.countryFilters) ||
      !patch.countryFilters.every((entry) => typeof entry === "string"))
  )
    return false;
  if (
    patch.asnFilters !== undefined &&
    (!Array.isArray(patch.asnFilters) ||
      !patch.asnFilters.every((entry) => typeof entry === "number"))
  )
    return false;
  if (
    patch.deviceFilters !== undefined &&
    (!Array.isArray(patch.deviceFilters) ||
      !patch.deviceFilters.every((entry) => typeof entry === "string"))
  )
    return false;
  return true;
}

export function isRecording(value: unknown): value is Recording {
  if (!value || typeof value !== "object" || containsForbiddenContent(value))
    return false;
  const recording = value as Partial<Recording>;
  return (
    recording.version === 1 &&
    typeof recording.name === "string" &&
    typeof recording.scenarioId === "string" &&
    typeof recording.seed === "string" &&
    typeof recording.startedAt === "number" &&
    typeof recording.durationMs === "number" &&
    Array.isArray(recording.events) &&
    recording.events.every(isFlowEvent)
  );
}

export function isSimulatorCommand(value: unknown): value is SimulatorCommand {
  if (!value || typeof value !== "object" || containsForbiddenContent(value))
    return false;
  const command = value as Partial<SimulatorCommand>;
  if (
    ["pause", "resume", "record.toggle", "replay"].includes(
      String(command.action),
    )
  )
    return true;
  if (command.action === "speed")
    return [0.25, 1, 2, 5, 20].includes(Number(command.speed));
  if (command.action === "scenario") {
    return (
      typeof command.scenarioId === "string" &&
      command.scenarioId.length > 0 &&
      command.scenarioId.length <= 80 &&
      (command.seed === undefined ||
        (typeof command.seed === "string" && command.seed.length <= 120))
    );
  }
  return (
    command.action === "seed" &&
    typeof command.seed === "string" &&
    command.seed.length > 0 &&
    command.seed.length <= 120
  );
}

export const DEFAULT_SETTINGS: DisplaySettings = {
  mode: "halo",
  theme: "ambient-black",
  animationSpeed: 1,
  glow: 0.82,
  particleCount: 64,
  retentionSeconds: 24,
  projectionRotation: 0,
  privacyMode: true,
  reducedMotion: false,
  countryFilters: [],
  asnFilters: [],
  deviceFilters: [],
};
