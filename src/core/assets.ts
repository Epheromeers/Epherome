export interface AssetIndex {
  objects: Record<string, { hash: string; size: number }>;
}
