"""
Proposal Agent - generate_pdf Lambda Action Group
Uses Claude via Bedrock to generate grant proposals, converts to PDF via fpdf2,
uploads to S3, returns pre-signed download URL.
"""
import json, logging, os, time, uuid
from datetime import datetime, timezone
from typing import Any
import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

logger = logging.getLogger()
logger.setLevel(logging.INFO)

bedrock_runtime = boto3.client("bedrock-runtime", region_name=os.environ.get("AWS_REGION", "ap-south-1"))
_region = os.environ.get("AWS_REGION", "ap-south-1")
s3_client = boto3.client("s3", region_name=_region,
                         endpoint_url=f"https://s3.{_region}.amazonaws.com",
                         config=Config(signature_version="s3v4"))
dynamodb = boto3.resource("dynamodb", region_name=_region)

PROPOSALS_BUCKET = os.environ.get("PROPOSALS_BUCKET", "nidhiai-generated-pdfs")
PROPOSALS_TABLE = os.environ.get("DYNAMODB_PROPOSALS_TABLE", "nidhiai-proposals")
PROPOSAL_MODEL_ID = os.environ.get("PROPOSAL_MODEL_ID", "anthropic.claude-3-haiku-20240307-v1:0")


def build_proposal_prompt(grant: dict, ngo: dict) -> str:
    return f"""You are an expert grant proposal writer specializing in Indian CSR proposals under the Companies Act 2013. Generate a comprehensive, professional, investor-grade grant proposal.

GRANT DETAILS:
- Corporation: {grant.get('corporationName','Corporation')}
- Program: {grant.get('programName','CSR Program')}
- Focus Areas: {', '.join(grant.get('focusAreas',['social development']))}
- Funding Range: Rs {grant.get('fundingRange',{}).get('min',200000):,} to Rs {grant.get('fundingRange',{}).get('max',1000000):,}
- Geographic Scope: {', '.join(grant.get('geographicScope',['India']))}

NGO DETAILS:
- Name: {ngo.get('ngoName','NGO')}
- Sector: {ngo.get('sector','Social Development')}
- PAN: {ngo.get('panCard','')}
- Description: {ngo.get('description', ngo.get('sector',''))}

Generate a DETAILED proposal as JSON. Each section must be thorough and substantive — this is a formal document for corporate CSR committees.

Return ONLY valid JSON with these keys:
{{
  "executiveSummary": "Write 500+ words. Include: project vision, the critical need being addressed, proposed intervention approach, expected outcomes, total budget ask, and why this NGO is uniquely positioned. Reference Schedule VII of Companies Act 2013.",
  "organizationBackground": "Write 400+ words. Cover: founding history, mission and vision, years of operation, key achievements with numbers, team strength, past CSR partnerships, geographic presence, and institutional credibility markers (12A, 80G, CSR-1 registration).",
  "problemStatement": "Write 600+ words. Include: detailed description of the problem in Indian context, cite specific statistics and data points (population affected, current gaps in services, government data), root cause analysis, geographic specifics, affected demographics, and why existing solutions are insufficient.",
  "proposedSolution": "Write 800+ words. Detail: comprehensive methodology, innovative approaches, implementation strategy with phases, target beneficiaries with numbers, activities and deliverables for each phase, partnerships and collaborations, technology or tools to be used, community engagement strategy, and sustainability plan beyond the grant period.",
  "riskMitigation": "Write 300+ words. Identify 4-5 key risks (operational, financial, external, compliance) with specific mitigation strategies for each.",
  "sustainabilityPlan": "Write 300+ words. Explain how the project will sustain itself after the grant period: revenue models, community ownership, institutional partnerships, scaling strategy.",
  "budgetTable": [
    {{"category": "...", "description": "Detailed description of expense", "amount": 0, "justification": "Why this expense is necessary"}}
  ],
  "impactMetrics": [
    {{"metric": "Specific measurable indicator", "baseline": "Current state", "target": "Expected outcome with numbers", "measurementMethod": "How it will be tracked"}}
  ],
  "timeline": [
    {{"phase": "Phase 1: Foundation", "duration": "Month 1-3", "milestones": ["Detailed milestone 1", "Detailed milestone 2", "Detailed milestone 3"]}}
  ],
  "conclusion": "Write 250+ words. Summarize: the transformative potential, alignment with CSR objectives under Schedule VII, the ask, and a compelling closing statement."
}}

CRITICAL REQUIREMENTS:
- Budget must have 6+ line items totaling within the funding range (Rs {grant.get('fundingRange',{}).get('min',200000):,} to Rs {grant.get('fundingRange',{}).get('max',1000000):,})
- Include 6+ impact metrics with quantifiable targets
- Include 4 timeline phases spanning 12 months with 3+ milestones each
- All content must be specific to Indian context with real statistics
- Use formal, professional language suitable for corporate CSR committees
- Total content should be equivalent to 5+ printed pages"""


def call_bedrock(prompt: str) -> str:
    """Call Bedrock. Claude uses invoke_model (Messages API), Nova uses converse() API."""
    is_claude = PROPOSAL_MODEL_ID.startswith("anthropic.")
    for attempt in range(3):
        try:
            if is_claude:
                body = {"anthropic_version":"bedrock-2023-05-31","max_tokens":8000,
                        "messages":[{"role":"user","content":prompt}],"temperature":0.7}
                resp = bedrock_runtime.invoke_model(
                    modelId=PROPOSAL_MODEL_ID,
                    body=json.dumps(body),
                    contentType="application/json", accept="application/json")
                return json.loads(resp["body"].read())["content"][0]["text"]
            else:
                # Nova and other models: use converse() API
                resp = bedrock_runtime.converse(
                    modelId=PROPOSAL_MODEL_ID,
                    messages=[{"role":"user","content":[{"text":prompt}]}],
                    inferenceConfig={"maxTokens":8000,"temperature":0.7})
                return resp["output"]["message"]["content"][0]["text"]
        except ClientError as e:
            if e.response["Error"]["Code"] == "ThrottlingException" and attempt < 2:
                time.sleep(2 ** attempt)
            else: raise
    raise RuntimeError("Bedrock failed")


def _pdf_escape(text: str) -> str:
    """Escape special PDF characters and strip non-latin-1."""
    s = str(text) if text else ""
    s = s.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
    s = s.encode("latin-1", errors="replace").decode("latin-1")
    return s


def generate_pdf_bytes(content: dict, grant: dict, ngo: dict) -> bytes:
    """Generate a professional PDF proposal. Falls back to text if fpdf2 fails."""
    def fallback(reason=""):
        logger.warning(f"PDF generation fallback to minimal PDF: {reason}")
        # Build a valid minimal PDF so browsers can always render it
        title = grant.get('programName', 'Grant Proposal')
        ngo_name = ngo.get('ngoName', 'NGO')
        summary = content.get('executiveSummary', '')[:800] if content.get('executiveSummary') else json.dumps(content, indent=2)[:800]
        text_lines = [
            f"Grant Proposal: {title}",
            f"NGO: {ngo_name}",
            "",
            "Executive Summary:",
            summary,
        ]
        body_text = "\\n".join(text_lines)
        # Minimal valid PDF 1.4
        stream = f"BT /F1 14 Tf 50 750 Td ({_pdf_escape(title)}) Tj ET\n"
        stream += f"BT /F1 10 Tf 50 730 Td (NGO: {_pdf_escape(ngo_name)}) Tj ET\n"
        y = 700
        for line in body_text.split("\\n"):
            if y < 50:
                break
            stream += f"BT /F1 10 Tf 50 {y} Td ({_pdf_escape(line[:90])}) Tj ET\n"
            y -= 16
        stream_bytes = stream.encode("latin-1", errors="replace")
        objects = []
        objects.append(b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n")
        objects.append(b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n")
        objects.append(b"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n")
        objects.append(b"4 0 obj\n<< /Length " + str(len(stream_bytes)).encode() + b" >>\nstream\n" + stream_bytes + b"\nendstream\nendobj\n")
        objects.append(b"5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n")
        body = b""
        offsets = []
        header = b"%PDF-1.4\n"
        pos = len(header)
        for obj in objects:
            offsets.append(pos)
            body += obj
            pos += len(obj)
        xref_pos = pos
        xref = b"xref\n0 6\n0000000000 65535 f \n"
        for off in offsets:
            xref += f"{off:010d} 00000 n \n".encode()
        trailer = f"trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n{xref_pos}\n%%EOF\n".encode()
        return header + body + xref + trailer

    try:
        from fpdf import FPDF
    except ImportError as e:
        logger.error(f"ImportError while importing FPDF: {e}", exc_info=True)
        return fallback(f"fpdf2 import error: {e}")

    def safe(text):
        """Sanitize text for fpdf2's Helvetica (latin-1/win1252 only)."""
        if not text:
            return ""
        s = str(text)
        replacements = {
            '\u20b9': 'Rs ', '\u2013': '-', '\u2014': '--', '\u2018': "'", '\u2019': "'",
            '\u201c': '"', '\u201d': '"', '\u2026': '...', '\u2022': '*', '\u2023': '>',
            '\u2032': "'", '\u2033': '"', '\u2212': '-', '\u00a0': ' ', '\u200b': '',
            '\u200d': '', '\u200c': '', '\ufeff': '',
        }
        for old, new in replacements.items():
            s = s.replace(old, new)
        # Force encode to latin-1, replacing unknown chars
        s = s.encode('latin-1', errors='replace').decode('latin-1')
        return s

    try:
        class PDF(FPDF):
            def header(self):
                self.set_font("Helvetica","B",10); self.set_text_color(255,140,0)
                self.cell(0,8,"NidhiAI - Grant Proposal",align="R"); self.ln(5)
                self.set_draw_color(255,140,0); self.line(10,self.get_y(),200,self.get_y()); self.ln(3)
            def footer(self):
                self.set_y(-15); self.set_font("Helvetica","I",8); self.set_text_color(128,128,128)
                self.cell(0,10,f"Generated by NidhiAI | {datetime.now(timezone.utc).strftime('%B %d, %Y')} | Page {self.page_no()}",align="C")
            def section(self, title):
                self.set_font("Helvetica","B",13); self.set_text_color(30,60,114)
                self.set_fill_color(230,240,255); self.cell(0,9,f"  {safe(title)}",fill=True,ln=True)
                self.set_text_color(60,60,60); self.ln(3)
            def body(self, text):
                self.set_font("Helvetica","",10); self.set_text_color(60,60,60)
                self.multi_cell(0,6,safe(text)); self.ln(4)

        pdf = PDF(); pdf.set_auto_page_break(auto=True, margin=20); pdf.add_page()

        # Title
        pdf.set_font("Helvetica","B",22); pdf.set_text_color(30,60,114); pdf.ln(10)
        pdf.multi_cell(0,12,"GRANT PROPOSAL",align="C")
        pdf.set_font("Helvetica","B",16); pdf.set_text_color(255,140,0)
        pdf.multi_cell(0,10,safe(grant.get("programName","CSR Grant")),align="C")
        pdf.set_font("Helvetica","",12); pdf.set_text_color(80,80,80)
        pdf.multi_cell(0,8,safe(f"To: {grant.get('corporationName','')} | By: {ngo.get('ngoName','')}"),align="C")
        pdf.multi_cell(0,8,f"Date: {datetime.now(timezone.utc).strftime('%B %d, %Y')} | PAN: {safe(ngo.get('panCard','N/A'))}",align="C")
        pdf.ln(8)

        # Sections
        sections = [("1. Executive Summary","executiveSummary"),("2. Organization Background","organizationBackground"),
                    ("3. Problem Statement","problemStatement"),("4. Proposed Solution","proposedSolution")]
        for title, key in sections:
            pdf.section(title); pdf.body(content.get(key,""))

        # Risk Mitigation
        if content.get("riskMitigation"):
            pdf.section("5. Risk Mitigation"); pdf.body(content.get("riskMitigation",""))

        # Sustainability Plan
        if content.get("sustainabilityPlan"):
            pdf.section("6. Sustainability Plan"); pdf.body(content.get("sustainabilityPlan",""))

        # Budget table
        sec_num = 7
        pdf.section(f"{sec_num}. Budget Breakdown")
        budget = content.get("budgetTable",[])
        if budget:
            pdf.set_font("Helvetica","B",9); pdf.set_fill_color(30,60,114); pdf.set_text_color(255,255,255)
            # Total width = 170 (since margin is 20: 210 - 40). 35 + 65 + 25 + 45 = 170
            pdf.cell(35,7,"Category",1,fill=True); pdf.cell(65,7,"Description",1,fill=True)
            pdf.cell(25,7,"Amount (Rs)",1,fill=True); pdf.cell(0,7,"Justification",1,fill=True,ln=True)
            pdf.set_font("Helvetica","",9); pdf.set_text_color(60,60,60); total=0
            for item in budget:
                amt = item.get("amount",0); total += amt
                pdf.cell(35,6,safe(str(item.get("category","")))[:20],1)
                pdf.cell(65,6,safe(str(item.get("description","")))[:40],1)
                pdf.cell(25,6,f"{amt:,.0f}",1); pdf.cell(0,6,safe(str(item.get("justification","")))[:30],1,ln=True)
            pdf.set_font("Helvetica","B",9); pdf.set_fill_color(30,60,114); pdf.set_text_color(255,255,255)
            pdf.cell(100,7,"TOTAL",1,fill=True); pdf.cell(25,7,f"Rs {total:,.0f}",1,fill=True)
            pdf.cell(0,7,"",1,fill=True,ln=True); pdf.ln(5)

        # Impact metrics
        pdf.section(f"{sec_num+1}. Impact Metrics")
        for m in content.get("impactMetrics",[]):
            pdf.set_font("Helvetica","",10); pdf.set_text_color(60,60,60)
            pdf.multi_cell(0,6,safe(f"* {m.get('metric','')}: {m.get('baseline','')} -> {m.get('target','')} ({m.get('measurementMethod','')})"))
            pdf.ln(1)
        pdf.ln(3)

        # Timeline
        pdf.section(f"{sec_num+2}. Timeline")
        for p in content.get("timeline",[]):
            pdf.set_font("Helvetica","B",10); pdf.cell(0,7,safe(f"{p.get('phase','')} ({p.get('duration','')})"),ln=True)
            pdf.set_font("Helvetica","",10)
            for ms in p.get("milestones",[]): pdf.multi_cell(0,6,safe(f"  - {ms}"))
            pdf.ln(2)

        # Conclusion + Declaration
        pdf.section(f"{sec_num+3}. Conclusion"); pdf.body(content.get("conclusion",""))
        pdf.section(f"{sec_num+4}. Declaration")
        pdf.body(f"We, {safe(ngo.get('ngoName',''))}, declare all information is accurate. Authorized Signatory: ___________  Date: {datetime.now(timezone.utc).strftime('%B %d, %Y')}")

        result = pdf.output(dest="S")
        return bytes(result) if not isinstance(result, bytes) else result
    except Exception as e:
        logger.error(f"FPDF2 PDF generation error: {e}", exc_info=True)
        return fallback(str(e))


def lambda_handler(event: dict, context: Any) -> dict:
    logger.info(f"Event: {json.dumps(event)}")
    ag = event.get("actionGroup","generate_pdf"); ap = event.get("apiPath","/generate-proposal")
    fn = event.get("function", ""); is_fn = bool(fn)

    try:
        if is_fn:
            params_list = event.get("parameters", [])
            params = {p["name"]: p["value"] for p in params_list}
        else:
            props = event.get("requestBody",{}).get("content",{}).get("application/json",{}).get("properties",[])
            params = {p["name"]: p["value"] for p in props}
        grant = json.loads(params.get("grantData","{}")) if isinstance(params.get("grantData"), str) else params.get("grantData",{})
        ngo = json.loads(params.get("ngoProfile","{}")) if isinstance(params.get("ngoProfile"), str) else params.get("ngoProfile",{})
    except Exception as e:
        return _resp(ag, ap, fn, is_fn, {"status":"error","message":str(e)}, 400)

    try:
        raw = call_bedrock(build_proposal_prompt(grant, ngo))
        try:
            content = json.loads(raw[raw.find("{"):raw.rfind("}")+1])
        except: content = {"executiveSummary":raw[:500],"problemStatement":"See proposal.","proposedSolution":"Detailed in proposal.",
                          "budgetTable":[{"category":"Program","description":"Total","amount":500000,"justification":"As proposed"}],
                          "impactMetrics":[{"metric":"Beneficiaries","baseline":"0","target":"500","measurementMethod":"Count"}],
                          "timeline":[{"phase":"Phase 1","duration":"Month 1-6","milestones":["Start"]}],"conclusion":"Thank you."}

        pdf_bytes = generate_pdf_bytes(content, grant, ngo)
        pid = str(uuid.uuid4()); nid = ngo.get("ngoId","unknown"); gid = grant.get("grantId","unknown")
        s3_key = f"{nid}/proposals/{gid}_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.pdf"

        s3_client.put_object(Bucket=PROPOSALS_BUCKET, Key=s3_key, Body=pdf_bytes, ContentType="application/pdf")
        url = s3_client.generate_presigned_url("get_object", Params={
            "Bucket": PROPOSALS_BUCKET,
            "Key": s3_key,
            "ResponseContentType": "application/pdf",
            "ResponseContentDisposition": "inline",
        }, ExpiresIn=3600)

        try:
            dynamodb.Table(PROPOSALS_TABLE).put_item(Item={"proposalId":pid,"ngoId":nid,"grantId":gid,"pdfS3Key":s3_key,"status":"generated","createdAt":datetime.now(timezone.utc).isoformat()})
        except: pass

        return _resp(ag, ap, fn, is_fn, {"status":"success","proposalId":pid,"downloadUrl":url,"s3Key":s3_key,
                             "summary":f"Proposal generated for {grant.get('programName','')} by {grant.get('corporationName','')}. Download ready.","content":content}, 200)
    except Exception as e:
        logger.exception(f"Failed: {e}")
        return _resp(ag, ap, fn, is_fn, {"status":"error","message":"Proposal generation failed. Please try again."}, 500)


def _resp(ag, ap, fn, is_fn, body, code):
    body_str = json.dumps(body)
    if is_fn:
        return {"messageVersion":"1.0","response":{"actionGroup":ag,"function":fn,
                "functionResponse":{"responseBody":{"TEXT":{"body":body_str}}}}}
    return {"messageVersion":"1.0","response":{"actionGroup":ag,"apiPath":ap,"httpMethod":"POST","httpStatusCode":code,
            "responseBody":{"application/json":{"body":body_str}}}}
