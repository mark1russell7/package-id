/**
 * Version ranges in the `vers` format of the purl specification, for example `vers:npm/>=1.0.0|<1.2.3`. The functions
 * parse a range, format it and tell if a version is in it, with the version order of the scheme.
 */
import { compareVersions } from "./version.ts";

/** The comparators of a `vers` constraint. */
export type VersComparator = "=" | "!=" | "<" | "<=" | ">" | ">=";

/** One constraint of a range: a comparator and a version. */
export interface VersConstraint {
  readonly comparator: VersComparator;
  readonly version: string;
}

/** A version range. A range with the constraint `*` holds each version, and its list of constraints is empty. */
export interface Vers {
  /** The version scheme, for example `npm`, `pypi` or `deb`. */
  readonly scheme: string;
  /** True: the range is `*`, so it holds each version. */
  readonly all: boolean;
  readonly constraints: readonly VersConstraint[];
}

// The longer comparators come first, so `<=` is not read as `<` and a version that starts with `=`.
const COMPARATORS: readonly VersComparator[] = ["!=", "<=", ">=", "<", ">", "="];

/** This function reads one constraint, for example `>=1.0.0`. A constraint with no comparator has the comparator `=`. */
function parseConstraint(text: string): VersConstraint | undefined {
  const trimmed = text.trim();
  const comparator = COMPARATORS.find((c) => trimmed.startsWith(c)) ?? "=";
  const raw = trimmed.slice(trimmed.startsWith(comparator) ? comparator.length : 0).trim();
  if (raw === "") return undefined;
  let version: string;
  try {
    version = decodeURIComponent(raw);
  } catch {
    return undefined;
  }
  return { comparator, version };
}

/** This function reads a `vers` text. A text that is not a range gives `undefined`. */
export function parseVers(text: string): Vers | undefined {
  const match = /^vers:([A-Za-z0-9.+-]+)\/(.+)$/.exec(text.replace(/\s+/g, ""));
  if (match === null) return undefined;
  const scheme = match[1]!.toLowerCase();
  const body = match[2]!;
  if (body === "*") return { scheme, all: true, constraints: [] };
  const constraints: VersConstraint[] = [];
  for (const part of body.split("|")) {
    const constraint = parseConstraint(part);
    if (constraint === undefined) return undefined;
    constraints.push(constraint);
  }
  return { scheme, all: false, constraints };
}

// The characters that a version keeps in a `vers` text: the others are percent-encoded.
const encodeVersion = (version: string): string => version.replace(/[^A-Za-z0-9.+~_:-]/g, (c) => encodeURIComponent(c));

/**
 * This function gives the `vers` text of a range. The constraints come in the order of the versions, when the scheme
 * has a known order. The comparator `=` has no sign, as the specification tells.
 */
export function formatVers(vers: Vers): string {
  if (vers.all) return `vers:${vers.scheme}/*`;
  const sorted = sortConstraints(vers.scheme, vers.constraints) ?? vers.constraints;
  const body = sorted.map((c) => `${c.comparator === "=" ? "" : c.comparator}${encodeVersion(c.version)}`).join("|");
  return `vers:${vers.scheme}/${body}`;
}

// The constraints in the order of their versions, or `undefined` when a version is not a version of the scheme.
function sortConstraints(scheme: string, constraints: readonly VersConstraint[]): VersConstraint[] | undefined {
  let unknown = false;
  const sorted = [...constraints].sort((a, b) => {
    const c = compareVersions(scheme, a.version, b.version);
    if (c === undefined) unknown = true;
    return c ?? 0;
  });
  return unknown ? undefined : sorted;
}

/**
 * This function tells if a version is in a range, with the algorithm of the `vers` specification. The result is
 * `undefined` when the scheme has no known order, or when a version is not a version of the scheme. Thus a caller
 * does not take an unknown result as a match or as no match.
 */
export function versContains(vers: Vers, version: string): boolean | undefined {
  if (vers.all) return true;
  const compare = (a: string, b: string): number | undefined => compareVersions(vers.scheme, a, b);
  for (const constraint of vers.constraints) {
    const c = compare(version, constraint.version);
    if (c === undefined) return undefined;
    if (c === 0 && ["=", "<=", ">="].includes(constraint.comparator)) return true;
    if (c === 0 && constraint.comparator === "!=") return false;
  }
  const ranged = sortConstraints(
    vers.scheme,
    vers.constraints.filter((c) => c.comparator !== "=" && c.comparator !== "!="),
  );
  if (ranged === undefined) return undefined;
  if (ranged.length === 0) {
    // Only `!=` constraints that the version does not equal: the version is in the range.
    return vers.constraints.some((c) => c.comparator === "!=");
  }
  const below = (c: VersConstraint): boolean => c.comparator === "<" || c.comparator === "<=";
  const above = (c: VersConstraint): boolean => c.comparator === ">" || c.comparator === ">=";
  const first = ranged[0]!;
  const last = ranged[ranged.length - 1]!;
  if (below(first) && compare(version, first.version)! < 0) return true;
  if (above(last) && compare(version, last.version)! > 0) return true;
  for (let i = 0; i + 1 < ranged.length; i++) {
    const low = ranged[i]!;
    const high = ranged[i + 1]!;
    if (above(low) && below(high) && compare(version, low.version)! > 0 && compare(version, high.version)! < 0) return true;
  }
  return false;
}
