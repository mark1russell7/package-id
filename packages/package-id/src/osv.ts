/**
 * The map from the ecosystems of OSV (`https://ossf.github.io/osv-schema/`) to purl types, and the purl of a package
 * of an OSV record.
 */

import { formatPurl, packagePurlOf } from "./purl.ts";

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
  const type = OSV_PURL_TYPES[base];
  if (type === undefined || name === "") return undefined;
  const names = split(type, name);
  if (names === undefined) return undefined;
  const distribution = DISTRIBUTION[base];
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
