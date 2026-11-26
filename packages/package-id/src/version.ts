/**
 * The version order of each ecosystem: SemVer, Go modules, PEP 440, Debian and RPM. The `vers` schemes `intdot` and
 * `generic` have an order too. Each function compares two versions of one scheme. A text that is not a version of the
 * scheme gives `undefined`, not a guess.
 */

/** The version schemes that this module compares. */
export type VersionScheme = "semver" | "golang" | "pypi" | "deb" | "rpm" | "intdot" | "generic";

/** The version scheme of each purl type whose order this module knows. */
const TYPE_SCHEMES: ReadonlyMap<string, VersionScheme> = new Map([
  ["npm", "semver"],
  ["cargo", "semver"],
  ["semver", "semver"],
  ["golang", "golang"],
  ["pypi", "pypi"],
  ["deb", "deb"],
  ["rpm", "rpm"],
  ["generic", "generic"],
]);

/** This function gives the version scheme of a purl type, or `undefined` for a type whose order this module does not know. */
export function versionScheme(type: string): VersionScheme | undefined {
  return TYPE_SCHEMES.get(type.toLowerCase());
}

/**
 * This function compares two versions of one scheme. The result is below 0 when `a` comes before `b`, 0 when they are
 * equal and above 0 when `a` comes after `b`. When a text is not a version of the scheme, the result is `undefined`.
 */
export function compareVersions(scheme: string, a: string, b: string): number | undefined {
  switch (scheme) {
    case "semver":
    case "npm":
    case "cargo":
      return compareSemver(a, b);
    case "golang":
      return compareGo(a, b);
    case "pypi":
      return comparePep440(a, b);
    case "deb":
      return compareDebian(a, b);
    case "rpm":
      return compareRpm(a, b);
    case "intdot":
      return compareIntdot(a, b);
    case "generic":
      return compareGeneric(a, b);
    default:
      return undefined;
  }
}

const sign = (n: number): number => (n < 0 ? -1 : n > 0 ? 1 : 0);
const compareText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
const compareDigits = (a: string, b: string): number => {
  const x = a.replace(/^0+(?=\d)/, "");
  const y = b.replace(/^0+(?=\d)/, "");
  return x.length !== y.length ? sign(x.length - y.length) : compareText(x, y);
};

// SemVer 2.0.0. The build metadata does not change the order.
const SEMVER = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

/** The parts of a SemVer version that decide its order. */
interface Semver {
  readonly core: readonly [string, string, string];
  readonly pre: readonly string[];
}

function parseSemver(text: string): Semver | undefined {
  const match = SEMVER.exec(text.trim().replace(/^=/, ""));
  if (match === null) return undefined;
  return { core: [match[1]!, match[2]!, match[3]!], pre: match[4] === undefined ? [] : match[4].split(".") };
}

function compareSemverParts(x: Semver, y: Semver): number {
  for (let i = 0; i < 3; i++) {
    const c = compareDigits(x.core[i]!, y.core[i]!);
    if (c !== 0) return c;
  }
  // A version with a pre-release comes before the same version with no pre-release.
  if (x.pre.length === 0 || y.pre.length === 0) return sign(y.pre.length - x.pre.length);
  for (let i = 0; i < Math.min(x.pre.length, y.pre.length); i++) {
    const p = x.pre[i]!;
    const q = y.pre[i]!;
    const pn = /^\d+$/.test(p);
    const qn = /^\d+$/.test(q);
    const c = pn && qn ? compareDigits(p, q) : pn ? -1 : qn ? 1 : compareText(p, q);
    if (c !== 0) return c;
  }
  return sign(x.pre.length - y.pre.length);
}

/** This function compares two SemVer 2.0.0 versions. It accepts a leading `v` or `=`, as npm does. */
export function compareSemver(a: string, b: string): number | undefined {
  const x = parseSemver(a);
  const y = parseSemver(b);
  return x === undefined || y === undefined ? undefined : compareSemverParts(x, y);
}

/**
 * This function compares two versions of Go modules. A Go version starts with `v` and follows SemVer. A pseudo-version is
 * a pre-release, so it has its place in the order of SemVer. The suffix `+incompatible` is build metadata.
 */
export function compareGo(a: string, b: string): number | undefined {
  if (!a.startsWith("v") || !b.startsWith("v")) return undefined;
  return compareSemver(a, b);
}

// PEP 440: the pattern of the version specification of the Python packaging guide.
const PEP440 =
  /^\s*v?(?:(?:(\d+)!)?(\d+(?:\.\d+)*)(?:[-_.]?(a|b|c|rc|alpha|beta|pre|preview)[-_.]?(\d+)?)?(?:-(\d+)|[-_.]?(post|rev|r)[-_.]?(\d+)?)?(?:[-_.]?(dev)[-_.]?(\d+)?)?)(?:\+([a-z0-9]+(?:[-_.][a-z0-9]+)*))?\s*$/i;

/** The parts of a PEP 440 version that decide its order. */
interface Pep440 {
  readonly epoch: number;
  readonly release: readonly number[];
  /** The pre-release as a rank (a 0, b 1, rc 2) and a number. */
  readonly pre?: readonly [number, number];
  readonly post?: number;
  readonly dev?: number;
  readonly local: readonly string[];
}

const PRE_RANK: Readonly<Record<string, number>> = { a: 0, alpha: 0, b: 1, beta: 1, c: 2, rc: 2, pre: 2, preview: 2 };

function parsePep440(text: string): Pep440 | undefined {
  const m = PEP440.exec(text);
  if (m === null) return undefined;
  const release = m[2]!.split(".").map(Number);
  while (release.length > 1 && release[release.length - 1] === 0) release.pop();
  const post = m[5] !== undefined ? Number(m[5]) : m[6] !== undefined ? Number(m[7] ?? 0) : undefined;
  return {
    epoch: Number(m[1] ?? 0),
    release,
    ...(m[3] === undefined ? {} : { pre: [PRE_RANK[m[3].toLowerCase()]!, Number(m[4] ?? 0)] as const }),
    ...(post === undefined ? {} : { post }),
    ...(m[8] === undefined ? {} : { dev: Number(m[9] ?? 0) }),
    local: m[10] === undefined ? [] : m[10].toLowerCase().split(/[-_.]/),
  };
}

function compareNumbers(a: readonly number[], b: readonly number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const c = sign((a[i] ?? 0) - (b[i] ?? 0));
    if (c !== 0) return c;
  }
  return 0;
}

/** This function compares two PEP 440 versions, with the order of the Python packaging specification. */
export function comparePep440(a: string, b: string): number | undefined {
  const x = parsePep440(a);
  const y = parsePep440(b);
  if (x === undefined || y === undefined) return undefined;
  const epoch = sign(x.epoch - y.epoch);
  if (epoch !== 0) return epoch;
  const release = compareNumbers(x.release, y.release);
  if (release !== 0) return release;
  // A dev release with no pre-release and no post-release comes before each pre-release.
  const preKey = (v: Pep440): readonly number[] => (v.pre !== undefined ? [0, ...v.pre] : v.post === undefined && v.dev !== undefined ? [-1] : [1]);
  const pre = compareNumbers(preKey(x), preKey(y));
  if (pre !== 0) return pre;
  const postKey = (v: Pep440): readonly number[] => (v.post === undefined ? [-1] : [0, v.post]);
  const post = compareNumbers(postKey(x), postKey(y));
  if (post !== 0) return post;
  const devKey = (v: Pep440): readonly number[] => (v.dev === undefined ? [1] : [0, v.dev]);
  const dev = compareNumbers(devKey(x), devKey(y));
  if (dev !== 0) return dev;
  return compareLocal(x.local, y.local);
}

// A local version comes after the same version with no local part. A number segment comes after a text segment.
function compareLocal(a: readonly string[], b: readonly string[]): number {
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    const p = a[i]!;
    const q = b[i]!;
    const pn = /^\d+$/.test(p);
    const qn = /^\d+$/.test(q);
    const c = pn && qn ? compareDigits(p, q) : pn ? 1 : qn ? -1 : compareText(p, q);
    if (c !== 0) return c;
  }
  return sign(a.length - b.length);
}

// The order of a character of a Debian version: `~` comes before the end, the end before a letter, a letter before
// each other character. A digit has the rank of the end, as in dpkg.
function debianRank(text: string, i: number): number {
  if (i >= text.length) return 0;
  const c = text[i]!;
  if (/d/.test(c)) return 0;
  if (c === "~") return -1;
  if (/[A-Za-z]/.test(c)) return c.charCodeAt(0);
  return c.charCodeAt(0) + 256;
}

// The comparison of dpkg: parts with no digit and parts of digits, one after the other.
function compareDebianPart(a: string, b: string): number {
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    while ((i < a.length && !/\d/.test(a[i]!)) || (j < b.length && !/\d/.test(b[j]!))) {
      const c = debianRank(a, i) - debianRank(b, j);
      if (c !== 0) return sign(c);
      i++;
      j++;
    }
    let p = "";
    let q = "";
    while (i < a.length && /\d/.test(a[i]!)) p += a[i++];
    while (j < b.length && /\d/.test(b[j]!)) q += b[j++];
    const c = compareDigits(p || "0", q || "0");
    if (c !== 0) return c;
  }
  return 0;
}

const DEBIAN = /^(?:(\d+):)?([0-9][A-Za-z0-9.+~:-]*?)(?:-([A-Za-z0-9.+~]+))?$/;

/** This function compares two Debian versions (`[epoch:]upstream[-revision]`) with the order of dpkg. */
export function compareDebian(a: string, b: string): number | undefined {
  const x = DEBIAN.exec(a.trim());
  const y = DEBIAN.exec(b.trim());
  if (x === null || y === null) return undefined;
  const epoch = compareDigits(x[1] ?? "0", y[1] ?? "0");
  if (epoch !== 0) return epoch;
  const upstream = compareDebianPart(x[2]!, y[2]!);
  if (upstream !== 0) return upstream;
  return compareDebianPart(x[3] ?? "0", y[3] ?? "0");
}

// The comparison of rpmvercmp: segments of letters or digits. `~` comes before each other thing, also the end. `^` comes
// after the end, but before each other segment.
function rpmvercmp(a: string, b: string): number {
  if (a === b) return 0;
  let i = 0;
  let j = 0;
  for (;;) {
    while (i < a.length && !/[A-Za-z0-9~^]/.test(a[i]!)) i++;
    while (j < b.length && !/[A-Za-z0-9~^]/.test(b[j]!)) j++;
    const ca = a[i];
    const cb = b[j];
    if (ca === "~" || cb === "~") {
      if (ca !== "~") return 1;
      if (cb !== "~") return -1;
      i++;
      j++;
      continue;
    }
    if (ca === "^" || cb === "^") {
      if (ca === undefined) return -1;
      if (cb === undefined) return 1;
      if (ca !== "^") return 1;
      if (cb !== "^") return -1;
      i++;
      j++;
      continue;
    }
    if (ca === undefined || cb === undefined) break;
    const digits = /\d/.test(ca);
    const same = digits ? /\d/ : /[A-Za-z]/;
    let p = "";
    let q = "";
    while (i < a.length && same.test(a[i]!)) p += a[i++];
    while (j < b.length && same.test(b[j]!)) q += b[j++];
    // A segment of digits comes after a segment of letters.
    if (q === "") return digits ? 1 : -1;
    const c = digits ? compareDigits(p, q) : compareText(p, q);
    if (c !== 0) return c;
  }
  if (i >= a.length && j >= b.length) return 0;
  return i >= a.length ? -1 : 1;
}

const RPM = /^(?:(\d+):)?([^-]+)(?:-([^-]+))?$/;

/** This function compares two RPM versions (`[epoch:]version[-release]`) with the order of `rpmvercmp`. */
export function compareRpm(a: string, b: string): number | undefined {
  const x = RPM.exec(a.trim());
  const y = RPM.exec(b.trim());
  if (x === null || y === null) return undefined;
  const epoch = compareDigits(x[1] ?? "0", y[1] ?? "0");
  if (epoch !== 0) return epoch;
  const version = rpmvercmp(x[2]!, y[2]!);
  if (version !== 0) return version;
  // A version with no release comes before each release of that version. Thus a check of a fix does not take it as fixed.
  return rpmvercmp(x[3] ?? "", y[3] ?? "");
}

const INTDOT = /^\d+(?:\.\d+)*$/;

/**
 * This function compares two versions of the `vers` scheme `intdot`: integers with a `.` between them. The integers
 * compare from left to right. A missing integer is 0, so `1.0` equals `1.0.0`.
 */
export function compareIntdot(a: string, b: string): number | undefined {
  const x = a.trim();
  const y = b.trim();
  if (!INTDOT.test(x) || !INTDOT.test(y)) return undefined;
  const p = x.split(".");
  const q = y.split(".");
  for (let i = 0; i < Math.max(p.length, q.length); i++) {
    const c = compareDigits(p[i] ?? "0", q[i] ?? "0");
    if (c !== 0) return c;
  }
  return 0;
}

/** This function gives the segments of a version of a vendor: the runs of digits and the runs of letters. */
function genericSegments(text: string): readonly string[] | undefined {
  // One `v` before a digit is a prefix, not a segment: `V6.80` is the version `6.80`.
  const body = text.trim().replace(/^[vV](?=\d)/, "");
  if (!/^\d/.test(body)) return undefined;
  return body.match(/\d+|[A-Za-z]+/g) ?? undefined;
}

const isDigits = (segment: string): boolean => /^\d/.test(segment);

/**
 * This function compares two versions of the `vers` scheme `generic`, the versions of vendors, for example `V6.80` or
 * `2.9.1.0_FR`. A version starts with a digit, after one optional `v`. The segments are the runs of digits and of letters.
 * The other characters separate the segments.
 *
 * The segments compare from left to right, and the first difference decides. Two runs of digits compare as integers.
 * Two runs of letters are equal when they are the same with no regard to case. Other pairs have no known order. These
 * pairs give `undefined`: two different runs of letters, or a run of digits and a run of letters.
 *
 * When one version ends first, a rest of zeros is equal to the end. A rest with a number above 0 before its first letters
 * comes after the end. A rest with letters before such a number, for example ` SP1` or `-beta`, has no known order.
 */
export function compareGeneric(a: string, b: string): number | undefined {
  const p = genericSegments(a);
  const q = genericSegments(b);
  if (p === undefined || q === undefined) return undefined;
  for (let i = 0; i < Math.min(p.length, q.length); i++) {
    const x = p[i]!;
    const y = q[i]!;
    if (isDigits(x) && isDigits(y)) {
      const c = compareDigits(x, y);
      if (c !== 0) return c;
    } else if (isDigits(x) || isDigits(y) || x.toLowerCase() !== y.toLowerCase()) {
      return undefined;
    }
  }
  const rest = p.length > q.length ? p.slice(q.length) : q.slice(p.length);
  const longer = p.length > q.length ? 1 : -1;
  for (const segment of rest) {
    if (!isDigits(segment)) return undefined;
    if (/[1-9]/.test(segment)) return longer;
  }
  return 0;
}
