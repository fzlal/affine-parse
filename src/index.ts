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
import { mkdirSync, writeFileSync } from "fs";
import { join, dirname } from "path";

function usage() {
  console.log(`Usage: bun run src/index.ts <input.affine> [output_dir]

Options:
  input.affine    Path to .affine backup file
  output_dir      Output directory (default: ./output)

Example:
  bun run src/index.ts ./workspace.affine ./output`);
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

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) usage();

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
  const trashIds = new Set<string>();
  const pageMap = new Map<string, PageMetaEntry>();

  for (const page of pages) {
    pageMap.set(page.id, page);
    if (page.trash) trashIds.add(page.id);
  }

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

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
