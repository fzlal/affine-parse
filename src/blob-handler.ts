import { Database } from "bun:sqlite";
import { readdirSync, readFileSync, statSync } from "fs";
import { join, extname } from "path";

function getMime(filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  const mimes: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".webp": "image/webp",
    ".bmp": "image/bmp",
    ".ico": "image/x-icon",
    ".pdf": "application/pdf",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".zip": "application/zip",
    ".json": "application/json",
    ".txt": "text/plain",
  };
  return mimes[ext] || "application/octet-stream";
}

export function scanImages(
  inputDir: string
): { key: string; filePath: string }[] {
  const images: { key: string; filePath: string }[] = [];

  function walk(dir: string) {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      try {
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
          walk(fullPath);
        } else {
          const ext = extname(entry).toLowerCase();
          const imageExts = [
            ".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp",
            ".bmp", ".ico", ".pdf", ".mp4", ".webm", ".mp3",
            ".wav", ".zip",
          ];
          if (imageExts.includes(ext)) {
            const key = entry;
            images.push({ key, filePath: fullPath });
          }
        }
      } catch {}
    }
  }

  walk(inputDir);
  return images;
}

export function loadBlobsToDb(
  db: Database,
  images: { key: string; filePath: string }[]
): void {
  for (const img of images) {
    try {
      const data = readFileSync(img.filePath);
      const mime = getMime(img.filePath);
      db.run(
        "INSERT OR REPLACE INTO blobs (key, data, mime, size) VALUES (?, ?, ?, ?)",
        [img.key, data, mime, data.length]
      );
    } catch (e) {
      console.log(`  WARN: Failed to load blob: ${img.key}`);
    }
  }
}
