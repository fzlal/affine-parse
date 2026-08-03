#!/usr/bin/env bun
import * as Y from "yjs";
import { AffineDb } from "./db";
import {
  decodeYDoc,
  getWorkspaceMeta,
  parsePageDoc,
  type PageMetaEntry,
} from "./doc-decoder";
import { docToMarkdown } from "./markdown";
import {
  getFolderStructure,
  sanitizePath,
  type FolderNode,
} from "./folder-structure";
import {
  createAffineDb,
  setMeta,
  insertSnapshot,
  insertUpdate,
  vacuumDb,
} from "./sqlite-schema";
import { parseMarkdown } from "./md-parser";
import { buildPageYDoc, buildRootYDoc } from "./ydoc-builder";
import { scanImages, loadBlobsToDb } from "./blob-handler";
import { mkdirSync, writeFileSync, readdirSync, readFileSync, statSync } from "fs";
import { join, dirname, extname, relative } from "path";

function usage() {
  console.log(`
Usage:
  bun run src/index.ts export <input.affine> [output_dir]
  bun run src/index.ts import <input_dir> <output.affine>

Commands:
  export    Convert .affine backup to Markdown files
  import    Convert Markdown folder to .affine backup

Examples:
  bun run src/index.ts export ./workspace.affine ./output
  bun run src/index.ts import ./my-docs ./output.affine
`);
  process.exit(1);
}

function readTemplateIds(db: AffineDb): Set<string> {
  const ids = new Set<string>();
  const binary = db.getDocBinary("db$docProperties");
  if (!binary) return ids;

  const doc = decodeYDoc(binary);
  for (const [key] of doc.share.entries()) {
    const m = doc.getMap(key);
    const id = m.get("id");
    const isTemplate = m.get("isTemplate");
    if (id && isTemplate) ids.add(String(id));
  }
  doc.destroy();
  return ids;
}

// ──────────────────────────────────────────
// EXPORT: .affine → Markdown
// ──────────────────────────────────────────

async function cmdExport(args: string[]) {
  const inputFile = args[0];
  const outputDir = args[1] || "./output";

  console.log(`Reading: ${inputFile}`);
  const db = new AffineDb(inputFile);

  const spaceId = db.getSpaceId();
  console.log(`Workspace ID: ${spaceId}`);

  const templateIds = readTemplateIds(db);
  if (templateIds.size > 0) console.log(`Templates: ${templateIds.size}`);

  const rootBinary = db.getDocBinary(spaceId);
  if (!rootBinary) {
    console.error("Cannot read root document");
    process.exit(1);
  }

  const rootDoc = decodeYDoc(rootBinary);
  const { name: workspaceName, pages } = getWorkspaceMeta(rootDoc);
  console.log(`Workspace: ${workspaceName}`);
  console.log(`Pages: ${pages.length}`);

  const foldersDocBinary = db.getDocBinary("db$folders");
  let foldersDoc: Y.Doc | null = null;
  if (foldersDocBinary) {
    foldersDoc = decodeYDoc(foldersDocBinary);
  }
  const { folders, docToFolder } = getFolderStructure(foldersDoc);

  let folderCount = 0;
  function countFolders(nodes: FolderNode[]) {
    for (const n of nodes) {
      folderCount++;
      countFolders(n.children);
    }
  }
  countFolders(folders);
  if (folderCount > 0) console.log(`Folders: ${folderCount}`);

  const wsDir = join(outputDir, sanitizePath(workspaceName));
  mkdirSync(wsDir, { recursive: true });

  let converted = 0;
  let failed = 0;

  for (const page of pages) {
    const pageId = page.id;
    if (!pageId) continue;

    const binary = db.getDocBinary(pageId);
    if (!binary) {
      console.log(`  SKIP: ${page.title || pageId} (no data)`);
      failed++;
      continue;
    }

    const doc = decodeYDoc(binary);
    const parsed = parsePageDoc(doc);
    if (!parsed) {
      console.log(`  SKIP: ${page.title || pageId} (no blocks)`);
      doc.destroy();
      failed++;
      continue;
    }

    const title = page.title || parsed.title || pageId;
    const markdown = docToMarkdown(parsed);
    const fileName = sanitizePath(title) + ".md";

    let dirParts: string[] = [];

    if (page.trash) {
      dirParts = ["trash"];
    } else if (templateIds.has(pageId)) {
      dirParts = ["templates"];
    } else {
      const folder = docToFolder.get(pageId);
      if (folder) {
        dirParts = buildFolderPath(folders, folder.id);
      } else {
        dirParts = ["public"];
      }
    }

    const dir = join(wsDir, ...dirParts);
    mkdirSync(dir, { recursive: true });
    const outputPath = join(dir, fileName);
    writeFileSync(outputPath, markdown, "utf-8");
    console.log(`  OK: ${title} -> ${dirParts.join("/")}/${fileName}`);
    converted++;

    doc.destroy();
  }

  if (foldersDoc) foldersDoc.destroy();
  rootDoc.destroy();

  const indexPath = join(wsDir, "index.md");
  const indexContent = buildIndex(pages, folders, workspaceName, docToFolder, templateIds);
  writeFileSync(indexPath, indexContent, "utf-8");
  console.log(`  Index: index.md`);

  db.close();
  console.log(`\nDone: ${converted} converted, ${failed} skipped`);
}

// ──────────────────────────────────────────
// IMPORT: Markdown → .affine
// ──────────────────────────────────────────

function collectMarkdownFiles(inputDir: string): string[] {
  const files: string[] = [];

  function walk(dir: string) {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry === "index.md" && dir === inputDir) continue;
      const fullPath = join(dir, entry);
      try {
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
          walk(fullPath);
        } else if (extname(entry) === ".md") {
          files.push(fullPath);
        }
      } catch {}
    }
  }

  walk(inputDir);
  return files;
}

function deriveTitle(filePath: string, inputDir: string): string {
  const rel = relative(inputDir, filePath);
  const name = rel.replace(/\.md$/, "").replace(/[/\\]/g, " / ");
  return name;
}

async function cmdImport(args: string[]) {
  const inputDir = args[0];
  const outputPath = args[1] || "./output.affine";

  console.log(`Input dir: ${inputDir}`);
  console.log(`Output: ${outputPath}`);

  const mdFiles = collectMarkdownFiles(inputDir);
  console.log(`Markdown files: ${mdFiles.length}`);

  if (mdFiles.length === 0) {
    console.error("No markdown files found");
    process.exit(1);
  }

  const workspaceId = "ws-" + Date.now().toString(36);
  const dirName = inputDir.split("/").pop() || "workspace";
  const workspaceName = dirName;

  const tmpDbPath = outputPath + ".tmp";
  const db = createAffineDb(tmpDbPath);
  setMeta(db, workspaceId);

  const pages: { id: string; title: string }[] = [];

  console.log("Creating documents...");

  for (const mdFile of mdFiles) {
    const content = readFileSync(mdFile, "utf-8");
    const title = deriveTitle(mdFile, inputDir);
    const pageId = "page-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);

    const result = parseMarkdown(content, title);
    const pageBinary = buildPageYDoc(pageId, result.title, result.blocks);

    insertSnapshot(db, pageId, pageBinary);
    insertUpdate(db, pageId, pageBinary);

    pages.push({ id: pageId, title: result.title });
    console.log(`  OK: ${result.title} (${result.blocks.length} blocks)`);
  }

  console.log("Creating workspace root...");
  const rootBinary = buildRootYDoc(workspaceId, workspaceName, pages);
  insertSnapshot(db, workspaceId, rootBinary);
  insertUpdate(db, workspaceId, rootBinary);

  console.log("Loading blobs...");
  const images = scanImages(inputDir);
  if (images.length > 0) {
    loadBlobsToDb(db, images);
    console.log(`  Blobs: ${images.length}`);
  }

  console.log("Vacuuming...");
  vacuumDb(db, outputPath);
  db.close();

  const { unlinkSync } = await import("fs");
  try { unlinkSync(tmpDbPath); } catch {}

  console.log(`\nDone: ${pages.length} pages -> ${outputPath}`);
}

// ──────────────────────────────────────────
// Shared helpers
// ──────────────────────────────────────────

function buildFolderPath(allFolders: FolderNode[], targetId: string): string[] {
  const path: string[] = [];
  function find(nodes: FolderNode[]): boolean {
    for (const n of nodes) {
      if (n.id === targetId) {
        path.unshift(sanitizePath(n.name));
        return true;
      }
      if (find(n.children)) {
        path.unshift(sanitizePath(n.name));
        return true;
      }
    }
    return false;
  }
  find(allFolders);
  return path;
}

function buildIndex(
  pages: PageMetaEntry[],
  folders: FolderNode[],
  workspaceName: string,
  docToFolder: Map<string, FolderNode>,
  templateIds: Set<string>
): string {
  const titleMap = new Map<string, string>();
  for (const p of pages) titleMap.set(p.id, p.title);

  const lines: string[] = [`# ${workspaceName}\n`];

  if (folders.length > 0) {
    renderFolderIndex(folders, "", lines, titleMap, templateIds);
  }

  const inFolder = new Set<string>();
  for (const [, f] of docToFolder) {
    for (const docId of f.docIds) inFolder.add(docId);
  }

  const unassigned = pages.filter(
    (p) => !p.trash && !templateIds.has(p.id) && !inFolder.has(p.id) && p.title
  );
  if (unassigned.length > 0) {
    lines.push(`## public\n`);
    for (const p of unassigned) {
      const title = p.title || p.id;
      const rel = `public/${sanitizePath(title)}.md`;
      lines.push(`- [${title}](${rel})`);
    }
    lines.push("");
  }

  const templatePages = pages.filter((p) => templateIds.has(p.id));
  if (templatePages.length > 0) {
    lines.push(`## templates\n`);
    for (const p of templatePages) {
      const title = p.title || p.id;
      const rel = `templates/${sanitizePath(title)}.md`;
      lines.push(`- [${title}](${rel})`);
    }
    lines.push("");
  }

  const trashPages = pages.filter((p) => p.trash);
  if (trashPages.length > 0) {
    lines.push(`## trash\n`);
    for (const p of trashPages) {
      const title = p.title || p.id;
      const rel = `trash/${sanitizePath(title)}.md`;
      lines.push(`- [${title}](${rel})`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

function renderFolderIndex(
  folderList: FolderNode[],
  parentPath: string,
  lines: string[],
  titleMap: Map<string, string>,
  templateIds: Set<string>
) {
  for (const f of folderList) {
    const folderPath = parentPath
      ? `${parentPath}/${sanitizePath(f.name)}`
      : sanitizePath(f.name);
    lines.push(`## ${f.name}\n`);
    for (const docId of f.docIds) {
      const title = titleMap.get(docId);
      if (!title) continue;
      if (templateIds.has(docId)) continue;
      const rel = `${folderPath}/${sanitizePath(title)}.md`;
      lines.push(`- [${title}](${rel})`);
    }
    if (f.children.length > 0) {
      renderFolderIndex(f.children, folderPath, lines, titleMap, templateIds);
    }
    lines.push("");
  }
}

// ──────────────────────────────────────────
// Main
// ──────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) usage();

  const command = args[0];
  const cmdArgs = args.slice(1);

  switch (command) {
    case "export":
      await cmdExport(cmdArgs);
      break;
    case "import":
      await cmdImport(cmdArgs);
      break;
    default:
      console.error(`Unknown command: ${command}`);
      usage();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
