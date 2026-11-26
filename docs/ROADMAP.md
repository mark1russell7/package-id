# Roadmap

This file is the plan of package-id. The Status page of the site reads it, and the tracker of the project mirrors it.

| ID | Item | Status | Summary |
| --- | --- | --- | --- |
| R1 | The first package | in progress | The package `@mark1russell7/package-id` gives purl parse, format and normalize, and the purl of each OSV ecosystem. The first release follows. |
| R2 | The purl types of the specification | open | Add the rules of each purl type: the required namespace, the case rules and the checks of the name. |
| R3 | Version ranges (vers) | in progress | `parseVers`, `formatVers` and `versContains` read, write and examine ranges in the `vers` format, in 0.0.2. |
| R4 | The version order of each ecosystem | in progress | 0.0.2 compares SemVer, Go, PEP 440, Debian and RPM versions. The order of Maven is the next part. |
| R5 | The names of each registry | open | Map the ecosystem names of OSV, purl and each registry to each other. |
| R6 | A demo site | open | Replace the first site with a demo that parses a purl and shows its parts. |
