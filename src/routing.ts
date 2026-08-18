export type HashRoute =
  | { kind: "admin" }
  | { kind: "survey"; access: string }
  | { kind: "report"; access: string }
  | { kind: "not_found" };

export function parseHashRoute(hash: string): HashRoute {
  if (hash === "" || hash === "#" || hash === "#/") return { kind: "admin" };

  const [kind, encoded, ...rest] = hash.replace(/^#\/?/, "").split("/");
  if (kind === "admin" && !encoded) return { kind: "admin" };
  if ((kind === "survey" || kind === "report") && encoded && rest.length === 0) {
    try {
      return { kind, access: decodeURIComponent(encoded) };
    } catch {
      return { kind: "not_found" };
    }
  }
  return { kind: "not_found" };
}
