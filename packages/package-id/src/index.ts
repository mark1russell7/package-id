/**
 * Package identities: package URLs (purl), the purl of each OSV ecosystem, the version order of each ecosystem, version ranges (vers) and CPE names. The functions are plain functions with
 * no fetch.
 */

export { cpeProductOf, cpeVersionOf, formatCpe, parseCpe, type Cpe, type CpePart } from "./cpe.ts";
export { formatPurl, normalizePurl, packagePurlOf, parsePurl, type Purl } from "./purl.ts";
export { OSV_PURL_TYPES, osvPackagePurl, osvPurl, osvRangeVers, type OsvEvent, type OsvRange } from "./osv.ts";
export {
  compareDebian,
  compareGeneric,
  compareGo,
  compareIntdot,
  comparePep440,
  compareRpm,
  compareSemver,
  compareVersions,
  versionScheme,
  type VersionScheme,
} from "./version.ts";
export { formatVers, parseVers, versContains, versEnd, type Vers, type VersComparator, type VersConstraint } from "./vers.ts";
