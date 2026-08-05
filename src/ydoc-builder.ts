import * as Y from "yjs";
import type { AffineBlockDef } from "./md-parser";

function genNanoid(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  for (let i = 0; i < 21; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

export function buildPageYDoc(
  pageId: string,
  title: string,
  blocks: AffineBlockDef[]
): Uint8Array {
  const doc = new Y.Doc();
  const blocksMap = doc.getMap("blocks");

  for (const block of blocks) {
    const yBlock = new Y.Map<any>();
    yBlock.set("sys:id", block.id);
    yBlock.set("sys:flavour", block.flavour);
    const version = block.flavour === "affine:page" ? 2 : 1;
    yBlock.set("sys:version", version);

    const childrenArr = new Y.Array<string>();
    yBlock.set("sys:children", childrenArr);
    if (block.children.length > 0) {
      childrenArr.insert(0, block.children);
    }

    if (block.props.text !== undefined) {
      const text = new Y.Text();
      yBlock.set("prop:text", text);
      if (typeof block.props.text === "string" && block.props.text) {
        text.insert(0, block.props.text);
      }
    }

    if (block.props.title !== undefined) {
      const titleText = new Y.Text();
      yBlock.set("prop:title", titleText);
      if (typeof block.props.title === "string" && block.props.title) {
        titleText.insert(0, String(block.props.title));
      }
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
      yBlock.set("prop:caption", cap);
      if (typeof block.props.caption === "string" && block.props.caption) {
        cap.insert(0, String(block.props.caption));
      }
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

    if (block.flavour === "affine:note") {
      if (!yBlock.has("prop:xywh")) yBlock.set("prop:xywh", "[0,0,498,92]");
      if (!yBlock.has("prop:index")) yBlock.set("prop:index", "a0");
      if (!yBlock.has("prop:hidden")) yBlock.set("prop:hidden", false);
      if (!yBlock.has("prop:background")) {
        const bg = new Y.Map();
        yBlock.set("prop:background", bg);
        bg.set("dark", "#252525");
        bg.set("light", "#ffffff");
      }
      if (!yBlock.has("prop:displayMode")) yBlock.set("prop:displayMode", "both");
      if (!yBlock.has("prop:edgeless")) {
        const edgeless = new Y.Map();
        yBlock.set("prop:edgeless", edgeless);
        const style = new Y.Map();
        edgeless.set("style", style);
        style.set("borderRadius", 8);
        style.set("borderSize", 4);
        style.set("borderStyle", "none");
        style.set("shadowType", "--affine-note-shadow-box");
      }
    }

    if (block.flavour === "affine:paragraph" || block.flavour === "affine:list") {
      if (!yBlock.has("prop:collapsed")) yBlock.set("prop:collapsed", false);
    }

    if (block.flavour === "affine:list") {
      if (!yBlock.has("prop:order")) yBlock.set("prop:order", null);
    }

      if (block.flavour === "affine:surface") {
        if (!yBlock.has("prop:elements")) {
          const boxed = new Y.Map();
          yBlock.set("prop:elements", boxed);
          boxed.set("type", "$blocksuite:internal:native$");
          const innerMap = new Y.Map();
          boxed.set("value", innerMap);
        }
      }

      blocksMap.set(block.id, yBlock);
  }

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
  workspaceName: string,
  pages: PageEntry[]
): Uint8Array {
  const doc = new Y.Doc();

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

  const spaces = doc.getMap("spaces");
  for (const page of pages) {
    const subDoc = new Y.Doc({ guid: page.id });
    spaces.set(page.id, subDoc);
    subDoc.destroy();
  }

  const binary = Y.encodeStateAsUpdate(doc);
  doc.destroy();
  return binary;
}

export function buildFoldersFromStructure(
  folders: Map<string, { name: string; parentId: string | null }>,
  docLinks: { parentId: string | null; docId: string; index: string }[]
): Uint8Array {
  const doc = new Y.Doc();

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

  const binary = Y.encodeStateAsUpdate(doc);
  doc.destroy();
  return binary;
}

export function buildDocPropertiesDoc(
  properties: { id: string; isTemplate?: boolean }[]
): Uint8Array {
  const doc = new Y.Doc();

  for (const prop of properties) {
    const yProp = doc.getMap(prop.id);
    yProp.set("id", prop.id);
    if (prop.isTemplate) yProp.set("isTemplate", true);
  }

  const binary = Y.encodeStateAsUpdate(doc);
  doc.destroy();
  return binary;
}
