# @mark1russell7/package-id

Package identities as plain functions with no fetch. The parts are the package URL (purl) of the [purl specification](https://github.com/package-url/purl-spec), the version order of each ecosystem and the version ranges of the [vers specification](https://github.com/package-url/vers-spec).

```ts
import { compareVersions, formatPurl, osvPurl, packagePurlOf, parsePurl, parseVers, versContains } from "@mark1russell7/package-id";

parsePurl("pkg:npm/%40angular/animation@12.3.1");
// { type: "npm", namespace: "@angular", name: "animation", version: "12.3.1" }

formatPurl({ type: "pypi", name: "Django_package", version: "1.11.1" });
// "pkg:pypi/django-package@1.11.1"

packagePurlOf("pkg:npm/a@1.0.0?arch=x#sub");
// "pkg:npm/a"

osvPurl("Maven", "org.example:core");
// "pkg:maven/org.example/core"

compareVersions("deb", "1.0~rc1", "1.0");
// -1

versContains(parseVers("vers:npm/>=1.0.0|<1.2.3")!, "1.1.0");
// true
```

## The functions

| Function | What it gives |
| --- | --- |
| `parsePurl(text)` | The parts of a purl text, decoded and normalized, or `undefined` for a text that is not a purl. |
| `formatPurl(purl)` | The canonical text of a purl, or `undefined` when a part breaks a rule. |
| `normalizePurl(purl)` | The canonical parts: the case rules of the type, sorted qualifiers and no empty part. |
| `packagePurlOf(text)` | The canonical purl with no version, no qualifiers and no subpath. |
| `osvPurl(ecosystem, name)` | The purl of a package of an OSV ecosystem, with no version. |
| `osvPackagePurl(pkg)` | The purl of an OSV record package. A valid purl of the record wins. |
| `OSV_PURL_TYPES` | The purl type of each OSV ecosystem that has one. |
| `compareVersions(scheme, a, b)` | Below 0, 0 or above 0 for the order of two versions, or `undefined` for a text that is not a version. |
| `compareSemver`, `compareGo`, `comparePep440`, `compareDebian`, `compareRpm` | The order of one scheme: SemVer 2.0.0, Go modules, PEP 440, dpkg and `rpmvercmp`. |
| `compareIntdot`, `compareGeneric` | The order of the `vers` schemes `intdot` (integers with dots) and `generic` (the versions of vendors, for example `V6.80`). |
| `versionScheme(type)` | The version scheme of a purl type, or `undefined` when the order of the type is not known. |
| `parseVers(text)` | The scheme and the constraints of a `vers` range, or `undefined` for a text that is not a range. |
| `formatVers(vers)` | The `vers` text of a range, with the constraints in the order of their versions. |
| `versContains(vers, version)` | True when the version is in the range. The result is `undefined` when the order is not known. |
| `versEnd(vers, version)` | The end `<` of the part of the range that holds the version: for an advisory, the fixed version. |

## The canonical form

- The type is in lower case.
- For the types `alpm`, `apk`, `bitbucket`, `composer`, `deb`, `github`, `golang` and `npm`, the namespace and the name are in lower case.
- For the types `hex`, `pub` and `pypi`, the name is in lower case. A `pypi` name has `-` in place of `_`.
- The qualifier keys are in lower case and in sorted order. A qualifier with an empty value is not in the purl.
- The subpath has no empty, `.` or `..` segment.
- Each part is percent-encoded, but a colon stays as it is. A qualifier value keeps its `/`.

## An unknown order

A comparison does not guess. A version that is not a version of its scheme gives `undefined`. A scheme with no known order also gives `undefined`, for example Maven. The `generic` order also gives `undefined` for two different runs of letters, for example `2.9.1.0_FR` and `2.9.1.0_ESP`. Thus a caller that matches advisories to installed versions does not take an unknown result as a match or as no match.

## License

MIT
