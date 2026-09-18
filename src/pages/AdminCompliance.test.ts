import { describe, it, expect } from "vitest";
import { arrToText, textToArr } from "./AdminCompliance";

describe("arrToText / textToArr", () => {
  it("round-trips a simple list", () => {
    const arr = ["Use the applicable disclosure setting.", "Publish the content.", "Submit the URL."];
    expect(textToArr(arrToText(arr))).toEqual(arr);
  });

  it("drops blank lines and trims whitespace on the way back to an array", () => {
    const text = "  First item  \n\n  Second item\n   \nThird item";
    expect(textToArr(text)).toEqual(["First item", "Second item", "Third item"]);
  });

  it("produces an empty array from empty or whitespace-only text", () => {
    expect(textToArr("")).toEqual([]);
    expect(textToArr("   \n  \n")).toEqual([]);
  });

  it("produces empty text from an empty array", () => {
    expect(arrToText([])).toBe("");
  });
});
