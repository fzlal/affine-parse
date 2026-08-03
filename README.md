# affine-parse

[فارسی](README-fa.md)

Convert `.affine` backup files to structured Markdown and back.

## Prerequisites

- [Bun](https://bun.sh) v1.0+

## Install

```bash
git clone https://github.com/fzlal/affine-parse.git
cd affine-parse
bun install
```

## Usage

### Export: .affine → Markdown

```bash
bun run export <path-to-.affine> [output_dir]
```

```bash
bun run export ./workspace.affine ./output
```

### Import: Markdown → .affine

```bash
bun run import <input_dir> <output.affine>
```

```bash
bun run import ./my-docs ./workspace.affine
```

### Compile to Binary

```bash
bun run build
./affine-parse export ./workspace.affine ./output
./affine-parse import ./my-docs ./workspace.affine
```

## Export Output Structure

```
output/
└── <workspace-name>/
    ├── index.md                  # Full index with links
    ├── <folder>/                 # Original folders
    │   └── <doc>.md
    ├── public/                   # Unassigned documents
    │   └── <doc>.md
    ├── templates/                # Templates
    │   └── <doc>.md
    └── trash/                    # Trashed documents
        └── <doc>.md
```

## Import Input Structure

```
my-docs/
├── page1.md                     # Each .md file becomes a page
├── page2.md
└── subfolder/
    ├── page3.md                 # Nested folders are preserved as title prefix
    └── image.png                # Images are imported as blobs
```

## Supported Formats

| Feature | Export | Import |
|---------|--------|--------|
| Headings (h1-h6) | ✅ | ✅ |
| Bold, Italic, Strike | ✅ | ✅ |
| Code blocks | ✅ | ✅ |
| Bullet lists | ✅ | ✅ |
| Numbered lists | ✅ | ✅ |
| Todo lists | ✅ | ✅ |
| Blockquotes | ✅ | ✅ |
| Dividers | ✅ | ✅ |
| Images (blob) | ✅ | ✅ |
| Links | ✅ | ✅ |
| Tables | ✅ | ✅ |
| LaTeX | ✅ | ✅ |
| Bookmarks | ✅ | ✅ |
| Folder structure | ✅ | via title prefix |
| Templates | ✅ | via folder name |

## How It Works

### Export

The `.affine` file is a SQLite database with Yjs CRDT binary data. This tool reads the SQLite file directly and decodes the Yjs binary — no need to run AFFiNE.

### Import

Markdown files are parsed with [remark](https://github.com/remarkjs/remark) into an AST, then converted to AFFiNE block types and serialized as Yjs binary. The output `.affine` file follows the v2 schema and can be imported into AFFiNE.

## License

MIT
