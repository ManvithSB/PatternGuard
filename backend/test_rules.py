import sys
from rules import detect_dark_patterns, normalize_text_for_rules


# ---------------------------------------------------------------------------
# Test 1 — Clean fintech screen produces zero false positives (Negative)
# ---------------------------------------------------------------------------
def test_clean_fintech_screen_no_false_positives():
    clean_text = (
        "Pay ₹1,250 to FreshBite Mart via UPI. "
        "Select your bank account: State Bank of India (..4321). "
        "Processing fee: ₹0. GST: ₹0. Total payable: ₹1,250. "
        "Enter UPI PIN to authorize payment."
    )
    findings = detect_dark_patterns(clean_text)
    assert len(findings) == 0, f"Expected 0 findings on clean screen, got {len(findings)}: {findings}"
    print("[PASS] Test 1: Clean fintech screen produced zero false positives")


# ---------------------------------------------------------------------------
# Test 2 — Normal banking dashboard produces zero false positives (Negative)
# ---------------------------------------------------------------------------
def test_normal_banking_dashboard_zero_findings():
    dashboard_text = """
    Welcome to HDFC NetBanking
    Savings Account No: XX9821
    Available Balance: ₹45,820.50
    Recent Activity:
    - IMPS Credit: ₹15,000 from Employer
    - UPI Debit: ₹320 to FreshBite Mart
    - Utility Bill Paid: ₹1,450
    Total Outflow This Month: ₹1,770
    """
    findings = detect_dark_patterns(dashboard_text)
    assert len(findings) == 0, f"Normal banking dashboard unexpectedly triggered findings: {findings}"
    print("[PASS] Test 2: Normal banking dashboard returned zero findings")


# ---------------------------------------------------------------------------
# Test 3 — Transparent upfront pricing produces zero false positives (Negative)
# ---------------------------------------------------------------------------
def test_transparent_upfront_pricing_zero_findings():
    transparent_text = (
        "Wireless Headphones Pro. "
        "Price: ₹2,999. Shipping: ₹0. Taxes included. "
        "All fees included in advertised price. Total: ₹2,999."
    )
    findings = detect_dark_patterns(transparent_text)
    assert len(findings) == 0, f"Transparent upfront pricing unexpectedly triggered: {findings}"
    print("[PASS] Test 3: Transparent upfront pricing produced zero findings")


# ---------------------------------------------------------------------------
# Test 4 — False Urgency expanded detection (Positive)
# ---------------------------------------------------------------------------
def test_false_urgency_detection():
    urgency_phrases = [
        "Hurry! Pre-approved personal loan offer expires in 5 mins. Avail ₹2,00,000 now.",
        "Special Festive Offer ends at midnight! Claim your discount now.",
        "Time is running out! Complete your booking before it's gone.",
        "Your deal expires in 10 minutes. Act now!",
        "Clock is ticking! Flash sale ends in 05:00.",
    ]
    for text in urgency_phrases:
        findings = detect_dark_patterns(text)
        fu_findings = [f for f in findings if f["pattern_name"] == "False Urgency"]
        assert len(fu_findings) >= 1, f"Failed to detect False Urgency in: '{text}' -> {findings}"
        assert fu_findings[0]["status"] == "potential_indicator"
        assert fu_findings[0]["severity"] in ("Low", "Medium", "High")
    print("[PASS] Test 4: False Urgency detected across midnight, timer, and idiom variations")


# ---------------------------------------------------------------------------
# Test 5 — False Urgency negative cases (Negative)
# ---------------------------------------------------------------------------
def test_false_urgency_negative_cases():
    neutral_urgency_cases = [
        "Store hours: Monday to Friday 9:00 AM to 6:00 PM.",
        "Estimated delivery in 2-3 business days.",
        "Payment received at 12:00 midnight. Transaction ID: 987654.",
        "System maintenance window: 02:00:00 to 04:00:00.",
    ]
    for sample in neutral_urgency_cases:
        findings = detect_dark_patterns(sample)
        fu_findings = [f for f in findings if f["pattern_name"] == "False Urgency"]
        assert len(fu_findings) == 0, f"Neutral timestamp or store hour falsely flagged as False Urgency: '{sample}' -> {fu_findings}"
    print("[PASS] Test 5: Store hours, delivery estimates, and bare timestamps produced zero False Urgency false positives")


# ---------------------------------------------------------------------------
# Test 6 — False Scarcity detection (Positive)
# ---------------------------------------------------------------------------
def test_false_scarcity_detection():
    scarcity_samples = [
        "There are just 2 seats remaining! Book now.",
        "Only 3 items left in stock. Order now before it's gone!",
        "Almost sold out! Last 2 units available at this price.",
        "Selling fast — only 1 room left!",
        "High demand: 18 people are viewing this right now.",
        "In 12 people's carts! Limited stock available.",
    ]
    for sample in scarcity_samples:
        findings = detect_dark_patterns(sample)
        fs_findings = [f for f in findings if f["pattern_name"] == "False Scarcity"]
        assert len(fs_findings) >= 1, f"Failed to detect False Scarcity in: '{sample}' -> {findings}"
        assert fs_findings[0]["severity"] in ("Low", "Medium")
        assert "scarcity" in fs_findings[0]["explanation"].lower()
    print("[PASS] Test 6: False Scarcity detected with calibrated severity across 'just X remaining' and 'only X left'")


# ---------------------------------------------------------------------------
# Test 7 — False Scarcity negative cases (Negative)
# ---------------------------------------------------------------------------
def test_false_scarcity_negative_cases():
    neutral_cases = [
        "Party size: 3 seats reserved for dinner.",
        "Table for 2 people reserved under John Doe.",
        "Account balance: 5 reward points available to redeem.",
        "Select quantity: 2 items in your cart.",
    ]
    for sample in neutral_cases:
        findings = detect_dark_patterns(sample)
        fs_findings = [f for f in findings if f["pattern_name"] == "False Scarcity"]
        assert len(fs_findings) == 0, f"Neutral count falsely flagged as False Scarcity: '{sample}' -> {fs_findings}"
    print("[PASS] Test 7: Normal table bookings, reward points, and cart quantities produced zero False Scarcity false positives")


# ---------------------------------------------------------------------------
# Test 8 — Confirmshaming detection (Positive)
# ---------------------------------------------------------------------------
def test_confirmshaming_detection():
    shaming_samples = [
        "Activate UPI AutoPay for instant bill payments. [Accept] or [No thanks, I hate savings].",
        "Protect your trip for ₹199? [Yes, protect] [No, I prefer paying full price].",
        "Do you want 15% discount? [Claim Discount] [No thanks, keep me at risk].",
        "Upgrade to Gold Membership? [Upgrade] [No, I don't want the best price].",
        "Get instant protection: [Yes, protect me] [No, I choose to miss out].",
        "Save 20% today? [Apply Coupon] [No, I'd rather pay full price].",
    ]
    for sample in shaming_samples:
        findings = detect_dark_patterns(sample)
        cs_findings = [f for f in findings if f["pattern_name"] == "Confirmshaming"]
        assert len(cs_findings) >= 1, f"Failed to detect Confirmshaming in: '{sample}' -> {findings}"
        assert cs_findings[0]["severity"] in ("Medium", "High")
        assert "neutral" in cs_findings[0]["recommendation"].lower() or "factual" in cs_findings[0]["recommendation"].lower()
    print("[PASS] Test 8: Confirmshaming detected across diverse guilt-tripping phrasing styles")


# ---------------------------------------------------------------------------
# Test 9 — Confirmshaming negative cases (Negative)
# ---------------------------------------------------------------------------
def test_confirmshaming_negative_cases():
    neutral_decline_cases = [
        "Would you like to subscribe to our newsletter? [Yes] [No thanks]",
        "Skip this step to continue to dashboard.",
        "I prefer to pay by Credit Card instead of Net Banking.",
        "Decline optional insurance and proceed with standard order.",
    ]
    for sample in neutral_decline_cases:
        findings = detect_dark_patterns(sample)
        cs_findings = [f for f in findings if f["pattern_name"] == "Confirmshaming"]
        assert len(cs_findings) == 0, f"Neutral decline option falsely flagged as Confirmshaming: '{sample}' -> {cs_findings}"
    print("[PASS] Test 9: Neutral decline buttons and payment method choices produced zero Confirmshaming false positives")


# ---------------------------------------------------------------------------
# Test 10 — Drip Pricing / Hidden Fees detection (Positive)
# ---------------------------------------------------------------------------
def test_drip_pricing_detection():
    drip_samples = [
        "Processing fee is non-refundable and applied at checkout.",
        "An additional service fee will be added before payment.",
        "Platform charges apply at checkout.",
        "The advertised price excludes the processing fee.",
        "The advertised price excludes the mandatory processing fee.",
        "A mandatory convenience fee was added at payment.",
        "Convenience fee added only at checkout.",
    ]
    for sample in drip_samples:
        findings = detect_dark_patterns(sample)
        dp_findings = [f for f in findings if f["pattern_name"] == "Drip Pricing"]
        assert len(dp_findings) >= 1, f"Failed to detect Drip Pricing in: '{sample}' -> {findings}"
        assert dp_findings[0]["severity"] in ("Medium", "High")
        assert "CCPA Guidelines 2023, Annexure 1, Clause 6 (Drip Pricing)" == dp_findings[0]["ccpa_guideline_reference"]
    print("[PASS] Test 10: Drip Pricing detected across excluded advertised fees, platform charges, and late checkout fees")


# ---------------------------------------------------------------------------
# Test 11 — Drip Pricing negative cases (Negative)
# ---------------------------------------------------------------------------
def test_drip_pricing_negative_cases():
    transparent_fee_cases = [
        "Pay ₹1,250 to FreshBite Mart via UPI. Processing fee: ₹0. GST: ₹0. Total payable: ₹1,250.",
        "All mandatory fees and government taxes are included in the advertised price.",
        "Late fee of ₹100 applies only if credit card bill is unpaid after due date.",
        "Annual maintenance charge: ₹500 billed every January as per agreement.",
    ]
    for sample in transparent_fee_cases:
        findings = detect_dark_patterns(sample)
        dp_findings = [f for f in findings if f["pattern_name"] == "Drip Pricing"]
        assert len(dp_findings) == 0, f"Transparent fee statement falsely flagged as Drip Pricing: '{sample}' -> {dp_findings}"
    print("[PASS] Test 11: Transparent inclusive fees and contractual penalty clauses produced zero Drip Pricing false positives")


# ---------------------------------------------------------------------------
# Test 12 — Drip Pricing: Actual QuickLoan hidden-fee-test.png OCR text (Positive)
# ---------------------------------------------------------------------------
def test_drip_pricing_actual_screenshot_ocr():
    actual_ocr_text = (
        "10:45\nQuickLoan\nLoan Summary\nLoan Amount\n5,000\n"
        "ProcessingFee\n天299\nTotal Payable\n5,299\n"
        "Processing fee is non-refundable and applied\natcheckout.\n"
        "Pay Now→\nQuickLoan is a fictional app for testing purposes only."
    )
    findings = detect_dark_patterns(actual_ocr_text)
    dp_findings = [f for f in findings if f["pattern_name"] == "Drip Pricing"]
    assert len(dp_findings) >= 1, f"Failed to detect Drip Pricing on actual hidden-fee-test.png OCR text! Got: {findings}"
    finding = dp_findings[0]
    assert "processing fee" in finding["matched_evidence"].lower()
    assert "applied at checkout" in finding["matched_evidence"].lower()
    assert finding["severity"] == "High"
    print("[PASS] Test 12: Actual hidden-fee-test.png OCR output correctly detected as Drip Pricing")


# ---------------------------------------------------------------------------
# Test 13 — Misleading Discounts / Deceptive Pricing (Positive)
# ---------------------------------------------------------------------------
def test_misleading_discounts_detection():
    discount_samples = [
        "Special Festive Offer: Was ₹4,999 Now ₹499!",
        "Original Price: ₹9,999 Sale: ₹1,299. Save 85% today only!",
        "Price dropped from ₹5,000 to ₹1,000 today!",
        "Flat 90% off on all items! Guaranteed lowest price.",
        "Unbeatable deal today: Save up to 80% on electronics.",
    ]
    for sample in discount_samples:
        findings = detect_dark_patterns(sample)
        md_findings = [f for f in findings if f["pattern_name"] == "Misleading Discounts"]
        assert len(md_findings) >= 1, f"Failed to detect Misleading Discounts in: '{sample}' -> {findings}"
        assert md_findings[0]["status"] == "potential_indicator"
    print("[PASS] Test 13: Misleading Discounts detected with reference baseline comparisons")


# ---------------------------------------------------------------------------
# Test 14 — Misleading Discounts negative cases (Negative)
# ---------------------------------------------------------------------------
def test_misleading_discounts_negative_cases():
    neutral_discount_cases = [
        "Senior citizen discount of 10% available upon presenting valid age ID.",
        "Please save your receipt for warranty claims and product exchanges.",
        "Original box and accessories must be returned for refund.",
    ]
    for sample in neutral_discount_cases:
        findings = detect_dark_patterns(sample)
        md_findings = [f for f in findings if f["pattern_name"] == "Misleading Discounts"]
        assert len(md_findings) == 0, f"Neutral discount term falsely flagged: '{sample}' -> {md_findings}"
    print("[PASS] Test 14: Senior discounts and receipt preservation instructions produced zero false positives")


# ---------------------------------------------------------------------------
# Test 15 — Subscription Traps / Forced Continuity (Positive)
# ---------------------------------------------------------------------------
def test_subscription_traps_detection():
    sub_samples = [
        "Start your 7-day free trial then ₹499/month automatically.",
        "Your subscription will renew automatically every month at ₹999.",
        "You will be charged every month unless cancelled.",
        "First month free, recurring charge unless cancelled before trial ends.",
        "Recurring billing begins after 14-day evaluation period.",
    ]
    for sample in sub_samples:
        findings = detect_dark_patterns(sample)
        st_findings = [f for f in findings if f["pattern_name"] == "Subscription Traps"]
        assert len(st_findings) >= 1, f"Failed to detect Subscription Traps in: '{sample}' -> {findings}"
        assert st_findings[0]["severity"] in ("Medium", "High")
    print("[PASS] Test 15: Subscription Traps detected for auto-renewal and recurring monthly charges")


# ---------------------------------------------------------------------------
# Test 15b — Subscription Paywall Regression Test (Positive)
# ---------------------------------------------------------------------------
def test_subscription_paywall_diagnostic_case():
    subscription_text = (
        "Start your 14-day free trial.\n"
        "In 14 Days — You'll be charged on Jan 28, 2026, unless you cancel anytime before.\n"
        "Annual — 14 days free, then $149.99/yr ($12.50/month)\n"
        "No Payment Due Now\n"
        "Try it free\n"
        "Subscribe with Apple\n"
        "Terms of Service | Privacy Policy"
    )
    findings = detect_dark_patterns(subscription_text)
    st_findings = [f for f in findings if f["pattern_name"] == "Subscription Traps"]
    expected_ids = {"CCPA-ST-01", "CCPA-ST-02", "CCPA-ST-03"}
    actual_ids = {finding["rule_id"] for finding in st_findings}
    assert actual_ids == expected_ids, (
        f"Expected subscription rules {expected_ids}, got {actual_ids}: {findings}"
    )
    evidence_by_id = {
        finding["rule_id"]: finding["matched_evidence"]
        for finding in st_findings
    }
    assert "unless you cancel" in evidence_by_id["CCPA-ST-02"]
    assert "$149.99/yr ($12.50/month" in evidence_by_id["CCPA-ST-01"]
    assert evidence_by_id["CCPA-ST-03"] == "$149.99/yr ($12.50/month)"
    print("[PASS] Test 15b: Exact subscription paywall text matched CCPA-ST-01, -02, and -03")


# ---------------------------------------------------------------------------
# Test 16 — Subscription Traps negative cases (Negative)
# ---------------------------------------------------------------------------
def test_subscription_traps_negative_cases():
    neutral_sub_cases = [
        "One-time payment of ₹1,499. No recurring fees and no auto-renewal.",
        "You can manually renew your account at the end of the year if you wish.",
        "Monthly account statement will be sent to your registered email address.",
    ]
    for sample in neutral_sub_cases:
        findings = detect_dark_patterns(sample)
        st_findings = [f for f in findings if f["pattern_name"] == "Subscription Traps"]
        assert len(st_findings) == 0, f"Neutral one-time fee falsely flagged as Subscription Trap: '{sample}' -> {st_findings}"
    print("[PASS] Test 16: One-time payments and manual renewal notices produced zero Subscription Trap false positives")


# ---------------------------------------------------------------------------
# Test 17 — Obstructive Choice Design (Positive)
# ---------------------------------------------------------------------------
def test_obstructive_choice_design_detection():
    obstacle_samples = [
        "To cancel your subscription, call customer service at 1800-XXX-XXXX during office hours.",
        "Cancellation only by calling support desk.",
        "Call us to cancel your account membership.",
        "You cannot cancel online. Please submit a written request.",
        "Members are unable to cancel from website.",
    ]
    for sample in obstacle_samples:
        findings = detect_dark_patterns(sample)
        oc_findings = [f for f in findings if f["pattern_name"] == "Obstructive Choice Design"]
        assert len(oc_findings) >= 1, f"Failed to detect Obstructive Choice Design in: '{sample}' -> {findings}"
        assert oc_findings[0]["severity"] == "High"
    print("[PASS] Test 17: Obstructive Choice Design detected for call-to-cancel mandates and online cancellation bans")


# ---------------------------------------------------------------------------
# Test 18 — Obstructive Choice Design negative cases (Negative)
# ---------------------------------------------------------------------------
def test_obstructive_choice_design_negative_cases():
    neutral_cancel_cases = [
        "Cancel anytime from your account settings page with a single click.",
        "Click here to cancel your subscription immediately.",
        "Call customer care for general banking inquiries and balance requests.",
    ]
    for sample in neutral_cancel_cases:
        findings = detect_dark_patterns(sample)
        oc_findings = [f for f in findings if f["pattern_name"] == "Obstructive Choice Design"]
        assert len(oc_findings) == 0, f"Click-to-cancel or general inquiry phone line falsely flagged: '{sample}' -> {oc_findings}"
    print("[PASS] Test 18: Self-serve cancellation and general customer care phone lines produced zero false positives")


# ---------------------------------------------------------------------------
# Test 19 — Basket Sneaking (Positive)
# ---------------------------------------------------------------------------
def test_basket_sneaking_detection():
    sneaking_samples = [
        "Device protection plan auto-added to your checkout EMI schedule.",
        "Order Summary: [x] Extended warranty ₹499. Subtotal: ₹4,999 Total: ₹5,498.",
        "Tip of ₹50 added automatically to your delivery order.",
        "Optional insurance has been automatically added to your cart.",
        "Donation selected by default in your order summary.",
    ]
    for sample in sneaking_samples:
        findings = detect_dark_patterns(sample)
        bs_findings = [f for f in findings if f["pattern_name"] == "Basket Sneaking"]
        assert len(bs_findings) >= 1, f"Failed to detect Basket Sneaking in: '{sample}' -> {findings}"
        assert bs_findings[0]["severity"] == "High"
    print("[PASS] Test 19: Basket Sneaking detected across auto-added warranties, pre-selected tips, and pre-ticked add-ons")


# ---------------------------------------------------------------------------
# Test 20 — Basket Sneaking negative cases (Negative)
# ---------------------------------------------------------------------------
def test_basket_sneaking_negative_cases():
    neutral_basket_cases = [
        "Product: Wireless Earbuds Pro. Price: ₹4,999. [ ] Add extended warranty: ₹499 (optional, unchecked). Total: ₹4,999.",
        "Standard 1-year manufacturer warranty included for free.",
        "Extended Warranty ₹299 — not selected by default.",
    ]
    for sample in neutral_basket_cases:
        findings = detect_dark_patterns(sample)
        bs_findings = [f for f in findings if f["pattern_name"] == "Basket Sneaking"]
        assert len(bs_findings) == 0, f"Unchecked warranty or free warranty falsely flagged: '{sample}' -> {bs_findings}"
    print("[PASS] Test 20: Unchecked checkboxes and included free warranties produced zero Basket Sneaking false positives")


# ---------------------------------------------------------------------------
# Test 21 — Suspicious Consent Requests (Positive)
# ---------------------------------------------------------------------------
def test_suspicious_consent_detection():
    consent_samples = [
        "By continuing, you agree to receive promotional marketing calls and SMS from partners.",
        "By signing up, you agree to share your personal data with third parties and advertisers.",
        "By creating an account, you consent to receive marketing emails and promotional offers.",
        "I consent to receive unsolicited commercial communications and marketing calls.",
        "By registering you agree to share your contact details with sponsors.",
    ]
    for sample in consent_samples:
        findings = detect_dark_patterns(sample)
        sc_findings = [f for f in findings if f["pattern_name"] == "Suspicious Consent"]
        assert len(sc_findings) >= 1, f"Failed to detect Suspicious Consent in: '{sample}' -> {findings}"
        assert sc_findings[0]["severity"] == "Medium"
    print("[PASS] Test 21: Suspicious Consent detected for bundled marketing and third-party data sharing")


# ---------------------------------------------------------------------------
# Test 22 — Suspicious Consent negative cases (Negative)
# ---------------------------------------------------------------------------
def test_suspicious_consent_negative_cases():
    neutral_consent_cases = [
        "By clicking Submit, you agree to the Terms of Service and Privacy Policy.",
        "By signing up, you agree to our Terms and Conditions.",
        "We respect your privacy and never sell your personal data to third parties.",
    ]
    for sample in neutral_consent_cases:
        findings = detect_dark_patterns(sample)
        sc_findings = [f for f in findings if f["pattern_name"] == "Suspicious Consent"]
        assert len(sc_findings) == 0, f"Standard terms agreement falsely flagged as Suspicious Consent: '{sample}' -> {sc_findings}"
    print("[PASS] Test 22: Clean Terms of Service and privacy assurances produced zero Suspicious Consent false positives")


# ---------------------------------------------------------------------------
# Test 23 — Multiple independent findings in one screen
# ---------------------------------------------------------------------------
def test_multiple_independent_findings_in_one_screen():
    composite_text = (
        "Special Flash Sale! Deal ends at midnight. "
        "There are just 2 seats remaining! "
        "Processing fee is non-refundable and applied at checkout. "
        "Upgrade now or [No thanks, I hate savings]. "
        "By continuing, you agree to receive promotional marketing calls."
    )
    findings = detect_dark_patterns(composite_text)
    categories = {f["pattern_name"] for f in findings}
    assert "False Urgency" in categories, "Missing False Urgency in multi-pattern text"
    assert "False Scarcity" in categories, "Missing False Scarcity in multi-pattern text"
    assert "Drip Pricing" in categories, "Missing Drip Pricing in multi-pattern text"
    assert "Confirmshaming" in categories, "Missing Confirmshaming in multi-pattern text"
    assert "Suspicious Consent" in categories, "Missing Suspicious Consent in multi-pattern text"
    assert len(findings) >= 5, f"Expected >= 5 independent findings, got {len(findings)}"
    print("[PASS] Test 23: Multiple independent findings across distinct categories accurately detected in a single screen")


# ---------------------------------------------------------------------------
# Test 24 — Duplicate and overlapping match deduplication (widest span kept)
# ---------------------------------------------------------------------------
def test_overlapping_match_deduplication():
    # Both general urgency and specific loan urgency could trigger
    overlapping_text = "Loan offer expires in 10 minutes. Hurry, only 10 minutes left!"
    findings = detect_dark_patterns(overlapping_text)
    fu_findings = [f for f in findings if f["pattern_name"] == "False Urgency"]
    for i in range(len(fu_findings)):
        for j in range(len(fu_findings)):
            if i == j:
                continue
            ev_i = fu_findings[i]["matched_evidence"].lower()
            ev_j = fu_findings[j]["matched_evidence"].lower()
            # Neither should be a strict substring of the other (subsumed matches must be filtered)
            assert not (ev_j in ev_i and ev_i != ev_j), f"Subsumed match was not deduplicated: '{ev_j}' inside '{ev_i}'"
    print("[PASS] Test 24: Overlapping spans within the same category correctly deduplicated to widest match")


# ---------------------------------------------------------------------------
# Test 25 — OCR Normalization corrections vs text that MUST remain unchanged
# ---------------------------------------------------------------------------
def test_ocr_normalization_safety():
    # Intended corrections
    assert normalize_text_for_rules("ProcessingFee: ₹299") == "Processing Fee: ₹299"
    assert normalize_text_for_rules("applied atcheckout") == "applied at checkout"
    assert normalize_text_for_rules("Deal ends in 02 : 45") == "Deal ends in 02:45"
    assert normalize_text_for_rules("天299") == "₹299"
    assert normalize_text_for_rules("[ x ]") == "[x]"
    assert normalize_text_for_rules("[   ]") == "[ ]"

    # Cases that MUST remain unchanged (no corruption)
    assert normalize_text_for_rules("attend meeting") == "attend meeting"
    assert normalize_text_for_rules("format disk") == "format disk"
    assert normalize_text_for_rules("plate number") == "plate number"
    assert normalize_text_for_rules("train station") == "train station"
    assert normalize_text_for_rules("Standard shipping within 3-5 days") == "Standard shipping within 3-5 days"
    print("[PASS] Test 25: OCR normalization accurately fixes OCR artifacts without corrupting normal words")


# ---------------------------------------------------------------------------
# Test 26 — Empty and invalid inputs safe handling
# ---------------------------------------------------------------------------
def test_empty_and_invalid_inputs():
    assert detect_dark_patterns("") == []
    assert detect_dark_patterns(None) == []
    assert detect_dark_patterns("    ") == []
    assert normalize_text_for_rules("") == ""
    assert normalize_text_for_rules(None) == ""
    print("[PASS] Test 26: Empty and null inputs handled safely without errors")


if __name__ == "__main__":
    print("=" * 65)
    print("Running PatternGuard Enhanced Dark-Pattern Test Suite (26 Suites)...")
    print("=" * 65)
    test_clean_fintech_screen_no_false_positives()
    test_normal_banking_dashboard_zero_findings()
    test_transparent_upfront_pricing_zero_findings()
    test_false_urgency_detection()
    test_false_urgency_negative_cases()
    test_false_scarcity_detection()
    test_false_scarcity_negative_cases()
    test_confirmshaming_detection()
    test_confirmshaming_negative_cases()
    test_drip_pricing_detection()
    test_drip_pricing_negative_cases()
    test_drip_pricing_actual_screenshot_ocr()
    test_misleading_discounts_detection()
    test_misleading_discounts_negative_cases()
    test_subscription_traps_detection()
    test_subscription_paywall_diagnostic_case()
    test_subscription_traps_negative_cases()
    test_obstructive_choice_design_detection()
    test_obstructive_choice_design_negative_cases()
    test_basket_sneaking_detection()
    test_basket_sneaking_negative_cases()
    test_suspicious_consent_detection()
    test_suspicious_consent_negative_cases()
    test_multiple_independent_findings_in_one_screen()
    test_overlapping_match_deduplication()
    test_ocr_normalization_safety()
    test_empty_and_invalid_inputs()
    print("=" * 65)
    print("All 27 test suites passed successfully!")
    print("=" * 65)
