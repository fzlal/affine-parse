import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import type { Root, Content } from "mdast";

export interface AffineBlockDef {
  id: string;
  flavour: string;
  type?: string;
  text?: string;
  children: string[];
  props: Record<string, unknown>;
}

let blockCounter = 0;

function genId(): string {
  blockCounter++;
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  for (let i = 0; i < 10; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

function resetCounter() {
  blockCounter = 0;
}

function extractText(node: any): string {
  if (!node) return "";
  if (node.type === "text") return node.value || "";
  if (node.type === "inlineCode") return node.value || "";
  if (node.type === "strong") return `**${extractChildren(node)}**`;
  if (node.type === "emphasis") return `_${extractChildren(node)}_`;
  if (node.type === "delete") return `~~${extractChildren(node)}~~`;
  if (node.type === "link") return `[${extractChildren(node)}](${node.url || ""})`;
  if (node.type === "image") return `![${node.alt || ""}](${node.url || ""})`;
  if (node.children) return extractChildren(node);
  return "";
}

function extractChildren(node: any): string {
  if (!node.children) return "";
  return node.children.map((c: any) => extractText(c)).join("");
}

function parseInline(text: string): string {
  return text;
}

function createBlock(flavour: string, props: Record<string, unknown> = {}): AffineBlockDef {
  return {
    id: genId(),
    flavour,
    children: [],
    props,
  };
}

function parseNode(node: any, blocks: AffineBlockDef[]): AffineBlockDef | null {
  switch (node.type) {
    case "heading": {
      const level = node.depth || 1;
      const text = extractChildren(node);
      const para = createBlock("affine:paragraph", {
        type: `h${level}`,
        text,
      });
      return para;
    }

    case "paragraph": {
      const text = extractChildren(node);
      const para = createBlock("affine:paragraph", {
        type: "text",
        text,
      });
      return para;
    }

    case "list": {
      const ordered = node.ordered || false;
      const start = node.start || 1;
      const type = ordered ? "numbered" : "bulleted";

      const listBlock = createBlock("affine:list", { type });

      const childIds: string[] = [];
      for (const child of node.children || []) {
        const itemBlock = parseListItem(child, blocks, ordered);
        if (itemBlock) {
          blocks.push(itemBlock);
          childIds.push(itemBlock.id);
        }
      }
      listBlock.children = childIds;
      return listBlock;
    }

    case "code": {
      const lang = node.lang || "";
      const text = node.value || "";
      const meta = node.meta || "";
      return createBlock("affine:code", {
        language: lang,
        text,
        caption: meta,
      });
    }

    case "blockquote": {
      const note = createBlock("affine:note", {});
      const childIds: string[] = [];
      for (const child of node.children || []) {
        const parsed = parseNode(child, blocks);
        if (parsed) {
          blocks.push(parsed);
          childIds.push(parsed.id);
        }
      }
      note.children = childIds;
      return note;
    }

    case "thematicBreak": {
      return createBlock("affine:divider");
    }

    case "image": {
      const url = node.url || "";
      const alt = node.alt || "";
      const isBlob = url.startsWith("blob://") || url.startsWith("data:");
      if (isBlob) {
        const key = url.replace("blob://", "").replace("data:", "");
        return createBlock("affine:image", {
          sourceId: key,
          caption: alt,
        });
      }
      return createBlock("affine:bookmark", { url, caption: alt });
    }

    case "table": {
      return parseTable(node, blocks);
    }

    case "html": {
      const value = node.value || "";
      if (value.includes("<iframe") && value.includes("youtube")) {
        const match = value.match(/src="([^"]+)"/);
        if (match) {
          const url = match[1];
          const videoIdMatch = url.match(/embed\/([^?&]+)/);
          if (videoIdMatch) {
            return createBlock("affine:embed-youtube", {
              videoId: videoIdMatch[1],
              url: `https://www.youtube.com/watch?v=${videoIdMatch[1]}`,
            });
          }
        }
      }
      return createBlock("affine:paragraph", { type: "text", text: value });
    }

    case "link": {
      const text = extractChildren(node);
      const url = node.url || "";
      return createBlock("affine:paragraph", {
        type: "text",
        text: `[${text}](${url})`,
      });
    }

    case "yaml": {
      return null;
    }

    default: {
      if (node.children) {
        const note = createBlock("affine:note", {});
        const childIds: string[] = [];
        for (const child of node.children) {
          const parsed = parseNode(child, blocks);
          if (parsed) {
            blocks.push(parsed);
            childIds.push(parsed.id);
          }
        }
        note.children = childIds;
        return note;
      }
      return null;
    }
  }
}

function parseListItem(
  node: any,
  blocks: AffineBlockDef[],
  _ordered: boolean
): AffineBlockDef | null {
  if (!node || node.type !== "listItem") return null;

  const checked = node.checked;
  const type = checked !== null && checked !== undefined ? "todo" : undefined;

  const textParts: string[] = [];
  const childIds: string[] = [];

  for (const child of node.children || []) {
    if (child.type === "paragraph") {
      textParts.push(extractChildren(child));
    } else {
      const parsed = parseNode(child, blocks);
      if (parsed) {
        blocks.push(parsed);
        childIds.push(parsed.id);
      }
    }
  }

  const listBlock = createBlock("affine:list", {
    type: type || undefined,
    checked: checked || false,
    text: textParts.join(" "),
  });
  listBlock.children = childIds;
  return listBlock;
}

function parseTable(node: any, blocks: AffineBlockDef[]): AffineBlockDef {
  const tableBlock = createBlock("affine:table", {});

  const rows = node.children || [];
  const childIds: string[] = [];

  for (const row of rows) {
    if (row.type !== "tableRow") continue;
    const rowBlock = createBlock("affine:paragraph", { type: "text", text: "" });
    const cellTexts: string[] = [];

    for (const cell of row.children || []) {
      if (cell.type === "tableCell" || cell.type === "tableCell") {
        const text = extractChildren(cell);
        cellTexts.push(text);
      }
    }

    rowBlock.props.text = cellTexts.join(" | ");
    blocks.push(rowBlock);
    childIds.push(rowBlock.id);
  }

  tableBlock.children = childIds;
  return tableBlock;
}

export interface ParseResult {
  title: string;
  blocks: AffineBlockDef[];
  rootBlockId: string;
  images: { key: string; filePath: string }[];
}

export function parseMarkdown(
  content: string,
  title?: string
): ParseResult {
  resetCounter();

  const processor = unified().use(remarkParse).use(remarkGfm);
  const ast = processor.parse(content) as Root;

  const blocks: AffineBlockDef[] = [];
  const images: { key: string; filePath: string }[] = [];

  const firstHeading = ast.children.find(
    (c: any) => c.type === "heading" && c.depth === 1
  );
  const docTitle = title || (firstHeading ? extractChildren(firstHeading) : "Untitled");

  const noteBlock = createBlock("affine:note", {});
  const childIds: string[] = [];

  let skipFirstH1 = !title;
  for (const node of ast.children) {
    if (skipFirstH1 && node.type === "heading" && (node as any).depth === 1) {
      skipFirstH1 = false;
      continue;
    }
    const parsed = parseNode(node, blocks);
    if (parsed) {
      blocks.push(parsed);
      childIds.push(parsed.id);
    }
  }

  noteBlock.children = childIds;
  blocks.unshift(noteBlock);

  const pageBlock = createBlock("affine:page", {
    title: docTitle,
  });
  pageBlock.children = [noteBlock.id];
  blocks.unshift(pageBlock);

  for (const block of blocks) {
    const src = block.props.sourceId;
    if (typeof src === "string" && src.startsWith("blob://")) {
      const key = src.replace("blob://", "");
      images.push({ key, filePath: key });
    }
  }

  return {
    title: docTitle,
    blocks,
    rootBlockId: pageBlock.id,
    images,
  };
}
