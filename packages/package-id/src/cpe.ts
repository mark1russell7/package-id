/**
 * CPE names of the NIST specification (NISTIR 7695): the formatted string of CPE 2.3, for example
 * `cpe:2.3:a:apache:http_server:2.4.62:*:*:*:*:*:*:*`, and the URI of CPE 2.2, for example `cpe:/a:apache:http_server:2.4.62`.
 * The functions read a name, write it as a formatted string and give the product of a name with no version. The match
 * of a CSAF advisory to a device uses them: a vendor gives a CPE when a product has no purl.
 */

/** The part of a CPE name: `a` an application, `o` an operating system, `h` a hardware device, `*` any part. */
export type CpePart = "a" | "o" | "h" | "*";

/**
 * A CPE name. Each attribute is a value of the formatted string, in lower case: `*` is any value, `-` is no value. A
 * special character has a backslash before it, for example `\!`. An unquoted `*` or `?` in a value is a wildcard.
 */
export interface Cpe {
  readonly part: CpePart;
  readonly vendor: string;
  readonly product: string;
  readonly version: string;
  readonly update: string;
  readonly edition: string;
  readonly language: string;
  readonly swEdition: string;
  readonly targetSw: string;
  readonly targetHw: string;
  readonly other: string;
}

/** The attributes of a name, in the order of the formatted string. */
const ATTRIBUTES = ["part", "vendor", "product", "version", "update", "edition", "language", "swEdition", "targetSw", "targetHw", "other"] as const;

/** The characters that a value keeps with no backslash. */
const PLAIN = /^[a-z0-9._-]$/;

/** This function gives the formatted-string form of one character of a value: a special character gets a backslash. */
const quoted = (char: string): string => (PLAIN.test(char) ? char : `\\${char}`);

/**
 * This function gives the canonical form of a value of a formatted string, or `undefined` for a value that is not valid.
 * The form is lower case. A backslash stays only before a special character. Each other special character gets one.
 */
function canonicalValue(value: string): string | undefined {
  const text = value.toLowerCase();
  if (text === "") return undefined;
  if (text === "*" || text === "-") return text;
  let out = "";
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]!;
    if (char === "\\") {
      const next = text[index + 1];
      if (next === undefined) return undefined;
      out += quoted(next);
      index += 1;
    } else if (char === "*" || char === "?") {
      // A wildcard is valid only at the start or the end of a value.
      if (!/^[*?]+$/.test(text.slice(0, index + 1)) && !/^[*?]+$/.test(text.slice(index))) return undefined;
      out += char;
    } else if (char.charCodeAt(0) < 0x21 || char.charCodeAt(0) > 0x7e) {
      return undefined;
    } else {
      out += quoted(char);
    }
  }
  // A value of one quoted hyphen is a hyphen, not "no value".
  return out === "-" ? "\\-" : out;
}

/** This function splits a formatted string at each colon that has no backslash before it. */
function splitFormatted(text: string): readonly string[] {
  const values: string[] = [];
  let current = "";
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]!;
    if (char === "\\" && index + 1 < text.length) {
      current += char + text[index + 1]!;
      index += 1;
    } else if (char === ":") {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current);
  return values;
}

/** This function gives the formatted-string value of one component of a CPE 2.2 URI, or `undefined`. */
function uriValue(component: string): string | undefined {
  if (component === "") return "*";
  if (component === "-") return "-";
  let out = "";
  for (let index = 0; index < component.length; index += 1) {
    const char = component[index]!;
    if (char !== "%") {
      if (!/^[A-Za-z0-9._~-]$/.test(char)) return undefined;
      out += quoted(char.toLowerCase());
      continue;
    }
    const code = component.slice(index + 1, index + 3);
    if (!/^[0-9A-Fa-f]{2}$/.test(code)) return undefined;
    index += 2;
    const value = Number.parseInt(code, 16);
    // The codes %01 and %02 are the wildcards `?` and `*` of a URI.
    if (value === 1) out += "?";
    else if (value === 2) out += "*";
    else if (value < 0x21 || value > 0x7e) return undefined;
    else out += quoted(String.fromCharCode(value).toLowerCase());
  }
  return canonicalValue(out);
}

/** This function gives a name from its values in the order of the formatted string, or `undefined`. */
function cpeOf(values: readonly string[]): Cpe | undefined {
  const canonical = values.map(canonicalValue);
  if (canonical.some((value) => value === undefined)) return undefined;
  const part = canonical[0];
  if (part !== "a" && part !== "o" && part !== "h" && part !== "*") return undefined;
  return Object.fromEntries(ATTRIBUTES.map((name, index) => [name, canonical[index] ?? "*"])) as unknown as Cpe;
}

/** This function reads a CPE 2.2 URI. The packed edition (`~edition~sw_edition~target_sw~target_hw~other`) gives five attributes. */
function parseUri(text: string): Cpe | undefined {
  const components = text.slice("cpe:/".length).split(":");
  if (components.length > 7) return undefined;
  const [part = "", vendor = "", product = "", version = "", update = "", edition = "", language = ""] = components;
  const packed = edition.startsWith("~") ? edition.slice(1).split("~") : undefined;
  if (packed !== undefined && packed.length !== 5) return undefined;
  // The order of the values is the order of the formatted string: the packed attributes come after the language.
  const values = [part, vendor, product, version, update, packed?.[0] ?? edition, language, ...(packed?.slice(1) ?? [])].map(uriValue);
  if (values.some((value) => value === undefined)) return undefined;
  return cpeOf(values as string[]);
}

/**
 * This function reads a CPE name: a formatted string of CPE 2.3 or a URI of CPE 2.2. A formatted string with fewer than
 * eleven attributes gets `*` for each missing attribute. A text that is not a CPE name gives `undefined`.
 */
export function parseCpe(text: string): Cpe | undefined {
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();
  if (lower.startsWith("cpe:/")) return parseUri(trimmed);
  if (!lower.startsWith("cpe:2.3:")) return undefined;
  const values = splitFormatted(trimmed.slice("cpe:2.3:".length));
  if (values.length < 3 || values.length > ATTRIBUTES.length) return undefined;
  return cpeOf(values);
}

/** This function writes a name as a formatted string of CPE 2.3, with each of its eleven attributes. */
export function formatCpe(cpe: Cpe): string {
  return `cpe:2.3:${ATTRIBUTES.map((name) => cpe[name]).join(":")}`;
}

/**
 * This function gives the product of a CPE name: the formatted string with the part, the vendor and the product. Each
 * other attribute is `*`. A name with no vendor or no product, or with a wildcard in them, gives `undefined`.
 */
export function cpeProductOf(text: string): string | undefined {
  const cpe = parseCpe(text);
  if (cpe === undefined) return undefined;
  const specific = (value: string): boolean => value !== "*" && value !== "-" && !/(^|[^\\])[*?]/.test(value);
  if (!specific(cpe.vendor) || !specific(cpe.product)) return undefined;
  return formatCpe({ part: cpe.part, vendor: cpe.vendor, product: cpe.product, version: "*", update: "*", edition: "*", language: "*", swEdition: "*", targetSw: "*", targetHw: "*", other: "*" });
}

/**
 * This function gives the version of a CPE name with no backslashes, for example `2.4.62`. A name with any version, no
 * version or a wildcard in its version gives `undefined`.
 */
export function cpeVersionOf(cpe: Cpe): string | undefined {
  if (cpe.version === "*" || cpe.version === "-" || /(^|[^\\])[*?]/.test(cpe.version)) return undefined;
  return cpe.version.replace(/\\(.)/g, "$1");
}
