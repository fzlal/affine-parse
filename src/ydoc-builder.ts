import * as Y from "yjs";
import type { AffineBlockDef } from "./md-parser";

export function buildPageYDoc(
  pageId: string,
  title: string,
  blocks: AffineBlockDef[]
): Uint8Array {
  const doc = new Y.Doc();
  const blocksMap = doc.getMap("blocks");

  doc.transact(() => {
    for (const block of blocks) {
      const yBlock = new Y.Map<any>();
      yBlock.set("sys:id", block.id);
      yBlock.set("sys:flavour", block.flavour);
      const version = block.flavour === "affine:page" ? 2 : 1;
      yBlock.set("sys:version", version);

      const childrenArr = new Y.Array<string>();
      childrenArr.insert(0, block.children);
      yBlock.set("sys:children", childrenArr);

      if (block.props.text !== undefined) {
        const text = new Y.Text();
        if (typeof block.props.text === "string" && block.props.text) {
          text.insert(0, block.props.text);
        }
        yBlock.set("prop:text", text);
      }

      if (block.props.title !== undefined) {
        const titleText = new Y.Text();
        if (typeof block.props.title === "string" && block.props.title) {
          titleText.insert(0, String(block.props.title));
        }
        yBlock.set("prop:title", titleText);
      }

      if (block.props.type !== undefined) {
        yBlock.set("prop:type", String(block.props.type));
      }

      if (block.props.checked !== undefined) {
        yBlock.set("prop:checked", Boolean(block.props.checked));
      }

      if (block.props.language !== undefined) {
        yBlock.set("prop:language", String(block.props.language));
      }

      if (block.props.caption !== undefined) {
        const cap = new Y.Text();
        if (typeof block.props.caption === "string" && block.props.caption) {
          cap.insert(0, String(block.props.caption));
        }
        yBlock.set("prop:caption", cap);
      }

      if (block.props.sourceId !== undefined) {
        yBlock.set("prop:sourceId", String(block.props.sourceId));
      }

      if (block.props.url !== undefined) {
        yBlock.set("prop:url", String(block.props.url));
      }

      if (block.props.videoId !== undefined) {
        yBlock.set("prop:videoId", String(block.props.videoId));
      }

      if (block.props.pageId !== undefined) {
        yBlock.set("prop:pageId", String(block.props.pageId));
      }

      if (block.props.latex !== undefined) {
        yBlock.set("prop:latex", String(block.props.latex));
      }

      if (block.props.width !== undefined) {
        yBlock.set("prop:width", Number(block.props.width));
      }

      if (block.props.height !== undefined) {
        yBlock.set("prop:height", Number(block.props.height));
      }

      if (block.props.displayMode !== undefined) {
        yBlock.set("prop:displayMode", String(block.props.displayMode));
      }

      blocksMap.set(block.id, yBlock);
    }
  });

  const binary = Y.encodeStateAsUpdate(doc);
  doc.destroy();
  return binary;
}

export interface PageEntry {
  id: string;
  title: string;
  trash?: boolean;
}

export function buildRootYDoc(
  workspaceId: string,
  workspaceName: string,
  pages: PageEntry[]
): Uint8Array {
  const doc = new Y.Doc();

  doc.transact(() => {
    const meta = doc.getMap("meta");
    meta.set("name", workspaceName);

    const pagesArr = new Y.Array<Y.Map<any>>();
    for (const page of pages) {
      const pageEntry = new Y.Map<any>();
      pageEntry.set("id", page.id);
      pageEntry.set("title", page.title);
      pageEntry.set("createDate", Date.now());
      pageEntry.set("updatedDate", Date.now());
      pageEntry.set("tags", new Y.Map());
      if (page.trash) {
        pageEntry.set("trash", true);
        pageEntry.set("trashDate", Date.now());
      }
      pagesArr.push([pageEntry]);
    }
    meta.set("pages", pagesArr);
  });

  const binary = Y.encodeStateAsUpdate(doc);
  doc.destroy();
  return binary;
}

function genNanoid(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  for (let i = 0; i < 21; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

export interface FolderEntry {
  id: string;
  parentId: string | null;
  type: "folder" | "doc" | "tag" | "collection";
  data: string;
  index: string;
}

export function buildFoldersDoc(
  rootEntries: FolderEntry[],
  childEntries: Map<string, FolderEntry[]>
): Uint8Array {
  const doc = new Y.Doc();

  doc.transact(() => {
    function addEntry(entry: FolderEntry) {
      const yEntry = new Y.Map<any>();
      yEntry.set("id", entry.id);
      if (entry.parentId) yEntry.set("parentId", entry.parentId);
      else yEntry.set("parentId", null);
      yEntry.set("type", entry.type);
      yEntry.set("data", entry.data);
      yEntry.set("index", entry.index);
      doc.share.set(entry.id, yEntry as any);
    }

    for (const entry of rootEntries) {
      addEntry(entry);
      const children = childEntries.get(entry.id) || [];
      for (const child of children) {
        addEntry(child);
        const grandchildren = childEntries.get(child.id) || [];
        for (const gc of grandchildren) {
          addEntry(gc);
        }
      }
    }
  });

  const binary = Y.encodeStateAsUpdate(doc);
  doc.destroy();
  return binary;
}

export function buildFoldersFromStructure(
  folders: Map<string, { name: string; parentId: string | null }>,
  docLinks: { parentId: string | null; docId: string; index: string }[]
): Uint8Array {
  const doc = new Y.Doc();

  doc.transact(() => {
    for (const [folderId, folder] of folders) {
      const yFolder = doc.getMap(folderId);
      yFolder.set("id", folderId);
      yFolder.set("parentId", folder.parentId);
      yFolder.set("type", "folder");
      yFolder.set("data", folder.name);
      yFolder.set("index", genNanoid());
    }

    for (const link of docLinks) {
      const linkId = "link-" + genNanoid();
      const yLink = doc.getMap(linkId);
      yLink.set("id", linkId);
      yLink.set("parentId", link.parentId);
      yLink.set("type", "doc");
      yLink.set("data", link.docId);
      yLink.set("index", link.index || genNanoid());
    }
  });

  const binary = Y.encodeStateAsUpdate(doc);
  doc.destroy();
  return binary;
}

export function buildDocPropertiesDoc(
  properties: { id: string; isTemplate?: boolean }[]
): Uint8Array {
  const doc = new Y.Doc();

  doc.transact(() => {
    for (const prop of properties) {
      const yProp = doc.getMap(prop.id);
      yProp.set("id", prop.id);
      if (prop.isTemplate) yProp.set("isTemplate", true);
    }
  });

  const binary = Y.encodeStateAsUpdate(doc);
  doc.destroy();
  return binary;
}
