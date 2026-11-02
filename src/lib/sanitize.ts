import sanitizeHtml from "sanitize-html";

/**
 * Allow-list for article HTML. Anything not listed is removed, including
 * scripts, inline styles, event handlers and javascript: URLs.
 */
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "h2", "h3", "h4", "p", "br", "hr", "strong", "b", "em", "i", "s", "u",
    "code", "pre", "blockquote", "ul", "ol", "li", "a", "img",
  ],
  allowedAttributes: {
    a: ["href", "title", "rel", "target"],
    img: ["src", "alt", "title", "width", "height", "loading", "decoding"],
    ol: ["start"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesByTag: { img: ["https"] },
  allowProtocolRelative: false,
  transformTags: {
    // Editor h1s become h2s: the page title is the only h1.
    h1: "h2",
    a: (tagName, attribs) => ({
      tagName,
      attribs: { ...attribs, rel: "noopener noreferrer nofollow ugc", target: "_blank" },
    }),
    img: (tagName, attribs) => ({
      tagName,
      attribs: { ...attribs, loading: "lazy", decoding: "async" },
    }),
  },
  exclusiveFilter: (frame) => frame.tag === "img" && !frame.attribs.src,
};

export function sanitizeArticleHtml(html: string): string {
  return sanitizeHtml(html, OPTIONS);
}

/** Plain text version, used for search and reading time. */
export function htmlToText(html: string): string {
  return sanitizeHtml(html.replace(/<\/(p|h[1-6]|li|blockquote|pre)>/gi, "$& "), {
    allowedTags: [],
    allowedAttributes: {},
  })
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}
