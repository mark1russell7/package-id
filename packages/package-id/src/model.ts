/**
 * The model numbers and the SKUs of CSAF 2.0. A CSAF advisory names a hardware product by a full or partial model number.
 * In such a pattern, `*` stands for zero or more characters and `?` stands for one character. A backslash before `*`,
 * `?` or a backslash makes that character literal. The comparison is exact: the case of each character counts.
 */

/** One token of a pattern: any run of characters, one character, or one literal character. */
type Token = { readonly kind: "any" } | { readonly kind: "one" } | { readonly kind: "char"; readonly char: string };

/** This function gives the tokens of a pattern. A backslash at the end is a literal backslash. */
function tokensOf(pattern: string): readonly Token[] {
  const chars = Array.from(pattern);
  const tokens: Token[] = [];
  for (let index = 0; index < chars.length; index++) {
    const char = chars[index]!;
    const next = chars[index + 1];
    if (char === "\\" && next !== undefined && (next === "*" || next === "?" || next === "\\")) {
      tokens.push({ kind: "char", char: next });
      index++;
    } else if (char === "*") {
      if (tokens.at(-1)?.kind !== "any") tokens.push({ kind: "any" });
    } else if (char === "?") tokens.push({ kind: "one" });
    else tokens.push({ kind: "char", char });
  }
  return tokens;
}

/**
 * This function tells if a model number or a SKU matches a pattern of a CSAF advisory. An empty pattern matches nothing.
 * The match keeps the last `*` and its place, so its time is at most the product of the two lengths.
 */
export function modelNumberMatches(pattern: string, model: string): boolean {
  if (pattern === "") return false;
  const tokens = tokensOf(pattern);
  const chars = Array.from(model);
  let token = 0;
  let char = 0;
  let star = -1;
  let resume = 0;
  while (char < chars.length) {
    const current = tokens[token];
    if (current !== undefined && (current.kind === "one" || (current.kind === "char" && current.char === chars[char]))) {
      token++;
      char++;
    } else if (current?.kind === "any") {
      star = token++;
      resume = char;
    } else if (star >= 0) {
      token = star + 1;
      char = ++resume;
    } else return false;
  }
  while (tokens[token]?.kind === "any") token++;
  return token === tokens.length;
}
