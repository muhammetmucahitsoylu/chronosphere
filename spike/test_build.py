import sys, time, warnings, numpy as np
warnings.simplefilter("ignore")
sys.path.insert(0, "backend")
import spherex as sx
from PIL import Image
ra,dec=269.4521,4.6934
t0=time.time(); fr=sx.search_frames(ra,dec); print("search", len(fr), round(time.time()-t0,1),"s")
import collections; print(collections.Counter((f["coll"],f["det"]) for f in fr))
d2=[f for f in fr if f["det"]==2]
grid=sx.make_grid(ra,dec,5.0); print("grid n",grid["n"],"scale",grid["scale"])
t0=time.time(); out=[]; errs=0
for f,r in sx.build(d2, grid):
    if r is None: errs+=1; print("skip", f["id"], f.get("error","no coverage"))
    else: out.append(r)
print("built", len(out), "skipped", errs, round(time.time()-t0,1),"s")
out.sort(key=lambda r:r["mjd"])
for r in out[:3]+out[-3:]: print({k:r[k] for k in ("id","date","coll","lam","lgx","lgy","bw","bg","sig","cov","fwhm","px")})
# truth check of wavelength with astropy -TAB
from astropy.io import fits; from astropy.wcs import WCS
r=out[0]
with fits.open(sx.S3_BASE+r["key"], use_fsspec=True) as h:
    ww=WCS(h["IMAGE"].header, fobj=h, key="W")
    print("astropy lam,bw at px", ww.all_pix2world(r["px"][0], r["px"][1], 0), "mine", r["lam"], r["bw"])
# montage
n=grid["n"]; tiles=[]
for r in out:
    a=r["data"].astype(float); a=np.arcsinh(np.clip(a,-1,None)/ (3*max(r["sig"],0.01)))
    a=np.nan_to_num((a-np.nanmin(a))/(np.nanpercentile(a,99.8)-np.nanmin(a)+1e-9)); a=np.clip(a,0,1)
    tiles.append((a[::-1]*255).astype(np.uint8))
cols=10; rows=(len(tiles)+cols-1)//cols
M=np.zeros((rows*(n+2),cols*(n+2)),np.uint8)
for i,t in enumerate(tiles): M[(i//cols)*(n+2):(i//cols)*(n+2)+n,(i%cols)*(n+2):(i%cols)*(n+2)+n]=t
Image.fromarray(M).resize((M.shape[1]*2,M.shape[0]*2),Image.NEAREST).save("spike/out/barnard_d2.png")
np.save("spike/out/barnard_d2.npy", np.stack([r["data"] for r in out])); 
import json; json.dump([{k:v for k,v in r.items() if k!="data"} for r in out], open("spike/out/barnard_d2.json","w"))
