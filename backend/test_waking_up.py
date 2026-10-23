"""Test: does the rule match when OCR splits the charge clause across two lines?"""
import re, json
from rules import normalize_text_for_rules, detect_dark_patterns

# Case 1: The text we assume the screenshot has (lines together)
text_together = """Start your 14-day free trial.
In 14 Days — You'll be charged on Jan 28, 2026, unless you cancel anytime before.
Annual — 14 days free, then $149.99/yr ($12.50/month)"""

# Case 2: OCR might split "You'll be charged on Jan 28, 2026," and "unless you cancel" onto separate lines
text_split = """Start your 14-day free trial.
In 14 Days
You'll be charged on Jan 28, 2026,
unless you cancel anytime before.
Annual
14 days free, then $149.99/yr ($12.50/month)"""

# Case 3: OCR might read it in a completely different order or miss some tokens
text_mangled = """Start your 14-day free trial.
In 14 Days
You' l be charged on Jan 28, 2026,
unless you cancel anytime before.
Annual  14 days free, then $149.99 /yr ($12.50 /month)"""

# Case 4: OCR reads the em-dash as something else
text_emdash = """Start your 14-day free trial.
In 14 Days \u2014 You\u2019ll be charged on Jan 28, 2026, unless you cancel anytime before.
Annual \u2014 14 days free, then $149.99/yr ($12.50/month)"""

# Case 5: OCR misreads apostrophe as backtick or other
text_apost = """Start your 14-day free trial.
In 14 Days - You\u2018ll be charged on Jan 28, 2026, unless you cancel anytime before.
Annual - 14 days free, then $149.99/yr ($12.50/month)"""

for name, txt in [
    ("together", text_together),
    ("split", text_split),
    ("mangled", text_mangled),
    ("emdash", text_emdash),
    ("apost", text_apost),
]:
    norm = normalize_text_for_rules(txt)
    findings = detect_dark_patterns(txt)
    ids = [f["rule_id"] for f in findings]
    print(f"[{name}] normalized: {norm[:120]}...")
    print(f"[{name}] findings_count={len(findings)}, ids={ids}")
    print()
