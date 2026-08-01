import { Database } from "bun:sqlite";

export interface SnapshotRow {
  doc_id: string;
  data: Buffer;
  created_at: string;
  updated_at: string;
}

export interface UpdateRow {
  doc_id: string;
  data: Buffer;
  created_at: string;
}

export interface BlobRow {
  key: string;
  data: Buffer;
  mime: string;
  size: number;
}

export class AffineDb {
  private db: Database;

  constructor(filePath: string) {
    this.db = new Database(filePath, { readonly: true });
  }

  getSpaceId(): string {
    const row = this.db.query("SELECT space_id FROM meta").get() as {
      space_id: string;
    };
    return row.space_id;
  }

  getSnapshot(docId: string): SnapshotRow | null {
    return (
      (this.db
        .query("SELECT * FROM snapshots WHERE doc_id = ?")
        .get(docId) as SnapshotRow) ?? null
    );
  }

  getUpdates(docId: string): UpdateRow[] {
    return this.db
      .query("SELECT * FROM updates WHERE doc_id = ? ORDER BY created_at")
      .all(docId) as UpdateRow[];
  }

  getDocBinary(docId: string): Uint8Array | null {
    const snap = this.getSnapshot(docId);
    if (!snap) return null;

    const updates = this.getUpdates(docId);
    const parts = [new Uint8Array(snap.data)];
    for (const u of updates) {
      parts.push(new Uint8Array(u.data));
    }

    if (parts.length === 1) return parts[0];

    let totalLen = 0;
    for (const p of parts) totalLen += p.length;
    const merged = new Uint8Array(totalLen);
    let offset = 0;
    for (const p of parts) {
      merged.set(p, offset);
      offset += p.length;
    }
    return merged;
  }

  getAllDocIds(): string[] {
    const rows = this.db
      .query("SELECT doc_id FROM snapshots")
      .all() as { doc_id: string }[];
    return rows.map((r) => r.doc_id);
  }

  getBlob(key: string): BlobRow | null {
    return (
      (this.db
        .query("SELECT * FROM blobs WHERE key = ?")
        .get(key) as BlobRow) ?? null
    );
  }

  getAllBlobs(): BlobRow[] {
    return this.db.query("SELECT * FROM blobs").all() as BlobRow[];
  }

  close(): void {
    this.db.close();
  }
}
