#!/usr/bin/env python3
"""Record a Hebrew lesson with a neural Hebrew voice: one mp3 per subtitle line, a/SS-LL.mp3.

    python tools/record_he.py content-he.js ipa-he.json OUT_DIR [--voice he_shaul]

Hebrew lines: Phonikud adds nikud and turns them into phonemes. English terms (E lines) are said
from ipa-he.json (term -> hand-written IPA, Israeli pronunciation). A lone prefix letter at the end
of a Hebrew line (ב, ו, ל, ...) is said together with the term after it, like buildFlow in engine.js.

Each English term is said inside its sentence: the Hebrew line before it, the term and the Hebrew line after
it are one utterance, cut back into one mp3 per line at the spaces between them (the model's own timings).
OUT_DIR/join.json lists the lines whose audio runs straight into the next one, so the player adds no pause.

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


def groups(phs, kinds, limit=480):
    """Runs of lines said in one breath: a Hebrew line, the term after it and the Hebrew line after that, ..."""
    out, cur, size = [], [], 0
    for j, (ph, kind) in enumerate(zip(phs, kinds)):
        joined = cur and (kind == "e" or kinds[j - 1] == "e")
        if not joined or size + len(ph) + 1 > limit:
            if cur: out.append(cur)
            cur, size = [], 0
        cur.append(j); size += len(ph) + 1
    if cur: out.append(cur)
    return out


def say_group(k, voice, speed, phs):
    """One utterance for the whole run, cut back into lines at the spaces between them (model timings)."""
    import numpy as np
    text = " ".join(phs)
    tokens = k.tokenizer.tokenize(text)
    style = k._style_for(k.get_voice_style(voice), len(tokens))
    au, dur = k._infer(tokens, style, speed)
    dur = np.asarray(dur, dtype=float); spf = len(au) / dur.sum()      # samples per frame
    ends = np.cumsum(dur) * spf                                          # token i+1 ends at ends[i+1] (0 = pad)
    cuts, pos = [0], 0
    for ph in phs[:-1]:                                                  # token index of each separating space
        pos += len(k.tokenizer.tokenize(ph)); sp = pos + 1               # +1 for the leading pad
        cuts.append(int(ends[sp - 1] + .35 * (ends[sp] - ends[sp - 1]))); pos += 1   # early in the gap: no onset of the next word
    cuts.append(len(au))
    return [au[a:b] for a, b in zip(cuts, cuts[1:])], len(phs) > 1


def trim(au, sr, head=True, tail=True):
    import numpy as np
    idx = np.where(np.abs(au) > 0.01)[0]                                  # trim silence at the outer edges, keep 60 ms
    if not len(idx): return au
    a = max(0, idx[0] - int(.06 * sr)) if head else 0
    b = idx[-1] + int(.06 * sr) if tail else len(au)
    return au[a:b]


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
    S = lines_of(a.content); total = sum(map(len, S)); n = 0; join = []
    for i, lines in enumerate(S):
        carry = ""; phs = []
        for j, (lang, text) in enumerate(lines):
            if lang == "h":
                t = text.strip(); m = PREFIX.search(t)
                if m and j + 1 < len(lines) and lines[j + 1][0] == "e":
                    carry = PREFIX_IPA[m.group(2)]; t = t[:m.start()].strip()
                ph = phonikud.phonemize(pk.add_diacritics(t)) if t else ""
            else:
                ph = carry + ipa[text]; carry = ""
            phs.append(glottal(ph))
        kinds = [l for l, _ in lines]
        for g in groups(phs, kinds):
            mp3s = [out / "a" / f"{i:02d}-{j:02d}.mp3" for j in g]
            if all(m.exists() for m in mp3s):
                n += len(g); continue
            said = [j for j in g if re.sub(r"[\s.,:;!?…]", "", phs[j])]
            parts = dict(zip(said, say_group(k, a.voice, a.speed, [phs[j] for j in said])[0])) if said else {}
            sr = 24000
            for j, mp3 in zip(g, mp3s):
                au = parts.get(j)
                if au is None: au = np.zeros(2400, dtype=np.float32)
                else: au = trim(au, sr, head=j == said[0], tail=j == said[-1])
                if j != g[-1]: join.append(f"{i:02d}-{j:02d}")
                sf.write(tmp, au, sr)
                subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(tmp), "-ac", "1", "-b:a", "56k", "-ar", "24000", str(mp3)], check=True)
                n += 1; print(f"{n}/{total} {i:02d}-{j:02d} {phs[j][:70]}", flush=True)
    (out / "join.json").write_text(json.dumps(join))
    tmp.unlink(missing_ok=True)
    print("DONE")


if __name__ == "__main__":
    main()
