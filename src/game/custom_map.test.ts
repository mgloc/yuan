import { describe, expect, it } from "vitest";
import { Clan } from "../game_types.ts";
import { parseCustomMap } from "./custom_map.ts";

const layout = ["H:Cao    R:Bao    ~", "F:Ju    M:Ge     H:Tov"];

describe("custom maps", () => {
  it("keeps only what the game needs, compacting the layout", () => {
    const map = parseCustomMap({ name: " Mine ", layout, temples: [{ col: 0, row: 0 }], bidding: true, players: 2, editor: { tiles: [] } });
    expect(map).toEqual({ name: "Mine", layout: ["H:Cao R:Bao ~", "F:Ju M:Ge H:Tov"], temples: [{ col: 0, row: 0 }], bidding: true, players: 2 });
  });

  it("treats an empty Capital list as missing", () => {
    expect(parseCustomMap({ layout, capitals: [] })).not.toHaveProperty("capitals");
  });

  it("rejects broken maps", () => {
    expect(parseCustomMap([])).toBe("The map must be a JSON object");
    expect(parseCustomMap({ layout: [] })).toBe("The layout must have 1 to 40 rows");
    expect(parseCustomMap({ layout: ["X"] })).toBe('Unknown terrain symbol "X"');
    expect(parseCustomMap({ layout: ["~ ^"] })).toBe("The map has no Province");
    expect(parseCustomMap({ layout, temples: [{ col: 1, row: 0 }] })).toBe("Temples can only stand on Hills");
    expect(parseCustomMap({ layout, capitals: [{ clan: Clan.Mu, coord: { col: 2, row: 0 } }] })).toBe("Every Capital needs a Clan and a Province");
    const twice = [{ clan: Clan.Mu, coord: { col: 0, row: 0 } }, { clan: Clan.Mu, coord: { col: 1, row: 0 } }];
    expect(parseCustomMap({ layout, capitals: twice })).toBe("Two Capitals share a Clan or a Province");
  });
});
