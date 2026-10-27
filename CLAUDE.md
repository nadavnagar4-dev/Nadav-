# Notes for Claude

## Video Teacher lessons (video-teacher/)
Nadav's standing preference: **every lesson uses the real-voice version** — narration recorded with the
Kokoro neural voice **af_heart** ("Heart") and played by the Video Teacher player in recorded-audio mode.
This is the version he chose as the best: https://claude.ai/artifact/VGUkYvnktMWybGbJRcrehF
Never fall back to the device (iPad) voice for a new lesson unless he asks.

How to make one: write the content block as in `video-teacher/PROJECT-INSTRUCTIONS.md`
(English lessons: only `E(...)` lines), render the slides to `s/p-NN.jpg`, then

    python3 video-teacher/tools/make_lesson.py content.js OUT_DIR "<Topic> Lecture English"

and publish `OUT_DIR/index.html` as an Artifact (icon `lesson`) with every `s/*.jpg` and `a/*.mp3` in `files`.
No caption on top of the slide; the subtitle list under it highlights the spoken line.

Hebrew lessons: Kokoro has no Hebrew. A Hebrew neural voice needs huggingface.co (see
`video-teacher/NEXT-STEPS.md`); until that exists, tell him the Hebrew real voice isn't ready yet.
