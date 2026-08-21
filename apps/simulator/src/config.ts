export function eventEndpoint(raw: string, allowRemote: boolean): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("PACKETHALO_SERVER must be a valid HTTP(S) URL");
  }
  if (
    (url.protocol !== "http:" && url.protocol !== "https:") ||
    url.username ||
    url.password ||
    url.hash
  )
    throw new Error(
      "PACKETHALO_SERVER must be an HTTP(S) URL without credentials or a fragment",
    );
  if (!localHostname(url.hostname) && !allowRemote)
    throw new Error(
      "PACKETHALO_SERVER must be local; set PACKETHALO_ALLOW_REMOTE=1 explicitly for a remote collector",
    );
  if (!localHostname(url.hostname) && url.protocol !== "https:")
    throw new Error("Remote PACKETHALO_SERVER endpoints must use HTTPS");
  return url;
}

export function localHostname(hostname: string): boolean {
  if (
    hostname === "localhost" ||
    hostname === "::1" ||
    hostname.endsWith(".local") ||
    !hostname.includes(".")
  )
    return true;
  const octets = hostname.split(".").map(Number);
  if (
    octets.length !== 4 ||
    !octets.every(
      (octet) => Number.isInteger(octet) && octet >= 0 && octet <= 255,
    )
  )
    return false;
  return (
    octets[0] === 10 ||
    octets[0] === 127 ||
    (octets[0] === 169 && octets[1] === 254) ||
    (octets[0] === 172 && octets[1]! >= 16 && octets[1]! <= 31) ||
    (octets[0] === 192 && octets[1] === 168)
  );
}
