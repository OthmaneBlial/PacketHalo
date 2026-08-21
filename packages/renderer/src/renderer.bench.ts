import { bench, describe } from "vitest";
import type { FlowEvent } from "@packethalo/protocol";
import { polarDestination } from "./index";

const events = Array.from({ length: 10_000 }, (_, index) => ({
  organization: `Network ${index % 1_000}`,
  geo: { countryCode: ["US", "DE", "IE", "NL", "JP"][index % 5] },
})) as FlowEvent[];

describe("renderer projection throughput", () => {
  bench("projects ten thousand destinations", () => {
    for (const event of events) polarDestination(event, 1_920, 1_080);
  });
});
