const MIN_LIGHTNESS = 0.55;

export function readableOnDark(hex: string): string {
  const value = parseInt(hex.slice(1), 16);
  const channels = [(value >> 16) & 255, (value >> 8) & 255, value & 255];
  const lightness = (Math.max(...channels) + Math.min(...channels)) / 2 / 255;
  if (lightness >= MIN_LIGHTNESS) {
    return hex;
  }
  const mix = (MIN_LIGHTNESS - lightness) / (1 - lightness);
  const lifted = channels.map((channel) => Math.round(channel + (255 - channel) * mix));
  return `#${lifted.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}
