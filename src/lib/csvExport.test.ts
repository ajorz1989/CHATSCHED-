import { describe, it, expect } from "vitest";
import { rowsToCsv, dateStampedFilename } from "./csvExport";

describe("rowsToCsv", () => {
  it("returns an empty string for no rows", () => {
    expect(rowsToCsv([])).toBe("");
  });

  it("writes a header row from the first object's keys, then one line per row", () => {
    const csv = rowsToCsv([{ Name: "Alice", Age: 30 }, { Name: "Bob", Age: 25 }]);
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe("Name,Age");
    expect(lines[1]).toBe("Alice,30");
    expect(lines[2]).toBe("Bob,25");
  });

  it("quotes a field containing a comma", () => {
    const csv = rowsToCsv([{ Note: "Cape Town, Western Cape" }]);
    expect(csv).toContain('"Cape Town, Western Cape"');
  });

  it("quotes and escapes a field containing a double quote", () => {
    const csv = rowsToCsv([{ Note: 'She said "hello"' }]);
    expect(csv).toContain('"She said ""hello"""');
  });

  it("quotes a field containing a newline", () => {
    const csv = rowsToCsv([{ Note: "Line one\nLine two" }]);
    expect(csv).toContain('"Line one\nLine two"');
  });

  it("renders null and undefined as empty cells, not the literal words", () => {
    const csv = rowsToCsv([{ A: null, B: undefined, C: "value" }]);
    const lines = csv.split("\r\n");
    expect(lines[1]).toBe(",,value");
  });

  it("leaves a plain field with no special characters unquoted", () => {
    const csv = rowsToCsv([{ Status: "active" }]);
    expect(csv).toBe("Status\r\nactive");
  });
});

describe("dateStampedFilename", () => {
  it("produces a chatsched-prefixed, date-stamped .csv filename", () => {
    const name = dateStampedFilename("requests");
    expect(name).toMatch(/^chatsched-requests-\d{4}-\d{2}-\d{2}\.csv$/);
  });
});
