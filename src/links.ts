const ALLOWED = new Set(["http:", "https:", "mailto:", "tel:"]);

/**
 * A run's `link`, or undefined when it is not safe to put in an href.
 *
 * A Doc is untrusted input -- it comes from a file somebody else wrote, or an
 * agent -- and this viewer renders it inside the host's origin, so a
 * `javascript:` link would be script in the host page. Only absolute http(s),
 * mailto and tel URLs, and in-document `#anchors`, are kept. The protocol is
 * read by the URL parser, not a regex, so case, leading spaces and embedded
 * tabs (which the parser strips, exactly as a browser would) cannot smuggle a
 * scheme past the check.
 */
export function safeHref(url: unknown): string | undefined {
  if (typeof url !== "string" || url === "") return undefined;
  if (/^#[^\s]*$/.test(url)) return url;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return undefined;
  }
  return ALLOWED.has(parsed.protocol) ? url : undefined;
}
