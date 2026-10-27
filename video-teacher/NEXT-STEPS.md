# Next steps

Done (2026-10-27): the Hebrew Parasitology lesson is recorded with the real Hebrew voice Shaul
(`he_shaul`, Nadav's pick out of Noa / Phonikud / Michael / Shaul):
https://claude.ai/artifact/QLTRdBpSRtThoPnBJ2djUg

How it was made: `tools/record_he.py` (Phonikud nikud + phonemes for Hebrew lines, hand-written IPA from
`lessons/parasitology/ipa-he.json` for English terms), `tools/lips.py`, `build.py --lesson he`, slides
copied from https://claude.ai/artifact/EceWEUyYvUva1EA3QjxzCk.

Open: if Nadav hears a term said wrong, fix its IPA in `ipa-he.json`, delete that line's mp3 and re-record.

Done (2026-10-27): Parasitology L5 Hebrew lesson from Nadav's Slides deck (https://claude.ai/artifact/LSHaHCrn8XJRRDwSsvzVhK),
39 slides, Shaul voice: https://claude.ai/artifact/5Q4LQP14fSm955YjgMLuRF
Content in `lessons/parasitology-l5/`. Slide images rendered from the deck's HTML with `tools/render_slides.js`
(the deck's own cover / intro / exam-tip slides are used as images, so no INTRO/OUTRO cards).
Publish in two calls: an Artifact publish takes at most 255 files.
