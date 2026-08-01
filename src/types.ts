export interface AffineBlock {
  id: string;
  flavour: string;
  children: string[];
  props: Record<string, unknown>;
}

export interface ParsedBlock {
  id: string;
  flavour: string;
  content: string;
  children: ParsedBlock[];
  props: Record<string, unknown>;
}

export interface DocMeta {
  title: string;
  id: string;
  createDate?: string;
  updatedDate?: string;
  trash?: boolean;
  trashDate?: string;
}

export interface FolderNode {
  id: string;
  name: string;
  children: FolderNode[];
  docIds: string[];
}

export interface WorkspaceInfo {
  name: string;
  spaceId: string;
  pages: DocMeta[];
  folders: FolderNode[];
}

export type DeltaOp = {
  insert?: string | Record<string, unknown>;
  attributes?: Record<string, unknown>;
};

export interface BlockSnapshot {
  id: string;
  flavour: string;
  children: BlockSnapshot[];
  text?: string;
  title?: string;
  type?: string;
  checked?: boolean;
  language?: string;
  caption?: string;
  sourceId?: string;
  url?: string;
  videoId?: string;
  pageId?: string;
  latex?: string;
  width?: number;
  height?: number;
  deltas?: DeltaOp[];
}
