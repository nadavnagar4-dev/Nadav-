import sys, glob, os, subprocess, json, numpy as np
d=sys.argv[1]; out={}
for f in sorted(glob.glob(d+'/a/*.mp3')):
    raw=subprocess.run(['ffmpeg','-loglevel','error','-i',f,'-f','s16le','-ac','1','-ar','8000','-'],capture_output=True,check=True).stdout
    a=np.frombuffer(raw,dtype=np.int16).astype(np.float32)/32768
    n=len(a)//400; r=np.array([np.sqrt(np.mean(a[i*400:(i+1)*400]**2)) for i in range(n)])
    if not n: continue
    ref=np.percentile(r,95) or 1
    lv=np.digitize(r/ref,[.08,.3,.55,.8])
    out[os.path.basename(f)[:-4]]=''.join(map(str,lv))
json.dump(out,open(d+'/lips.json','w'))
print(len(out),'files', sum(len(v) for v in out.values()),'frames')
