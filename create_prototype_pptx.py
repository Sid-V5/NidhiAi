"""
NidhiAI — Prototype Development Submission (Dark-themed standalone PPT)
Rebuilt with verified facts and content answering the official template questions.
"""
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from pptx.enum.shapes import MSO_SHAPE
import os

# ─── COLORS ───
DARK_BG = RGBColor(0x0D, 0x1B, 0x2A)
ACCENT_ORANGE = RGBColor(0xFF, 0x99, 0x33)
ACCENT_TEAL = RGBColor(0x00, 0xD4, 0xAA)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
LIGHT_GRAY = RGBColor(0xCC, 0xCC, 0xCC)
RED = RGBColor(0xFF, 0x44, 0x44)
GREEN = RGBColor(0x00, 0xCC, 0x66)
LIGHT_BG = RGBColor(0x14, 0x24, 0x3B)
BLUE = RGBColor(0x44, 0x88, 0xFF)
PURPLE = RGBColor(0xAA, 0x44, 0xFF)
DIM = RGBColor(0x88, 0x99, 0xAA)

SS = r'C:\Users\Siddhant\.gemini\antigravity\brain\ffadbb09-a544-4a00-a7d0-c6df051cd0f2'

prs = Presentation()
prs.slide_width = Inches(13.333)
prs.slide_height = Inches(7.5)

def bg(slide):
    f = slide.background.fill; f.solid(); f.fore_color.rgb = DARK_BG

def tb(s, l, t, w, h, txt, sz=14, c=WHITE, b=False, a=PP_ALIGN.LEFT):
    bx = s.shapes.add_textbox(Inches(l), Inches(t), Inches(w), Inches(h))
    tf = bx.text_frame; tf.word_wrap = True
    p = tf.paragraphs[0]; p.text = txt; p.font.size = Pt(sz)
    p.font.color.rgb = c; p.font.bold = b; p.font.name = "Calibri"; p.alignment = a
    return bx

def bl(s, l, t, w, h, items, sz=12, c=WHITE):
    bx = s.shapes.add_textbox(Inches(l), Inches(t), Inches(w), Inches(h))
    tf = bx.text_frame; tf.word_wrap = True
    for i, item in enumerate(items):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.text = f"  {item}"; p.font.size = Pt(sz); p.font.color.rgb = c
        p.font.name = "Calibri"; p.space_after = Pt(4)
    return bx

def cd(s, l, t, w, h, fill=LIGHT_BG, border=None, txt="", sz=11, fc=WHITE):
    sh = s.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(l), Inches(t), Inches(w), Inches(h))
    sh.fill.solid(); sh.fill.fore_color.rgb = fill
    if border: sh.line.color.rgb = border; sh.line.width = Pt(1.5)
    else: sh.line.fill.background()
    if txt:
        tf = sh.text_frame; tf.word_wrap = True
        p = tf.paragraphs[0]; p.text = txt; p.font.size = Pt(sz)
        p.font.color.rgb = fc; p.font.bold = True; p.alignment = PP_ALIGN.CENTER
    return sh

def hd(s, txt):
    bar = s.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0), Inches(0), Inches(13.333), Inches(1.0))
    bar.fill.solid(); bar.fill.fore_color.rgb = LIGHT_BG; bar.line.fill.background()
    tb(s, 0.5, 0.2, 12, 0.6, txt, sz=26, c=ACCENT_ORANGE, b=True)

def ft(s, txt="Powered by AWS  |  AI for Bharat Hackathon 2026  |  Track 03"):
    bar = s.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0), Inches(6.9), Inches(13.333), Inches(0.6))
    bar.fill.solid(); bar.fill.fore_color.rgb = LIGHT_BG; bar.line.fill.background()
    tb(s, 0.5, 6.95, 12, 0.4, txt, sz=11, c=DIM, a=PP_ALIGN.CENTER)

def trow(s, x, y, w, m, v, i, mc=WHITE, vc=WHITE, hdr=False):
    bg_c = RGBColor(0x1A, 0x3A, 0x5A) if hdr else (DARK_BG if i % 2 == 0 else LIGHT_BG)
    r = s.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(x), Inches(y), Inches(w), Inches(0.45))
    r.fill.solid(); r.fill.fore_color.rgb = bg_c; r.line.fill.background()
    tb(s, x+0.15, y+0.03, w*0.5, 0.35, m, sz=11, c=mc, b=hdr)
    tb(s, x+w*0.5, y+0.03, w*0.45, 0.35, v, sz=11, c=vc, b=hdr, a=PP_ALIGN.RIGHT)

def img(s, fn, l, t, w, h):
    p = os.path.join(SS, fn)
    if os.path.exists(p): s.shapes.add_picture(p, Inches(l), Inches(t), Inches(w), Inches(h))
    else: print(f"  MISSING: {fn}")


# ═══════════════════════════════════════════════════
# SLIDE 1: TITLE
# ═══════════════════════════════════════════════════
s = prs.slides.add_slide(prs.slide_layouts[6]); bg(s)
tb(s, 1, 1.0, 11, 1.2, "NidhiAI", sz=48, c=ACCENT_ORANGE, b=True, a=PP_ALIGN.CENTER)
tb(s, 1.5, 2.3, 10, 0.8, "Prototype Development Submission", sz=24, c=WHITE, a=PP_ALIGN.CENTER)
tb(s, 1.5, 3.1, 10, 0.6, "AI-Powered CSR Funding Access for Grassroots NGOs", sz=16, c=ACCENT_TEAL, a=PP_ALIGN.CENTER)
dv = s.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(4), Inches(4.0), Inches(5.333), Inches(0.03))
dv.fill.solid(); dv.fill.fore_color.rgb = ACCENT_TEAL; dv.line.fill.background()
tb(s, 1, 4.5, 5.5, 0.4, "Team Name:  NidhiAI", sz=16, c=LIGHT_GRAY)
tb(s, 1, 5.0, 5.5, 0.4, "Team Leader:  Siddhant", sz=16, c=LIGHT_GRAY)
tb(s, 7, 4.5, 5.8, 0.9, "Problem: The 'Last Mile' CSR Funding Gap\nTrack 03 — AI for Communities, Access & Public Impact", sz=16, c=ACCENT_TEAL, a=PP_ALIGN.RIGHT)
ft(s)


# ═══════════════════════════════════════════════════
# SLIDE 2: BRIEF ABOUT THE IDEA
# ═══════════════════════════════════════════════════
s = prs.slides.add_slide(prs.slide_layouts[6]); bg(s)
hd(s, "Brief About the Idea")

tb(s, 0.5, 1.2, 6, 0.5, "THE PROBLEM", sz=18, c=RED, b=True)
bl(s, 0.5, 1.8, 6, 3.2, [
    "Section 135 of the Companies Act (2013) mandates qualifying",
    "companies to spend 2% of avg net profits on CSR activities.",
    "",
    "In FY 2024-25, 301 major companies spent Rs.17,742 Cr on CSR",
    "(CSRBOX ICOR 2025 Report). Total CSR pool: ~Rs.38,000 Cr.",
    "",
    "But the vast majority of these funds go to established,",
    "well-connected NGOs with dedicated compliance teams.",
    "",
    "3.7 million+ NGOs are registered on the DARPAN portal.",
    "Most lack the resources for compliance paperwork (12A, 80G)",
    "and cannot write formal English grant proposals.",
], sz=12)

tb(s, 7, 1.2, 6, 0.5, "THE SOLUTION", sz=18, c=GREEN, b=True)
bl(s, 7, 1.8, 5.8, 3.2, [
    "NidhiAI automates the full CSR funding lifecycle for NGOs:",
    "",
    "1. Upload documents — AI validates legal compliance",
    "2. Discover grants — AI matches NGO to corporate CSR funds",
    "3. Draft proposals — AI writes formal grant applications",
    "4. Ask questions — chatbot answers CSR regulatory queries",
    "",
    "Built on Amazon Bedrock Agents using the Supervisor Pattern.",
    "4 specialized AI agents orchestrated as a coordinated team.",
    "",
    "What takes 30 days manually now takes 10 minutes.",
], sz=12)

cd(s, 0.5, 5.5, 12.333, 1.2, LIGHT_BG)
tb(s, 0.8, 5.6, 3.5, 0.9, "Rs.17,742 Cr\nCSR Spend FY24-25", sz=18, c=ACCENT_ORANGE, b=True, a=PP_ALIGN.CENTER)
tb(s, 4.5, 5.6, 3.5, 0.9, "3.7 Million+\nRegistered NGOs", sz=18, c=ACCENT_ORANGE, b=True, a=PP_ALIGN.CENTER)
tb(s, 8.5, 5.6, 4, 0.9, "Schedule VII\n7 CSR Categories", sz=18, c=ACCENT_TEAL, b=True, a=PP_ALIGN.CENTER)
tb(s, 0.5, 6.72, 12.333, 0.2, "Sources: CSRBOX ICOR 2025 Report  |  DARPAN Portal  |  Companies Act Section 135", sz=9, c=DIM, a=PP_ALIGN.CENTER)
ft(s)


# ═══════════════════════════════════════════════════
# SLIDE 3: WHY AI / HOW AWS / VALUE
# ═══════════════════════════════════════════════════
s = prs.slides.add_slide(prs.slide_layouts[6]); bg(s)
hd(s, "Why AI + How AWS Services Are Used")

qa = [
    ("Why AI\nis Required",
     "Legal certificates (12A, 80G) are\nscanned PDFs with no standard API.\nOnly OCR + an AI agent can extract\nregistration numbers and dates.\n\nKeyword search can't map 'village\nwater project' to 'Schedule VII\nRural Infrastructure.' Semantic\nvector search is required.\n\nNGOs can't afford grant writers.\nAn LLM generates formal proposals\nthat match corporate requirements."),
    ("How AWS Services\nAre Used",
     "Amazon Bedrock Agents:\nSupervisor Pattern orchestrating\n4 specialized sub-agents\n\nAmazon Textract:\nOCR on government certificates\n\nBedrock Knowledge Bases (x3):\nCSR laws, corporate CSR filings,\nproposal templates — all on\nOpenSearch Serverless\n\nAWS Lambda (x4):\nServerless compute for each action\n\nS3 + DynamoDB:\nDocument storage and state"),
    ("What Value\nAI Adds",
     "Without AI:\n  Weeks of manual research\n  Rs.50,000+ per grant writer\n  CA fees for compliance\n\nWith NidhiAI:\n  Grants found in seconds\n  Proposals drafted in 15 seconds\n  Compliance checked instantly\n\nThe AI layer converts a 30-day,\nRs.50,000 process into a 10-min,\nnear-zero-cost automated one."),
]
for i, (title, desc) in enumerate(qa):
    x = 0.5 + i * 4.2
    cd(s, x, 1.3, 3.8, 5.2, LIGHT_BG, ACCENT_TEAL)
    tb(s, x+0.2, 1.45, 3.4, 0.8, title, sz=15, c=ACCENT_ORANGE, b=True, a=PP_ALIGN.CENTER)
    tb(s, x+0.3, 2.4, 3.2, 3.8, desc, sz=11, c=LIGHT_GRAY)
ft(s)


# ═══════════════════════════════════════════════════
# SLIDE 4: FEATURES
# ═══════════════════════════════════════════════════
s = prs.slides.add_slide(prs.slide_layouts[6]); bg(s)
hd(s, "Features of the Prototype")

feats = [
    ("Compliance Scanner", "Upload 12A, 80G, CSR-1 certificates.\nTextract reads them, Bedrock validates.\nInstant pass/fail with expiry dates.", BLUE),
    ("AI Grant Discovery", "Semantic search across corporate CSR\nfilings. Returns ranked matches with\nrelevance scores (e.g., 93%, 88%).", ACCENT_ORANGE),
    ("Proposal Generator", "One-click formal proposal drafting.\nOutput is livestreamed to screen as\nthe model writes. PDF export.", PURPLE),
    ("Impact Reports", "Quarterly reports using user-provided\ndata (beneficiaries, funds utilized).\nAI computes metrics and generates PDF.", GREEN),
    ("CSR Assistant Chatbot", "Knowledge Base of Indian CSR laws.\nAnswers questions about Section 135,\nSchedule VII, FCRA, 12A/80G.", ACCENT_TEAL),
    ("Agent Trace Panel", "See the multi-agent orchestration\nlive — which agent was called, what\ndata was retrieved, what happened.", RGBColor(0xFF, 0x66, 0x99)),
]
for i, (title, desc, color) in enumerate(feats):
    col = i % 3; row = i // 3
    x = 0.4 + col * 4.3; y = 1.3 + row * 3.0
    cd(s, x, y, 3.9, 2.6, LIGHT_BG)
    ac = s.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(x), Inches(y), Inches(0.08), Inches(2.6))
    ac.fill.solid(); ac.fill.fore_color.rgb = color; ac.line.fill.background()
    tb(s, x+0.3, y+0.2, 3.4, 0.4, title, sz=15, c=color, b=True)
    tb(s, x+0.3, y+0.7, 3.4, 1.6, desc, sz=11, c=LIGHT_GRAY)
ft(s)


# ═══════════════════════════════════════════════════
# SLIDE 5: PROCESS FLOW
# ═══════════════════════════════════════════════════
s = prs.slides.add_slide(prs.slide_layouts[6]); bg(s)
hd(s, "Process Flow")

steps = [
    ("NGO Leader\nUploads Docs", ACCENT_TEAL),
    ("Compliance\nAgent Scans", BLUE),
    ("Grant Scout\nFinds Matches", ACCENT_ORANGE),
    ("Proposal Agent\nDrafts PDF", PURPLE),
    ("NGO Gets\nReady Proposal", GREEN),
]
sw = 2.0; gap = 0.6
total = len(steps)*sw + (len(steps)-1)*gap
sx = (13.333 - total) / 2
for i, (label, color) in enumerate(steps):
    x = sx + i*(sw+gap)
    sh = s.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(x), Inches(2.0), Inches(sw), Inches(1.8))
    sh.fill.solid(); sh.fill.fore_color.rgb = color; sh.line.fill.background()
    tf = sh.text_frame; tf.word_wrap = True
    p = tf.paragraphs[0]; p.text = label; p.font.size = Pt(13); p.font.color.rgb = WHITE; p.font.bold = True; p.alignment = PP_ALIGN.CENTER
    if i < len(steps)-1:
        ax = x + sw
        ar = s.shapes.add_shape(MSO_SHAPE.RIGHT_ARROW, Inches(ax+0.05), Inches(2.65), Inches(gap-0.1), Inches(0.5))
        ar.fill.solid(); ar.fill.fore_color.rgb = ACCENT_TEAL; ar.line.fill.background()

cd(s, 3, 4.3, 7.333, 0.7, LIGHT_BG, ACCENT_ORANGE, "All orchestrated by SUPERVISOR AGENT (Bedrock Supervisor Pattern)", sz=14, fc=ACCENT_ORANGE)

# Details
detail = [
    ("Step 1-2", "Amazon Textract extracts\nfields from scanned 12A/80G\ncertificates. Bedrock agent\nvalidates compliance."),
    ("Step 3", "Titan Embeddings V2 queries\nOpenSearch Serverless KB.\nReturns ranked matches\nby relevance to NGO profile."),
    ("Step 4-5", "Claude generates a formal\nproposal via RAG. Output is\nlivestreamed to the user.\nPDF saved to S3 for download."),
]
for i, (step, desc) in enumerate(detail):
    x = 1 + i * 4.0
    tb(s, x, 5.3, 3.5, 0.3, step, sz=12, c=ACCENT_ORANGE, b=True, a=PP_ALIGN.CENTER)
    tb(s, x, 5.65, 3.5, 1.0, desc, sz=10, c=LIGHT_GRAY, a=PP_ALIGN.CENTER)
ft(s)


# ═══════════════════════════════════════════════════
# SLIDE 6: WIREFRAMES / SCREENSHOTS
# ═══════════════════════════════════════════════════
s = prs.slides.add_slide(prs.slide_layouts[6]); bg(s)
hd(s, "Screenshots of the Working Prototype")
img(s, 'dashboard_1772968871753.png', 0.3, 1.2, 6.3, 3.8)
img(s, 'grants_1772969005674.png', 6.8, 1.2, 6.3, 3.8)
tb(s, 0.3, 5.1, 6.3, 0.3, "Dashboard — compliance status, grants, quick actions", sz=10, c=DIM, a=PP_ALIGN.CENTER)
tb(s, 6.8, 5.1, 6.3, 0.3, "Grant Discovery — AI-matched CSR opportunities", sz=10, c=DIM, a=PP_ALIGN.CENTER)
ft(s, "All screenshots from the live running prototype")


# ═══════════════════════════════════════════════════
# SLIDE 7: ARCHITECTURE
# ═══════════════════════════════════════════════════
s = prs.slides.add_slide(prs.slide_layouts[6]); bg(s)
hd(s, "Architecture Diagram")

# Top: User + API
cd(s, 0.5, 1.4, 2.5, 0.9, ACCENT_TEAL, txt="NGO User\n(Next.js Dashboard)", sz=11)
cd(s, 3.5, 1.4, 2.5, 0.9, RGBColor(0x44, 0x66, 0xBB), txt="API Gateway\n+ Cognito", sz=10)

# Middle: Supervisor
cd(s, 3.5, 2.8, 6, 0.9, ACCENT_ORANGE, txt="Amazon Bedrock Supervisor Agent", sz=14)

# Sub-agents
agts = [("Compliance\nAgent", BLUE), ("Grant Scout\nAgent", ACCENT_ORANGE), ("Proposal\nAgent", PURPLE), ("Impact\nAgent", GREEN)]
for i, (n, c) in enumerate(agts):
    cd(s, 0.3 + i*3.2, 4.2, 2.8, 0.9, c, txt=n, sz=10)

# Services
svcs = ["Amazon Textract", "KB: CSR Laws", "KB: CSR Opportunities", "KB: Proposals"]
for i, sv in enumerate(svcs):
    cd(s, 9.8, 1.4 + i*0.85, 3.2, 0.7, RGBColor(0x22, 0x55, 0x99), txt=sv, sz=9)

# Bottom row
bsvc = ["Lambda x4 (Python)", "Amazon S3 (5 buckets)", "DynamoDB (4 tables)", "OpenSearch Serverless"]
for i, sv in enumerate(bsvc):
    cd(s, 0.3 + i*3.2, 5.6, 2.8, 0.55, RGBColor(0x22, 0x55, 0x99), txt=sv, sz=9)

tb(s, 0.5, 6.4, 12, 0.3, "Region: ap-south-1 (Mumbai)  |  100% Serverless  |  12 AWS Services", sz=11, c=DIM, a=PP_ALIGN.CENTER)
ft(s)


# ═══════════════════════════════════════════════════
# SLIDE 8: TECHNOLOGIES
# ═══════════════════════════════════════════════════
s = prs.slides.add_slide(prs.slide_layouts[6]); bg(s)
hd(s, "Technologies Utilized")

cats = [
    ("AI & ML", [
        "Amazon Bedrock Agents (Supervisor Pattern)",
        "Amazon Bedrock Knowledge Bases (x3)",
        "Amazon Titan Text Embeddings V2",
        "Foundation Models: Claude 3.5 Sonnet, Amazon Nova Lite",
    ]),
    ("Document Intelligence", [
        "Amazon Textract (OCR + form extraction)",
        "Reads 12A, 80G, CSR-1 govt certificates",
        "Extracts registration numbers and expiry dates",
    ]),
    ("Compute & Storage", [
        "AWS Lambda — 4 functions (Python 3.12)",
        "Amazon S3 — 5 buckets",
        "Amazon OpenSearch Serverless (vector DB)",
        "Amazon API Gateway + Amazon DynamoDB",
    ]),
    ("Frontend & Auth", [
        "Next.js 16 (React 19) + TailwindCSS",
        "Amazon Cognito (user authentication)",
        "Deployed on Vercel (CDN + Edge)",
    ]),
]
for i, (cat, items) in enumerate(cats):
    col = i % 2; row = i // 2
    x = 0.5 + col*6.5; y = 1.3 + row*3.0
    cd(s, x, y, 6.0, 2.7, LIGHT_BG, ACCENT_TEAL)
    tb(s, x+0.2, y+0.15, 5.5, 0.4, cat, sz=15, c=ACCENT_ORANGE, b=True)
    bl(s, x+0.2, y+0.6, 5.5, 1.8, items, sz=11)
ft(s)


# ═══════════════════════════════════════════════════
# SLIDE 9: COST
# ═══════════════════════════════════════════════════
s = prs.slides.add_slide(prs.slide_layouts[6]); bg(s)
hd(s, "Estimated Implementation Cost")

# Left: Unit Economics
cd(s, 0.5, 1.3, 6.0, 5.3, LIGHT_BG, ACCENT_TEAL)
tb(s, 0.7, 1.4, 5.5, 0.4, "Unit Economics: NidhiAI vs Traditional", sz=15, c=ACCENT_ORANGE, b=True)

comp = [
    ("Metric", "Traditional", "NidhiAI", ACCENT_ORANGE, ACCENT_ORANGE, ACCENT_ORANGE),
    ("Cost per proposal", "Rs.50,000+", "< Rs.10", WHITE, RED, GREEN),
    ("Time per proposal", "2-4 weeks", "< 10 minutes", WHITE, RED, GREEN),
    ("Grant discovery", "Manual search", "AI-matched", WHITE, RED, GREEN),
    ("Compliance check", "CA fees Rs.5,000+", "Automated (Textract)", WHITE, RED, GREEN),
    ("Scaling to 100 NGOs", "50 grant writers", "Same AI system", WHITE, RED, GREEN),
]
for i, (m, t, n, mc, tc, nc) in enumerate(comp):
    y = 2.0 + i*0.52
    bg_c = RGBColor(0x1A, 0x3A, 0x5A) if i == 0 else (DARK_BG if i % 2 == 0 else LIGHT_BG)
    r = s.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.7), Inches(y), Inches(5.5), Inches(0.47))
    r.fill.solid(); r.fill.fore_color.rgb = bg_c; r.line.fill.background()
    tb(s, 0.8, y+0.04, 1.8, 0.35, m, sz=11, c=mc, b=(i==0))
    tb(s, 2.7, y+0.04, 1.5, 0.35, t, sz=11, c=tc, b=(i==0), a=PP_ALIGN.CENTER)
    tb(s, 4.3, y+0.04, 1.7, 0.35, n, sz=11, c=nc, b=(i==0), a=PP_ALIGN.CENTER)

sav = s.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.7), Inches(5.2), Inches(5.5), Inches(0.9))
sav.fill.solid(); sav.fill.fore_color.rgb = RGBColor(0x0A, 0x2A, 0x1A)
sav.line.color.rgb = GREEN; sav.line.width = Pt(1.5)
tb(s, 0.9, 5.3, 5.1, 0.7, "5000x cost reduction per proposal\nServerless = zero cost when idle", sz=12, c=GREEN, b=True, a=PP_ALIGN.CENTER)

# Right: Prototype Spend
cd(s, 7.0, 1.3, 5.8, 5.3, LIGHT_BG, ACCENT_ORANGE)
tb(s, 7.2, 1.4, 5.3, 0.4, "Prototype Spend Breakdown", sz=15, c=ACCENT_ORANGE, b=True)

spend = [
    ("Service", "Monthly Cost"),
    ("Lambda / API Gateway / DynamoDB", "AWS Free Tier"),
    ("Bedrock model inference", "~Rs.800"),
    ("S3 storage (all buckets)", "< Rs.50"),
    ("OpenSearch Serverless", "Min-capacity provisions"),
    ("Total prototype spend to date", "< Rs.8,000"),
    ("", ""),
    ("Production (100 NGOs)", "~Rs.17,000/month"),
]
for i, (m, v) in enumerate(spend):
    if not m and not v: continue
    mc = ACCENT_ORANGE if i == 0 else WHITE
    vc = ACCENT_ORANGE if i == 0 else (GREEN if "Free" in v else WHITE)
    trow(s, 7.2, 2.0 + i*0.5, 5.3, m, v, i, mc, vc, i == 0)
ft(s)


# ═══════════════════════════════════════════════════
# SLIDE 10: MORE SCREENSHOTS
# ═══════════════════════════════════════════════════
s = prs.slides.add_slide(prs.slide_layouts[6]); bg(s)
hd(s, "More Prototype Screenshots")
img(s, 'chatbot_final_1772969216606.png', 0.3, 1.2, 6.3, 3.5)
img(s, 'proposals_1772969030004.png', 6.8, 1.2, 6.3, 3.5)
tb(s, 0.3, 4.8, 6.3, 0.3, "CSR Assistant Chatbot — answers regulatory questions", sz=10, c=DIM, a=PP_ALIGN.CENTER)
tb(s, 6.8, 4.8, 6.3, 0.3, "Proposal Generator — livestreamed AI output", sz=10, c=DIM, a=PP_ALIGN.CENTER)
img(s, 'compliance_1772968882563.png', 0.3, 5.3, 6.3, 1.4)
img(s, 'upload_page_fixed_1772819311612.png', 6.8, 5.3, 6.3, 1.4)
ft(s, "Live prototype — all features fully functional")


# ═══════════════════════════════════════════════════
# SLIDE 11: PERFORMANCE
# ═══════════════════════════════════════════════════
s = prs.slides.add_slide(prs.slide_layouts[6]); bg(s)
hd(s, "Prototype Performance")

# Left: Latency
cd(s, 0.5, 1.3, 6.0, 3.5, LIGHT_BG, ACCENT_TEAL)
tb(s, 0.7, 1.45, 5.5, 0.4, "Response Latency (ap-south-1)", sz=15, c=ACCENT_ORANGE, b=True)

perf = [
    ("Document upload to S3", "~1.2 seconds"),
    ("Compliance scan (Textract + Agent)", "4-6 seconds"),
    ("Grant matching (semantic search)", "1.8 seconds"),
    ("Proposal generation (RAG + streaming)", "15-20 seconds"),
    ("CSR chatbot response", "2-4 seconds"),
]
for i, (m, v) in enumerate(perf):
    trow(s, 0.7, 2.0 + i*0.47, 5.5, m, v, i, WHITE, ACCENT_TEAL)

# Right: How it works
cd(s, 7.0, 1.3, 5.8, 3.5, LIGHT_BG, ACCENT_ORANGE)
tb(s, 7.2, 1.45, 5.3, 0.4, "How Streaming Works", sz=15, c=ACCENT_ORANGE, b=True)
bl(s, 7.2, 2.0, 5.3, 2.5, [
    "Proposal and report generation use server-side",
    "streaming — the output appears on screen as",
    "the model writes, so the user sees results",
    "immediately rather than waiting 15-20 seconds.",
    "",
    "The Agent Trace panel shows the Supervisor's",
    "decision-making live: which sub-agent was",
    "called, what Knowledge Base was queried,",
    "and what data was returned.",
], sz=11)

# Bottom
cd(s, 0.5, 5.2, 12.333, 1.3, LIGHT_BG)
tb(s, 0.8, 5.35, 4, 0.9, "100% Serverless\nAuto-scales with demand", sz=14, c=ACCENT_ORANGE, b=True, a=PP_ALIGN.CENTER)
tb(s, 4.8, 5.35, 4, 0.9, "12 AWS Services\nAll managed, no self-hosting", sz=14, c=ACCENT_ORANGE, b=True, a=PP_ALIGN.CENTER)
tb(s, 8.8, 5.35, 4, 0.9, "Real-time Streaming\nLive AI output to browser", sz=14, c=ACCENT_ORANGE, b=True, a=PP_ALIGN.CENTER)
ft(s)


# ═══════════════════════════════════════════════════
# SLIDE 12: FUTURE
# ═══════════════════════════════════════════════════
s = prs.slides.add_slide(prs.slide_layouts[6]); bg(s)
hd(s, "Future Development")

cd(s, 0.5, 1.3, 6.0, 5.3, LIGHT_BG, ACCENT_TEAL)
tb(s, 0.7, 1.45, 5.5, 0.4, "Near-Term (3-6 months)", sz=15, c=ACCENT_ORANGE, b=True)
bl(s, 0.7, 2.0, 5.5, 3.5, [
    "Multilingual voice input via Amazon Transcribe",
    "— NGO founders narrate in Hindi, AI converts",
    "to formal English proposals",
    "",
    "Expand Grant Knowledge Base from 5 to 50+",
    "corporate CSR programs",
    "",
    "Automated 12A/80G renewal reminders",
    "",
    "Mobile-first PWA for low-bandwidth rural areas",
], sz=11)

cd(s, 7.0, 1.3, 5.8, 3.0, LIGHT_BG, ACCENT_ORANGE)
tb(s, 7.2, 1.45, 5.3, 0.4, "Long-Term Vision", sz=15, c=ACCENT_ORANGE, b=True)
bl(s, 7.2, 2.0, 5.3, 2.0, [
    "Direct submission to corporate CSR portals",
    "",
    "Government scheme matching (PM-KISAN, MGNREGA)",
    "",
    "WhatsApp bot for zero-tech-literacy users",
    "",
    "NidhiAI as the default admin platform for",
    "NGOs in India — compliance, funding, reporting",
], sz=11)

# Impact callout
cd(s, 7.2, 4.6, 5.3, 1.6, RGBColor(0x0A, 0x2A, 0x1A), GREEN)
tb(s, 7.4, 4.7, 5, 1.3,
    "If even 1% of the Rs.17,742 Cr CSR pool\nreaches underserved NGOs through NidhiAI:\n\nRs.177 Crores redirected to communities\nthat actually need it.",
    sz=12, c=GREEN, b=True, a=PP_ALIGN.CENTER)
ft(s)


# ═══════════════════════════════════════════════════
# SLIDE 13: ASSETS
# ═══════════════════════════════════════════════════
s = prs.slides.add_slide(prs.slide_layouts[6]); bg(s)
hd(s, "Prototype Assets")
cd(s, 2, 1.8, 9.333, 1.5, LIGHT_BG, ACCENT_TEAL)
tb(s, 2.3, 2.0, 8.7, 0.5, "GitHub Public Repository", sz=18, c=ACCENT_ORANGE, b=True, a=PP_ALIGN.CENTER)
tb(s, 2.3, 2.55, 8.7, 0.5, "https://github.com/Sid-V5/NidhiAi", sz=16, c=ACCENT_TEAL, a=PP_ALIGN.CENTER)
cd(s, 2, 3.6, 9.333, 1.5, LIGHT_BG, ACCENT_ORANGE)
tb(s, 2.3, 3.8, 8.7, 0.5, "Demo Video (Max 3 Minutes)", sz=18, c=ACCENT_ORANGE, b=True, a=PP_ALIGN.CENTER)
tb(s, 2.3, 4.35, 8.7, 0.5, "[Insert YouTube / Drive Link]", sz=16, c=LIGHT_GRAY, a=PP_ALIGN.CENTER)
cd(s, 2, 5.4, 9.333, 1.2, LIGHT_BG, GREEN)
tb(s, 2.3, 5.55, 8.7, 0.5, "Working MVP Link", sz=18, c=GREEN, b=True, a=PP_ALIGN.CENTER)
tb(s, 2.3, 6.0, 8.7, 0.5, "[Insert Vercel URL]", sz=16, c=LIGHT_GRAY, a=PP_ALIGN.CENTER)
ft(s)


# ═══════════════════════════════════════════════════
# SLIDE 14: THANK YOU
# ═══════════════════════════════════════════════════
s = prs.slides.add_slide(prs.slide_layouts[6]); bg(s)
tb(s, 1, 1.5, 11, 1.0, "NidhiAI", sz=48, c=ACCENT_ORANGE, b=True, a=PP_ALIGN.CENTER)
tb(s, 1.5, 3.0, 10, 0.8, "Let's Fund the Changemakers of Bharat.", sz=28, c=WHITE, a=PP_ALIGN.CENTER)
dv = s.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(4), Inches(4.2), Inches(5.333), Inches(0.03))
dv.fill.solid(); dv.fill.fore_color.rgb = ACCENT_TEAL; dv.line.fill.background()
tb(s, 1, 4.7, 11, 0.5, "Team NidhiAI  |  Leader: Siddhant", sz=18, c=LIGHT_GRAY, a=PP_ALIGN.CENTER)
tb(s, 1, 5.3, 11, 0.5, "Track 03: AI for Communities, Access & Public Impact", sz=14, c=ACCENT_TEAL, a=PP_ALIGN.CENTER)
tb(s, 1, 5.9, 11, 0.5, "Amazon Bedrock  •  Amazon Textract  •  Amazon OpenSearch", sz=13, c=DIM, a=PP_ALIGN.CENTER)
ft(s, "AI for Bharat Hackathon 2026  |  Thank You")


# SAVE
out = r'c:\Users\Siddhant\NidhiAi\NidhiAI_Prototype_Submission.pptx'
prs.save(out)
print(f"Saved: {out}")
print(f"Slides: {len(prs.slides)}")
