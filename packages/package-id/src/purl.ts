/**
 * Package URLs (purl): parse, format and normalize, as the purl specification tells
 * (`https://github.com/package-url/purl-spec`). The form is `pkg:type/namespace/name@version?qualifiers#subpath`.
 *
 * The functions are plain functions with no fetch and no state.
 */

/** A package URL as its parts. Each text part is decoded: it has no percent-encoding. */
export interface Purl {
  /** The type of the package, in lower case, for example `npm` or `pypi`. */
  readonly type: string;
  /** The namespace, with `/` between its segments, or `undefined` when the purl has no namespace. */
  readonly namespace?: string;
  /** The name of the package. */
  readonly name: string;
  /** The version, or `undefined` when the purl has no version. */
  readonly version?: string;
  /** The qualifiers, with lower-case keys. A qualifier with an empty value is not in the record. */
  readonly qualifiers?: Readonly<Record<string, string>>;
  /** The subpath, with `/` between its segments, or `undefined` when the purl has no subpath. */
  readonly subpath?: string;
}

/** The pattern of a type: a letter first, then letters, digits, `.`, `+` or `-`. */
const TYPE = /^[a-z][a-z0-9.+-]*$/;

/** The pattern of a qualifier key: a letter first, then letters, digits, `.`, `-` or `_`. */
const KEY = /^[a-z][a-z0-9._-]*$/;

/**
 * The types whose namespace and name are not case sensitive. The canonical form of these parts is lower case.
 * The list comes from the type definitions of the purl specification.
 */
const LOWER_NAMESPACE_AND_NAME: ReadonlySet<string> = new Set(["alpm", "apk", "bitbucket", "composer", "deb", "github", "golang", "npm"]);

/** The types whose name only is not case sensitive. The canonical form of the name is lower case. */
const LOWER_NAME: ReadonlySet<string> = new Set(["hex", "pub", "pypi"]);

/** This function percent-encodes one part of a purl. A letter, a digit, `.-_~` and `:` stay as they are. */
function encode(text: string): string {
  return encodeURIComponent(text)
    .replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`)
    .replace(/%3A/g, ":");
}

/** This function decodes one part of a purl, or gives `undefined` for a bad percent-encoding. */
function decode(text: string): string | undefined {
  try {
    return decodeURIComponent(text);
  } catch {
    return undefined;
  }
}

/** This function splits a path into its decoded segments. It discards each empty segment. */
function segments(text: string): string[] | undefined {
  const parts: string[] = [];
  for (const raw of text.split("/")) {
    if (raw === "") continue;
    const part = decode(raw);
    if (part === undefined) return undefined;
    parts.push(part);
  }
  return parts;
}

/**
 * This function gives the canonical parts of a purl. The type and the qualifier keys are in lower case. The parts
 * follow the case rules of the type, and no part is empty.
 * It gives `undefined` when a part breaks a rule of the specification.
 */
export function normalizePurl(purl: Purl): Purl | undefined {
  const type = purl.type.toLowerCase();
  if (!TYPE.test(type)) return undefined;
  const lowerAll = LOWER_NAMESPACE_AND_NAME.has(type);
  const lowerName = lowerAll || LOWER_NAME.has(type);
  let name = lowerName ? purl.name.toLowerCase() : purl.name;
  if (type === "pypi") name = name.replace(/_/g, "-");
  if (name === "") return undefined;
  const space = purl.namespace?.split("/").filter((segment) => segment !== "").join("/");
  const namespace = space === undefined || space === "" ? undefined : lowerAll ? space.toLowerCase() : space;
  if (type === "maven" && namespace === undefined) return undefined;
  const qualifiers: Record<string, string> = {};
  for (const [key, value] of Object.entries(purl.qualifiers ?? {})) {
    const lower = key.toLowerCase();
    if (!KEY.test(lower)) return undefined;
    if (value !== "") qualifiers[lower] = value;
  }
  const subpath = purl.subpath
    ?.split("/")
    .filter((segment) => segment !== "" && segment !== "." && segment !== "..")
    .join("/");
  return {
    type,
    ...(namespace === undefined ? {} : { namespace }),
    name,
    ...(purl.version === undefined || purl.version === "" ? {} : { version: purl.version }),
    ...(Object.keys(qualifiers).length === 0 ? {} : { qualifiers }),
    ...(subpath === undefined || subpath === "" ? {} : { subpath }),
  };
}

/**
 * This function reads a purl text into its parts, as the parse steps of the specification tell, and normalizes them.
 * It gives `undefined` when the text is not a valid purl.
 */
export function parsePurl(text: string): Purl | undefined {
  let rest = text.trim();
  let subpath: string | undefined;
  const hash = rest.indexOf("#");
  if (hash >= 0) {
    const parts = segments(rest.slice(hash + 1));
    if (parts === undefined) return undefined;
    subpath = parts.filter((segment) => segment !== "." && segment !== "..").join("/");
    rest = rest.slice(0, hash);
  }
  let qualifiers: Record<string, string> | undefined;
  const question = rest.indexOf("?");
  if (question >= 0) {
    qualifiers = {};
    for (const pair of rest.slice(question + 1).split("&")) {
      if (pair === "") continue;
      const equal = pair.indexOf("=");
      if (equal <= 0) return undefined;
      const key = pair.slice(0, equal).toLowerCase();
      const value = decode(pair.slice(equal + 1));
      if (value === undefined || key in qualifiers) return undefined;
      qualifiers[key] = value;
    }
    rest = rest.slice(0, question);
  }
  const colon = rest.indexOf(":");
  if (colon < 0 || rest.slice(0, colon).toLowerCase() !== "pkg") return undefined;
  rest = rest.slice(colon + 1).replace(/^\/+/, "");
  const slash = rest.indexOf("/");
  if (slash <= 0) return undefined;
  const type = rest.slice(0, slash);
  rest = rest.slice(slash + 1);
  let version: string | undefined;
  const at = rest.lastIndexOf("@");
  // An npm scope in a purl is `%40`, so a raw `@` starts the version. A raw `@` at the start of the
  // namespace is not a version.
  if (at > 0) {
    version = decode(rest.slice(at + 1));
    if (version === undefined) return undefined;
    rest = rest.slice(0, at);
  }
  const path = segments(rest);
  if (path === undefined || path.length === 0) return undefined;
  const name = path[path.length - 1]!;
  const namespace = path.length > 1 ? path.slice(0, -1).join("/") : undefined;
  return normalizePurl({
    type,
    ...(namespace === undefined ? {} : { namespace }),
    name,
    ...(version === undefined ? {} : { version }),
    ...(qualifiers === undefined ? {} : { qualifiers }),
    ...(subpath === undefined ? {} : { subpath }),
  });
}

/**
 * This function writes the canonical text of a purl: the parts normalized, each part percent-encoded and the
 * qualifiers in the order of their keys. It gives `undefined` when a part breaks a rule of the specification.
 */
export function formatPurl(purl: Purl): string | undefined {
  const canonical = normalizePurl(purl);
  if (canonical === undefined) return undefined;
  let text = `pkg:${canonical.type}/`;
  if (canonical.namespace !== undefined) text += `${canonical.namespace.split("/").map(encode).join("/")}/`;
  text += encode(canonical.name);
  if (canonical.version !== undefined) text += `@${encode(canonical.version)}`;
  const keys = Object.keys(canonical.qualifiers ?? {}).sort();
  // A qualifier value keeps its `/`, as the test suite of the specification does with `repository_url`.
  if (keys.length > 0) text += `?${keys.map((key) => `${key}=${encode(canonical.qualifiers![key]!).replace(/%2F/g, "/")}`).join("&")}`;
  if (canonical.subpath !== undefined) text += `#${canonical.subpath.split("/").map(encode).join("/")}`;
  return text;
}

/**
 * This function gives the canonical purl of the package with no version, no qualifiers and no subpath. A person who
 * names a package with this text names each version of it. It gives `undefined` when the text is not a valid purl.
 */
export function packagePurlOf(text: string): string | undefined {
  const purl = parsePurl(text);
  return purl === undefined ? undefined : formatPurl({ type: purl.type, ...(purl.namespace === undefined ? {} : { namespace: purl.namespace }), name: purl.name });
}
