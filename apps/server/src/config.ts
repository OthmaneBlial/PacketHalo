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
  const host = environment.PACKETHALO_HOST || "127.0.0.1";
  const port = Number(environment.PACKETHALO_PORT || PRODUCT.defaultServerPort);
  const token = environment.PACKETHALO_CONTROL_TOKEN?.trim() || undefined;
  const containerLoopback = environment.PACKETHALO_CONTAINER_LOOPBACK === "1";
  if (!Number.isInteger(port) || port < 1 || port > 65_535)
    throw new Error("PACKETHALO_PORT must be a valid TCP port");
  if (!isLoopback(host) && !token && !containerLoopback)
    throw new Error(
      "PACKETHALO_CONTROL_TOKEN is required when LAN mode is enabled",
    );
  return {
    host,
    port,
    ...(token ? { token } : {}),
    databasePath: environment.PACKETHALO_DATABASE || "packethalo.db",
    retentionMinutes: Number(environment.PACKETHALO_RETENTION_MINUTES || 60),
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
  let result = 0;
  for (let index = 0; index < config.token.length; index += 1)
    result |= config.token.charCodeAt(index) ^ requestToken.charCodeAt(index);
  return result === 0;
}

function isRemoteLoopback(address: string): boolean {
  return (
    address === "127.0.0.1" ||
    address === "::1" ||
    address.startsWith("127.") ||
    address.startsWith("::ffff:127.")
  );
}
