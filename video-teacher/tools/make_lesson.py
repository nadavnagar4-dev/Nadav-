#!/usr/bin/env python3
"""Make a real-voice lesson from a content block: record every subtitle line with a neural voice,
build the mouth tracks, and write the lesson page.

    python3 tools/make_lesson.py content-en.js OUT_DIR "Topic Lecture English" [--voice af_heart]

OUT_DIR gets index.html and a/SS-LL.mp3 (one file per subtitle line). Put the slide images in
OUT_DIR/s/p-NN.jpg and publish index.html with s/ and a/ as files.

Needs: pip install kokoro-onnx soundfile; ffmpeg; and the Kokoro model files in tools/models/
(downloaded automatically from the kokoro-onnx GitHub release on first run).
English only for now (Kokoro has no Hebrew voice).
"""
import argparse, json, os, pathlib, subprocess, urllib.request

HERE = pathlib.Path(__file__).parent
ROOT = HERE.parent
MODELS = HERE / "models"
REL = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/"


def lines_of(content):
    """[(entry, line, lang, text)] from the content block, evaluated by node."""
    js = (
        "const fs=require('fs');const H=t=>['h',t],E=t=>['e',t];"
        f"const src=fs.readFileSync({json.dumps(str(content))},'utf8');"
        "const S=new Function('H','E',src+';return S;')(H,E);"
        "console.log(JSON.stringify(S.flatMap((x,i)=>x.s.map(([l,t],j)=>[i,j,l,t]))));"
    )
    return json.loads(subprocess.run(["node", "-e", js], capture_output=True, text=True, check=True).stdout)


def record(lines, out, voice):
    import numpy as np, soundfile as sf
    from kokoro_onnx import Kokoro
    MODELS.mkdir(exist_ok=True)
    for f in ("kokoro-v1.0.onnx", "voices-v1.0.bin"):
        if not (MODELS / f).exists():
            print("downloading", f, flush=True)
            urllib.request.urlretrieve(REL + f, MODELS / f)
    k = Kokoro(str(MODELS / "kokoro-v1.0.onnx"), str(MODELS / "voices-v1.0.bin"))
    (out / "a").mkdir(parents=True, exist_ok=True)
    tmp = out / "tmp.wav"
    for n, (i, j, lang, text) in enumerate(lines):
        mp3 = out / "a" / f"{i:02d}-{j:02d}.mp3"
        if mp3.exists():
            continue
        a, sr = k.create(text.replace("…", "..."), voice=voice, speed=1.0, lang="en-us")
        idx = np.where(np.abs(a) > 0.01)[0]          # trim silence at the edges, keep 60 ms
        if len(idx):
            a = a[max(0, idx[0] - int(.06 * sr)): idx[-1] + int(.06 * sr)]
        sf.write(tmp, a, sr)
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(tmp), "-ac", "1", "-b:a", "56k", "-ar", "24000", str(mp3)], check=True)
        print(f"{n + 1}/{len(lines)}", flush=True)
    tmp.unlink(missing_ok=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("content"); ap.add_argument("out"); ap.add_argument("title")
    ap.add_argument("--voice", default="af_heart")
    a = ap.parse_args()
    out = pathlib.Path(a.out)
    lines = lines_of(a.content)
    record(lines, out, a.voice)
    subprocess.run(["python3", str(HERE / "lips.py"), str(out)], check=True)
    lips = (out / "lips.json").read_text()
    full = out / "content-audio.js"
    full.write_text(pathlib.Path(a.content).read_text() + f"\nconst AUDIO={{voice:'Kokoro {a.voice}',lips:{lips}}};\n")
    subprocess.run(["python3", str(ROOT / "build.py"), "--lesson", "en", str(full), str(out / "index.html"), a.title], check=True)
    print("wrote", out / "index.html")


if __name__ == "__main__":
    main()
