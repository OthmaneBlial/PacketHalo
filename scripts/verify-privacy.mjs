import { readFileSync } from "node:fs";

const contracts = [
  [
    "TypeScript FlowEvent",
    readFileSync(
      new URL("../packages/protocol/src/index.ts", import.meta.url),
      "utf8",
    ),
    /export interface FlowEvent \{([\s\S]*?)\n\}/,
  ],
  [
    "Rust FlowEvent",
    readFileSync(
      new URL("../agent/rust-agent/src/lib.rs", import.meta.url),
      "utf8",
    ),
    /pub struct FlowEvent \{([\s\S]*?)\n\}/,
  ],
];
const forbidden = [
  "payload",
  "password",
  "cookie",
  "request_body",
  "response_body",
  "requestBody",
  "responseBody",
  "webpage",
  "email_body",
  "chat_message",
];
for (const [label, source, pattern] of contracts) {
  const body = source.match(pattern)?.[1];
  if (!body) throw new Error(`Could not locate ${label}`);
  const violation = forbidden.find((field) => body.includes(field));
  if (violation)
    throw new Error(`${label} exposes forbidden field: ${violation}`);
}
console.log(
  "Privacy contract verified: FlowEvent cannot represent packet or application content.",
);
