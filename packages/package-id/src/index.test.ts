import { describe, expect, it } from "vitest";
import { formatPurl, formatVers, normalizePurl, OSV_PURL_TYPES, osvPackagePurl, osvPurl, osvRangeVers, packagePurlOf, parsePurl, versContains } from "./index.ts";

/** This function gives the canonical text of a purl text: a parse, then a format. */
const canonical = (text: string): string | undefined => {
  const purl = parsePurl(text);
  return purl === undefined ? undefined : formatPurl(purl);
};

describe("the parse of a purl", () => {
  it("gives each part, decoded", () => {
    expect(parsePurl("pkg:npm/%40angular/animation@12.3.1")).toEqual({ type: "npm", namespace: "@angular", name: "animation", version: "12.3.1" });
    expect(parsePurl("pkg:deb/debian/curl@7.50.3-1?arch=i386&distro=jessie")).toEqual({
      type: "deb",
      namespace: "debian",
      name: "curl",
      version: "7.50.3-1",
      qualifiers: { arch: "i386", distro: "jessie" },
    });
    expect(parsePurl("pkg:golang/google.golang.org/genproto#googleapis/api/annotations")).toEqual({
      type: "golang",
      namespace: "google.golang.org",
      name: "genproto",
      subpath: "googleapis/api/annotations",
    });
  });

  it("gives undefined for a text that is not a purl", () => {
    expect(parsePurl("EnterpriseLibrary.Common@6.0.1304")).toBeUndefined();
    expect(parsePurl("http:npm/a")).toBeUndefined();
    expect(parsePurl("pkg:npm")).toBeUndefined();
    expect(parsePurl("pkg:maven/@1.3.4")).toBeUndefined();
    expect(parsePurl("pkg:maven/io@1.3.4")).toBeUndefined();
    expect(parsePurl("pkg:npm/a%ZZ")).toBeUndefined();
    expect(parsePurl("pkg:npm/a?x")).toBeUndefined();
    expect(parsePurl("pkg:npm/a?x=1&x=2")).toBeUndefined();
    expect(parsePurl("pkg:9npm/a")).toBeUndefined();
  });
});

describe("the canonical form", () => {
  it("applies the case rules of each type", () => {
    expect(canonical("pkg:PYPI/Django_package@1.11.1.dev1")).toBe("pkg:pypi/django-package@1.11.1.dev1");
    expect(canonical("pkg:GOLANG/google.golang.org/genproto#/googleapis/api/annotations/")).toBe("pkg:golang/google.golang.org/genproto#googleapis/api/annotations");
    expect(canonical("pkg:github/Package-URL/purl-spec@244fd47e07d1004#everybody/loves/dogs")).toBe("pkg:github/package-url/purl-spec@244fd47e07d1004#everybody/loves/dogs");
    expect(canonical("pkg:nuget/EnterpriseLibrary.Common@6.0.1304")).toBe("pkg:nuget/EnterpriseLibrary.Common@6.0.1304");
    expect(canonical("pkg:maven/org.apache.commons/io")).toBe("pkg:maven/org.apache.commons/io");
  });

  it("sorts the qualifiers, puts their keys in lower case and drops an empty value", () => {
    expect(canonical("pkg:gem/jruby-launcher@1.1.2?Platform=java")).toBe("pkg:gem/jruby-launcher@1.1.2?platform=java");
    expect(canonical("pkg:maven/org.apache.xmlgraphics/batik-anim@1.9.1?repositorY_url=repo.spring.io/release&classifier=sources")).toBe(
      "pkg:maven/org.apache.xmlgraphics/batik-anim@1.9.1?classifier=sources&repository_url=repo.spring.io/release",
    );
    expect(canonical("pkg:npm/a?empty=&b=1")).toBe("pkg:npm/a?b=1");
  });

  it("encodes the parts, but not a colon", () => {
    expect(canonical("pkg:docker/customer/dockerimage@sha256%3A244fd47e07d10?repository_url=gcr.io")).toBe(
      "pkg:docker/customer/dockerimage@sha256:244fd47e07d10?repository_url=gcr.io",
    );
    expect(formatPurl({ type: "generic", name: "a b(c)", version: "1+2" })).toBe("pkg:generic/a%20b%28c%29@1%2B2");
  });

  it("drops the segments . and .. of a subpath", () => {
    expect(canonical("pkg:golang/x/y#a/./../b")).toBe("pkg:golang/x/y#a/b");
  });

  it("gives the same text after a second parse", () => {
    for (const text of ["pkg:npm/%40angular/animation@12.3.1", "pkg:pypi/django-package@1.11.1.dev1?a=b#c/d", "pkg:docker/customer/dockerimage@sha256:244fd47e07d10"]) {
      expect(canonical(canonical(text)!)).toBe(canonical(text));
    }
  });

  it("refuses a part that breaks a rule", () => {
    expect(normalizePurl({ type: "npm", name: "" })).toBeUndefined();
    expect(normalizePurl({ type: "npm", name: "a", qualifiers: { "1bad": "x" } })).toBeUndefined();
    expect(formatPurl({ type: "maven", name: "core" })).toBeUndefined();
  });
});

describe("the purl of a package with no version", () => {
  it("drops the version, the qualifiers and the subpath", () => {
    expect(packagePurlOf("pkg:npm/a@1.0.0?arch=x#sub")).toBe("pkg:npm/a");
    expect(packagePurlOf("pkg:npm/%40scope/A@2")).toBe("pkg:npm/%40scope/a");
    expect(packagePurlOf("not a purl")).toBeUndefined();
  });
});

describe("the purl of an OSV package", () => {
  it("gives the purl of each ecosystem with a purl type", () => {
    expect(osvPurl("npm", "@waline/client")).toBe("pkg:npm/%40waline/client");
    expect(osvPurl("PyPI", "Mcp_Diag.Tool")).toBe("pkg:pypi/mcp-diag.tool");
    expect(osvPurl("crates.io", "besk")).toBe("pkg:cargo/besk");
    expect(osvPurl("RubyGems", "rails")).toBe("pkg:gem/rails");
    expect(osvPurl("Maven", "org.example:core")).toBe("pkg:maven/org.example/core");
    expect(osvPurl("Go", "github.com/Foo/Bar")).toBe("pkg:golang/github.com/foo/bar");
    expect(osvPurl("Packagist", "Vendor/Pkg")).toBe("pkg:composer/vendor/pkg");
    expect(osvPurl("GitHub Actions", "actions/checkout")).toBe("pkg:github/actions/checkout");
    expect(osvPurl("Debian:12", "curl")).toBe("pkg:deb/debian/curl");
    expect(osvPurl("Alpine:v3.18", "openssl")).toBe("pkg:apk/alpine/openssl");
  });

  it("gives undefined for an ecosystem with no purl type or a bad name", () => {
    expect(osvPurl("VSCode", "example.theme")).toBeUndefined();
    expect(osvPurl("npm", "")).toBeUndefined();
    expect(osvPurl("Maven", "core")).toBeUndefined();
    expect(Object.keys(OSV_PURL_TYPES)).toContain("crates.io");
  });

  it("takes the purl of the record first, with no version", () => {
    expect(osvPackagePurl({ ecosystem: "npm", name: "a", purl: "pkg:npm/a@1.0.0?arch=x#sub" })).toBe("pkg:npm/a");
    expect(osvPackagePurl({ ecosystem: "npm", name: "b", purl: "bad" })).toBe("pkg:npm/b");
    expect(osvPackagePurl({ ecosystem: "npm", name: "c" })).toBe("pkg:npm/c");
  });
});

describe("the vers range of an OSV range", () => {
  it("sorts the events and gives one constraint for each", () => {
    const vers = osvRangeVers("PyPI", { type: "ECOSYSTEM", events: [{ introduced: "2.0" }, { fixed: "2.3" }, { introduced: "1.0" }, { fixed: "1.2" }] });
    expect(vers === undefined ? undefined : formatVers(vers)).toBe("vers:pypi/>=1.0|<1.2|>=2.0|<2.3");
    expect(versContains(vers!, "1.1")).toBe(true);
    expect(versContains(vers!, "1.5")).toBe(false);
  });

  it("gives no constraint for introduced 0, and <= for last_affected", () => {
    const fixed = osvRangeVers("npm", { type: "SEMVER", events: [{ introduced: "0" }, { fixed: "3.16.3" }] });
    expect(fixed === undefined ? undefined : formatVers(fixed)).toBe("vers:semver/<3.16.3");
    const last = osvRangeVers("Go", { type: "SEMVER", events: [{ introduced: "0" }, { last_affected: "1.4.0" }] });
    expect(last === undefined ? undefined : formatVers(last)).toBe("vers:semver/<=1.4.0");
    expect(osvRangeVers("npm", { type: "SEMVER", events: [{ introduced: "0" }] })).toEqual({ scheme: "semver", all: true, constraints: [] });
    expect(osvRangeVers("npm", { type: "SEMVER", events: [{ introduced: "0" }, { limit: "*" }] })?.all).toBe(true);
  });

  it("uses the purl type of the ecosystem for a range of the type ECOSYSTEM", () => {
    expect(osvRangeVers("Debian:12", { type: "ECOSYSTEM", events: [{ introduced: "0" }, { fixed: "7.88.1-10+deb12u5" }] })?.scheme).toBe("deb");
    expect(osvRangeVers("Maven", { type: "ECOSYSTEM", events: [{ introduced: "2.0" }, { fixed: "1.5" }] })?.constraints.map((c) => c.version)).toEqual(["2.0", "1.5"]);
  });

  it("gives undefined for a GIT range, an unknown ecosystem or an empty event", () => {
    expect(osvRangeVers("npm", { type: "GIT", events: [{ introduced: "abc123" }] })).toBeUndefined();
    expect(osvRangeVers("constructor", { type: "ECOSYSTEM", events: [{ fixed: "1.0" }] })).toBeUndefined();
    expect(osvRangeVers("npm", { type: "SEMVER", events: [{}] })).toBeUndefined();
    expect(osvPurl("constructor", "x")).toBeUndefined();
  });
});
