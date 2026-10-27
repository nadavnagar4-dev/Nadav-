import json, subprocess, sys, os, re
from kokoro_onnx import Kokoro
import soundfile as sf, numpy as np
voice=sys.argv[1] if len(sys.argv)>1 else 'am_michael'
k=Kokoro('kokoro-v1.0.onnx','voices-v1.0.bin')
lines=json.load(open('lines-en.json')); os.makedirs('out-en/a',exist_ok=True)
for n,L in enumerate(lines):
    name=f"out-en/a/{L['i']:02d}-{L['j']:02d}.mp3"
    if os.path.exists(name): continue
    t=L['t'].replace('…','...')
    a,sr=k.create(t,voice=voice,speed=1.0,lang='en-us')
    # trim silence at the edges, keep 60 ms
    idx=np.where(np.abs(a)>0.01)[0]
    if len(idx): a=a[max(0,idx[0]-int(.06*sr)):idx[-1]+int(.06*sr)]
    sf.write('tmp.wav',a,sr)
    subprocess.run(['ffmpeg','-y','-loglevel','error','-i','tmp.wav','-ac','1','-b:a','56k','-ar','24000',name],check=True)
    print(n,len(lines),flush=True)
print('DONE')
