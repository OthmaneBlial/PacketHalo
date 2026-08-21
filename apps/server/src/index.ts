import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { URL } from "node:url";
import {
  DEFAULT_SETTINGS,
  containsForbiddenContent,
  isFlowEvent,
  isSettingsPatch,
  isSimulatorCommand,
  type ClientMessage,
  type DisplaySettings,
  type FlowEvent,
  type ServerMessage,
} from "@packethalo/protocol";
import { WebSocket, WebSocketServer } from "ws";
import { authorized, readConfig } from "./config";
import { PLANNED_PROVIDERS } from "./providers";
import { FlowStore } from "./store";

const config = readConfig();
const store = new FlowStore(config.databasePath);
let settings: DisplaySettings = DEFAULT_SETTINGS;
const displays = new Set<WebSocket>();
const controls = new Set<WebSocket>();

function cors(request: IncomingMessage, response: ServerResponse): void {
  const origin = request.headers.origin;
  if (origin && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Vary", "Origin");
  }
  response.setHeader(
    "Access-Control-Allow-Headers",
    "authorization, content-type",
  );
  response.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PATCH, OPTIONS",
  );
}

function tokenFrom(request: IncomingMessage, url: URL): string | undefined {
  const header = request.headers.authorization;
  if (header?.startsWith("Bearer ")) return header.slice(7);
  return url.searchParams.get("token") ?? undefined;
}

function json(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(value));
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const bytes = Buffer.from(chunk);
    size += bytes.length;
    if (size > 256_000) throw new Error("request-too-large");
    chunks.push(bytes);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
}

function broadcast(clients: Set<WebSocket>, message: ClientMessage): void {
  const encoded = JSON.stringify(message);
  for (const client of clients)
    if (client.readyState === WebSocket.OPEN) client.send(encoded);
}

function acceptFlow(flow: FlowEvent): void {
  store.append(flow);
  broadcast(displays, { type: "flow", event: flow });
}

const server = createServer(async (request, response) => {
  cors(request, response);
  if (request.method === "OPTIONS") {
    response.writeHead(204).end();
    return;
  }
  const url = new URL(
    request.url ?? "/",
    `http://${request.headers.host ?? "127.0.0.1"}`,
  );

  try {
    if (request.method === "GET" && url.pathname === "/health") {
      json(response, 200, {
        status: "ok",
        service: "packethalo-server",
        protocolVersion: 1,
        privacy: "metadata-only",
        displays: displays.size,
      });
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/providers") {
      json(response, 200, { providers: PLANNED_PROVIDERS });
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/settings") {
      json(response, 200, { settings });
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/timeline") {
      if (
        !authorized(
          tokenFrom(request, url),
          config,
          request.socket.remoteAddress,
        )
      ) {
        json(response, 401, { error: "unauthorized" });
        return;
      }
      const since = Number(
        url.searchParams.get("since") || Date.now() - 10 * 60_000,
      );
      json(response, 200, { events: store.recent(since) });
      return;
    }
    if (request.method === "POST" && url.pathname === "/api/events") {
      if (
        !authorized(
          tokenFrom(request, url),
          config,
          request.socket.remoteAddress,
        )
      ) {
        json(response, 401, { error: "unauthorized" });
        return;
      }
      const body = await readJson(request);
      const candidateEvents = Array.isArray(body) ? body : [body];
      if (
        containsForbiddenContent(body) ||
        !candidateEvents.every(isFlowEvent)
      ) {
        json(response, 422, { error: "invalid-metadata-event" });
        return;
      }
      candidateEvents.forEach(acceptFlow);
      json(response, 202, { accepted: candidateEvents.length });
      return;
    }
    if (request.method === "PATCH" && url.pathname === "/api/settings") {
      if (
        !authorized(
          tokenFrom(request, url),
          config,
          request.socket.remoteAddress,
        )
      ) {
        json(response, 401, { error: "unauthorized" });
        return;
      }
      const patch = (await readJson(request)) as Partial<DisplaySettings>;
      if (!isSettingsPatch(patch)) {
        json(response, 422, { error: "invalid-settings" });
        return;
      }
      settings = { ...settings, ...patch };
      broadcast(displays, { type: "settings", settings });
      broadcast(controls, { type: "settings", settings });
      json(response, 200, { settings });
      return;
    }
    json(response, 404, { error: "not-found" });
  } catch (error) {
    const status =
      error instanceof Error && error.message === "request-too-large"
        ? 413
        : 400;
    json(response, status, {
      error: status === 413 ? "request-too-large" : "invalid-request",
    });
  }
});

const socketServer = new WebSocketServer({
  noServer: true,
  maxPayload: 256_000,
});
server.on("upgrade", (request, socket, head) => {
  const url = new URL(
    request.url ?? "/",
    `http://${request.headers.host ?? "127.0.0.1"}`,
  );
  if (
    (url.pathname !== "/stream" && url.pathname !== "/control") ||
    !authorized(tokenFrom(request, url), config, request.socket.remoteAddress)
  ) {
    socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
    socket.destroy();
    return;
  }
  socketServer.handleUpgrade(request, socket, head, (webSocket) => {
    const group = url.pathname === "/control" ? controls : displays;
    group.add(webSocket);
    webSocket.send(
      JSON.stringify({
        type: "hello",
        version: 1,
        serverTime: Date.now(),
      } satisfies ClientMessage),
    );
    webSocket.send(
      JSON.stringify({ type: "settings", settings } satisfies ClientMessage),
    );
    if (url.pathname === "/stream") {
      for (const event of store.recent(Date.now() - 30_000, 400))
        webSocket.send(
          JSON.stringify({ type: "flow", event } satisfies ClientMessage),
        );
    }
    webSocket.on("message", (raw) => {
      if (url.pathname !== "/control") return;
      try {
        const message = JSON.parse(raw.toString()) as ServerMessage;
        if (
          message.type === "settings.update" &&
          isSettingsPatch(message.patch)
        ) {
          settings = { ...settings, ...message.patch };
          broadcast(displays, { type: "settings", settings });
          broadcast(controls, { type: "settings", settings });
        } else if (
          message.type === "simulator.update" &&
          isSimulatorCommand(message.command)
        ) {
          broadcast(displays, {
            type: "simulator.control",
            command: message.command,
          });
        } else if (message.type === "ping") {
          webSocket.send(
            JSON.stringify({
              type: "hello",
              version: 1,
              serverTime: Date.now(),
            } satisfies ClientMessage),
          );
        }
      } catch {
        webSocket.send(
          JSON.stringify({
            type: "error",
            code: "invalid-message",
            message: "Expected a valid control message.",
          } satisfies ClientMessage),
        );
      }
    });
    webSocket.on("close", () => group.delete(webSocket));
  });
});

const pruneTimer = setInterval(
  () => store.prune(Date.now() - config.retentionMinutes * 60_000),
  60_000,
);
server.listen(config.port, config.host, () => {
  // This startup line deliberately contains no token, event metadata, or secrets.
  console.log(
    `PacketHalo server listening on http://${config.host}:${config.port} (${config.containerLoopback ? "container loopback" : config.host === "127.0.0.1" ? "local-only" : "authenticated LAN mode"})`,
  );
});

function shutdown(): void {
  clearInterval(pruneTimer);
  for (const socket of [...displays, ...controls])
    socket.close(1001, "server shutdown");
  server.close(() => {
    store.close();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
