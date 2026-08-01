# affine-parse

[فارسی](README-fa.md)

Convert `.affine` backup files into structured Markdown output.

## Prerequisites

- [Bun](https://bun.sh) v1.0+

## Install

```bash
git clone https://github.com/fzlal/affine-parse.git
cd affine-parse
bun install
```

## Usage

```bash
bun run start <path-to-.affine> <output-dir>
```

### Example

```bash
bun run start ./workspace.affine ./output
```

### Compile to Binary

```bash
bun run build
./affine-parse ./workspace.affine ./output
```

## Output Structure

```
output/
└── <workspace-name>/
    ├── index.md                  # Full index with links
    ├── <folder>/                 # Original folders
    │   ├── <subfolder>/
    │   │   └── <doc>.md
    │   └── <doc>.md
    ├── public/                   # Unassigned documents
    │   └── <doc>.md
    ├── templates/                # Templates
    │   └── <doc>.md
    └── trash/                    # Trashed documents
        └── <doc>.md
```

### Categories

| Folder | Description |
|--------|-------------|
| `<folder>/` | Documents organized by original folder structure |
| `public/` | Documents not assigned to any folder |
| `templates/` | Documents marked as templates (`isTemplate: true`) |
| `trash/` | Deleted documents (`trash: true`) |

## Supported Formats

- **Rich text**: bold, italic, strikethrough, inline code
- **Headings**: h1 through h6
- **Lists**: numbered, bulleted, todo lists
- **Code blocks**: with language and caption
- **Images**: blob links
- **Links**: internal and external
- **Tables**: basic markdown tables
- **LaTeX**: math expressions
- **Dividers**: horizontal rules
- **Blockquotes**
- **Bookmarks**: external links
- **YouTube**: embedded iframes
- **Folder structure**: from `db$folders`
- **Templates**: from `db$docProperties`

## How It Works

The `.affine` file is a SQLite database where document content is stored as Yjs CRDT binary data. This tool reads the SQLite file directly and decodes the Yjs binary — no need to run AFFiNE.

## License

MIT
