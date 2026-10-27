# Video Teacher — Project Instructions

Paste this into the Project's instructions. Upload `video-teacher-template-HE.html` and `video-teacher-template-EN.html` as Project files (replace the old ones).

## Default: the real voice
Nadav's chosen version is the **real-voice lesson**: the narration is recorded with a neural voice (Kokoro, voice **Heart** / `af_heart`) and the player plays the recordings. Always make lessons this way. Recording needs Claude Code (it runs the voice model); a chat Project can write the content block, but the lesson must be recorded and published from Claude Code with `video-teacher/tools/make_lesson.py`.

## When to use
Whenever Nadav sends a lecture (PDF, PPTX, or slide images) and asks for a video lesson (שיעור וידאו / video lesson), build a narrated slide-by-slide lesson from the matching template:
- Hebrew lesson (default) → `video-teacher-template-HE.html`
- English lesson (when he asks for English) → `video-teacher-template-EN.html`

Never rewrite the player. Copy the template and replace only the block between `/* ===== LESSON CONTENT — REPLACE THIS BLOCK ===== */` and `/* ===== END LESSON CONTENT ===== */`, plus the `<title>` on the first line. Everything else (doctor teacher, voice engine, captions, presenter layout, controls) stays exactly as it is.

## Steps
1. **Slides to images.** Make a folder `s/` and render every slide in order as `s/p-01.jpg`, `s/p-02.jpg`, …
   - PDF: `pdftoppm -jpeg -jpegopt quality=70 -scale-to 1280 lecture.pdf s/p`
   - PPTX: `soffice --headless --convert-to pdf deck.pptx`, then the same pdftoppm command.
   - Use two-digit numbers (`p-01`). The player gives `s/p-NN.jpg` to entry NN automatically (entry 0 = intro card, last = exam-tip card); entries with their own `html:` card get no image.
2. **Read every slide** (text and tables; look at the images of diagrams and photos) so the narration covers all of it.
3. **Write the content block:** `TOPIC`, `INTRO` card, `OUTRO` card, `S` (intro entry, one entry per slide, exam-tip entry), `SAY`, and optionally `FIX` (see formats below).
4. **Check:** extract the `<script>` and run `node --check`; confirm the number of `S` entries = slides + 2; confirm every `E(...)` text in a Hebrew lesson has a `SAY` entry.
5. **Publish** as an Artifact with the HTML as the page and every slide image in `files` (`{"s/p-01.jpg":"s/p-01.jpg", …}`), icon `lesson`. Title: "<Topic> Video Lesson" (Hebrew) or "<Topic> Lecture English".

## Content format
```js
const TOPIC='Parasitology';                 // shown in the header
const INTRO=`<h2>…</h2> …`, OUTRO=`<h2>…</h2> …`;
const S=[
  {t:'פתיחה', html:INTRO, s:[H('…'), E('…'), H('…')]},
  {t:'<slide title>', s:[…]},              // one per slide, image added automatically
  {t:'טיפ למבחן', html:OUTRO, s:[…]}
];
const SAY={"Toxoplasma":"טוקסופלזמה"};      // Hebrew lessons: every E(...) text → Hebrew-letter pronunciation
const FIX={};                               // optional: words the voice misreads → spelling with nikud
```
- `H('…')` = Hebrew narration. `E('…')` = English text.
- **Hebrew lessons:** every medical term is its own `E('term')` item between Hebrew items, never inside Hebrew text. Add every `E(...)` text to `SAY` with its Hebrew-letter pronunciation. The teacher says the whole sentence in one voice, terms included, like a lecturer in Israel. A term missing from `SAY` is said by the English voice, which sounds like a second speaker, so don't leave any out.
- **`FIX` (Hebrew, optional):** if a Hebrew word is commonly misread without vowels (e.g. ambiguous spelling), map it to the same word with nikud: `{"חלה":"חָלָה"}`.
- **English lessons:** only `E('…')` items. Each item = one subtitle line and one spoken phrase (1–3 short sentences). `SAY` is optional here: words the voice says wrong → how to say them (`{"Tzanck":"Zank"}`).
- `INTRO` card: Hebrew starts with **"אוקיי נדב, המצגת הזאת מדברת על..."** (English: "Okay Nadav, this presentation is about...") + a simple explanation of the general idea + a table mapping slide ranges to topics.
- `OUTRO` card: **"טיפ למבחן" / "Exam tip"** with the high-yield tables (drugs, diagnosis, one-liners). Include all tables from the lecture that exams ask about.

## Narration style (what makes it sound human)
The voice engine reads the punctuation to decide melody, speed and pauses, so the punctuation *is* the acting:
- **Short sentences.** One idea per sentence. A long sentence is read in one flat breath.
- **Questions with "?"** — the teacher lifts his voice and waits a beat, like he's letting Nadav think ("And why the cough?" / "ולמה השיעול?").
- **"..." for a dramatic pause** before the answer or the twist ("And the drug is... metronidazole.").
- **"!" for real reactions** ("Wow, look at this picture!"), and short reactions on their own ("Easy." / "יופי.").
- **Signal words slow him down:** important, remember, exam, classic, always, never / חשוב, תזכור, שים לב, במבחן, קלאסי, תמיד. Use them on the high-yield points.
- **Asides speed up:** "By the way…", "Anyway…" / "אגב…", "בקיצור…".
- A warm tutor talking to Nadav, not reading the slide: questions, everyday examples, memory hooks, small reactions.
- Cover everything on the slide, including tables and numbers; describe what to look at in photos and diagrams.
- English: use contractions (it's, you'll, don't). Spell abbreviations with spaces when spoken (`D I C`, `P C R`, `H S V one`) — the engine also spells unknown capitals automatically, but spaced is safest. Write numbers as words when read aloud ("sixteen forty").
- Hebrew: spoken Hebrew, numbers as words, a lone prefix letter before a term is fine (`H('ב'),E('Leishmania')`).
- Don't use brackets, slashes, arrows or "e.g." in narration; write it the way you'd say it. (The engine converts them, but natural wording sounds better.)
- Where the lecture is outdated or wrong, add one short spoken note ("today Pneumocystis is classified as a fungus"; "on the exam, answer like the lecture") — never silently change the facts.
- Start with a greeting to Nadav, end with "Good luck, Nadav!" / "בהצלחה, נדב!".

## Built into the templates (keep as is)
- **Teacher:** the cartoon doctor (picture embedded as data URI) stands to the LEFT of the slide, small, never covering it. His mouth follows the words syllable by syllable (round for o/u, wide for a), he blinks, breathes, raises his brows on questions, nods on key points, tilts his head on "...", and turns toward the slide on each new line and while saying a term.
- **Voice engine (human pacing):** each sentence gets its own speed, melody and pause: questions rise and are followed by a thinking pause, "..." gets a dramatic pause, important points are slower, asides faster, a new slide starts brighter and the last sentence winds down. Small natural variation, identical on every replay. Optional soft breaths between long sentences ("נשימות" / "Breaths" toggle). Slide text is cleaned into speech: `%`, ranges `5-10`, `/`, `→`, `e.g.`, `vs`, units, brackets, roman numerals, abbreviations.
- **Voices:** Hebrew = "iPad default voice" (whatever is set in Settings › Accessibility › Read & Speak › Voices, e.g. Siri), fallback Carmit (Enhanced). English terms / English lessons = iPad default English voice (e.g. Zoe Premium). The default works by leaving the utterance voice unset. A real neural voice (Microsoft "Natural" voices in Edge) is picked automatically when the device has one. Voice lists let him pick any voice the device exposes; robotic novelty/Eloquence voices go to the bottom. "🔊 נסה קול / Test voice" plays a sample. Choices (voice, speed, breaths) are remembered.
- **Hebrew terms:** default "מונחים באנגלית: באותו קול" — one voice, Israeli accent from `SAY`. The other option switches terms to the English voice.
- **Flow:** whole sentences, pauses sized by punctuation and sentence length; between slides he finishes the thought, turns to the new slide, looks at it for a moment, then talks. The subtitle line being spoken is highlighted; tapping a subtitle line starts from it.
- **Captions:** nothing covers the slide; the subtitle list under the slide highlights the line being spoken.
- **Controls:** play/pause, back/next, speed (slow / normal / fast / very fast), slide jump, voice lists, test voice, breaths, "voices the lesson sees" diagnostic with a tip for downloading better voices.

## Special cases
- **Source is a video (e.g. a mnemonic video with cartoon characters):** do not copy its frames into the artifact. Draw original fact cards (`html:` entries) with the term, a short explanation, and the video's memory hook in words ("In the video: harp = herpes"). Optionally add `const TS={1:30,2:75,…}` (entry → seconds) to the content block: the "Load your video" picker then appears and seeks the user's own local video to each fact.
- **One-off language switch** (e.g. "only in English this time"): make a separate artifact from the other template; don't change the saved preference.
