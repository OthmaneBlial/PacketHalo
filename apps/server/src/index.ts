import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import type { Duplex } from "node:stream";
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
import { CAPTURE_PROVIDERS } from "./providers";
import { FlowStore } from "./store";

const MAX_EVENT_BATCH = 500;
const MAX_SOCKET_BUFFER = 1_000_000;
const config = readConfig();
const store = new FlowStore(config.databasePath);
const startedAt = Date.now();
let settings: DisplaySettings = DEFAULT_SETTINGS;
let acceptedEvents = 0;
let rejectedEvents = 0;
let lastAcceptedAt: number | undefined;
let shuttingDown = false;
const displays = new Set<WebSocket>();
const controls = new Set<WebSocket>();
const responsiveSockets = new WeakSet<WebSocket>();

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

function securityHeaders(response: ServerResponse): void {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("Cross-Origin-Resource-Policy", "same-site");
  response.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
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

function send(client: WebSocket, encoded: string): boolean {
  if (client.readyState !== WebSocket.OPEN) return false;
  if (client.bufferedAmount > MAX_SOCKET_BUFFER) {
    client.close(1013, "client too slow");
    return false;
  }
  try {
    client.send(encoded);
    return true;
  } catch {
    client.terminate();
    return false;
  }
}

function broadcast(clients: Set<WebSocket>, message: ClientMessage): void {
  const encoded = JSON.stringify(message);
  for (const client of clients) send(client, encoded);
}

function acceptFlow(flow: FlowEvent): boolean {
  if (!store.append(flow)) return false;
  acceptedEvents += 1;
  lastAcceptedAt = Date.now();
  broadcast(displays, { type: "flow", event: flow });
  return true;
}

function log(
  level: "info" | "warn" | "error",
  event: string,
  details: Record<string, string | number | boolean | undefined> = {},
): void {
  const entry = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    service: "packethalo-server",
    event,
    ...details,
  });
  (level === "error"
    ? console.error
    : level === "warn"
      ? console.warn
      : console.log)(entry);
}

const server = createServer(async (request, response) => {
  securityHeaders(response);
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
        uptimeSeconds: Math.floor((Date.now() - startedAt) / 1_000),
        connections: { displays: displays.size, controls: controls.size },
        ingest: {
          acceptedEvents,
          rejectedEvents,
          lastAcceptedAt: lastAcceptedAt ?? null,
        },
      });
      return;
    }
    if (request.method === "GET" && url.pathname === "/ready") {
      json(response, store.ready() ? 200 : 503, {
        status: store.ready() ? "ready" : "unavailable",
        storedEvents: store.count(),
      });
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/providers") {
      json(response, 200, { providers: CAPTURE_PROVIDERS });
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
      const since = queryInteger(
        url.searchParams.get("since"),
        Date.now() - 10 * 60_000,
        0,
        Number.MAX_SAFE_INTEGER,
      );
      const limit = queryInteger(
        url.searchParams.get("limit"),
        5_000,
        1,
        10_000,
      );
      if (since === undefined || limit === undefined) {
        json(response, 422, { error: "invalid-timeline-query" });
        return;
      }
      json(response, 200, { events: store.recent(since, limit) });
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
        candidateEvents.length === 0 ||
        candidateEvents.length > MAX_EVENT_BATCH ||
        containsForbiddenContent(body) ||
        !candidateEvents.every(isFlowEvent)
      ) {
        rejectedEvents += candidateEvents.length || 1;
        json(response, 422, { error: "invalid-metadata-event" });
        return;
      }
      const accepted = candidateEvents.filter(acceptFlow).length;
      json(response, 202, {
        accepted,
        duplicates: candidateEvents.length - accepted,
      });
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
    log("warn", "request_rejected", {
      method: request.method,
      path: request.url?.split("?", 1)[0],
      status,
    });
  }
});

server.requestTimeout = 15_000;
server.headersTimeout = 10_000;
server.keepAliveTimeout = 5_000;
server.maxRequestsPerSocket = 1_000;

const socketServer = new WebSocketServer({
  noServer: true,
  maxPayload: 256_000,
});
server.on("upgrade", (request, socket, head) => {
  let url: URL;
  try {
    url = new URL(
      request.url ?? "/",
      `http://${request.headers.host ?? "127.0.0.1"}`,
    );
  } catch {
    rejectUpgrade(socket, 400, "Bad Request");
    return;
  }
  if (
    (url.pathname !== "/stream" && url.pathname !== "/control") ||
    !allowedWebSocketOrigin(request, url) ||
    !authorized(tokenFrom(request, url), config, request.socket.remoteAddress)
  ) {
    rejectUpgrade(socket, 401, "Unauthorized");
    return;
  }
  socketServer.handleUpgrade(request, socket, head, (webSocket) => {
    const group = url.pathname === "/control" ? controls : displays;
    group.add(webSocket);
    responsiveSockets.add(webSocket);
    send(
      webSocket,
      JSON.stringify({
        type: "hello",
        version: 1,
        serverTime: Date.now(),
      } satisfies ClientMessage),
    );
    send(
      webSocket,
      JSON.stringify({ type: "settings", settings } satisfies ClientMessage),
    );
    if (url.pathname === "/stream") {
      for (const event of store.recent(Date.now() - 30_000, 400))
        send(
          webSocket,
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
          send(
            webSocket,
            JSON.stringify({
              type: "hello",
              version: 1,
              serverTime: Date.now(),
            } satisfies ClientMessage),
          );
        } else {
          send(
            webSocket,
            JSON.stringify({
              type: "error",
              code: "invalid-message",
              message: "Expected a valid control message.",
            } satisfies ClientMessage),
          );
        }
      } catch {
        send(
          webSocket,
          JSON.stringify({
            type: "error",
            code: "invalid-message",
            message: "Expected a valid control message.",
          } satisfies ClientMessage),
        );
      }
    });
    webSocket.on("pong", () => responsiveSockets.add(webSocket));
    webSocket.on("close", () => group.delete(webSocket));
  });
});

const pruneTimer = setInterval(
  () => store.prune(Date.now() - config.retentionMinutes * 60_000),
  60_000,
);
const heartbeatTimer = setInterval(() => {
  for (const socket of [...displays, ...controls]) {
    if (!responsiveSockets.has(socket)) {
      socket.terminate();
      continue;
    }
    responsiveSockets.delete(socket);
    socket.ping();
  }
}, 30_000);
server.on("clientError", (_error, socket) => {
  rejectUpgrade(socket, 400, "Bad Request");
});
server.on("error", (error: NodeJS.ErrnoException) => {
  clearInterval(pruneTimer);
  clearInterval(heartbeatTimer);
  store.close();
  log("error", "server_error", {
    code: error.code,
    message: error.message,
  });
  process.exit(1);
});
server.listen(config.port, config.host, () => {
  log("info", "server_started", {
    host: config.host,
    port: config.port,
    mode: config.containerLoopback
      ? "container-loopback"
      : isLoopbackHost(config.host)
        ? "local-only"
        : "authenticated-lan",
    retentionMinutes: config.retentionMinutes,
  });
});

function shutdown(): void {
  if (shuttingDown) return;
  shuttingDown = true;
  clearInterval(pruneTimer);
  clearInterval(heartbeatTimer);
  for (const socket of [...displays, ...controls])
    socket.close(1001, "server shutdown");
  const forceTimer = setTimeout(() => server.closeAllConnections(), 5_000);
  forceTimer.unref();
  server.close(() => {
    clearTimeout(forceTimer);
    store.close();
    log("info", "server_stopped");
    process.exit(0);
  });
}

function queryInteger(
  raw: string | null,
  fallback: number,
  minimum: number,
  maximum: number,
): number | undefined {
  if (raw === null || raw === "") return fallback;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed >= minimum && parsed <= maximum
    ? parsed
    : undefined;
}

function isLoopbackHost(host: string): boolean {
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

function allowedWebSocketOrigin(
  request: IncomingMessage,
  target: URL,
): boolean {
  const origin = request.headers.origin;
  if (!origin) return true;
  try {
    const parsed = new URL(origin);
    return (
      (parsed.protocol === "http:" || parsed.protocol === "https:") &&
      (isLoopbackHost(parsed.hostname) || parsed.hostname === target.hostname)
    );
  } catch {
    return false;
  }
}

function rejectUpgrade(socket: Duplex, status: number, reason: string): void {
  socket.write(
    `HTTP/1.1 ${status} ${reason}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`,
  );
  socket.destroy();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
