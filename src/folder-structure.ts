import * as Y from "yjs";

export interface FolderEntry {
  id: string;
  parentId: string | null;
  type: "folder" | "doc" | "tag" | "collection";
  data: string;
  index: string;
}

export interface FolderNode {
  id: string;
  name: string;
  children: FolderNode[];
  docIds: string[];
  index: string;
}

export function parseFoldersDoc(doc: Y.Doc): FolderEntry[] {
  const entries: FolderEntry[] = [];
  const shareKeys = [...doc.share.keys()].filter((k) => k !== "blocks");

  for (const key of shareKeys) {
    const m = doc.getMap(key);
    const deleted = m.get("$$DELETED");
    if (deleted) continue;

    const id = String(m.get("id") || key);
    const parentId = m.get("parentId") ? String(m.get("parentId")) : null;
    const type = String(m.get("type") || "") as FolderEntry["type"];
    const data = String(m.get("data") || "");
    const index = String(m.get("index") || "");

    if (!type) continue;
    entries.push({ id, parentId, type, data, index });
  }

  return entries;
}

function buildTree(entries: FolderEntry[]): FolderNode[] {
  const byParent = new Map<string | null, FolderEntry[]>();
  for (const e of entries) {
    const key = e.parentId || "__root__";
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(e);
  }

  function sortEntries(a: FolderEntry, b: FolderEntry): number {
    return a.index < b.index ? -1 : a.index > b.index ? 1 : 0;
  }

  function build(parentId: string | null): FolderNode[] {
    const key = parentId || "__root__";
    const items = byParent.get(key) || [];
    items.sort(sortEntries);

    const folders: FolderNode[] = [];
    for (const e of items) {
      if (e.type === "folder") {
        folders.push({
          id: e.id,
          name: e.data,
          children: build(e.id),
          docIds: [],
          index: e.index,
        });
      }
    }

    for (const f of folders) {
      const childDocs = (byParent.get(f.id) || [])
        .filter((e) => e.type === "doc")
        .sort(sortEntries);
      f.docIds = childDocs.map((e) => e.data);
    }

    return folders;
  }

  return build(null);
}

export function getFolderStructure(
  foldersDoc: Y.Doc | null
): { folders: FolderNode[]; docToFolder: Map<string, FolderNode> } {
  if (!foldersDoc) return { folders: [], docToFolder: new Map() };

  const entries = parseFoldersDoc(foldersDoc);
  const folders = buildTree(entries);

  const docToFolder = new Map<string, FolderNode>();
  function indexFolder(nodes: FolderNode[]) {
    for (const n of nodes) {
      for (const docId of n.docIds) {
        docToFolder.set(docId, n);
      }
      indexFolder(n.children);
    }
  }
  indexFolder(folders);

  return { folders, docToFolder };
}

export function sanitizePath(name: string): string {
  return name
    .replace(/[\/\\:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .substring(0, 100);
}
