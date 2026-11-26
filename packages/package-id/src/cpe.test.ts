import { describe, expect, it } from "vitest";
import { cpeProductOf, cpeVersionOf, formatCpe, parseCpe, type Cpe } from "./cpe.ts";

const name = (text: string): Cpe => {
  const cpe = parseCpe(text);
  if (cpe === undefined) throw new Error(`not a CPE name: ${text}`);
  return cpe;
};

describe("the formatted string of CPE 2.3", () => {
  it("reads each attribute and writes the name again", () => {
    const cpe = name("cpe:2.3:a:apache:http_server:2.4.62:*:*:*:*:*:*:*");
    expect(cpe).toEqual({ part: "a", vendor: "apache", product: "http_server", version: "2.4.62", update: "*", edition: "*", language: "*", swEdition: "*", targetSw: "*", targetHw: "*", other: "*" });
    expect(formatCpe(cpe)).toBe("cpe:2.3:a:apache:http_server:2.4.62:*:*:*:*:*:*:*");
  });

  it("gives the canonical form: lower case, and a backslash before each special character only", () => {
    expect(formatCpe(name("cpe:2.3:H:Siemens:SIMATIC_S7-1500:-:*:*:*:*:*:*:*"))).toBe("cpe:2.3:h:siemens:simatic_s7-1500:-:*:*:*:*:*:*:*");
    expect(formatCpe(name(String.raw`cpe:2.3:a:acme:tool:1.0\.5`))).toBe("cpe:2.3:a:acme:tool:1.0.5:*:*:*:*:*:*:*");
    expect(formatCpe(name("cpe:2.3:a:example:web!app:1.0"))).toBe(String.raw`cpe:2.3:a:example:web\!app:1.0:*:*:*:*:*:*:*`);
  });

  it("keeps a colon with a backslash in its value, and a quoted hyphen as a value", () => {
    expect(name(String.raw`cpe:2.3:a:example:web:1.0\:beta`).version).toBe(String.raw`1.0\:beta`);
    expect(name(String.raw`cpe:2.3:a:acme:tool:\-`).version).toBe(String.raw`\-`);
  });

  it("gives `*` for each missing attribute after the product", () => {
    expect(name("cpe:2.3:o:acme:os").version).toBe("*");
  });

  it("keeps a wildcard at the start or the end of a value, and refuses one in the middle", () => {
    expect(name("cpe:2.3:a:acme:tool:1.*").version).toBe("1.*");
    expect(name("cpe:2.3:a:acme:tool:??1").version).toBe("??1");
    expect(parseCpe("cpe:2.3:a:acme:to*ol:1.0")).toBeUndefined();
  });

  it("refuses a text that is not a CPE name", () => {
    for (const text of ["not a cpe", "cpe:2.3:x:acme:tool", "cpe:2.3:a:acme", "cpe:2.3:a:acme::1.0", "cpe:2.3:a:acme:tool:1.0\\","cpe:2.3:a:acme:tool:1:2:3:4:5:6:7:8:9"]) {
      expect(parseCpe(text)).toBeUndefined();
    }
  });
});

describe("the URI of CPE 2.2", () => {
  it("reads a URI, with an empty component as any value", () => {
    expect(formatCpe(name("cpe:/a:microsoft:internet_explorer:8.0.6001:beta"))).toBe("cpe:2.3:a:microsoft:internet_explorer:8.0.6001:beta:*:*:*:*:*:*");
    expect(formatCpe(name("cpe:/o:acme::1.0"))).toBe("cpe:2.3:o:acme:*:1.0:*:*:*:*:*:*:*");
  });

  it("reads the packed edition as five attributes", () => {
    expect(formatCpe(name("cpe:/a:hp:insight_diagnostics:7.4.0.1570::~~online~win2003~x64~"))).toBe("cpe:2.3:a:hp:insight_diagnostics:7.4.0.1570:*:*:*:online:win2003:x64:*");
  });

  it("decodes each percent code, with %01 and %02 as the wildcards", () => {
    expect(formatCpe(name("cpe:/a:foo%21bar:baz:1.%02"))).toBe(String.raw`cpe:2.3:a:foo\!bar:baz:1.*:*:*:*:*:*:*:*`);
    expect(parseCpe("cpe:/a:foo bar:baz")).toBeUndefined();
    expect(parseCpe("cpe:/a:acme:tool:1.0::~a~b")).toBeUndefined();
  });
});

describe("the product and the version of a name", () => {
  it("gives the product with `*` for each other attribute", () => {
    expect(cpeProductOf("cpe:2.3:a:apache:http_server:2.4.62:*:*:*:*:*:*:*")).toBe("cpe:2.3:a:apache:http_server:*:*:*:*:*:*:*:*");
    expect(cpeProductOf("cpe:/h:siemens:simatic_s7-1500")).toBe("cpe:2.3:h:siemens:simatic_s7-1500:*:*:*:*:*:*:*:*");
  });

  it("gives no product for a name with any vendor, any product or a wildcard in them", () => {
    expect(cpeProductOf("cpe:2.3:a:*:tool:1.0")).toBeUndefined();
    expect(cpeProductOf("cpe:2.3:a:acme:-:1.0")).toBeUndefined();
    expect(cpeProductOf("cpe:2.3:a:acme:tool*:1.0")).toBeUndefined();
    expect(cpeProductOf("not a cpe")).toBeUndefined();
  });

  it("gives the version with no backslashes, and no version for any value, no value or a wildcard", () => {
    expect(cpeVersionOf(name(String.raw`cpe:2.3:a:example:web:1.0\:beta`))).toBe("1.0:beta");
    expect(cpeVersionOf(name("cpe:2.3:a:acme:tool:*"))).toBeUndefined();
    expect(cpeVersionOf(name("cpe:2.3:a:acme:tool:-"))).toBeUndefined();
    expect(cpeVersionOf(name("cpe:2.3:a:acme:tool:1.*"))).toBeUndefined();
  });
});
