// Ported from math_engine/investor_encoder.py's _VERTICAL_KEYWORDS /
// _text_vertical_weights. Keyword fallback for vertical inference from free text
// (bios + portfolio company descriptions), used only when neither contact_verticals
// nor the firm's vertical_focus have any tags. Keys must match verticals.vertical_name
// exactly.
const VERTICAL_KEYWORDS: Record<string, string[]> = {
  "AI": ["ai", "artificial intelligence", "machine learning", "ml", "generative ai",
         "genai", "neural network", "large language model", "llm"],
  "Ad Tech": ["advertising", "ad tech", "adtech", "ad platform", "programmatic advertising"],
  "Commercial Real Estate (CRE)": ["real estate", "cre", "commercial property", "property management"],
  "Consumer": ["consumer app", "direct-to-consumer", "d2c", "social network", "mobile app"],
  "Consumer Products": ["consumer product", "cpg", "packaged goods", "retail brand"],
  "Cybersecurity": ["security", "cyber", "vulnerability", "threat detection",
                     "encryption", "malware", "data breach"],
  "Fintech & Crypto": ["fintech", "financial technology", "payments", "banking",
                        "crypto", "blockchain", "web3", "defi", "stablecoin", "cryptocurrency"],
  "Infrastructure": ["infrastructure", "cloud", "devops", "developer tools",
                      "api platform", "data pipeline", "kubernetes"],
  "Marketplace & Commerce": ["marketplace", "e-commerce", "ecommerce", "commerce platform",
                              "online retail", "supply chain"],
  "SaaS": ["saas", "software as a service", "b2b software", "enterprise software"],
  "Sport Tech": ["sports", "athlete", "fitness", "sport tech"],
};

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const VERTICAL_PATTERNS: [string, RegExp][] = Object.entries(VERTICAL_KEYWORDS).map(
  ([vertical, keywords]) => [
    vertical,
    new RegExp(`\\b(?:${keywords.map(escapeRegExp).join("|")})\\b`, "gi"),
  ],
);

export function textVerticalWeights(text: string): Record<string, number> {
  if (!text) return {};
  const counts: Record<string, number> = {};
  for (const [vertical, pattern] of VERTICAL_PATTERNS) {
    const matches = text.match(pattern);
    if (matches && matches.length > 0) counts[vertical] = matches.length;
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (total === 0) return {};
  return Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, v / total]));
}
