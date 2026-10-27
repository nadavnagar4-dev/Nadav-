#!/usr/bin/env python3
"""Builds video-teacher-template-HE.html and video-teacher-template-EN.html from src/.

    python3 build.py                      # the two templates
    python3 build.py --lesson he content.js out.html "Title"   # a lesson from a content block

The content block is everything between the LESSON CONTENT markers (TOPIC, INTRO, OUTRO, S, SAY, FIX, TS).
"""
import pathlib, sys

ROOT = pathlib.Path(__file__).parent
SRC = ROOT / "src"
BEGIN = "/* ===== LESSON CONTENT — REPLACE THIS BLOCK ===== */"
END = "/* ===== END LESSON CONTENT ===== */"

EXTRA_CSS = """
[hidden]{display:none!important}
h1 .topic{font-style:normal;color:inherit}
label.tog{display:inline-flex;align-items:center;gap:6px;font-size:.95rem;color:var(--muted);min-height:42px;cursor:pointer}
label.tog input{width:18px;height:18px;accent-color:var(--eosin)}
.subs [data-i]{cursor:pointer}
.note p{margin:6px 0}
"""
EN_CSS = """
/* English-only version */
.card,.vcap,.bar,.vload,.note,.subs .h,.subs .ti,.start{direction:ltr;text-align:left}
.start{text-align:center}
.card th,.card td{text-align:left}
.fterm{text-align:left}
.subs .e{font-family:var(--f-body);color:var(--ink);font-size:1.06rem}
.subs .e.past{color:var(--sub-past)}
"""

UI = {
"he": r"""const UI={
  defHe:'ברירת המחדל בעברית (הקול שבחרת בהגדרות)', defEn:'ברירת המחדל באנגלית (הקול שבחרת בהגדרות)',
  natural:' · טבעי מאוד', good:' · טבעי',
  noteNow:(n,en)=>`המורה מדבר בקול ${n}, בקצב, בהפסקות ובמנגינה של מורה אמיתי.`+(en?` המונחים באנגלית נאמרים בקול ${en}.`:' המונחים באנגלית נאמרים באותו קול, במבטא ישראלי, כמו אצל מרצה בארץ.'),
  noSpeech:'הדפדפן הזה לא יודע להקריא, אז הכתוביות ירוצו לבד.',
  sample:'היי נדב, ככה אני נשמע. נשמע טוב? יופי, אז בוא נתחיל.',
  counter:(c,n)=>c===0?'פתיחה':c===n-1?'טיפ למבחן':`שקופית ${c} מתוך ${n-2}`,
  play:'▶ נגן', pause:'❚❚ עצור', keyNext:'ArrowLeft', keyPrev:'ArrowRight',
  vLoading:'טוען את הסרטון…', vReady:'הסרטון נטען. בכל שקופית תופיע התמונה מהסרטון.', vSwap:'החלף סרטון',
  vError:'לא הצלחתי לפתוח את הקובץ. נסה לבחור אותו שוב מ-Files.'
};""",
"en": r"""const UI={
  defHe:'Hebrew default', defEn:'Device default English voice (set in Settings)',
  natural:' · very natural', good:' · natural',
  noteNow:(n)=>`The teacher is speaking with ${n}, with a real teacher's pace, pauses and melody.`,
  noSpeech:"This browser can't read aloud, so the subtitles will run on their own.",
  sample:"Hi Nadav, this is how I sound. Sounds good? Great, let's get started.",
  counter:(c,n)=>c===0?'Intro':c===n-1?'Exam tip':`Slide ${c} / ${n-2}`,
  play:'▶ Play', pause:'❚❚ Pause', keyNext:'ArrowRight', keyPrev:'ArrowLeft',
  vLoading:'Loading the video…', vReady:'Video loaded. Each slide shows its picture from the video.', vSwap:'Change video',
  vError:"Couldn't open the file. Try choosing it again from Files."
};""",
}

BAR = {
"he": """  <div class="bar">
    <button class="ctl" id="prev" type="button" aria-label="שקופית קודמת">→ הקודם</button>
    <button class="ctl main" id="play" type="button">▶ נגן</button>
    <button class="ctl" id="next" type="button" aria-label="שקופית הבאה">הבא ←</button>
    <span class="grow"></span>
    <select id="speed" aria-label="מהירות"><option value="0.85">איטי</option><option value="1" selected>רגיל</option><option value="1.12">מהיר</option><option value="1.25">מהיר מאוד</option></select>
    <select id="voice" aria-label="קול עברית"><option value="">קול אוטומטי</option></select>
    <button class="ctl" id="testv" type="button">🔊 נסה קול</button>
    <select id="termmode" aria-label="איך להגיד מונחים באנגלית"><option value="il" selected>מונחים באנגלית: באותו קול</option><option value="en">מונחים באנגלית: קול אנגלי</option></select>
    <select id="envoice" aria-label="קול אנגלית" hidden><option value="">English auto</option></select>
    <label class="tog"><input type="checkbox" id="breath" checked> נשימות</label>
    <select id="jump" aria-label="מעבר לשקופית"></select>
  </div>
  <details class="note" id="vdiag"><summary>הקולות שהשיעור רואה במכשיר</summary>
    <p>לקול הכי אנושי באייפד: Settings › Accessibility › Read &amp; Speak › Voices › Hebrew, והורד את <span class="t">Carmit (Enhanced)</span>. לאנגלית: <span class="t">Zoe</span> או <span class="t">Ava (Premium)</span>. אחר כך סגור את השיעור לגמרי ופתח אותו מחדש.</p>
    <pre id="vlist" style="white-space:pre-wrap;direction:ltr;text-align:left;font-family:var(--f-term);font-size:.8rem;margin:6px 0 0"></pre></details>
  <p class="note" id="note">המורה מדבר בקול העברי הכי טבעי שיש במכשיר שלך. מקשים: רווח לעצירה, חצים למעבר. לחיצה על שורה בכתוביות מתחילה ממנה.</p>""",
"en": """  <div class="bar">
    <button class="ctl" id="prev" type="button" aria-label="Previous slide">← Back</button>
    <button class="ctl main" id="play" type="button">▶ Play</button>
    <button class="ctl" id="next" type="button" aria-label="Next slide">Next →</button>
    <span class="grow"></span>
    <select id="speed" aria-label="Speed"><option value="0.85">Slow</option><option value="1" selected>Normal</option><option value="1.12">Fast</option><option value="1.25">Very fast</option></select>
    <select id="envoice" aria-label="English voice"><option value="">English auto</option></select>
    <button class="ctl" id="testv" type="button">🔊 Test voice</button>
    <label class="tog"><input type="checkbox" id="breath" checked> Breaths</label>
    <select id="jump" aria-label="Go to slide"></select>
  </div>
  <details class="note" id="vdiag"><summary>Voices the lesson can see on this device</summary>
    <p>For the most human voice on iPad: Settings › Accessibility › Read &amp; Speak › Voices › English, and download <span class="t">Zoe</span> or <span class="t">Ava (Premium)</span>. Then close the lesson completely and open it again.</p>
    <pre id="vlist" style="white-space:pre-wrap;direction:ltr;text-align:left;font-family:var(--f-term);font-size:.8rem;margin:6px 0 0"></pre></details>
  <p class="note" id="note">The teacher speaks with the most natural English voice on your device. Keys: space to pause, arrows to move. Tap a subtitle line to start from it.</p>""",
}

STAGE = {
"he": ("שיעור וידאו", "התחל את השיעור", "המורה יסביר כל שקופית בקול", "טען את הסרטון שלך",
       "כדי לראות בכל שקופית את התמונה מהסרטון, בחר את קובץ הסרטון מהאייפד. הסרטון נשאר אצלך במכשיר."),
"en": ("video lesson", "Start the lesson", "The teacher explains every slide out loud", "Load your video",
       "To see each slide's picture from the video, choose the video file on your iPad. It stays on your device."),
}


def page(lang, title, content):
    sub, start_b, start_s, vbtn, vtext = STAGE[lang]
    css = (SRC / "style.css").read_text() + EXTRA_CSS + (EN_CSS if lang == "en" else "")
    teacher = (SRC / "teacher-img.html").read_text().rstrip("\n")
    engine = (SRC / "engine.js").read_text()
    return f"""<title>{title}</title>
<meta name="claude:viewport-fit-sides" content="cover">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Assistant:wght@400;600;700&family=Suez+One&family=IBM+Plex+Mono:wght@500;600&display=swap">
<style>
{css}</style>

<div class="wrap">
  <header>
    <h1><em class="topic">Topic</em> <span>{sub}</span></h1>
    <div class="counter" id="counter"></div>
  </header>
  <div class="prog"><div id="prog"></div></div>

  <div class="presenter">
    <div class="teacher doc lookme" id="teacher" aria-hidden="true"><div class="body"><div class="head">
{teacher}
    </div></div></div>
  <div class="stage" id="stage">
    <img id="slideImg" alt="" hidden>
    <video id="vid" playsinline muted preload="auto" hidden></video>
    <div class="vcap" id="vcap" hidden></div>
    <div class="card" id="card" hidden></div>
    <div class="cc" id="cc" hidden><span id="ccText"></span></div>
    <button class="start" id="startBtn" type="button"><i>▶</i><b>{start_b}</b><span>{start_s}</span></button>
  </div>
  </div>

  <div class="vload" id="vload" hidden>
    <label class="ctl vbtn" for="vfile">{vbtn}</label>
    <input type="file" id="vfile" accept="video/*,.mp4,.mov" style="position:absolute;width:1px;height:1px;opacity:0;overflow:hidden">
    <span id="vstate">{vtext}</span>
  </div>
  <div class="subs" id="subs" aria-live="polite"></div>

{BAR[lang]}
</div>

<script>
const LANG='{lang}';
{UI[lang]}
const H=(t)=>['h',t], E=(t)=>['e',t];

{BEGIN}
{content.strip()}
{END}

{engine}</script>
"""


def main():
    if len(sys.argv) > 1 and sys.argv[1] == "--lesson":
        lang, content, out, title = sys.argv[2:6]
        pathlib.Path(out).write_text(page(lang, title, pathlib.Path(content).read_text()))
        return
    for lang in ("he", "en"):
        content = (SRC / f"sample-{lang}.js").read_text()
        title = "Video Lesson Template" if lang == "he" else "Lecture English Template"
        (ROOT / f"video-teacher-template-{lang.upper()}.html").write_text(page(lang, title, content))


if __name__ == "__main__":
    main()
