# Video Teacher

Slide-by-slide narrated lessons with a cartoon doctor teacher, played in the browser (made for iPad).

- `video-teacher-template-HE.html`, `video-teacher-template-EN.html` — the templates to upload to the Claude Project.
- `PROJECT-INSTRUCTIONS.md` — the Project instructions that go with them.
- `src/` — the parts the templates are built from: `engine.js` (player + voice engine, shared by both), `style.css`, `teacher-img.html` (the doctor), `sample-he.js` / `sample-en.js` (the example lesson in each template).
- `build.py` — rebuilds both templates after changing `src/`:

```
python3 build.py
python3 build.py --lesson he content.js lesson.html "Topic Video Lesson"   # a lesson from a content block
```

## The voice

The page speaks with the device's own voices (Web Speech API), so the quality ceiling is the best voice on the device. Download *Carmit (Enhanced)* for Hebrew and a *Premium* English voice (Zoe, Ava) in Settings › Accessibility › Read & Speak › Voices.

On top of the voice, the engine makes the delivery human:
- one voice per sentence in Hebrew lessons (English terms said with an Israeli accent from `SAY`) instead of switching voices mid-sentence;
- per-sentence speed, melody and pauses from punctuation and wording: questions rise and get a thinking pause, `...` gets a dramatic pause, key points are slower, asides faster, slides start brighter and wind down at the end, with small natural variation that is the same on every replay;
- slide text cleaned into speech (`%`, ranges, `/`, arrows, `e.g.`, units, brackets, roman numerals, abbreviations);
- optional soft breaths between long sentences;
- the doctor's mouth follows the words syllable by syllable.
