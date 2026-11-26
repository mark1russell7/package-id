import { describe, expect, it } from "vitest";
import { formatVers, parseVers, versContains, versEnd, type Vers } from "./vers.ts";

const range = (text: string): Vers => {
  const vers = parseVers(text);
  if (vers === undefined) throw new Error(`not a range: ${text}`);
  return vers;
};

describe("the parse of a range", () => {
  it("gives the scheme and each constraint", () => {
    expect(parseVers("vers:npm/>=1.0.0|<1.2.3")).toEqual({
      scheme: "npm",
      all: false,
      constraints: [
        { comparator: ">=", version: "1.0.0" },
        { comparator: "<", version: "1.2.3" },
      ],
    });
    expect(parseVers("vers:pypi/1.0|!=2.0")?.constraints).toEqual([
      { comparator: "=", version: "1.0" },
      { comparator: "!=", version: "2.0" },
    ]);
    expect(parseVers("vers:NPM/ >= 1.0.0 | < 2.0.0 ")?.scheme).toBe("npm");
    expect(parseVers("vers:npm/*")).toEqual({ scheme: "npm", all: true, constraints: [] });
  });

  it("refuses a text that is not a range", () => {
    expect(parseVers("npm/<1.0.0")).toBeUndefined();
    expect(parseVers("vers:npm/")).toBeUndefined();
    expect(parseVers("vers:npm/<")).toBeUndefined();
    expect(parseVers("vers:npm/<1.0.0||>2.0.0")).toBeUndefined();
  });
});

describe("the format of a range", () => {
  it("sorts the constraints and writes = with no sign", () => {
    expect(formatVers(range("vers:npm/<2.0.0|>=1.0.0"))).toBe("vers:npm/>=1.0.0|<2.0.0");
    expect(formatVers(range("vers:npm/=1.0.0"))).toBe("vers:npm/1.0.0");
    expect(formatVers(range("vers:npm/*"))).toBe("vers:npm/*");
  });

  it("gives the same range after a parse", () => {
    for (const text of ["vers:deb/>=1.0|<1.2|>=2.0|<2.3", "vers:pypi/0.0.1|1.0|2.0rc1", "vers:golang/<v1.2.0"]) {
      expect(formatVers(range(formatVers(range(text))))).toBe(formatVers(range(text)));
    }
  });
});

describe("a version in a range", () => {
  it("follows a range with a lower and an upper end", () => {
    const vers = range("vers:npm/>=1.0.0|<1.2.3");
    expect(versContains(vers, "1.0.0")).toBe(true);
    expect(versContains(vers, "1.1.0")).toBe(true);
    expect(versContains(vers, "1.2.3")).toBe(false);
    expect(versContains(vers, "0.9.0")).toBe(false);
    expect(versContains(vers, "1.2.3-rc.1")).toBe(true);
  });

  it("follows a range with an open end", () => {
    expect(versContains(range("vers:npm/<=1.0.0"), "1.0.0")).toBe(true);
    expect(versContains(range("vers:npm/<=1.0.0"), "1.0.1")).toBe(false);
    expect(versContains(range("vers:npm/>2.0.0"), "2.0.0")).toBe(false);
    expect(versContains(range("vers:npm/>2.0.0"), "3.0.0")).toBe(true);
  });

  it("follows a range of two parts", () => {
    const vers = range("vers:deb/>=1.0|<1.2|>=2.0|<2.3");
    expect(versContains(vers, "1.1")).toBe(true);
    expect(versContains(vers, "1.5")).toBe(false);
    expect(versContains(vers, "2.1")).toBe(true);
    expect(versContains(vers, "3.0")).toBe(false);
  });

  it("follows the constraints = and !=", () => {
    expect(versContains(range("vers:npm/1.0.0|2.0.0"), "2.0.0")).toBe(true);
    expect(versContains(range("vers:npm/1.0.0|2.0.0"), "1.5.0")).toBe(false);
    expect(versContains(range("vers:pypi/<2.0|!=1.5"), "1.5")).toBe(false);
    expect(versContains(range("vers:pypi/<2.0|!=1.5"), "1.4")).toBe(true);
    expect(versContains(range("vers:pypi/!=1.5"), "1.6")).toBe(true);
  });

  it("holds each version for *", () => {
    expect(versContains(range("vers:maven/*"), "anything")).toBe(true);
  });

  it("gives undefined when the order is not known", () => {
    expect(versContains(range("vers:maven/<1.0"), "0.9")).toBeUndefined();
    expect(versContains(range("vers:npm/<1.0.0"), "latest")).toBeUndefined();
    expect(versContains(range("vers:npm/<one"), "0.9.0")).toBeUndefined();
  });
});

describe("the end of the part of a range that holds a version", () => {
  it("gives the next constraint < above the version", () => {
    const vers = range("vers:deb/>=1.0|<1.2|>=2.0|<2.3");
    expect(versEnd(vers, "1.0")).toBe("1.2");
    expect(versEnd(vers, "2.1")).toBe("2.3");
    expect(versEnd(range("vers:npm/<3.16.3"), "3.0.0")).toBe("3.16.3");
  });

  it("gives undefined out of the range, for <=, for an open end and for =", () => {
    const vers = range("vers:deb/>=1.0|<1.2|>=2.0|<2.3");
    expect(versEnd(vers, "1.5")).toBeUndefined();
    expect(versEnd(range("vers:npm/<=1.4.0"), "1.0.0")).toBeUndefined();
    expect(versEnd(range("vers:npm/>=2.0.0"), "3.0.0")).toBeUndefined();
    expect(versEnd(range("vers:npm/1.0.0|2.0.0"), "1.0.0")).toBeUndefined();
    expect(versEnd(range("vers:npm/*"), "1.0.0")).toBeUndefined();
    expect(versEnd(range("vers:maven/<2.0"), "1.0")).toBeUndefined();
  });
});
