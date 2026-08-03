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
      yBlock.set("sys:version", 2);

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

export function buildRootYDoc(
  workspaceId: string,
  workspaceName: string,
  pages: { id: string; title: string }[]
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
      pagesArr.push([pageEntry]);
    }
    meta.set("pages", pagesArr);
  });

  const binary = Y.encodeStateAsUpdate(doc);
  doc.destroy();
  return binary;
}
