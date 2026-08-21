import { rmSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
for (const name of ["packethalo.db", "packethalo.db-shm", "packethalo.db-wal"])
  rmSync(resolve(root, name), { force: true });
console.log(
  "PacketHalo local SQLite history reset. Browser-only settings were preserved.",
);
