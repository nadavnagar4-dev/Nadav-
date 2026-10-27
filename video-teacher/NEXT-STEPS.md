# Next steps: Hebrew lesson with a real neural voice

Nadav wants the teacher to sound like a real person. English is done with recorded neural audio
(Kokoro, voice **af_heart**, his choice): https://claude.ai/artifact/VGUkYvnktMWybGbJRcrehF

Hebrew still uses the iPad voice and sounds robotic. Free Hebrew neural TTS models are on
huggingface.co, which was blocked in the first session; Nadav has now allowed it in the environment.

## Task for the new session
1. Check `curl -sI https://huggingface.co` works.
2. Install a Hebrew neural TTS. Options to try, in order:
   - `phonikud` / `phonikud-onnx` (adds nikud/phonemes) + the Phonikud Piper Hebrew voice (`piper-onnx`),
     models from huggingface.co/thewh1teagle.
   - Any other good Hebrew model on Hugging Face (e.g. MMS `facebook/mms-tts-heb` as a fallback; lower quality).
   Make short samples first, send them to Nadav, and let him pick (he liked a warm female voice in English).
3. Record `lessons/parasitology/content-he.js`: one mp3 per subtitle line, `a/SS-LL.mp3`
   (SS = entry index, LL = line index). In Hebrew lessons, join each slide's H/E lines the way
   `buildFlow` in `src/engine.js` does, using `SAY` for English terms, but keep one file per line.
   See `tools/record_en.py` for the English recorder (trims silence, 56k mono mp3).
4. `python3 tools/lips.py <dir>` → lips.json; append `const AUDIO={voice:'…',lips:{…}};` to the content.
5. `python3 build.py --lesson he content.js out.html "Parasitology Video Lesson Real Voice"` and publish
   with the slide images copied from https://claude.ai/artifact/EceWEUyYvUva1EA3QjxzCk (`s/p-01.jpg`…`s/p-60.jpg`)
   and the `a/*.mp3` files.
6. Update PROJECT-INSTRUCTIONS.md: real-voice lessons are recorded in Claude Code (the claude.ai Project
   can't record audio), in his chosen voices.
