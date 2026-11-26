import { describe, expect, it } from "vitest";
import { compareDebian, compareGo, comparePep440, compareRpm, compareSemver, compareVersions, versionScheme } from "./version.ts";

/** This function tells that each version of a list comes before the next one, and that each version equals itself. */
function ascending(compare: (a: string, b: string) => number | undefined, versions: readonly string[]): void {
  for (let i = 0; i < versions.length; i++) {
    expect(compare(versions[i]!, versions[i]!), versions[i]).toBe(0);
    for (let j = i + 1; j < versions.length; j++) {
      expect(Math.sign(compare(versions[i]!, versions[j]!)!), `${versions[i]} < ${versions[j]}`).toBe(-1);
      expect(Math.sign(compare(versions[j]!, versions[i]!)!), `${versions[j]} > ${versions[i]}`).toBe(1);
    }
  }
}

describe("the order of SemVer", () => {
  it("follows the example of the specification", () => {
    ascending(compareSemver, [
      "1.0.0-alpha",
      "1.0.0-alpha.1",
      "1.0.0-alpha.beta",
      "1.0.0-beta",
      "1.0.0-beta.2",
      "1.0.0-beta.11",
      "1.0.0-rc.1",
      "1.0.0",
      "2.0.0",
      "2.1.0",
      "2.1.1",
      "10.0.0",
    ]);
  });

  it("does not use the build metadata, and allows a leading v", () => {
    expect(compareSemver("1.0.0+a", "1.0.0+b")).toBe(0);
    expect(compareSemver("v1.2.3", "1.2.3")).toBe(0);
  });

  it("gives undefined for a text that is not a version", () => {
    expect(compareSemver("1.0", "1.0.0")).toBeUndefined();
    expect(compareSemver("01.0.0", "1.0.0")).toBeUndefined();
    expect(compareSemver("latest", "1.0.0")).toBeUndefined();
  });
});

describe("the order of Go modules", () => {
  it("puts a pseudo-version before the release", () => {
    ascending(compareGo, ["v0.0.0-20191109021931-daa7c04131f5", "v0.1.0", "v1.0.0", "v2.0.0"]);
    expect(compareGo("v2.0.0+incompatible", "v2.0.0")).toBe(0);
  });

  it("refuses a version with no v", () => {
    expect(compareGo("1.0.0", "v1.0.0")).toBeUndefined();
  });
});

describe("the order of PEP 440", () => {
  it("follows the example of the specification", () => {
    ascending(comparePep440, [
      "1.dev0",
      "1.0.dev456",
      "1.0a1",
      "1.0a2.dev456",
      "1.0a12.dev456",
      "1.0a12",
      "1.0b1.dev456",
      "1.0b2",
      "1.0b2.post345.dev456",
      "1.0b2.post345",
      "1.0rc1.dev456",
      "1.0rc1",
      "1.0",
      "1.0+abc.5",
      "1.0+abc.7",
      "1.0+5",
      "1.0.post456.dev34",
      "1.0.post456",
      "1.0.15",
      "1.1.dev1",
    ]);
  });

  it("normalizes the other spellings", () => {
    expect(comparePep440("1.0RC1", "1.0rc1")).toBe(0);
    expect(comparePep440("1.0alpha1", "1.0a1")).toBe(0);
    expect(comparePep440("1.0c1", "1.0rc1")).toBe(0);
    expect(comparePep440("1.0-1", "1.0.post1")).toBe(0);
    expect(comparePep440("1.0.0", "1.0")).toBe(0);
    expect(comparePep440("v1.0", "1.0")).toBe(0);
  });

  it("puts the epoch first", () => {
    expect(comparePep440("1!1.0", "2.0")).toBe(1);
  });

  it("gives undefined for a text that is not a version", () => {
    expect(comparePep440("1.0-beta-x", "1.0")).toBeUndefined();
  });
});

describe("the order of Debian", () => {
  it("follows the tilde rule of the Debian policy", () => {
    ascending(compareDebian, ["1.0~~", "1.0~~a", "1.0~", "1.0", "1.0a", "1.0+b1"]);
  });

  it("compares the epoch, the upstream version and the revision", () => {
    ascending(compareDebian, ["1.0-1", "1.0-2", "1.0-9", "1.0-10", "2:0.1"]);
    expect(compareDebian("1:0.1", "2.0")).toBe(1);
    expect(compareDebian("7.50.3-1", "7.50.3-1+deb9u1")).toBe(-1);
    expect(compareDebian("0:1.0", "1.0")).toBe(0);
    expect(compareDebian("1.2-3-4", "1.2-3-5")).toBe(-1);
  });

  it("gives undefined for a text that is not a version", () => {
    expect(compareDebian("abc", "1.0")).toBeUndefined();
  });
});

describe("the order of RPM", () => {
  it("follows the cases of rpmvercmp", () => {
    expect(compareRpm("1.0", "1.0")).toBe(0);
    expect(compareRpm("1.0", "2.0")).toBe(-1);
    expect(compareRpm("2.0.1", "2.0")).toBe(1);
    expect(compareRpm("1.0a", "1.0")).toBe(1);
    expect(compareRpm("1.0", "1.0.0")).toBe(-1);
    expect(compareRpm("1.0~rc1", "1.0")).toBe(-1);
    expect(compareRpm("1.0^", "1.0")).toBe(1);
    expect(compareRpm("1.0^git1", "1.0.1")).toBe(-1);
    expect(compareRpm("a", "1")).toBe(-1);
    expect(compareRpm("fc4", "fc.4")).toBe(0);
    expect(compareRpm("1.010", "1.9")).toBe(1);
  });

  it("compares the epoch and the release", () => {
    expect(compareRpm("1:1.0-1", "2.0-1")).toBe(1);
    expect(compareRpm("1.0-1.el8", "1.0-2.el8")).toBe(-1);
    expect(compareRpm("1.0", "1.0-1")).toBe(-1);
  });
});

describe("the scheme of a purl type", () => {
  it("gives the scheme of each known type, and undefined for the others", () => {
    expect(versionScheme("npm")).toBe("semver");
    expect(versionScheme("PyPI")).toBe("pypi");
    expect(versionScheme("golang")).toBe("golang");
    expect(versionScheme("maven")).toBeUndefined();
    expect(versionScheme("constructor")).toBeUndefined();
    expect(compareVersions("maven", "1", "2")).toBeUndefined();
    expect(compareVersions("npm", "1.0.0", "1.0.1")).toBe(-1);
  });
});
