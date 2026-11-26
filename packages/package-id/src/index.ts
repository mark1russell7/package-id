/**
 * Package identities: package URLs (purl) and the purl of each OSV ecosystem. The functions are plain functions with
 * no fetch.
 */

export { formatPurl, normalizePurl, packagePurlOf, parsePurl, type Purl } from "./purl.ts";
export { OSV_PURL_TYPES, osvPackagePurl, osvPurl } from "./osv.ts";
