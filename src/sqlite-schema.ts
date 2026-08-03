import { Database } from "bun:sqlite";

const SCHEMA_SQL = `
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

export function createAffineDb(filePath: string): Database {
  const db = new Database(filePath);
  db.exec("PRAGMA journal_mode=WAL");
  db.exec(SCHEMA_SQL);
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
