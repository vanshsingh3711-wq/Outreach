/**
 * B2B SaaS Discovery & Executive formatting utilities.
 * Keeps UI clean, minimalist, and free from scraper debug artifacts.
 */

export function getInitials(name?: string, fallback = "CO"): string {
  if (!name) return fallback;
  const cleaned = name.replace(/[^a-zA-Z0-9\s]/g, " ").trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return fallback;
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function cleanDescription(desc?: string): string {
  if (!desc) return "";

  // Strip review poll boilerplate and rating survey fragments
  let text = desc
    .replace(/Are there any areas for improvement[^\.\n]*/gi, "")
    .replace(/Share\.\s*Custom Software Development[^\.\n]*/gi, "")
    .replace(/\(?\d+\)?\.\s*\d*\s*more\s+[^\.\n]*/gi, "")
    .replace(/Decision-makers ready to extract.*/gi, "")
    .replace(/View DetailsSave to DB.*/gi, "");

  // If the snippet was just a list of percentage capabilities, turn into readable copy
  if (text.includes("%") && (text.includes("Development:") || text.includes("Augmentation:"))) {
    const capabilities = Array.from(
      text.matchAll(/([A-Za-z\s/]+):\s*\d+%/g)
    ).map((m) => m[1].trim());

    if (capabilities.length > 0) {
      return `Specialized dev studio with verified focus in ${capabilities.slice(0, 3).join(", ")}.`;
    }
  }

  // Remove repeated periods, ellipsis fragments, and extra whitespace
  text = text
    .replace(/\.{2,}/g, ".")
    .replace(/\s+/g, " ")
    .trim();

  // Strip dangling punctuation at ends
  text = text.replace(/^[,\.\-\s]+|[,\.\-\s]+$/g, "").trim();

  if (text.length > 0 && !text.endsWith(".")) {
    text += ".";
  }

  return text;
}

export function extractEvidenceHighlights(snippet?: string): string[] {
  if (!snippet) return [];
  const highlights: string[] = [];

  // Look for location pattern
  const locMatch = snippet.match(/Location:\s*([A-Za-z\s,]+?)(?:—|·|Education|Connections|$)/i);
  if (locMatch && locMatch[1].trim().length > 2) {
    highlights.push(locMatch[1].trim());
  }

  // Look for connections
  const connMatch = snippet.match(/(\d+\+?\s*connections)/i);
  if (connMatch) {
    highlights.push(connMatch[1].trim());
  }

  // Look for education or background
  const eduMatch = snippet.match(/Education:\s*([A-Za-z0-9\s,\-\.]+?)(?:—|·|Location|Connections|$)/i);
  if (eduMatch && eduMatch[1].trim().length > 2) {
    highlights.push(eduMatch[1].trim());
  }

  return highlights;
}

export function formatExecutiveRole(rolePriority?: number, title?: string): { label?: string; isHighLevel: boolean } {
  const t = (title || "").toLowerCase();

  if (t.includes("founder") || t.includes("ceo") || t.includes("co-founder") || rolePriority === 1) {
    return { label: "Founder / Executive", isHighLevel: true };
  }
  if (t.includes("cto") || t.includes("vp") || t.includes("head of") || t.includes("chief") || rolePriority === 2) {
    return { label: "Leadership", isHighLevel: true };
  }
  if (t.includes("partner") || t.includes("director") || t.includes("principal") || rolePriority === 3) {
    return { label: "Director / Partner", isHighLevel: false };
  }

  // For general engineering or priority >= 4, do not output internal priority numbers
  return { label: undefined, isHighLevel: false };
}
