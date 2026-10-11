import { describe, expect, it } from "vitest";
import { insertionIndex } from "./drag";

const cards = [{ top: 0, bottom: 100 }, { top: 110, bottom: 210 }, { top: 220, bottom: 320 }];

describe("insertionIndex", () => {
  it("inserts before a card when the cursor is in its upper half", () => {
    expect(insertionIndex(cards, 10)).toBe(0);
    expect(insertionIndex(cards, 120)).toBe(1);
  });

  it("inserts after a card when the cursor is in its lower half", () => {
    expect(insertionIndex(cards, 90)).toBe(1);
    expect(insertionIndex(cards, 300)).toBe(3);
    expect(insertionIndex(cards, 9999)).toBe(3);
  });

  it("appends to an empty list", () => {
    expect(insertionIndex([], 50)).toBe(0);
  });
});
