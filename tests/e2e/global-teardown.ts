import { rmSync } from "node:fs";

export default function globalTeardown(): void {
  const database = "/tmp/packethalo-playwright-55173.db";
  for (const suffix of ["", "-shm", "-wal"])
    rmSync(`${database}${suffix}`, { force: true });
}
