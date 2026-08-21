import type { FlowEvent } from "@packethalo/protocol";

export interface CaptureProvider {
  readonly id: string;
  readonly name: string;
  readonly privacyDescription: string;
  start(emit: (event: FlowEvent) => void): Promise<void>;
  stop(): Promise<void>;
}

export class ProviderRegistry {
  private readonly providers = new Map<string, CaptureProvider>();

  public register(provider: CaptureProvider): void {
    if (this.providers.has(provider.id))
      throw new Error(`Capture provider already registered: ${provider.id}`);
    this.providers.set(provider.id, provider);
  }

  public list(): readonly Pick<
    CaptureProvider,
    "id" | "name" | "privacyDescription"
  >[] {
    return [...this.providers.values()].map(
      ({ id, name, privacyDescription }) => ({ id, name, privacyDescription }),
    );
  }

  public get(id: string): CaptureProvider | undefined {
    return this.providers.get(id);
  }
}

export const CAPTURE_PROVIDERS = [
  {
    id: "simulator",
    name: "Built-in simulator",
    privacyDescription: "Synthetic metadata. Always available.",
    status: "available",
    integration: "browser and headless process",
  },
  {
    id: "linux-host",
    name: "Linux host metadata",
    privacyDescription: "Reads operating-system socket metadata only.",
    status: "available",
    integration: "external Rust agent",
  },
  {
    id: "pcap-metadata",
    name: "PCAP metadata",
    privacyDescription:
      "Explicit opt-in. Header metadata only; payload bytes are discarded.",
    status: "planned",
    integration: "not implemented",
  },
  {
    id: "recording",
    name: "Recorded session",
    privacyDescription: "Replays a local PacketHalo metadata recording.",
    status: "available",
    integration: "browser import",
  },
  {
    id: "router-adapter",
    name: "Router adapter",
    privacyDescription:
      "Future local extension. Authenticated router metadata only.",
    status: "planned",
    integration: "not implemented",
  },
] as const;
