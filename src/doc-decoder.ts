import * as Y from "yjs";
import type { AffineBlock, ParsedBlock, DocMeta, DeltaOp } from "./types";

export function decodeYDoc(binary: Uint8Array): Y.Doc {
  const doc = new Y.Doc();
  Y.applyUpdate(doc, binary);
  return doc;
}

export interface PageMetaEntry {
  id: string;
  title: string;
  trash: boolean;
  createDate?: number;
  updatedDate?: number;
}

export function getWorkspaceMeta(doc: Y.Doc): {
  name: string;
  pages: PageMetaEntry[];
} {
  const meta = doc.getMap("meta");
  const name = String(meta.get("name") || "workspace");
  const pagesArr = meta.get("pages");
  const pages: PageMetaEntry[] = [];
  if (pagesArr instanceof Y.Array) {
    try {
      const arr = pagesArr.toArray();
      for (const entry of arr) {
        if (entry instanceof Y.Map) {
          pages.push({
            id: String(entry.get("id") || ""),
            title: String(entry.get("title") || ""),
            trash: Boolean(entry.get("trash")),
            createDate: Number(entry.get("createDate") || 0),
            updatedDate: Number(entry.get("updatedDate") || 0),
          });
        } else if (typeof entry === "string") {
          pages.push({ id: entry, title: "", trash: false });
        }
      }
    } catch {}
  }
  return { name, pages };
}

export function getPageMeta(doc: Y.Doc): DocMeta | null {
  const blocks = doc.getMap("blocks");
  for (const [id, block] of blocks.entries()) {
    const flavour = String(block.get("sys:flavour") || "");
    if (flavour === "affine:page") {
      const title = extractYText(block.get("prop:title"));
      return {
        id,
        title,
        trash: Boolean(block.get("trash")),
      };
    }
  }
  return null;
}

function extractYText(val: unknown): string {
  if (!val) return "";
  try {
    if (typeof val === "string") return val;
    if (val instanceof Object && "toString" in val) {
      const s = (val as { toString(): string }).toString();
      if (s !== "[object Object]") return s;
    }
    if (val instanceof Y.Text) {
      return val.toString();
    }
  } catch {}
  return "";
}

function extractYTextDeltas(val: unknown): DeltaOp[] {
  if (!val) return [];
  try {
    if (val instanceof Y.Text) {
      const delta = (val as Y.Text).toDelta();
      if (Array.isArray(delta)) return delta;
    }
  } catch {}
  return [];
}

export function extractBlocks(doc: Y.Doc): AffineBlock[] {
  const blocks = doc.getMap("blocks");
  const result: AffineBlock[] = [];

  for (const [id, block] of blocks.entries()) {
    const flavour = String(block.get("sys:flavour") || "");
    const childrenArr = block.get("sys:children");
    const children: string[] = [];
    if (childrenArr instanceof Y.Array) {
      for (const c of childrenArr.toArray()) {
        children.push(String(c));
      }
    }

    const props: Record<string, unknown> = {};
    for (const key of Object.keys(block.toJSON ? block.toJSON() : {})) {
      if (key.startsWith("sys:")) continue;
      try {
        const v = block.get(key);
        if (v instanceof Y.Text) {
          props[key] = v.toString();
        } else if (v instanceof Y.Array) {
          props[key] = v.toArray().map(String);
        } else if (v instanceof Y.Map) {
          props[key] = v.toJSON();
        } else {
          props[key] = v;
        }
      } catch {}
    }

    result.push({ id, flavour, children, props });
  }

  return result;
}

function buildBlockTree(
  blocks: Map<string, Y.Map<unknown>>,
  blockId: string,
  visited: Set<string> = new Set()
): ParsedBlock | null {
  if (visited.has(blockId)) return null;
  visited.add(blockId);

  const block = blocks.get(blockId);
  if (!block) return null;

  const flavour = String(block.get("sys:flavour") || "");
  const childrenArr = block.get("sys:children");
  const childIds: string[] = [];
  if (childrenArr instanceof Y.Array) {
    for (const c of childrenArr.toArray()) childIds.push(String(c));
  }

  const props: Record<string, unknown> = {};
  const deltas: DeltaOp[] = [];

  for (const key of ["title", "text", "type", "checked", "language",
    "caption", "sourceId", "url", "videoId", "pageId", "latex",
    "width", "height", "displayMode"]) {
    try {
      const v = block.get("prop:" + key);
      if (v === undefined || v === null) continue;
      if (v instanceof Y.Text) {
        props[key] = v.toString();
        if (key === "text" || key === "title") {
          const d = v.toDelta();
          if (Array.isArray(d)) {
            for (const op of d) {
              deltas.push(op as DeltaOp);
            }
          }
        }
      } else if (v instanceof Y.Array) {
        props[key] = v.toJSON();
      } else if (v instanceof Y.Map) {
        props[key] = v.toJSON();
      } else {
        props[key] = v;
      }
    } catch {}
  }

  const children: ParsedBlock[] = [];
  for (const cid of childIds) {
    const child = buildBlockTree(blocks, cid, visited);
    if (child) children.push(child);
  }

  const text = String(props.text || props.title || "");

  return {
    id: blockId,
    flavour,
    content: text,
    children,
    props,
    text,
    title: String(props.title || ""),
    type: String(props.type || ""),
    checked: Boolean(props.checked),
    language: String(props.language || ""),
    caption: String(props.caption || ""),
    sourceId: String(props.sourceId || ""),
    url: String(props.url || ""),
    videoId: String(props.videoId || ""),
    pageId: String(props.pageId || ""),
    latex: String(props.latex || ""),
    width: Number(props.width || 0),
    height: Number(props.height || 0),
    deltas,
  };
}

export function parsePageDoc(doc: Y.Doc): ParsedBlock | null {
  const blocks = doc.getMap("blocks");

  let rootId: string | null = null;
  for (const [id, block] of blocks.entries()) {
    if (String(block.get("sys:flavour") || "") === "affine:page") {
      rootId = id;
      break;
    }
  }

  if (!rootId) return null;
  return buildBlockTree(blocks, rootId, new Set());
}
