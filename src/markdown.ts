import type { ParsedBlock, DeltaOp } from "./types";

function deltaToMarkdown(deltas: DeltaOp[]): string {
  if (!deltas || deltas.length === 0) return "";

  let result = "";
  const stack: { open: string; close: string }[] = [];

  for (const op of deltas) {
    if (op.insert && typeof op.insert === "object" && !(typeof op.insert === "string")) {
      const embed = op.insert as Record<string, unknown>;
      if (embed.image) {
        result += `![](${String(embed.image)})`;
      } else if (embed.video) {
        result += `[Video](${String(embed.video)})`;
      } else if (embed.thematic_break) {
        result += "\n---\n";
      }
      continue;
    }

    if (typeof op.insert !== "string") continue;

    let text = op.insert as string;
    const attrs = op.attributes || {};

    if (attrs.bold) text = `**${text}**`;
    if (attrs.italic) text = `_${text}_`;
    if (attrs.strike) text = `~~${text}~~`;
    if (attrs.code) text = `\`${text}\``;
    if (attrs.link) text = `[${text}](${attrs.link})`;
    if (attrs.reference) {
      const ref = attrs.reference as Record<string, unknown>;
      const pageId = ref.pageId || ref.id || "";
      text = `[${text}](doc://${String(pageId)})`;
    }

    result += text;
  }

  return result;
}

function renderChildren(children: ParsedBlock[], indent: string, listIndex: number = 0): string {
  let idx = listIndex;
  return children.map((c) => {
    if (c.flavour === "affine:list" && c.type === "numbered") {
      const result = renderBlock(c, indent, idx);
      idx++;
      return result;
    }
    return renderBlock(c, indent);
  }).join("");
}

export function renderBlock(block: ParsedBlock, indent: string = "", listIndex: number = 0): string {
  const { flavour, children } = block;
  const inner = (s: string) => (s ? indent + s + "\n" : "");

  switch (flavour) {
    case "affine:page":
      return renderChildren(children, indent);

    case "affine:note":
      return renderChildren(children, indent);

    case "affine:paragraph": {
      const type = block.type || "text";
      const text = block.deltas?.length
        ? deltaToMarkdown(block.deltas)
        : block.content;
      switch (type) {
        case "h1": return inner(`# ${text}`);
        case "h2": return inner(`## ${text}`);
        case "h3": return inner(`### ${text}`);
        case "h4": return inner(`#### ${text}`);
        case "h5": return inner(`##### ${text}`);
        case "h6": return inner(`###### ${text}`);
        case "quote": return inner(`> ${text}`);
        default: return inner(text);
      }
    }

    case "affine:list": {
      const type = block.type || "bulleted";
      const text = block.deltas?.length
        ? deltaToMarkdown(block.deltas)
        : block.content;
      switch (type) {
        case "bulleted": return inner(`* ${text}`) + renderChildren(children, indent);
        case "numbered": return inner(`${listIndex + 1}. ${text}`) + renderChildren(children, indent, 0);
        case "todo": {
          const check = block.checked ? "[x]" : "[ ]";
          return inner(`- ${check} ${text}`) + renderChildren(children, indent);
        }
        default: return inner(`- ${text}`) + renderChildren(children, indent);
      }
    }

    case "affine:code": {
      const lang = block.language || "";
      const caption = block.caption ? ` ${block.caption}` : "";
      const text = block.content || "";
      return inner("```" + lang + caption) + inner(text) + inner("```");
    }

    case "affine:image": {
      const src = block.sourceId ? `blob://${block.sourceId}` : "";
      const caption = block.caption || block.sourceId || "image";
      return inner(`![${caption}](${src})`);
    }

    case "affine:attachment": {
      const name = block.caption || block.sourceId || "attachment";
      return inner(`[Attachment: ${name}]`);
    }

    case "affine:divider":
      return inner("---");

    case "affine:bookmark":
      return inner(`[](Bookmark,${block.url || ""})`);

    case "affine:embed-youtube":
      return "";

    case "affine:embed-linked-doc":
      return "";
    case "affine:embed-synced-doc":
      return "";

    case "affine:latex":
      return inner(`$$${block.latex || block.content}$$`);

    case "affine:database":
    case "affine:table":
    case "affine:surface":
    case "affine:frame":
      return renderChildren(children, indent);

    case "affine:embed":
      return renderChildren(children, indent);

    default:
      return renderChildren(children, indent);
  }
}

export function docToMarkdown(root: ParsedBlock): string {
  const parts: string[] = [];

  if (root.title) {
    parts.push(`# ${root.title}\n`);
  }

  parts.push(renderBlock(root));
  return parts.join("\n");
}
