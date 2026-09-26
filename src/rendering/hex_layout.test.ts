import { describe, expect, it } from "vitest";
import { hexToWorld, worldToHex } from "./hex_layout.ts";

describe("worldToHex", () => {
  it("inverts hexToWorld, including slightly off-centre points", () => {
    for (let col = 0; col < 9; col++) {
      for (let row = 0; row < 7; row++) {
        const { x, y } = hexToWorld(col, row);
        expect(worldToHex(x, y)).toEqual({ col, row });
        expect(worldToHex(x + 0.6, y - 0.5)).toEqual({ col, row });
      }
    }
  });
});
