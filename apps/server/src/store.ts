import { DatabaseSync } from "node:sqlite";
import type { FlowEvent } from "@packethalo/protocol";

export class FlowStore {
  private readonly database: DatabaseSync;
  private readonly insertStatement;
  private readonly recentStatement;
  private readonly pruneStatement;
  private readonly countStatement;
  private readonly readyStatement;

  public constructor(path: string) {
    this.database = new DatabaseSync(path);
    this.database.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      CREATE TABLE IF NOT EXISTS flow_events (
        id TEXT PRIMARY KEY,
        timestamp INTEGER NOT NULL,
        metadata TEXT NOT NULL
      ) STRICT;
      CREATE INDEX IF NOT EXISTS flow_events_timestamp ON flow_events(timestamp);
      PRAGMA user_version = 1;
    `);
    this.insertStatement = this.database.prepare(
      "INSERT OR IGNORE INTO flow_events (id, timestamp, metadata) VALUES (?, ?, ?)",
    );
    this.recentStatement = this.database.prepare(
      "SELECT metadata FROM flow_events WHERE timestamp >= ? ORDER BY timestamp ASC LIMIT ?",
    );
    this.pruneStatement = this.database.prepare(
      "DELETE FROM flow_events WHERE timestamp < ?",
    );
    this.countStatement = this.database.prepare(
      "SELECT COUNT(*) AS count FROM flow_events",
    );
    this.readyStatement = this.database.prepare("SELECT 1 AS ready");
  }

  public append(flow: FlowEvent): boolean {
    const result = this.insertStatement.run(
      flow.id,
      flow.timestamp,
      JSON.stringify(flow),
    );
    return Number(result.changes) === 1;
  }

  public recent(since: number, limit = 5_000): readonly FlowEvent[] {
    return this.recentStatement
      .all(since, Math.min(10_000, limit))
      .map((row) => JSON.parse(String(row.metadata)) as FlowEvent);
  }

  public prune(before: number): void {
    this.pruneStatement.run(before);
  }
  public count(): number {
    const row = this.countStatement.get() as { count: number | bigint };
    return Number(row.count);
  }
  public ready(): boolean {
    return !!this.readyStatement.get();
  }
  public close(): void {
    this.database.close();
  }
}
