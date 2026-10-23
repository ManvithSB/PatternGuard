/**
 * PatternGuard CCPA 2023 Rules Engine — JavaScript port
 *
 * Direct transliteration of backend/rules.py.
 * Every rule ID, pattern_name, ccpa_guideline_reference, severity,
 * explanation, recommendation, and the span-deduplication algorithm
 * are preserved exactly so Android and web produce identical output.
 *
 * Disclaimer:
 * Matches produced by this engine are potential indicators requiring human
 * compliance review and do not constitute a definitive or formal legal
 * determination.
 *
 * Compatibility: ES2018+ (V8 on Android API 24+, all modern browsers).
 * Lookbehind assertions used in CCPA-BS-03 are fixed-width -> safe.
 */

// ---------------------------------------------------------------------------
// Text Pre-Normalization for OCR Robustness
// ---------------------------------------------------------------------------

export function normalizeTextForRules(text) {
  if (!text || typeof text !== 'string') return '';

  let s = text;

  // Normalize Unicode curly/smart quotes and dashes from iOS/macOS screenshots
  // OCR faithfully reads these, but regex rules expect ASCII equivalents
  s = s.replace(/\u2018/g, "'");   // left single curly quote  → ASCII apostrophe
  s = s.replace(/\u2019/g, "'");   // right single curly quote → ASCII apostrophe
  s = s.replace(/\u201C/g, '"');   // left double curly quote  → ASCII double quote
  s = s.replace(/\u201D/g, '"');   // right double curly quote → ASCII double quote
  s = s.replace(/\u2014/g, ' - '); // em dash → spaced hyphen
  s = s.replace(/\u2013/g, ' - '); // en dash → spaced hyphen

  // Currency misrecognitions in RapidOCR (e.g. '天' instead of '₹')
  s = s.replace(/[天]\s*(\d+)/g, '₹$1');

  // Normalize whitespace inside checkbox brackets: '[ x ]' -> '[x]', '[  ]' -> '[ ]'
  s = s.replace(/\[\s*([x✓\u2713\u2714v])\s*\]/gi, '[$1]');
  s = s.replace(/\[\s+\]/g, '[ ]');

  // Split camelCase words where lowercase letter is followed by uppercase letter
  // (e.g. 'ProcessingFee' -> 'Processing Fee', 'TotalPayable' -> 'Total Payable')
  s = s.replace(/([a-z])([A-Z])/g, '$1 $2');

  // Separate common agglutinated OCR tokens
  s = s.replace(/\b(at|in|onlyat|appliedat|revealedat)(checkout|payment|finalstep)\b/gi, '$1 $2');
  s = s.replace(/\b(processing|convenience|platform|handling|service|delivery|booking)(fee|fees|charge|charges)s?\b/gi, '$1 $2');
  s = s.replace(/\b(no|skip)(thanks?|now)\b/gi, '$1 $2');
  s = s.replace(/\b(limited)(time|period)\b/gi, '$1 $2');

  // Reconnect timer colons split with spaces: '02 : 45' -> '02:45'
  s = s.replace(/\b(\d{1,2})\s*:\s*(\d{2})(?:\s*:\s*(\d{2}))?\b/g, (match) => match.replace(/\s+/g, ''));

  // Collapse multiple whitespace characters into a single space
  return s.replace(/\s+/g, ' ').trim();
}

// ---------------------------------------------------------------------------
// Rule Definitions Mapped to CCPA 2023 & Consumer Protection Categories
// ---------------------------------------------------------------------------

export const RULE_DEFINITIONS = [
  // -------------------------------------------------------------------
  // 1. False Urgency
  // CCPA 2023 Annexure 1, Clause 1
  // -------------------------------------------------------------------
  {
    id: 'CCPA-FU-01',
    pattern_name: 'False Urgency',
    ccpa_guideline_reference:
      'CCPA Guidelines 2023, Annexure 1, Clause 1 (False Urgency)',
    severity: 'Medium',
    regex: /\b(?:hurry|offer|loan|cashback|approval|discount|reward|deal|sale)\b.{0,30}\b(?:expires|valid for|ends|ending|closes)\b.{0,25}\b(?:\d+\s*(?:mins?|minutes?|secs?|seconds?|hrs?|hours?|days?)|today only|now|tonight|midnight|end\s+of\s+day)\b/gi,
    explanation:
      'Suggests artificial time scarcity or psychological pressure on an offer or transaction. Note: Static image inspection flags this as a potential urgency indicator; whether the validity period is genuinely limited cannot be verified from a screenshot alone.',
    recommendation:
      'Display stable, transparent validity terms and allow users adequate time to evaluate transaction terms without simulated time pressure.',
  },
  {
    id: 'CCPA-FU-02',
    pattern_name: 'False Urgency',
    ccpa_guideline_reference:
      'CCPA Guidelines 2023, Annexure 1, Clause 1 (False Urgency)',
    severity: 'Medium',
    regex: /\b(?:(?:only|just)\s+)?(?:\d+\s+)?(?:minutes?|hours?|days?|mins?|hrs?)\s+left\b|\b(?:offer|deal|loan offer|credit offer|reward|sale|discount)\s+expires?\s+(?:soon|in\s+\d+\s+(?:minutes?|hours?|days?|mins?|hrs?))\b|\b(?:hurry|act now|limited\s+time(?:\s+offer)?|last chance|don'?t\s+miss\s+out|claim\s+(?:your\s+)?reward\s*(?:within\s*\d+\s*(?:mins?|minutes?))?|price\s+(?:increases|goes\s+up)\s+in\s+\d+\s*(?:mins?|minutes?|hrs?|hours?)|time\s+is\s+running\s+out|clock\s+is\s+ticking|running\s+out\s+of\s+time)\b|\b(?:deal|offer|sale|discount)\s+(?:ends|expires)\s+(?:at\s+midnight|tonight|today\s+only)\b|\b(?:order|book|reserve|buy|act)\s+within\s+\d+\s*(?:mins?|minutes?|secs?|seconds?|hrs?|hours?)\b/gi,
    explanation:
      'Creates immediate time pressure on offers, loans, or discounts. Note: Static inspection flags this as a potential indicator requiring verification of actual offer terms.',
    recommendation:
      'Disclose transparent eligibility criteria and stable validity periods rather than simulated urgency.',
  },
  {
    id: 'CCPA-FU-03',
    pattern_name: 'False Urgency',
    ccpa_guideline_reference:
      'CCPA Guidelines 2023, Annexure 1, Clause 1 (False Urgency)',
    severity: 'Medium',
    regex: /(?:\b(?:limited\s+time(?:\s+offer)?|limited\s+period|expires?\s+in|expires?\s+soon|hurry|claim\s+now|claim\s+your\s+reward|within\s+\d+\s+(?:mins?|minutes?|secs?|seconds?|hrs?|hours?)|don'?t\s+miss\s+out|flash\s+sale|deal\s+ends?\s+in)\b.{0,120}\b(?:\d{1,2}:\d{2}(?::\d{2})?)\b|\b(?:\d{1,2}:\d{2}(?::\d{2})?)\b.{0,120}\b(?:limited\s+time(?:\s+offer)?|expires?\s+in|expires?\s+soon|claim\s+now|claim\s+your\s+reward|don'?t\s+miss\s+out|flash\s+sale|deal\s+ends?\s+in)\b)/gi,
    explanation:
      'Pairs an urgency cue with a ticking countdown clock to induce hasty commitments. Note: Flagged as a potential indicator; screenshot inspection cannot verify whether the countdown is artificial.',
    recommendation:
      'Provide steady validity terms without artificial countdown timers on interface offers.',
  },
  {
    id: 'CCPA-FU-ID-01',
    pattern_name: 'False Urgency',
    ccpa_guideline_reference:
      'CCPA Guidelines 2023, Annexure 1, Clause 1 (False Urgency)',
    severity: 'Medium',
    regex: /\b(?:waktu\s*terbatas|promo\s*terbatas|penawaran\s*terbatas|hanya\s*hari\s*ini|buruan)\b.{0,40}(?:\b\d{1,2}:\d{2}(?::\d{2})?\b|\b(?:\d+\s*(?:menit|detik|jam)|segera|dapatkan\s*sekarang)\b)|\b(?:\d{1,2}:\d{2}(?::\d{2})?)\b.{0,40}\b(?:waktu\s*terbatas|dapatkan\s*sekarang|segera)\b/gi,
    explanation:
      "Creates artificial pressure through ticking countdown timers or limited-time claims ('waktu terbatas') on fintech interfaces.",
    recommendation:
      'Display stable validity terms and avoid artificial countdown clocks on credit products.',
  },
  {
    id: 'CCPA-FU-ID-02',
    pattern_name: 'False Urgency',
    ccpa_guideline_reference:
      'CCPA Guidelines 2023, Annexure 1, Clause 1 (False Urgency)',
    severity: 'Low',
    regex: /\b(?:waktu\s*terbatas|penawaran\s*terbatas|kuota\s*terbatas|hanya\s*tersisa\s*\d+)\b/gi,
    explanation:
      "Signals limited-time availability or restricted quotas ('waktu terbatas') to encourage immediate financial transactions.",
    recommendation:
      'Ensure availability disclosures reflect genuine constraints rather than simulated urgency.',
  },

  // -------------------------------------------------------------------
  // 2. False Scarcity
  // CCPA 2023 Annexure 1, Clause 1 & FTC Deceptive Patterns
  // -------------------------------------------------------------------
  {
    id: 'CCPA-FS-01',
    pattern_name: 'False Scarcity',
    ccpa_guideline_reference:
      'CCPA Guidelines 2023, Annexure 1, Clause 1 (False Urgency & Scarcity)',
    severity: 'Medium',
    regex: /\b(?:(?:only|just|last)\s+\d+\s+(?:items?|units?|rooms?|seats?|tickets?|spots?|places?|left|remaining)(?:\s+(?:in\s+stock|available))?|only\s+\d+\s+left\s+at\s+this\s+price|almost\s+sold\s+out|selling\s+fast|limited\s+stock(?:\s+available)?|low\s+stock\s+alert|hurry,?\s+only\s+\d+\s+left)\b/gi,
    explanation:
      "Suggests acute inventory scarcity (e.g. 'only X left in stock' or 'just 2 seats remaining') to trigger fear of missing out. Note: Static inspection flags this as a potential scarcity indicator requiring inventory log verification.",
    recommendation:
      'Ensure inventory counts accurately reflect real-time stock without artificial scarcity claims.',
  },
  {
    id: 'CCPA-FS-02',
    pattern_name: 'False Scarcity',
    ccpa_guideline_reference:
      'CCPA Guidelines 2023, Annexure 1, Clause 1 (False Urgency & Scarcity)',
    severity: 'Medium',
    regex: /\b(?:high\s+demand\b.{0,35}\b(?:viewing|looking|buyers?)|in\s+\d+\s+(?:people'?s?\s+)?carts?|\d+\s+people\s+(?:are\s+)?(?:viewing|looking\s+at|buying)\s+this(?:\s+right\s+now)?)\b/gi,
    explanation:
      "Displays real-time popularity or peer activity counters (e.g. 'in 15 carts') to simulate competitive buying pressure and artificial scarcity.",
    recommendation:
      'Avoid simulated popularity or cart indicators unless independently audited and based on authentic, concurrent user sessions.',
  },

  // -------------------------------------------------------------------
  // 3. Confirmshaming
  // CCPA 2023 Annexure 1, Clause 3
  // -------------------------------------------------------------------
  {
    id: 'CCPA-CS-01',
    pattern_name: 'Confirmshaming',
    ccpa_guideline_reference:
      'CCPA Guidelines 2023, Annexure 1, Clause 3 (Confirmshaming)',
    severity: 'High',
    regex: /\b(?:no\s*,?\s*thanks?|decline|reject|skip|cancel|no)\b.{0,40}\b(?:hate\s+(?:savings?|cashback|money|discounts?)|don'?t\s+(?:want|need|care\s+about)\s+(?:savings?|discounts?|protection|cashback|security|safety|the\s+best\s+price)|(?:prefer|choose|rather)\s+paying?\s+full(?:\s+price)?|rather\s+pay\s+full|leave\s+me\s+unprotected|keep\s+(?:me\s+)?at\s+risk|choose\s+to\s+miss\s+out)\b/gi,
    explanation:
      'Uses emotionally manipulative, derogatory, or guilt-inducing phrasing in the rejection button to make users feel foolish for declining an offer.',
    recommendation:
      "Provide neutral, factual rejection options such as 'No thanks', 'Skip', or 'Decline'.",
  },
  {
    id: 'CCPA-CS-02',
    pattern_name: 'Confirmshaming',
    ccpa_guideline_reference:
      'CCPA Guidelines 2023, Annexure 1, Clause 3 (Confirmshaming)',
    severity: 'Medium',
    regex: /\b(?:i\s+don'?t\s+want\s+(?:to\s+save\s+money|savings?|discounts?|cashback|protection|the\s+best\s+price)|i\s+don'?t\s+care\s+about\s+(?:saving\s+money|savings?|discounts?|cashback|security)|i\s+prefer\s+paying\s+(?:higher\s+interest|more|extra|full\s+price)|i\s+hate\s+(?:discounts?|saving\s+money|cashback)|i\s+love\s+paying\s+(?:more|extra|full\s+price)|skip\s+and\s+lose\s+(?:reward|offer|discount|savings)|no\s*,?\s*keep\s+me\s+at\s+risk)\b/gi,
    explanation:
      'Frames the decline option with self-defeating language to emotionally coerce user acceptance.',
    recommendation:
      'Ensure opt-out mechanisms are framed respectfully, neutrally, and objectively without editorializing.',
  },

  // -------------------------------------------------------------------
  // 4. Hidden Costs / Drip Pricing
  // CCPA 2023 Annexure 1, Clause 6
  // -------------------------------------------------------------------
  {
    id: 'CCPA-DP-01',
    pattern_name: 'Drip Pricing',
    ccpa_guideline_reference:
      'CCPA Guidelines 2023, Annexure 1, Clause 6 (Drip Pricing)',
    severity: 'High',
    regex: /\b(?:processing|convenience|platform|gateway|handling|service|delivery|booking|administrative|admin)\s*(?:fee|fees|charge|charges|cost|costs)\b.{0,70}\b(?:is|was|will\s*be|are)?\s*(?:(?:non-?refundable|mandatory|automatically)?\s*(?:and|,)?\s*)*(?:applied|added|charged|revealed|levied|apply|applies)\b.{0,50}\b(?:at\s*checkout|at\s*payment|at\s*final\s*step|before\s*payment|only\s*at\s*checkout)\b|\b(?:advertised\s+price|listed\s+price|initial\s+price)\s+excludes\s+(?:the\s+)?(?:mandatory\s+|additional\s+)?(?:processing|convenience|platform|service|booking|handling)?\s*(?:fees?|charges?)\b|\b(?:additional|mandatory|extra|hidden|surprise|undisclosed)\s*(?:convenience\s*fee|platform\s*(?:fee|charge)|processing\s*(?:fee|charge)|gateway\s*charge|handling\s*fee|service\s*(?:fee|charge)|booking\s*fee)\b(?:.{0,60}\b(?:added|applied|revealed|charged|apply|applies)\b.{0,60}\b(?:at\s*checkout|at\s*payment|before\s*payment|at\s*final\s*step)\b)?|\b(?:processing|convenience|platform|gateway|handling|service)\s*fee\b.{0,100}\b(?:added\s*only|revealed|not\s*included|added|revealed)\b.{0,60}\b(?:at\s*checkout|at\s*payment|only\s*at\s*checkout|in\s*advertised\s*price|at\s*final\s*step)\b/gi,
    explanation:
      'Reveals mandatory platform, convenience, or processing charges at the concluding payment step rather than presenting all-inclusive pricing upfront, or explicitly states that advertised prices exclude mandatory fees.',
    recommendation:
      'Disclose full inclusive cost or all mandatory fees upfront before the user commences the checkout or loan application funnel.',
  },
  {
    id: 'CCPA-DP-02',
    pattern_name: 'Drip Pricing',
    ccpa_guideline_reference:
      'CCPA Guidelines 2023, Annexure 1, Clause 6 (Drip Pricing)',
    severity: 'Medium',
    regex: /\b(?:surprise\s+processing\s+fee|fee\s*(?:is\s+)?applied\s*at\s*(?:checkout|payment)|fee\s*added\s*at\s*(?:final\s*step|checkout|payment)|platform\s+charges?\s+apply\s+at\s*(?:checkout|payment)|undisclosed\s+convenience\s+fee|taxes?\s*(?:and|&)\s*fees?\s*calculated\s*at\s*(?:checkout|next\s*step|payment))\b/gi,
    explanation:
      'Withholds mandatory charges or postpones fee calculation until the transaction is near completion.',
    recommendation:
      'Display total payable amounts with clear upfront itemization from the earliest stage.',
  },

  // -------------------------------------------------------------------
  // 5. Misleading Discounts / Deceptive Pricing
  // CCPA 2023 Annexure 1, Clause 8 & FTC Guides
  // -------------------------------------------------------------------
  {
    id: 'CCPA-MD-01',
    pattern_name: 'Misleading Discounts',
    ccpa_guideline_reference:
      'CCPA Guidelines 2023, Annexure 1, Clause 8 (Misleading Pricing)',
    severity: 'Medium',
    regex: /\b(?:was|mrp|original\s+price|list\s+price|regular\s+price|price\s+dropped\s+from)\b\s*[:\-–—]?\s*(?:₹|rs\.?|inr|\$|rp)\s*[\d,.]+\s*(?:now|sale|today|special|discounted|to)\s*[:\-–—]?\s*(?:₹|rs\.?|inr|\$|rp)\s*[\d,.]+/gi,
    explanation:
      "Displays substantial reference price comparisons ('Was ... Now ...'). Note: Static image inspection flags this as a potential pricing indicator; verifying whether the baseline price was genuine requires prior sales history.",
    recommendation:
      'Ensure reference prices reflect genuine prior selling prices and avoid artificial baseline inflations.',
  },
  {
    id: 'CCPA-MD-02',
    pattern_name: 'Misleading Discounts',
    ccpa_guideline_reference:
      'CCPA Guidelines 2023, Annexure 1, Clause 8 (Misleading Pricing)',
    severity: 'Medium',
    regex: /\b(?:flat\s+\d+%\s+off\s+on\s+all|save\s+(?:up\s+to\s+)?\d+%\s+today\s+only|guaranteed\s+lowest\s+price|unbeatable\s+deal\s+today)\b/gi,
    explanation:
      'Promotes sweeping or unconditional discount claims. Flagged as a potential indicator requiring verification of actual terms and exclusions.',
    recommendation:
      'Provide clear, prominent terms and conditions accompanying discount claims without misleading superlatives.',
  },

  // -------------------------------------------------------------------
  // 6. Subscription Traps / Forced Continuity
  // CCPA 2023 Annexure 1, Clause 5
  // -------------------------------------------------------------------
  {
    id: 'CCPA-ST-01',
    pattern_name: 'Subscription Traps',
    ccpa_guideline_reference:
      'CCPA Guidelines 2023, Annexure 1, Clause 5 (Forced Continuity)',
    severity: 'Medium',
    regex: /(?:(?:free\s+trial|\d+[\s-]+days?\s+free)\b.{0,40}\b(?:then|afterwards|automatically\s+renews?|renews?\s+at|billed\s+at)\b.{0,30}(?:₹|rs\.?|inr|\$|rp)?\s*[\d,.]+\s*(?:\/\s*(?:month|mo|year|yr)|per\s+(?:month|year))(?:\s*\([^\)]*\))?)/gi,
    explanation:
      'Converts a free trial or introductory period into automatic recurring paid billing. Flagged as a potential indicator requiring review of whether terms are prominent and cancellation is frictionless.',
    recommendation:
      'Provide prominent, unambiguous disclosure of renewal dates, recurring fees, and simple one-click cancellation before starting a trial.',
  },
  {
    id: 'CCPA-ST-02',
    pattern_name: 'Subscription Traps',
    ccpa_guideline_reference:
      'CCPA Guidelines 2023, Annexure 1, Clause 5 (Forced Continuity)',
    severity: 'Medium',
    regex: /\b(?:(?:subscription|membership|plan)\s+(?:will\s+)?renew\s+automatically|auto-?renews?\s+automatically|automatically\s+renews?\s+(?:every|each|monthly|annually)|(?:will\s+be|are|you'll\s+be|you\s+will\s+be)\s+charged\b.{0,40}\bunless\s+you\s+cancell?|(?:will\s+be|are)\s+charged\s+every\s+(?:month|year|billing\s+cycle)|recurring\s+charge\s+unless\s+cancell?ed|recurring\s+billing\s+(?:starts|begins)|billed\s+monthly\s+after\s+trial)\b/gi,
    explanation:
      "Enrolls users into automatic recurring billing unless actively cancelled before a scheduled date. Note: Automatic renewal is standard across subscription services; this is flagged as a potential indicator to confirm that cancellation parity ('click-to-cancel') is honored.",
    recommendation:
      'Require affirmative opt-in for ongoing recurring billing with straightforward self-serve cancellation and advance renewal reminders.',
  },
  {
    id: 'CCPA-ST-03',
    pattern_name: 'Subscription Traps',
    ccpa_guideline_reference:
      'CCPA Guidelines 2023, Annexure 1, Clause 5 (Price Framing in Subscriptions)',
    severity: 'Low',
    regex: /(?:₹|rs\.?|inr|\$|rp)\s*[\d,.]+\s*(?:\/\s*(?:year|yr)|per\s+year)\s*\(\s*(?:₹|rs\.?|inr|\$|rp)\s*[\d,.]+\s*(?:\/\s*(?:month|mo)|per\s+month)\s*\)/gi,
    explanation:
      "Displays an upfront annual subscription framed as a low monthly installment (e.g. '$149.99/yr ($12.50/month)'), which may obscure the full immediate annual commitment.",
    recommendation:
      'Clearly state the total upfront annual charge alongside any monthly equivalent breakdown.',
  },

  // -------------------------------------------------------------------
  // 7. Obstructive Choice Design
  // CCPA 2023 Annexure 1, Clause 7 (Interface Interference)
  // -------------------------------------------------------------------
  {
    id: 'CCPA-OC-01',
    pattern_name: 'Obstructive Choice Design',
    ccpa_guideline_reference:
      'CCPA Guidelines 2023, Annexure 1, Clause 7 (Interface Interference)',
    severity: 'High',
    regex: /\b(?:to\s+cancell?\s+(?:your\s+)?(?:subscription|account|membership|service)\s*,?\s*(?:call|contact|phone|speak\s+with)\b.{0,40}\b(?:support|customer\s+service|representative|phone|desk|hours))\b|\b(?:cancellation\s+only\s+(?:via|by|through)\s+(?:phone|calling|post|mail))\b|\b(?:call\s+(?:us\s+)?to\s+cancel|cancellations?\s+(?:must\s+be\s+done\s+by\s+calling|not\s+allowed\s+online))\b|\b(?:(?:cannot|can\s+not|unable\s+to)\s+cancel\s+(?:your\s+)?(?:online|via\s+app|in\s+app|from\s+(?:the\s+)?website))\b/gi,
    explanation:
      'Creates burdensome obstacles or asymmetric friction to cancel a service (such as mandating phone calls during restricted hours or forbidding online cancellation).',
    recommendation:
      "Ensure cancellation mechanisms are at least as accessible and simple as signing up ('click-to-cancel' parity).",
  },

  // -------------------------------------------------------------------
  // 8. Basket Sneaking
  // CCPA 2023 Annexure 1, Clause 2
  // -------------------------------------------------------------------
  {
    id: 'CCPA-BS-01',
    pattern_name: 'Basket Sneaking',
    ccpa_guideline_reference:
      'CCPA Guidelines 2023, Annexure 1, Clause 2 (Basket Sneaking)',
    severity: 'High',
    regex: /\b(?<!not\s)(?<!un)(?:automatically\s+added|auto-added|pre-?selected|pre-?ticked|default\s+tip|added\s+by\s+default|selected\s+by\s+default)\b.{0,50}\b(?:(?:extended\s+)?warranty|insurance|protection(?:\s+plan)?|coverage|donation|gift\s*wrap(?:ping)?|tip|care\s*plan)\b/gi,
    explanation:
      'Automatically includes or pre-selects an ancillary service or payment add-on without affirmative user opt-in.',
    recommendation:
      'Require explicit, un-checked opt-in checkboxes before adding any supplementary fee, warranty, or insurance to the transaction.',
  },
  {
    id: 'CCPA-BS-02',
    pattern_name: 'Basket Sneaking',
    ccpa_guideline_reference:
      'CCPA Guidelines 2023, Annexure 1, Clause 2 (Basket Sneaking)',
    severity: 'High',
    regex: /\b(?:(?:extended\s+)?warranty|insurance|protection(?:\s+plan)?|device\s*care|gift\s*wrap(?:ping)?|donation|care\s*plan|tip)\b.{0,50}\b(?<!not\s)(?<!un)(?:automatically\s+added|auto-added|pre-?ticked|pre-?selected|selected\s+by\s+default|added\s+by\s+default)\b/gi,
    explanation:
      'Pre-selects supplementary warranty, insurance, or non-essential paid add-ons into the payment basket by default.',
    recommendation:
      'All auxiliary products and warranties should remain unselected by default, giving the consumer complete autonomy.',
  },
  {
    id: 'CCPA-BS-03',
    pattern_name: 'Basket Sneaking',
    ccpa_guideline_reference:
      'CCPA Guidelines 2023, Annexure 1, Clause 2 (Basket Sneaking)',
    severity: 'High',
    // ES2018 fixed-width lookbehind: (?<!not\s) = 4 chars, (?<!un) = 2 chars
    regex: /(?:\[[x✓\u2713\u2714v]\]|☑|(?<!not\s)(?<!un)\b(?:pre-?selected|pre-?ticked|selected)\b)\s*[:\-–—]?\s*(?:(?:extended\s+)?warranty|insurance|protection(?:\s+plan)?|device\s*care|gift\s*wrap(?:ping)?|donation|care\s*plan)\b.{0,30}(?:₹|rs\.?|inr|rp|\$)\s*[\d,.]+|(?:\b(?:extended\s+)?warranty|insurance|protection(?:\s+plan)?|device\s*care|gift\s*wrap(?:ping)?|donation|care\s*plan)\b.{0,30}(?:₹|rs\.?|inr|rp|\$)\s*[\d,.]+.{0,35}(?:\[[x✓\u2713\u2714v]\]|☑|(?<!not\s)(?<!un)\b(?:pre-?selected|pre-?ticked|selected|added\s+to\s+(?:order|cart|total)|included\s+in\s+total)\b)|(?:\b(?:extended\s+)?warranty|insurance|protection(?:\s+plan)?|device\s*care|gift\s*wrap(?:ping)?|donation|care\s*plan)\b.{0,35}(?:\[[x✓\u2713\u2714v]\]|☑)\s*[:\-–—]?\s*(?:₹|rs\.?|inr|rp|\$)\s*[\d,.]+/gi,
    explanation:
      'Identifies an optional paid add-on paired with price and a selection indicator in the order summary. Note: Text-based inspection flags this as a potential indicator requiring human review to confirm whether it was selected by default or intentionally opted into by the consumer.',
    recommendation:
      'Ensure all optional paid add-ons remain unchecked by default and are only charged when the user deliberately checks the selection box.',
  },
  {
    id: 'CCPA-BS-04',
    pattern_name: 'Basket Sneaking',
    ccpa_guideline_reference:
      'CCPA Guidelines 2023, Annexure 1, Clause 2 (Basket Sneaking)',
    severity: 'High',
    regex: /\b(?<!not\s)(?<!un)(?:auto-?added\s+to\s+(?:cart|basket|order)|automatically\s+added\s+to\s+(?:cart|basket|order)|pre-?selected\s+(?:tip|donation|insurance|warranty|protection))\b|\b(?:optional\s+)?(?:donation|tip|carbon\s*offset|device\s*care|insurance|warranty)\b.{0,35}\b(?<!not\s)(?<!un)(?:added\s+automatically|automatically\s+added|selected\s+by\s+default|auto-added)\b/gi,
    explanation:
      "Detects indications of unsolicited items, tips, or donations automatically placed in the consumer's cart.",
    recommendation:
      'Require affirmative manual selection before adding tips, donations, or extra services to the checkout basket.',
  },
  {
    id: 'CCPA-BS-ES-01',
    pattern_name: 'Basket Sneaking',
    ccpa_guideline_reference:
      'CCPA Guidelines 2023, Annexure 1, Clause 2 (Basket Sneaking)',
    severity: 'High',
    regex: /\b(?:garantia|garant[ií]a)\s+extendida\b.{0,25}\b(?:agregad[oa]|a[ñn]adid[oa]|incluid[oa])\b/gi,
    explanation:
      "Detects a paid extended warranty in Spanish checkout text described as already added ('agregada', 'añadida', 'incluida') without clear prior consent.",
    recommendation:
      'Ensure optional warranties are unchecked by default and only charged when the user explicitly selects them.',
  },

  // -------------------------------------------------------------------
  // 9. Suspicious Consent Requests
  // CCPA 2023 Annexure 1, Clause 10 (Bundled / Deceptive Consent)
  // -------------------------------------------------------------------
  {
    id: 'CCPA-SC-01',
    pattern_name: 'Suspicious Consent',
    ccpa_guideline_reference:
      'CCPA Guidelines 2023, Annexure 1, Clause 10 (Deceptive / Bundled Consent)',
    severity: 'Medium',
    regex: /\b(?:by\s+(?:clicking|continuing|signing\s*up|submitting|checking\s*this\s*box|registering|creating\s+an\s+account)\s*,?\s*you\s+(?:agree|consent)\s+to\s+(?:receive\s+(?:promotional|marketing|commercial|\s|,)*(?:calls|sms|messages|emails?|communications)|share\s+(?:your\s+)?(?:(?:personal|contact)\s+)?(?:data|information|details)\s+with\s+(?:third\s*parties|partners|affiliates|advertisers|sponsors)))\b|\b(?:agree\s+to\s+receive\s+(?:promotional|marketing|commercial)\s*(?:calls|sms|messages|emails?|communications))\b/gi,
    explanation:
      'Bundles mandatory service terms with consent to receive promotional marketing calls, SMS, or commercial communications without separate unbundled consent.',
    recommendation:
      'Provide distinct, unbundled opt-in choices for marketing communications separate from essential terms of service.',
  },
  {
    id: 'CCPA-SC-02',
    pattern_name: 'Suspicious Consent',
    ccpa_guideline_reference:
      'CCPA Guidelines 2023, Annexure 1, Clause 10 (Deceptive / Bundled Consent)',
    severity: 'Medium',
    regex: /\b(?:agree\s+to\s+share\s+(?:your\s+)?(?:(?:personal|contact)\s+)?(?:data|information|details)\s+with\s+(?:third\s*parties|affiliates|partners|advertisers|sponsors)|i\s+consent\s+to\s+receive\s+unsolicited\s+(?:commercial|marketing)\s+communications)\b/gi,
    explanation:
      'Indicates bundled third-party data sharing or unsolicited commercial communications tied to standard interface progression.',
    recommendation:
      'Make data sharing with third-party advertising partners strictly optional with explicit affirmative consent.',
  },
];

// ---------------------------------------------------------------------------
// Detection Engine
// ---------------------------------------------------------------------------

/**
 * Scans input text for potential CCPA dark pattern indicators.
 * Returns an array of structured findings. Does not claim a legal violation.
 *
 * @param {string} text - Raw OCR-extracted or user-supplied text.
 * @returns {Array<Object>} findings
 */
export function detectDarkPatterns(text) {
  if (!text || typeof text !== 'string') return [];

  // Apply OCR text normalization (mirrors Python normalize_text_for_rules)
  const normalizedText = normalizeTextForRules(text);
  if (!normalizedText) return [];

  // ── Phase 1: collect ALL matches with their character spans ──────────────
  const raw = [];

  for (const rule of RULE_DEFINITIONS) {
    // Reset lastIndex since all regexes carry the `g` flag
    rule.regex.lastIndex = 0;

    let match;
    while ((match = rule.regex.exec(normalizedText)) !== null) {
      const matchedText = match[0].trim();
      const start = match.index;
      const end = match.index + match[0].length;

      raw.push({
        start,
        end,
        pname: rule.pattern_name,
        finding: {
          rule_id: rule.id,
          pattern_name: rule.pattern_name,
          matched_evidence: matchedText,
          ccpa_guideline_reference: rule.ccpa_guideline_reference,
          severity: rule.severity,
          status: 'potential_indicator',
          disclaimer:
            'Potential indicator requiring human compliance review; not a definitive legal violation.',
          explanation: rule.explanation,
          recommendation: rule.recommendation,
        },
      });

      // Prevent infinite loops on zero-length matches (safety guard)
      if (match[0].length === 0) {
        rule.regex.lastIndex++;
      }
    }
  }

  // ── Phase 2: keep only the widest non-subsumed span per pattern_name ─────
  // Sort widest-first so we always prefer the more informative match.
  raw.sort((a, b) => (b.end - b.start) - (a.end - a.start));

  const kept = [];
  const keptSpans = []; // [{ pname, start, end }]

  for (const entry of raw) {
    const { start: s, end: e, pname } = entry;
    const subsumed = keptSpans.some(
      ({ pname: kpname, start: ks, end: ke }) =>
        kpname === pname && s >= ks && e <= ke
    );
    if (!subsumed) {
      keptSpans.push({ pname, start: s, end: e });
      kept.push(entry);
    }
  }

  // Restore document order (by start position)
  kept.sort((a, b) => a.start - b.start);
  return kept.map((r) => r.finding);
}
