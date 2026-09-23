/**
 * HTML escaping for the share page — the one place in this product that turns untrusted
 * text into markup.
 *
 * ITS OWN FILE SO IT CAN BE TESTED AS ITSELF. `index.ts` imports the Firebase Admin SDK at
 * module scope, so a build-time test cannot load it; a test that reimplemented this
 * function would pass while the shipped one was wrong, and one that read the source and
 * eval'd it would be both fragile and a bad habit to leave in the repository. One
 * definition, imported by the renderer and by `scripts/share.test.ts`.
 *
 * WHAT IT DEFENDS AGAINST. The share page renders a report ABOUT SOMEBODY ELSE'S WEB PAGE:
 * headlines, CTA copy and fragments the model quoted verbatim from a site the sharer does
 * not control. So a page can put text of its choosing in front of this renderer, and a
 * missed escape is stored XSS on our own domain, served to whoever opens a shared link.
 *
 * The five characters are the complete set for both element text and quoted attribute
 * values, which is all this renderer produces. It is NOT sufficient for unquoted
 * attributes, URLs, inline CSS or inline JavaScript — none of which the share page emits,
 * and any of which would need its own encoding rather than this one.
 */
export const escapeHtml = (v: unknown): string => String(v ?? '')
  .replace(/&/g, '&amp;')   // first, or it would double-escape the entities below
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');
