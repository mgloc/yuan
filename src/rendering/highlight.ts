export const Highlight = {
  Selected: "Selected",
  Adjacent: "Adjacent",
  Connected: "Connected",
  Unplayable: "Unplayable",
} as const;

export type Highlight = (typeof Highlight)[keyof typeof Highlight];

export const HIGHLIGHT_COLORS: Record<Highlight, number> = {
  [Highlight.Selected]: 0x2ecc40,
  [Highlight.Adjacent]: 0xffdc00,
  [Highlight.Connected]: 0x0074d9,
  [Highlight.Unplayable]: 0xbbbbbb,
};
