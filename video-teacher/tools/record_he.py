#!/usr/bin/env python3
"""Record a Hebrew lesson with a neural Hebrew voice: one mp3 per subtitle line, a/SS-LL.mp3.

    python tools/record_he.py content-he.js ipa-he.json OUT_DIR [--voice he_shaul]

Hebrew lines: Phonikud adds nikud and turns them into phonemes. English terms (E lines) are said
from ipa-he.json (term -> hand-written IPA, Israeli pronunciation). A lone prefix letter at the end
of a Hebrew line (ב, ו, ל, ...) is said together with the term after it, like buildFlow in engine.js.

Needs Python <3.13 with: phonikud phonikud-onnx kokoro-onnx soundfile numpy; ffmpeg; node; and in
tools/models/: phonikud-1.0.int8.onnx (Phonikud/phonikud-onnx), kokoro.onnx, voices-hebrew.bin,
config.json (thewh1teagle/kokoro-hebrew-nc) from huggingface.co (allow *.hf.co in the environment).
"""
import argparse, json, os, pathlib, re, subprocess

HERE = pathlib.Path(__file__).parent
MODELS = pathlib.Path(os.environ.get("HE_MODELS", HERE / "models"))
PREFIX = re.compile(r"(^|\s)(מה|וב|וה|ול|שה|כש|[בולהמשכ])$")
PREFIX_IPA = {'ב': 'be', 'ו': 've', 'ל': 'le', 'ה': 'ha', 'מ': 'mi', 'ש': 'ʃe', 'כ': 'ke', 'מה': 'meha',
              'וב': 'uve', 'וה': 'veha', 'ול': 'vele', 'שה': 'ʃeha', 'כש': 'keʃe'}


def lines_of(content):
    js = ("const fs=require('fs');const H=t=>['h',t],E=t=>['e',t];"
          f"const S=new Function('H','E',fs.readFileSync({json.dumps(str(content))},'utf8')+';return S;')(H,E);"
          "console.log(JSON.stringify(S.map(x=>x.s)));")
    return json.loads(subprocess.run(["node", "-e", js], capture_output=True, text=True, check=True).stdout)


def glottal(ipa):
    """A word that starts with a vowel gets the glottal stop the voice was trained with."""
    return re.sub(r"(^|[\s,:(-])(ˈ?)([aeiou])", r"\1ʔ\2\3", ipa)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("content"); ap.add_argument("ipa"); ap.add_argument("out")
    ap.add_argument("--voice", default="he_shaul"); ap.add_argument("--speed", type=float, default=1.0)
    a = ap.parse_args()
    import numpy as np, soundfile as sf, phonikud
    from phonikud_onnx import Phonikud
    from kokoro_onnx import Kokoro
    pk = Phonikud(str(MODELS / "phonikud-1.0.int8.onnx"))
    k = Kokoro(str(MODELS / "kokoro.onnx"), str(MODELS / "voices-hebrew.bin"), vocab_config=str(MODELS / "config.json"))
    ipa = json.load(open(a.ipa))
    out = pathlib.Path(a.out); (out / "a").mkdir(parents=True, exist_ok=True); tmp = out / "tmp.wav"
    S = lines_of(a.content); total = sum(map(len, S)); n = 0
    for i, lines in enumerate(S):
        carry = ""
        for j, (lang, text) in enumerate(lines):
            n += 1
            if lang == "h":
                t = text.strip(); m = PREFIX.search(t)
                if m and j + 1 < len(lines) and lines[j + 1][0] == "e":
                    carry = PREFIX_IPA[m.group(2)]; t = t[:m.start()].strip()
                ph = phonikud.phonemize(pk.add_diacritics(t)) if t else ""
            else:
                ph = carry + ipa[text]; carry = ""
            mp3 = out / "a" / f"{i:02d}-{j:02d}.mp3"
            if mp3.exists():
                continue
            ph = glottal(ph)
            if re.sub(r"[\s.,:;!?…]", "", ph):
                au, sr = k.create(ph, voice=a.voice, speed=a.speed, is_phonemes=True)
                idx = np.where(np.abs(au) > 0.01)[0]          # trim silence at the edges, keep 60 ms
                if len(idx):
                    au = au[max(0, idx[0] - int(.06 * sr)): idx[-1] + int(.06 * sr)]
            else:
                au, sr = np.zeros(2400, dtype=np.float32), 24000
            sf.write(tmp, au, sr)
            subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(tmp), "-ac", "1", "-b:a", "56k", "-ar", "24000", str(mp3)], check=True)
            print(f"{n}/{total} {i:02d}-{j:02d} {ph[:70]}", flush=True)
    tmp.unlink(missing_ok=True)
    print("DONE")


if __name__ == "__main__":
    main()
