import type { FlowEvent } from "@packethalo/protocol";
import type { CaptureProvider } from "../../apps/server/src/providers";

export class ExampleMetadataProvider implements CaptureProvider {
  public readonly id = "example-metadata";
  public readonly name = "Example local source";
  public readonly privacyDescription =
    "Reads synthetic connection metadata only.";
  private timer: ReturnType<typeof setInterval> | undefined;

  public async start(emit: (event: FlowEvent) => void): Promise<void> {
    this.timer = setInterval(() => {
      // Translate metadata from the local source, validate it, then call emit(event).
      void emit;
    }, 1_000);
  }

  public async stop(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }
}
