export const Highlight = {
  Selected: "Selected",
  Target: "Target",
  Effect: "Effect",
  Adjacent: "Adjacent",
  Connected: "Connected",
  Unplayable: "Unplayable",
} as const;

export type Highlight = (typeof Highlight)[keyof typeof Highlight];

export const HIGHLIGHT_PRIORITY: readonly Highlight[] = [
  Highlight.Target,
  Highlight.Selected,
  Highlight.Effect,
  Highlight.Adjacent,
  Highlight.Connected,
  Highlight.Unplayable,
];

export interface HighlightStyle {
  color: number;
  thickness: number;
  opacity: number;
  segmented: boolean;
  lift: number;
}

const ACCENT = 0xffb300;
const NEUTRAL = 0xbbbbbb;
const TARGET = 0xffffff;
const EFFECT = 0x5ad1e6;

export const HIGHLIGHT_STYLES: Record<Highlight, HighlightStyle> = {
  [Highlight.Selected]: { color: ACCENT, thickness: 0.12, opacity: 0.85, segmented: false, lift: 0.12 },
  [Highlight.Target]: { color: TARGET, thickness: 0.14, opacity: 1, segmented: true, lift: 0.12 },
  [Highlight.Effect]: { color: EFFECT, thickness: 0.12, opacity: 1, segmented: true, lift: 0.06 },
  [Highlight.Adjacent]: { color: ACCENT, thickness: 0.06, opacity: 0.55, segmented: false, lift: 0 },
  [Highlight.Connected]: { color: ACCENT, thickness: 0.05, opacity: 0.4, segmented: true, lift: 0 },
  [Highlight.Unplayable]: { color: NEUTRAL, thickness: 0.07, opacity: 1, segmented: false, lift: 0 },
};
