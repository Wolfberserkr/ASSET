import pathlib, glob
from PIL import Image
from pptx import Presentation
from pptx.util import Inches, Emu

HERE = pathlib.Path(__file__).parent
SRC  = sorted(glob.glob(str(HERE/"png"/"slide-*.png")))
TMP  = HERE/"pptx_img"; TMP.mkdir(exist_ok=True)

NOTES = {
1:"Frame the session: A.S.S.E.T. is live in both departments today. This is a walkthrough, not a proposal — no budget, headcount or sign-off is being requested.",
2:"Four parts, roughly twenty minutes. Say explicitly that no decision is required — it lowers the defensiveness and lets them listen to the capability.",
3:"Anchor on the pain before the product. The third card — no evidence — is the one an executive audience cares about most. 'We trained them' is not a record.",
4:"Numbers on this slide are taken from the User Manual v1.0 (July 2026). Verify against Question Stats and the live roster before presenting — pools move as questions are added or retired.",
5:"Section break. Keep it moving.",
6:"Walk the screenshot: chip stack on the felt, read the wager, type the dollar payout. The anti-memorisation point is the one to land — answers are COMPUTED from bet x ratio, not matched against stored text, so the numbers change on every draw.",
7:"Do not read the table aloud. Land one line: accuracy beats speed. Then the cooldown point — 20 sessions four hours apart cannot be crammed into the last week, which is deliberate.",
8:"The point that matters to management: difficulty adapts to the person, but a hard question is worth the same ten points as an easy one. That is what keeps scores comparable across a team of mixed experience.",
9:"'Practice can never hurt your record' is the line that gets floor staff to actually use it. Note that practice IS logged — as evidence of effort, and it earns credit toward remediation.",
10:"Contrast this with a classroom refresher a quarter later. A wrong payout corrected in the moment, with the rule attached, is where the learning actually happens.",
11:"Section break into the management layer.",
12:"The two banners are the daily five-minute routine: amber names anyone below the 20-session target, purple names score decay. Mention that deactivated accounts stay on the roster — read the Status column before acting on a banner.",
13:"Four statuses. The value is the Needed column: it gives the shortfall AND the sessions-per-day pace, so the coaching conversation is 'you need two a day', not 'you're behind'.",
14:"The line to land: read the pair, not the number. 55% over 400 answers is a training problem; 55% over nine answers is noise. Volume sits beside every rate for that reason.",
15:"Heads-only screen. Warn them month-to-date always looks weak against a complete month — judge on accuracy and average score, and leave volume until the month closes.",
16:"The drill floor is the integrity point: an assignment cannot auto-complete on practice alone. At least one real scored drill is required. Say this plainly — it is what makes the completion meaningful.",
17:"This is the compliance slide. One file, taken monthly and filed consistently, answers 'prove this team was trained'. Note the wall holds in exports — there is no way to pull another department's data.",
18:"Section break. This is the part the room came for.",
19:"The most important slide for this audience. Ten pit managers are already running identical drills. There is no Pit version to build, no integration to schedule, no licence to buy.",
20:"Reassurance slide. Pit data is invisible to Surveillance and vice versa, enforced in the database rather than the interface. Also flag the warning: never set a Surveillance figure beside a Pit figure and call it a gap — different populations.",
21:"Six areas. Card 06 is the one to flag explicitly — the Shift Manager role is built and tested but no account exists yet. If Pit wants a management layer without account powers, it is available.",
22:"Retention is the one genuinely open item. Frame it as a decision the property's records policy owns, not a gap in the platform. Also be clear that IP and device logging exists for integrity checks, not routine monitoring of staff.",
23:"Current state. Craps being practice-only is deliberate, not a defect. Be careful with the 'not built' list — it is an ideas list, not a roadmap commitment, and no process should be planned around it.",
24:"Three takeaways, then open the floor. If asked for outcome data, be straight: this briefing covers capability. Measured before/after results are not yet available — pre/post comparison reporting is on the not-built list.",
}

prs = Presentation()
prs.slide_width  = Inches(13.333)
prs.slide_height = Inches(7.5)
blank = prs.slide_layouts[6]

for i, f in enumerate(SRC, 1):
    im = Image.open(f)
    if im.width != 2560:
        im = im.resize((2560, 1440), Image.LANCZOS)
    out = TMP/f"s{i:02d}.png"
    im.save(out, optimize=True)

    s = prs.slides.add_slide(blank)
    s.shapes.add_picture(str(out), 0, 0, width=prs.slide_width, height=prs.slide_height)
    s.notes_slide.notes_text_frame.text = NOTES.get(i, "")

dest = HERE.parent/"ASSET-Pit-Operations-Briefing.pptx"
prs.save(dest)
print("saved:", dest, f"{dest.stat().st_size/1e6:.1f} MB", len(SRC), "slides")
