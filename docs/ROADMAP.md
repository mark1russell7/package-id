# Roadmap

This file is the plan of package-id. The Status page of the site reads it, and the tracker of the project mirrors it.

| ID | Item | Status | Summary |
| --- | --- | --- | --- |
| R1 | The first package | in progress | The package `@mark1russell7/package-id` gives purl parse, format and normalize, and the purl of each OSV ecosystem. The first release follows. |
| R2 | The purl types of the specification | open | Add the rules of each purl type: the required namespace, the case rules and the checks of the name. |
| R3 | Version ranges (vers) | in progress | `parseVers`, `formatVers` and `versContains` read, write and examine ranges in the `vers` format, in 0.0.2. |
| R4 | The version order of each ecosystem | in progress | 0.0.2 compares SemVer, Go, PEP 440, Debian and RPM versions. 0.1.0 adds the `vers` schemes `intdot` and `generic`, for the CSAF advisories of vendors. The order of Maven is the next part. |
| R5 | The names of each registry | open | Map the ecosystem names of OSV, purl and each registry to each other. |
| R6 | A demo site | open | Replace the first site with a demo that parses a purl and shows its parts. |
| R7 | CPE names | in progress | `parseCpe`, `formatCpe`, `cpeProductOf` and `cpeVersionOf` read and write the CPE names of NIST: the formatted string of CPE 2.3 and the URI of CPE 2.2. The CSAF advisories of vendors give a CPE when a product has no purl. |
| R8 | CSAF model numbers | done | `modelNumberMatches` compares a model number or a SKU with a pattern of a CSAF advisory. The pattern uses `*` and `?`, and a backslash makes them literal. |
| R9 | Match keys | done | `packageKeyOf` gives one key to the names that a registry makes equal: PEP 503 for PyPI, case and `_` for Cargo, case for NuGet. |
