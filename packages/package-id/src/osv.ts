/**
 * The map from the ecosystems of OSV (`https://ossf.github.io/osv-schema/`) to purl types, and the purl of a package
 * of an OSV record.
 */

import { formatPurl, packagePurlOf } from "./purl.ts";
import type { Vers, VersConstraint } from "./vers.ts";
import { compareVersions, versionScheme } from "./version.ts";

/**
 * The purl type of each OSV ecosystem that has one. An ecosystem that is not in the table has no purl.
 * For a Linux distribution, the table key is the part of the ecosystem before the first `:`.
 */
export const OSV_PURL_TYPES: Readonly<Record<string, string>> = {
  npm: "npm",
  PyPI: "pypi",
  "crates.io": "cargo",
  RubyGems: "gem",
  NuGet: "nuget",
  Go: "golang",
  Maven: "maven",
  Packagist: "composer",
  Pub: "pub",
  Hex: "hex",
  Hackage: "hackage",
  CRAN: "cran",
  "GitHub Actions": "github",
  Debian: "deb",
  Ubuntu: "deb",
  Alpine: "apk",
};

/** The purl namespace of each OSV ecosystem of a Linux distribution: the name of the distribution. */
const DISTRIBUTION: Readonly<Record<string, string>> = { Debian: "debian", Ubuntu: "ubuntu", Alpine: "alpine" };

/** This function gives the namespace and the name of an OSV package name, as the purl type of its ecosystem splits them. */
function split(type: string, name: string): { readonly namespace?: string; readonly name: string } | undefined {
  switch (type) {
    case "npm": {
      const slash = name.indexOf("/");
      return name.startsWith("@") && slash > 1 ? { namespace: name.slice(0, slash), name: name.slice(slash + 1) } : { name };
    }
    case "golang":
    case "composer":
    case "github": {
      const slash = name.lastIndexOf("/");
      return slash > 0 ? { namespace: name.slice(0, slash), name: name.slice(slash + 1) } : { name };
    }
    case "maven": {
      const colon = name.indexOf(":");
      return colon > 0 ? { namespace: name.slice(0, colon), name: name.slice(colon + 1) } : undefined;
    }
    default:
      return { name };
  }
}

/**
 * This function gives the canonical purl of an OSV package, with no version. For an ecosystem with no purl type, or
 * a bad name, it gives `undefined`.
 */
export function osvPurl(ecosystem: string, name: string): string | undefined {
  const base = ecosystem.split(":")[0]!;
  const type = Object.hasOwn(OSV_PURL_TYPES, base) ? OSV_PURL_TYPES[base] : undefined;
  if (type === undefined || name === "") return undefined;
  const names = split(type, name);
  if (names === undefined) return undefined;
  const distribution = Object.hasOwn(DISTRIBUTION, base) ? DISTRIBUTION[base] : undefined;
  const namespace = distribution ?? names.namespace;
  return formatPurl({ type, ...(namespace === undefined ? {} : { namespace }), name: names.name });
}

/**
 * This function gives the purl of a package of an OSV record, with no version, qualifiers or subpath. A valid purl
 * of the record wins. Else the function builds the purl from the ecosystem and the name.
 */
export function osvPackagePurl(pkg: { readonly ecosystem: string; readonly name: string; readonly purl?: string }): string | undefined {
  const own = pkg.purl === undefined ? undefined : packagePurlOf(pkg.purl);
  return own ?? osvPurl(pkg.ecosystem, pkg.name);
}

/** One event of an OSV range, as the OSV schema writes it: each event has one of the four fields. */
export interface OsvEvent {
  readonly introduced?: string;
  readonly fixed?: string;
  readonly last_affected?: string;
  readonly limit?: string;
}

/** A range of an OSV record: its type (`SEMVER`, `ECOSYSTEM` or `GIT`) and its events. */
export interface OsvRange {
  readonly type: string;
  readonly events: readonly OsvEvent[];
}

/**
 * This function gives the `vers` range of an OSV range. A range of the type `SEMVER` has the scheme `semver`. A range
 * of the type `ECOSYSTEM` has the purl type of its ecosystem as its scheme. A `GIT` range, an ecosystem with no purl type
 * or an event with no version gives `undefined`.
 *
 * The events come in the order of their versions, as the OSV schema tells, when the scheme has a known order. Else they
 * keep the order of the record. The event `introduced 0` is the start of each version, so it gives no constraint.
 */
export function osvRangeVers(ecosystem: string, range: OsvRange): Vers | undefined {
  const base = ecosystem.split(":")[0]!;
  const type = Object.hasOwn(OSV_PURL_TYPES, base) ? OSV_PURL_TYPES[base] : undefined;
  const scheme = range.type === "SEMVER" ? "semver" : range.type === "ECOSYSTEM" ? type : undefined;
  if (scheme === undefined) return undefined;
  const constraints: VersConstraint[] = [];
  let all = false;
  for (const event of range.events) {
    const constraint = eventConstraint(event);
    if (constraint === undefined) return undefined;
    if (constraint === "start") all = true;
    else if (constraint !== "none") constraints.push(constraint);
  }
  if (constraints.length === 0) return all ? { scheme, all: true, constraints: [] } : undefined;
  return { scheme, all: false, constraints: sortEvents(scheme, constraints) };
}

// The constraint of one event: "start" for `introduced 0`, "none" for `limit *` (no limit).
function eventConstraint(event: OsvEvent): VersConstraint | "start" | "none" | undefined {
  if (event.introduced !== undefined) return event.introduced === "0" ? "start" : { comparator: ">=", version: event.introduced };
  if (event.fixed !== undefined) return { comparator: "<", version: event.fixed };
  if (event.last_affected !== undefined) return { comparator: "<=", version: event.last_affected };
  if (event.limit !== undefined) return event.limit === "*" ? "none" : { comparator: "<", version: event.limit };
  return undefined;
}

// The constraints in the order of their versions, or in their own order when the scheme has no known order.
function sortEvents(scheme: string, constraints: readonly VersConstraint[]): VersConstraint[] {
  if (versionScheme(scheme) === undefined) return [...constraints];
  let unknown = false;
  const sorted = [...constraints].sort((a, b) => {
    const c = compareVersions(scheme, a.version, b.version);
    if (c === undefined) unknown = true;
    return c ?? 0;
  });
  return unknown ? [...constraints] : sorted;
}
