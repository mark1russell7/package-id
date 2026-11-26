import { describe, expect, it } from "vitest";
import { modelNumberMatches } from "./model.ts";

describe("the model numbers of CSAF", () => {
  it("matches a full model number and refuses another", () => {
    expect(modelNumberMatches("6ES7212-1AE40-0XB0", "6ES7212-1AE40-0XB0")).toBe(true);
    expect(modelNumberMatches("6ES7212-1AE40-0XB0", "6ES7212-1AE40-0XB1")).toBe(false);
    expect(modelNumberMatches("6es7212-1ae40-0xb0", "6ES7212-1AE40-0XB0")).toBe(false);
  });

  it("gives `?` one character and `*` zero or more characters", () => {
    expect(modelNumberMatches("6ES7212-1?E40-0XB0", "6ES7212-1BE40-0XB0")).toBe(true);
    expect(modelNumberMatches("6ES7212-1?E40-0XB0", "6ES7212-1E40-0XB0")).toBe(false);
    expect(modelNumberMatches("6ES7212-*", "6ES7212-")).toBe(true);
    expect(modelNumberMatches("6ES7*-0XB0", "6ES7212-1AE40-0XB0")).toBe(true);
    expect(modelNumberMatches("*a*b*", "xaxxbx")).toBe(true);
    expect(modelNumberMatches("*a*b", "xaxxbx")).toBe(false);
    expect(modelNumberMatches("**", "")).toBe(true);
  });

  it("reads a backslash before a wildcard as a literal character", () => {
    expect(modelNumberMatches("AB\\*1", "AB*1")).toBe(true);
    expect(modelNumberMatches("AB\\*1", "ABC1")).toBe(false);
    expect(modelNumberMatches("AB\\?", "AB?")).toBe(true);
    expect(modelNumberMatches("AB\\?", "ABC")).toBe(false);
    expect(modelNumberMatches("AB\\\\", "AB\\")).toBe(true);
    expect(modelNumberMatches("AB\\", "AB\\")).toBe(true);
    expect(modelNumberMatches("A\\B", "A\\B")).toBe(true);
    expect(modelNumberMatches("A\\B", "AB")).toBe(false);
  });

  it("matches nothing with an empty pattern, and reads each code point as one character", () => {
    expect(modelNumberMatches("", "")).toBe(false);
    expect(modelNumberMatches("?", "")).toBe(false);
    expect(modelNumberMatches("X?", "X\u{1F600}")).toBe(true);
  });

  it("ends in a short time for a long pattern with many stars", () => {
    expect(modelNumberMatches(`${"*a".repeat(200)}b`, "a".repeat(5000))).toBe(false);
  });
});
