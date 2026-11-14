import time, io, requests, pyvo, numpy as np
from astropy.io import fits
from astropy.wcs import WCS
from concurrent.futures import ThreadPoolExecutor
svc = pyvo.dal.SIA2Service("https://irsa.ipac.caltech.edu/SIA")
ra,dec=269.4521,4.6934
tb=svc.search(pos=(ra,dec,0.01), collection="spherex_dr1").to_table()
tb=tb[[ "D2" in str(x) for x in tb["energy_bandpassname"]]]
urls=[str(u) for u in tb["access_url"]]
print("D2 frames:", len(urls)); print("cloud:", str(tb["cloud_access"][0])[:300])
def get(u):
    t0=time.time(); tries=0
    for i in range(5):
        tries+=1
        r=requests.get(u+f"?center={ra},{dec}deg&size=0.1deg", timeout=90)
        if r.status_code==200: break
        time.sleep(1.5*(i+1))
    return time.time()-t0, r.status_code, r.content, tries
dt,code,content,tries=get(urls[0]); print("one cutout:", round(dt,1),"s", code, len(content)//1024,"KB tries",tries)
if code!=200: print(content[:300]); raise SystemExit
h=fits.open(io.BytesIO(content))
h.info()
hdr=h["IMAGE"].header
print({k:hdr.get(k) for k in ["MJD-AVG","DETECTOR","BUNIT","NAXIS1","NAXIS2","CTYPE1","DATE-AVG"]})
w=WCS(hdr); print("target pix:", w.all_world2pix(ra,dec,0))
im=h["IMAGE"].data; print("img", im.shape, float(np.nanmedian(im)), float(np.nanmax(im)))
t0=time.time()
with ThreadPoolExecutor(6) as ex: res=list(ex.map(get, urls[1:17]))
print("16 parallel(6):", round(time.time()-t0,1),"s ok=", [c for _,c,_,_ in res].count(200), "tries", [t for *_,t in res])
