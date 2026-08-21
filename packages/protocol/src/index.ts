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
  "requestbody",
  "responsebody",
  "cookie",
  "cookies",
  "password",
  "token",
  "webpage",
  "email",
  "message",
]);

const flowKeys = new Set([
  "id",
  "timestamp",
  "durationMs",
  "direction",
  "localIp",
  "remoteIp",
  "localPort",
  "remotePort",
  "protocol",
  "transport",
  "geo",
  "asn",
  "organization",
  "process",
  "processIcon",
  "deviceId",
  "deviceName",
  "deviceKind",
  "bytes",
  "packets",
  "confidence",
  "captureSource",
  "classification",
]);
const geoKeys = new Set([
  "latitude",
  "longitude",
  "countryCode",
  "country",
  "city",
]);
const classificationKeys = new Set([
  "label",
  "service",
  "category",
  "confidence",
]);
const recordingKeys = new Set([
  "version",
  "name",
  "scenarioId",
  "seed",
  "startedAt",
  "durationMs",
  "events",
]);

export const MAX_RECORDING_EVENTS = 10_000;

function normalizedField(key: string): string {
  return key.replaceAll(/[-_\s]/g, "").toLowerCase();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: Set<string>) {
  return Object.keys(value).every((key) => allowed.has(key));
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isSafeInteger(
  value: unknown,
  minimum = 0,
  maximum = Number.MAX_SAFE_INTEGER,
): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= minimum &&
    value <= maximum
  );
}

function isBoundedString(
  value: unknown,
  minimum: number,
  maximum: number,
): value is string {
  return (
    typeof value === "string" &&
    value.length >= minimum &&
    value.length <= maximum &&
    value.trim() === value
  );
}

function isIpAddress(value: unknown): value is string {
  if (!isBoundedString(value, 2, 64)) return false;
  const ipv4 = value.split(".");
  if (!value.includes(":") && ipv4.length === 4)
    return ipv4.every(
      (part) =>
        /^\d{1,3}$/.test(part) && Number(part) >= 0 && Number(part) <= 255,
    );
  const [address, zone, ...extra] = value.split("%");
  return (
    extra.length === 0 &&
    !!address &&
    address.includes(":") &&
    /^[0-9a-f:.]+$/i.test(address) &&
    (zone === undefined || /^[a-z0-9_.-]{1,24}$/i.test(zone))
  );
}

export function containsForbiddenContent(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  return Object.entries(value).some(
    ([key, child]) =>
      forbiddenFields.has(normalizedField(key)) ||
      containsForbiddenContent(child),
  );
}

export function isFlowEvent(value: unknown): value is FlowEvent {
  if (
    !isRecord(value) ||
    containsForbiddenContent(value) ||
    !hasOnlyKeys(value, flowKeys)
  )
    return false;
  const flow = value as Partial<FlowEvent>;
  const geo = isRecord(flow.geo) ? flow.geo : undefined;
  const classification = isRecord(flow.classification)
    ? flow.classification
    : undefined;
  const port = (entry: unknown): entry is number =>
    isSafeInteger(entry, 0, 65_535);
  return (
    isBoundedString(flow.id, 1, 160) &&
    isSafeInteger(flow.timestamp) &&
    isSafeInteger(flow.durationMs) &&
    (flow.direction === "inbound" || flow.direction === "outbound") &&
    isIpAddress(flow.localIp) &&
    isIpAddress(flow.remoteIp) &&
    port(flow.localPort) &&
    port(flow.remotePort) &&
    isBoundedString(flow.protocol, 1, 64) &&
    ["tcp", "udp", "quic", "icmp"].includes(String(flow.transport)) &&
    !!geo &&
    hasOnlyKeys(geo, geoKeys) &&
    isFiniteNumber(geo.latitude) &&
    geo.latitude >= -90 &&
    geo.latitude <= 90 &&
    isFiniteNumber(geo.longitude) &&
    geo.longitude >= -180 &&
    geo.longitude <= 180 &&
    typeof geo.countryCode === "string" &&
    /^(?:[A-Z]{2}|XX)$/.test(geo.countryCode) &&
    isBoundedString(geo.country, 1, 120) &&
    (geo.city === undefined || isBoundedString(geo.city, 1, 120)) &&
    isSafeInteger(flow.asn, 0, 4_294_967_295) &&
    isBoundedString(flow.organization, 1, 180) &&
    (flow.process === undefined || isBoundedString(flow.process, 1, 160)) &&
    (flow.processIcon === undefined ||
      isBoundedString(flow.processIcon, 1, 8)) &&
    isBoundedString(flow.deviceId, 1, 120) &&
    isBoundedString(flow.deviceName, 1, 160) &&
    ["laptop", "phone", "tv", "console", "nas", "router", "unknown"].includes(
      String(flow.deviceKind),
    ) &&
    isSafeInteger(flow.bytes) &&
    isSafeInteger(flow.packets) &&
    isFiniteNumber(flow.confidence) &&
    flow.confidence >= 0 &&
    flow.confidence <= 1 &&
    ["simulator", "linux-host", "pcap-metadata", "recording"].includes(
      String(flow.captureSource),
    ) &&
    !!classification &&
    hasOnlyKeys(classification, classificationKeys) &&
    isBoundedString(classification.label, 1, 180) &&
    (classification.service === undefined ||
      isBoundedString(classification.service, 1, 120)) &&
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
    isFiniteNumber(classification.confidence) &&
    classification.confidence >= 0 &&
    classification.confidence <= 1
  );
}

export function isSettingsPatch(
  value: unknown,
): value is Partial<DisplaySettings> {
  if (!isRecord(value) || containsForbiddenContent(value)) return false;
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
      patch.countryFilters.length > 100 ||
      !patch.countryFilters.every(
        (entry) => typeof entry === "string" && /^(?:[A-Z]{2}|XX)$/.test(entry),
      ))
  )
    return false;
  if (
    patch.asnFilters !== undefined &&
    (!Array.isArray(patch.asnFilters) ||
      patch.asnFilters.length > 100 ||
      !patch.asnFilters.every((entry) =>
        isSafeInteger(entry, 0, 4_294_967_295),
      ))
  )
    return false;
  if (
    patch.deviceFilters !== undefined &&
    (!Array.isArray(patch.deviceFilters) ||
      patch.deviceFilters.length > 100 ||
      !patch.deviceFilters.every((entry) => isBoundedString(entry, 1, 120)))
  )
    return false;
  return true;
}

export function isDisplaySettings(value: unknown): value is DisplaySettings {
  if (!isSettingsPatch(value)) return false;
  const settings = value as Partial<DisplaySettings>;
  return (
    settings.mode !== undefined &&
    settings.theme !== undefined &&
    settings.animationSpeed !== undefined &&
    settings.glow !== undefined &&
    settings.particleCount !== undefined &&
    settings.retentionSeconds !== undefined &&
    settings.projectionRotation !== undefined &&
    settings.privacyMode !== undefined &&
    settings.reducedMotion !== undefined &&
    settings.countryFilters !== undefined &&
    settings.asnFilters !== undefined &&
    settings.deviceFilters !== undefined
  );
}

export function isRecording(value: unknown): value is Recording {
  if (
    !isRecord(value) ||
    containsForbiddenContent(value) ||
    !hasOnlyKeys(value, recordingKeys)
  )
    return false;
  const recording = value as Partial<Recording>;
  return (
    recording.version === 1 &&
    isBoundedString(recording.name, 1, 160) &&
    isBoundedString(recording.scenarioId, 1, 80) &&
    isBoundedString(recording.seed, 1, 120) &&
    isSafeInteger(recording.startedAt) &&
    isSafeInteger(recording.durationMs) &&
    Array.isArray(recording.events) &&
    recording.events.length <= MAX_RECORDING_EVENTS &&
    recording.events.every(isFlowEvent)
  );
}

export function isSimulatorCommand(value: unknown): value is SimulatorCommand {
  if (!isRecord(value) || containsForbiddenContent(value)) return false;
  const command = value as Partial<SimulatorCommand>;
  if (
    ["pause", "resume", "record.toggle", "replay"].includes(
      String(command.action),
    )
  )
    return hasOnlyKeys(value, new Set(["action"]));
  if (command.action === "speed")
    return (
      hasOnlyKeys(value, new Set(["action", "speed"])) &&
      [0.25, 1, 2, 5, 20].includes(Number(command.speed))
    );
  if (command.action === "scenario") {
    return (
      hasOnlyKeys(value, new Set(["action", "scenarioId", "seed"])) &&
      isBoundedString(command.scenarioId, 1, 80) &&
      (command.seed === undefined || isBoundedString(command.seed, 1, 120))
    );
  }
  return (
    command.action === "seed" &&
    hasOnlyKeys(value, new Set(["action", "seed"])) &&
    isBoundedString(command.seed, 1, 120)
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
