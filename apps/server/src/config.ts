import { timingSafeEqual } from "node:crypto";
import { isLoopback, PRODUCT } from "@packethalo/config";

export interface ServerConfig {
  readonly host: string;
  readonly port: number;
  readonly token?: string;
  readonly databasePath: string;
  readonly retentionMinutes: number;
  readonly containerLoopback: boolean;
}

export function readConfig(
  environment: NodeJS.ProcessEnv = process.env,
): ServerConfig {
  const host = (environment.PACKETHALO_HOST || "127.0.0.1").trim();
  const port = integerSetting(
    "PACKETHALO_PORT",
    environment.PACKETHALO_PORT,
    PRODUCT.defaultServerPort,
    1,
    65_535,
  );
  const token = environment.PACKETHALO_CONTROL_TOKEN?.trim() || undefined;
  const containerLoopbackValue = environment.PACKETHALO_CONTAINER_LOOPBACK;
  if (
    containerLoopbackValue !== undefined &&
    containerLoopbackValue !== "0" &&
    containerLoopbackValue !== "1"
  )
    throw new Error("PACKETHALO_CONTAINER_LOOPBACK must be 0 or 1");
  const containerLoopback = containerLoopbackValue === "1";
  if (!host || host.length > 253 || !/^[a-z0-9.:[\]-]+$/i.test(host))
    throw new Error("PACKETHALO_HOST must be a valid bind host");
  if (token && !/^[A-Za-z0-9._~+/=-]{32,256}$/.test(token))
    throw new Error(
      "PACKETHALO_CONTROL_TOKEN must contain 32-256 safe ASCII characters",
    );
  if (!isLoopback(host) && !token && !containerLoopback)
    throw new Error(
      "PACKETHALO_CONTROL_TOKEN is required when LAN mode is enabled",
    );
  return {
    host,
    port,
    ...(token ? { token } : {}),
    databasePath: databaseSetting(environment.PACKETHALO_DATABASE),
    retentionMinutes: integerSetting(
      "PACKETHALO_RETENTION_MINUTES",
      environment.PACKETHALO_RETENTION_MINUTES,
      60,
      1,
      10_080,
    ),
    containerLoopback,
  };
}

export function authorized(
  requestToken: string | undefined,
  config: ServerConfig,
  remoteAddress?: string,
): boolean {
  if (remoteAddress && isRemoteLoopback(remoteAddress)) return true;
  if (!config.token) return isLoopback(config.host) || config.containerLoopback;
  if (!requestToken || requestToken.length !== config.token.length)
    return false;
  return timingSafeEqual(Buffer.from(config.token), Buffer.from(requestToken));
}

function integerSetting(
  name: string,
  raw: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  if (raw === undefined || raw === "") return fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum)
    throw new Error(`${name} must be an integer from ${minimum} to ${maximum}`);
  return parsed;
}

function databaseSetting(raw: string | undefined): string {
  const path = raw?.trim() || "packethalo.db";
  if (path.length > 1_024 || path.includes("\0"))
    throw new Error("PACKETHALO_DATABASE must be a valid local path");
  return path;
}

function isRemoteLoopback(address: string): boolean {
  return (
    address === "127.0.0.1" ||
    address === "::1" ||
    address.startsWith("127.") ||
    address.startsWith("::ffff:127.")
  );
}
