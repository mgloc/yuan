export const Highlight = {
  Selected: "Selected",
  Target: "Target",
  Adjacent: "Adjacent",
  Connected: "Connected",
  Unplayable: "Unplayable",
} as const;

export type Highlight = (typeof Highlight)[keyof typeof Highlight];

export const HIGHLIGHT_PRIORITY: readonly Highlight[] = [
  Highlight.Selected,
  Highlight.Target,
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

export const HIGHLIGHT_STYLES: Record<Highlight, HighlightStyle> = {
  [Highlight.Selected]: { color: ACCENT, thickness: 0.2, opacity: 1, segmented: false, lift: 0.25 },
  [Highlight.Target]: { color: TARGET, thickness: 0.14, opacity: 1, segmented: true, lift: 0.12 },
  [Highlight.Adjacent]: { color: ACCENT, thickness: 0.11, opacity: 1, segmented: false, lift: 0 },
  [Highlight.Connected]: { color: ACCENT, thickness: 0.07, opacity: 0.7, segmented: true, lift: 0 },
  [Highlight.Unplayable]: { color: NEUTRAL, thickness: 0.07, opacity: 1, segmented: false, lift: 0 },
};
