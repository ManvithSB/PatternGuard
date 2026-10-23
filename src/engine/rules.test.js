/**
 * PatternGuard JS Rules Engine — Test Suite
 *
 * Mirrors the golden test cases from backend/test_rules.py so that the
 * JavaScript port can be validated against the same inputs and expected
 * outputs as the Python backend.
 *
 * Run with: node src/engine/rules.test.js
 */

import { detectDarkPatterns, normalizeTextForRules } from './rules.js';

// ---------------------------------------------------------------------------
// Minimal test harness (no external dependencies required)
// ---------------------------------------------------------------------------
let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`[FAIL] ${message}`);
    failed++;
  } else {
    console.log(`[PASS] ${message}`);
    passed++;
  }
}

// ---------------------------------------------------------------------------
// Test 1 — Clean fintech screen produces zero false positives (Negative)
// ---------------------------------------------------------------------------
{
  const cleanText =
    'Pay ₹1,250 to FreshBite Mart via UPI. ' +
    'Select your bank account: State Bank of India (..4321). ' +
    'Processing fee: ₹0. GST: ₹0. Total payable: ₹1,250. ' +
    'Enter UPI PIN to authorize payment.';

  const findings = detectDarkPatterns(cleanText);
  assert(
    findings.length === 0,
    `Test 1: Clean fintech screen produced zero false positives (got ${findings.length})`
  );
}

// ---------------------------------------------------------------------------
// Test 2 — Normal banking dashboard produces zero false positives (Negative)
// ---------------------------------------------------------------------------
{
  const dashboardText =
    'Welcome to HDFC NetBanking. Savings Account No: XX9821. Available Balance: ₹45,820.50. Total Outflow This Month: ₹1,770.';
  const findings = detectDarkPatterns(dashboardText);
  assert(findings.length === 0, `Test 2: Normal banking dashboard produced zero false positives (got ${findings.length})`);
}

// ---------------------------------------------------------------------------
// Test 3 — Transparent upfront pricing produces zero false positives (Negative)
// ---------------------------------------------------------------------------
{
  const transparentText =
    'Wireless Headphones Pro. Price: ₹2,999. Shipping: ₹0. Taxes included. All fees included in advertised price. Total: ₹2,999.';
  const findings = detectDarkPatterns(transparentText);
  assert(findings.length === 0, `Test 3: Transparent upfront pricing produced zero false positives (got ${findings.length})`);
}

// ---------------------------------------------------------------------------
// Test 4 — False Urgency expanded detection (Positive)
// ---------------------------------------------------------------------------
{
  const urgencyPhrases = [
    'Hurry! Pre-approved personal loan offer expires in 5 mins. Avail ₹2,00,000 now.',
    'Special Festive Offer ends at midnight! Claim your discount now.',
    'Time is running out! Complete your booking before it is gone.',
    'Your deal expires in 10 minutes. Act now!',
    'Clock is ticking! Flash sale ends in 05:00.',
  ];
  for (const text of urgencyPhrases) {
    const findings = detectDarkPatterns(text);
    const fuFindings = findings.filter((f) => f.pattern_name === 'False Urgency');
    assert(fuFindings.length >= 1, `Test 4: False Urgency detected in: "${text}"`);
    if (fuFindings.length >= 1) {
      assert(fuFindings[0].status === 'potential_indicator', 'Test 4: Status is potential_indicator');
    }
  }
}

// ---------------------------------------------------------------------------
// Test 5 — False Urgency negative cases (Negative)
// ---------------------------------------------------------------------------
{
  const neutralUrgencyCases = [
    'Store hours: Monday to Friday 9:00 AM to 6:00 PM.',
    'Estimated delivery in 2-3 business days.',
    'Payment received at 12:00 midnight. Transaction ID: 987654.',
    'System maintenance window: 02:00:00 to 04:00:00.',
  ];
  for (const sample of neutralUrgencyCases) {
    const findings = detectDarkPatterns(sample);
    const fuFindings = findings.filter((f) => f.pattern_name === 'False Urgency');
    assert(fuFindings.length === 0, `Test 5: Neutral timestamp or store hour falsely flagged: "${sample}"`);
  }
}

// ---------------------------------------------------------------------------
// Test 6 — False Scarcity detection (Positive)
// ---------------------------------------------------------------------------
{
  const scarcitySamples = [
    'There are just 2 seats remaining! Book now.',
    'Only 3 items left in stock. Order now before it is gone!',
    'Almost sold out! Last 2 units available at this price.',
    'Selling fast — only 1 room left!',
    'High demand: 18 people are viewing this right now.',
    'In 12 people\'s carts! Limited stock available.',
  ];
  for (const sample of scarcitySamples) {
    const findings = detectDarkPatterns(sample);
    const fsFindings = findings.filter((f) => f.pattern_name === 'False Scarcity');
    assert(fsFindings.length >= 1, `Test 6: False Scarcity detected in: "${sample}"`);
    if (fsFindings.length >= 1) {
      assert(fsFindings[0].severity === 'Medium' || fsFindings[0].severity === 'Low', 'Test 6: Severity calibrated');
    }
  }
}

// ---------------------------------------------------------------------------
// Test 7 — False Scarcity negative cases (Negative)
// ---------------------------------------------------------------------------
{
  const neutralCases = [
    'Party size: 3 seats reserved for dinner.',
    'Table for 2 people reserved under John Doe.',
    'Account balance: 5 reward points available to redeem.',
    'Select quantity: 2 items in your cart.',
  ];
  for (const sample of neutralCases) {
    const findings = detectDarkPatterns(sample);
    const fsFindings = findings.filter((f) => f.pattern_name === 'False Scarcity');
    assert(fsFindings.length === 0, `Test 7: Neutral count falsely flagged as False Scarcity: "${sample}"`);
  }
}

// ---------------------------------------------------------------------------
// Test 8 — Confirmshaming detection (Positive)
// ---------------------------------------------------------------------------
{
  const shamingSamples = [
    'Activate UPI AutoPay for instant bill payments. [Accept] or [No thanks, I hate savings].',
    'Protect your trip for ₹199? [Yes, protect] [No, I prefer paying full price].',
    'Do you want 15% discount? [Claim Discount] [No thanks, keep me at risk].',
    'Upgrade to Gold Membership? [Upgrade] [No, I don\'t want the best price].',
    'Get instant protection: [Yes, protect me] [No, I choose to miss out].',
    'Save 20% today? [Apply Coupon] [No, I\'d rather pay full price].',
  ];
  for (const sample of shamingSamples) {
    const findings = detectDarkPatterns(sample);
    const csFindings = findings.filter((f) => f.pattern_name === 'Confirmshaming');
    assert(csFindings.length >= 1, `Test 8: Confirmshaming detected in: "${sample}"`);
  }
}

// ---------------------------------------------------------------------------
// Test 9 — Confirmshaming negative cases (Negative)
// ---------------------------------------------------------------------------
{
  const neutralDeclineCases = [
    'Would you like to subscribe to our newsletter? [Yes] [No thanks]',
    'Skip this step to continue to dashboard.',
    'I prefer to pay by Credit Card instead of Net Banking.',
    'Decline optional insurance and proceed with standard order.',
  ];
  for (const sample of neutralDeclineCases) {
    const findings = detectDarkPatterns(sample);
    const csFindings = findings.filter((f) => f.pattern_name === 'Confirmshaming');
    assert(csFindings.length === 0, `Test 9: Neutral decline falsely flagged: "${sample}"`);
  }
}

// ---------------------------------------------------------------------------
// Test 10 — Drip Pricing / Hidden Fees detection (Positive)
// ---------------------------------------------------------------------------
{
  const dripSamples = [
    'Processing fee is non-refundable and applied at checkout.',
    'An additional service fee will be added before payment.',
    'Platform charges apply at checkout.',
    'The advertised price excludes the processing fee.',
    'The advertised price excludes the mandatory processing fee.',
    'A mandatory convenience fee was added at payment.',
    'Convenience fee added only at checkout.',
  ];
  for (const sample of dripSamples) {
    const findings = detectDarkPatterns(sample);
    const dpFindings = findings.filter((f) => f.pattern_name === 'Drip Pricing');
    assert(dpFindings.length >= 1, `Test 10: Drip Pricing detected in: "${sample}"`);
  }
}

// ---------------------------------------------------------------------------
// Test 11 — Drip Pricing negative cases (Negative)
// ---------------------------------------------------------------------------
{
  const transparentFeeCases = [
    'Pay ₹1,250 to FreshBite Mart via UPI. Processing fee: ₹0. GST: ₹0. Total payable: ₹1,250.',
    'All mandatory fees and government taxes are included in the advertised price.',
    'Late fee of ₹100 applies only if credit card bill is unpaid after due date.',
    'Annual maintenance charge: ₹500 billed every January as per agreement.',
  ];
  for (const sample of transparentFeeCases) {
    const findings = detectDarkPatterns(sample);
    const dpFindings = findings.filter((f) => f.pattern_name === 'Drip Pricing');
    assert(dpFindings.length === 0, `Test 11: Transparent fee statement falsely flagged: "${sample}"`);
  }
}

// ---------------------------------------------------------------------------
// Test 12 — Drip Pricing: Actual QuickLoan hidden-fee-test.png OCR text (Positive)
// ---------------------------------------------------------------------------
{
  const actualOcrText =
    '10:45\nQuickLoan\nLoan Summary\nLoan Amount\n5,000\n' +
    'ProcessingFee\n天299\nTotal Payable\n5,299\n' +
    'Processing fee is non-refundable and applied\natcheckout.\n' +
    'Pay Now→\nQuickLoan is a fictional app for testing purposes only.';

  const findings = detectDarkPatterns(actualOcrText);
  const dpFindings = findings.filter((f) => f.pattern_name === 'Drip Pricing');
  assert(dpFindings.length >= 1, `Test 12: Actual hidden-fee-test.png OCR text detected (got ${dpFindings.length})`);
  if (dpFindings.length >= 1) {
    assert(dpFindings[0].severity === 'High', 'Test 12: Severity is High');
  }
}

// ---------------------------------------------------------------------------
// Test 13 — Misleading Discounts / Deceptive Pricing (Positive)
// ---------------------------------------------------------------------------
{
  const discountSamples = [
    'Special Festive Offer: Was ₹4,999 Now ₹499!',
    'Original Price: ₹9,999 Sale: ₹1,299. Save 85% today only!',
    'Price dropped from ₹5,000 to ₹1,000 today!',
    'Flat 90% off on all items! Guaranteed lowest price.',
    'Unbeatable deal today: Save up to 80% on electronics.',
  ];
  for (const sample of discountSamples) {
    const findings = detectDarkPatterns(sample);
    const mdFindings = findings.filter((f) => f.pattern_name === 'Misleading Discounts');
    assert(mdFindings.length >= 1, `Test 13: Misleading Discounts detected in: "${sample}"`);
  }
}

// ---------------------------------------------------------------------------
// Test 14 — Misleading Discounts negative cases (Negative)
// ---------------------------------------------------------------------------
{
  const neutralDiscountCases = [
    'Senior citizen discount of 10% available upon presenting valid age ID.',
    'Please save your receipt for warranty claims and product exchanges.',
    'Original box and accessories must be returned for refund.',
  ];
  for (const sample of neutralDiscountCases) {
    const findings = detectDarkPatterns(sample);
    const mdFindings = findings.filter((f) => f.pattern_name === 'Misleading Discounts');
    assert(mdFindings.length === 0, `Test 14: Neutral discount term falsely flagged: "${sample}"`);
  }
}

// ---------------------------------------------------------------------------
// Test 15 — Subscription Traps / Forced Continuity (Positive)
// ---------------------------------------------------------------------------
{
  const subSamples = [
    'Start your 7-day free trial then ₹499/month automatically.',
    'Your subscription will renew automatically every month at ₹999.',
    'You will be charged every month unless cancelled.',
    'First month free, recurring charge unless cancelled before trial ends.',
    'Recurring billing begins after 14-day evaluation period.',
  ];
  for (const sample of subSamples) {
    const findings = detectDarkPatterns(sample);
    const stFindings = findings.filter((f) => f.pattern_name === 'Subscription Traps');
    assert(stFindings.length >= 1, `Test 15: Subscription Traps detected in: "${sample}"`);
  }
}

// ---------------------------------------------------------------------------
// Test 15b — Subscription Paywall Regression Test (Positive)
// ---------------------------------------------------------------------------
{
  const subscriptionText =
    'Start your 14-day free trial.\n' +
    "In 14 Days — You'll be charged on Jan 28, 2026, unless you cancel anytime before.\n" +
    'Annual — 14 days free, then $149.99/yr ($12.50/month)\n' +
    'No Payment Due Now\n' +
    'Try it free\n' +
    'Subscribe with Apple\n' +
    'Terms of Service | Privacy Policy';

  const findings = detectDarkPatterns(subscriptionText);
  const stFindings = findings.filter((f) => f.pattern_name === 'Subscription Traps');
  assert(stFindings.length >= 1, `Test 15b: Subscription paywall detected (got ${stFindings.length})`);
  const evidenceList = stFindings.map((f) => f.matched_evidence.toLowerCase());
  assert(
    evidenceList.some((ev) => ev.includes('charged') || ev.includes('free') || ev.includes('$149.99')),
    'Test 15b: Evidence captures auto-conversion or recurring charge clause'
  );
}

// ---------------------------------------------------------------------------
// Test 16 — Subscription Traps negative cases (Negative)
// ---------------------------------------------------------------------------
{
  const neutralSubCases = [
    'One-time payment of ₹1,499. No recurring fees and no auto-renewal.',
    'You can manually renew your account at the end of the year if you wish.',
    'Monthly account statement will be sent to your registered email address.',
  ];
  for (const sample of neutralSubCases) {
    const findings = detectDarkPatterns(sample);
    const stFindings = findings.filter((f) => f.pattern_name === 'Subscription Traps');
    assert(stFindings.length === 0, `Test 16: One-time payment falsely flagged as Subscription Trap: "${sample}"`);
  }
}

// ---------------------------------------------------------------------------
// Test 17 — Obstructive Choice Design (Positive)
// ---------------------------------------------------------------------------
{
  const obstacleSamples = [
    'To cancel your subscription, call customer service at 1800-XXX-XXXX during office hours.',
    'Cancellation only by calling support desk.',
    'Call us to cancel your account membership.',
    'You cannot cancel online. Please submit a written request.',
    'Members are unable to cancel from website.',
  ];
  for (const sample of obstacleSamples) {
    const findings = detectDarkPatterns(sample);
    const ocFindings = findings.filter((f) => f.pattern_name === 'Obstructive Choice Design');
    assert(ocFindings.length >= 1, `Test 17: Obstructive Choice Design detected in: "${sample}"`);
  }
}

// ---------------------------------------------------------------------------
// Test 18 — Obstructive Choice Design negative cases (Negative)
// ---------------------------------------------------------------------------
{
  const neutralCancelCases = [
    'Cancel anytime from your account settings page with a single click.',
    'Click here to cancel your subscription immediately.',
    'Call customer care for general banking inquiries and balance requests.',
  ];
  for (const sample of neutralCancelCases) {
    const findings = detectDarkPatterns(sample);
    const ocFindings = findings.filter((f) => f.pattern_name === 'Obstructive Choice Design');
    assert(ocFindings.length === 0, `Test 18: Click-to-cancel or general phone line falsely flagged: "${sample}"`);
  }
}

// ---------------------------------------------------------------------------
// Test 19 — Basket Sneaking (Positive)
// ---------------------------------------------------------------------------
{
  const sneakingSamples = [
    'Device protection plan auto-added to your checkout EMI schedule.',
    'Order Summary: [x] Extended warranty ₹499. Subtotal: ₹4,999 Total: ₹5,498.',
    'Tip of ₹50 added automatically to your delivery order.',
    'Optional insurance has been automatically added to your cart.',
    'Donation selected by default in your order summary.',
  ];
  for (const sample of sneakingSamples) {
    const findings = detectDarkPatterns(sample);
    const bsFindings = findings.filter((f) => f.pattern_name === 'Basket Sneaking');
    assert(bsFindings.length >= 1, `Test 19: Basket Sneaking detected in: "${sample}"`);
  }
}

// ---------------------------------------------------------------------------
// Test 20 — Basket Sneaking negative cases (Negative)
// ---------------------------------------------------------------------------
{
  const neutralBasketCases = [
    'Product: Wireless Earbuds Pro. Price: ₹4,999. [ ] Add extended warranty: ₹499 (optional, unchecked). Total: ₹4,999.',
    'Standard 1-year manufacturer warranty included for free.',
    'Extended Warranty ₹299 — not selected by default.',
  ];
  for (const sample of neutralBasketCases) {
    const findings = detectDarkPatterns(sample);
    const bsFindings = findings.filter((f) => f.pattern_name === 'Basket Sneaking');
    assert(bsFindings.length === 0, `Test 20: Unchecked warranty falsely flagged: "${sample}"`);
  }
}

// ---------------------------------------------------------------------------
// Test 21 — Suspicious Consent Requests (Positive)
// ---------------------------------------------------------------------------
{
  const consentSamples = [
    'By continuing, you agree to receive promotional marketing calls and SMS from partners.',
    'By signing up, you agree to share your personal data with third parties and advertisers.',
    'By creating an account, you consent to receive marketing emails and promotional offers.',
    'I consent to receive unsolicited commercial communications and marketing calls.',
    'By registering you agree to share your contact details with sponsors.',
  ];
  for (const sample of consentSamples) {
    const findings = detectDarkPatterns(sample);
    const scFindings = findings.filter((f) => f.pattern_name === 'Suspicious Consent');
    assert(scFindings.length >= 1, `Test 21: Suspicious Consent detected in: "${sample}"`);
  }
}

// ---------------------------------------------------------------------------
// Test 22 — Suspicious Consent negative cases (Negative)
// ---------------------------------------------------------------------------
{
  const neutralConsentCases = [
    'By clicking Submit, you agree to the Terms of Service and Privacy Policy.',
    'By signing up, you agree to our Terms and Conditions.',
    'We respect your privacy and never sell your personal data to third parties.',
  ];
  for (const sample of neutralConsentCases) {
    const findings = detectDarkPatterns(sample);
    const scFindings = findings.filter((f) => f.pattern_name === 'Suspicious Consent');
    assert(scFindings.length === 0, `Test 22: Clean Terms of Service falsely flagged: "${sample}"`);
  }
}

// ---------------------------------------------------------------------------
// Test 23 — Multiple independent findings in one screen
// ---------------------------------------------------------------------------
{
  const compositeText =
    'Special Flash Sale! Deal ends at midnight. ' +
    'There are just 2 seats remaining! ' +
    'Processing fee is non-refundable and applied at checkout. ' +
    'Upgrade now or [No thanks, I hate savings]. ' +
    'By continuing, you agree to receive promotional marketing calls.';

  const findings = detectDarkPatterns(compositeText);
  const categories = new Set(findings.map((f) => f.pattern_name));
  assert(categories.has('False Urgency'), 'Test 23a: Multi-pattern includes False Urgency');
  assert(categories.has('False Scarcity'), 'Test 23b: Multi-pattern includes False Scarcity');
  assert(categories.has('Drip Pricing'), 'Test 23c: Multi-pattern includes Drip Pricing');
  assert(categories.has('Confirmshaming'), 'Test 23d: Multi-pattern includes Confirmshaming');
  assert(categories.has('Suspicious Consent'), 'Test 23e: Multi-pattern includes Suspicious Consent');
  assert(findings.length >= 5, `Test 23f: Expected >=5 findings, got ${findings.length}`);
}

// ---------------------------------------------------------------------------
// Test 24 — Duplicate and overlapping match deduplication (widest span kept)
// ---------------------------------------------------------------------------
{
  const overlappingText = 'Loan offer expires in 10 minutes. Hurry, only 10 minutes left!';
  const findings = detectDarkPatterns(overlappingText);
  const fuFindings = findings.filter((f) => f.pattern_name === 'False Urgency');
  for (let i = 0; i < fuFindings.length; i++) {
    for (let j = 0; j < fuFindings.length; j++) {
      if (i === j) continue;
      const evi = fuFindings[i].matched_evidence.toLowerCase();
      const evj = fuFindings[j].matched_evidence.toLowerCase();
      assert(!(evj.includes(evi) && evi !== evj), 'Test 24: Subsumed duplicate span filtered');
    }
  }
}

// ---------------------------------------------------------------------------
// Test 25 — OCR Normalization corrections vs text that MUST remain unchanged
// ---------------------------------------------------------------------------
{
  // Intended corrections
  assert(normalizeTextForRules('ProcessingFee: ₹299') === 'Processing Fee: ₹299', 'Test 25a: ProcessingFee split');
  assert(normalizeTextForRules('applied atcheckout') === 'applied at checkout', 'Test 25b: atcheckout split');
  assert(normalizeTextForRules('Deal ends in 02 : 45') === 'Deal ends in 02:45', 'Test 25c: Colon normalized');
  assert(normalizeTextForRules('天299') === '₹299', 'Test 25d: Currency symbol normalized');
  assert(normalizeTextForRules('[ x ]') === '[x]', 'Test 25e: Checkbox [ x ] normalized');
  assert(normalizeTextForRules('[   ]') === '[ ]', 'Test 25f: Checkbox [   ] normalized');

  // Cases that MUST remain unchanged
  assert(normalizeTextForRules('attend meeting') === 'attend meeting', 'Test 25g: "attend" preserved');
  assert(normalizeTextForRules('format disk') === 'format disk', 'Test 25h: "format" preserved');
  assert(normalizeTextForRules('plate number') === 'plate number', 'Test 25i: "plate" preserved');
  assert(normalizeTextForRules('train station') === 'train station', 'Test 25j: "station" preserved');
  assert(normalizeTextForRules('Standard shipping within 3-5 days') === 'Standard shipping within 3-5 days', 'Test 25k: shipping preserved');
}

// ---------------------------------------------------------------------------
// Test 26 — Empty and invalid inputs safe handling
// ---------------------------------------------------------------------------
{
  assert(detectDarkPatterns('').length === 0, 'Test 26a: Empty string returns []');
  assert(detectDarkPatterns(null).length === 0, 'Test 26b: null returns []');
  assert(detectDarkPatterns(undefined).length === 0, 'Test 26c: undefined returns []');
  assert(normalizeTextForRules('') === '', 'Test 26d: normalizeTextForRules empty string returns ""');
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log(`\n${'='.repeat(65)}`);
console.log(`JavaScript Rules Engine Test Results: ${passed} passed, ${failed} failed`);
console.log(`${'='.repeat(65)}`);
if (failed > 0) {
  process.exit(1);
}
