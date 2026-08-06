import { Database } from "bun:sqlite";

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS "_sqlx_migrations" (
  "version" BIGINT PRIMARY KEY NOT NULL,
  "description" TEXT NOT NULL,
  "installed_on" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "success" BOOLEAN NOT NULL,
  "checksum" BLOB NOT NULL,
  "execution_time" BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS "meta" (
  "space_id" VARCHAR PRIMARY KEY NOT NULL
);

CREATE TABLE IF NOT EXISTS "snapshots" (
  "doc_id" VARCHAR PRIMARY KEY NOT NULL,
  "data" BLOB NOT NULL,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updated_at" TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS "updates" (
  "doc_id" VARCHAR NOT NULL,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "data" BLOB NOT NULL,
  PRIMARY KEY ("doc_id", "created_at")
);

CREATE TABLE IF NOT EXISTS "clocks" (
  "doc_id" VARCHAR PRIMARY KEY NOT NULL,
  "timestamp" TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS "blobs" (
  "key" VARCHAR PRIMARY KEY NOT NULL,
  "data" BLOB NOT NULL,
  "mime" VARCHAR NOT NULL,
  "size" INTEGER NOT NULL,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "deleted_at" TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "peer_clocks" (
  "peer" VARCHAR NOT NULL,
  "doc_id" VARCHAR NOT NULL,
  "remote_clock" TIMESTAMP NOT NULL DEFAULT 0,
  "pulled_remote_clock" TIMESTAMP NOT NULL DEFAULT 0,
  "pushed_clock" TIMESTAMP NOT NULL DEFAULT 0,
  PRIMARY KEY ("peer", "doc_id")
);
CREATE INDEX IF NOT EXISTS "peer_clocks_doc_id" ON "peer_clocks" ("doc_id");

CREATE TABLE IF NOT EXISTS "peer_blob_sync" (
  "peer" VARCHAR NOT NULL,
  "blob_id" VARCHAR NOT NULL,
  "uploaded_at" TIMESTAMP,
  PRIMARY KEY ("peer", "blob_id")
);
CREATE INDEX IF NOT EXISTS "peer_blob_sync_peer" ON "peer_blob_sync" ("peer");

CREATE TABLE IF NOT EXISTS "idx_snapshots" (
  "index_name" TEXT PRIMARY KEY NOT NULL,
  "data" BLOB NOT NULL,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS "indexer_sync" (
  "doc_id" VARCHAR PRIMARY KEY NOT NULL,
  "indexed_clock" TIMESTAMP NOT NULL DEFAULT 0,
  "indexer_version" INTEGER NOT NULL DEFAULT 0
);
`;

function hexToBuffer(hex: string): Buffer {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return Buffer.from(bytes);
}

function insertMigrations(db: Database): void {
  const now = new Date().toISOString();
  const migrations = [
    {
      version: 1,
      description: "init_v2",
      checksum: "a1f0a1496ba1d1ff1689fc234514b13e7501ce5a3891b5943a75300b20e68444444ae71a1a80f40e46ccee2fc9e2af1a",
      execution_time: 3295523,
    },
    {
      version: 2,
      description: "add_blob_sync",
      checksum: "c40244fec04822d74db419bead8486db435bb52d1f0214e4ddcc8928f4444475c7be8f96cee4c4383fd21b866fffd630",
      execution_time: 3270677,
    },
    {
      version: 3,
      description: "add_idx_snapshots",
      checksum: "c13e51745e6f2d3e49f01fc82df68e88e91feabfa0a28507d658bb85b4c5cb81354ac8b23eb1038b175b1ae66311980a",
      execution_time: 2686673,
    },
    {
      version: 4,
      description: "add_indexer_sync",
      checksum: "eeb9b2d07c3827f326feaed6651f587f177c2312c701d72f321c2d1a132bcd962fc914b39b12a34694003033bf29882b",
      execution_time: 3117936,
    },
  ];

  for (const m of migrations) {
    const checksumBuf = hexToBuffer(m.checksum.replace(/\s/g, ""));
    db.run(
      `INSERT OR REPLACE INTO "_sqlx_migrations" (version, description, installed_on, success, checksum, execution_time)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [m.version, m.description, now, 1, checksumBuf, m.execution_time]
    );
  }
}

export function createAffineDb(filePath: string): Database {
  const db = new Database(filePath);
  db.exec("PRAGMA journal_mode=WAL");
  db.exec(SCHEMA_SQL);
  insertMigrations(db);
  return db;
}

export function setMeta(db: Database, spaceId: string): void {
  db.run("INSERT OR REPLACE INTO meta (space_id) VALUES (?)", [spaceId]);
}

export function insertSnapshot(
  db: Database,
  docId: string,
  data: Uint8Array,
  updatedAt?: string
): void {
  const ts = updatedAt || new Date().toISOString();
  db.run(
    "INSERT OR REPLACE INTO snapshots (doc_id, data, updated_at) VALUES (?, ?, ?)",
    [docId, Buffer.from(data), ts]
  );
}

export function insertUpdate(
  db: Database,
  docId: string,
  data: Uint8Array
): void {
  db.run("INSERT INTO updates (doc_id, data) VALUES (?, ?)", [
    docId,
    Buffer.from(data),
  ]);
}

export function insertClock(
  db: Database,
  docId: string,
  timestamp?: string
): void {
  const ts = timestamp || new Date().toISOString();
  db.run("INSERT OR REPLACE INTO clocks (doc_id, timestamp) VALUES (?, ?)", [
    docId,
    ts,
  ]);
}

export function insertBlob(
  db: Database,
  key: string,
  data: Uint8Array,
  mime: string
): void {
  db.run(
    "INSERT OR REPLACE INTO blobs (key, data, mime, size) VALUES (?, ?, ?, ?)",
    [key, Buffer.from(data), mime, data.length]
  );
}

export function vacuumDb(db: Database, outputPath: string): void {
  db.exec(`VACUUM INTO '${outputPath}'`);
}
