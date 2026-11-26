# @mark1russell7/package-id

Package identities as plain functions with no fetch. The first part is the package URL (purl) of the [purl specification](https://github.com/package-url/purl-spec).

```ts
import { formatPurl, osvPurl, packagePurlOf, parsePurl } from "@mark1russell7/package-id";

parsePurl("pkg:npm/%40angular/animation@12.3.1");
// { type: "npm", namespace: "@angular", name: "animation", version: "12.3.1" }

formatPurl({ type: "pypi", name: "Django_package", version: "1.11.1" });
// "pkg:pypi/django-package@1.11.1"

packagePurlOf("pkg:npm/a@1.0.0?arch=x#sub");
// "pkg:npm/a"

osvPurl("Maven", "org.example:core");
// "pkg:maven/org.example/core"
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

## The canonical form

- The type is in lower case.
- For the types `alpm`, `apk`, `bitbucket`, `composer`, `deb`, `github`, `golang` and `npm`, the namespace and the name are in lower case.
- For the types `hex`, `pub` and `pypi`, the name is in lower case. A `pypi` name has `-` in place of `_`.
- The qualifier keys are in lower case and in sorted order. A qualifier with an empty value is not in the purl.
- The subpath has no empty, `.` or `..` segment.
- Each part is percent-encoded, but a colon stays as it is. A qualifier value keeps its `/`.

## License

MIT
