import time, json, warnings, numpy as np, pyvo
warnings.simplefilter("ignore")
from astropy.io import fits
from astropy.wcs import WCS
from concurrent.futures import ThreadPoolExecutor
svc = pyvo.dal.SIA2Service("https://irsa.ipac.caltech.edu/SIA")
ra,dec=269.4521,4.6934
tb=svc.search(pos=(ra,dec,0.01), collection="spherex_dr1").to_table()
tb=tb[[ "D2" in str(x) for x in tb["energy_bandpassname"]]]
keys=[json.loads(str(c))["aws"]["key"] for c in tb["cloud_access"]]
base="https://nasa-irsa-spherex.s3.amazonaws.com/"
def get(key, verbose=False):
    t0=time.time()
    with fits.open(base+key, use_fsspec=True, fsspec_kwargs={"block_size":262144,"cache_type":"bytes"}) as h:
        if verbose: h.info()
        hdr=h["IMAGE"].header
        w=WCS(hdr)
        x,y=w.all_world2pix(ra,dec,0); x=int(round(float(x))); y=int(round(float(y)))
        s=np.s_[max(0,y-30):y+30, max(0,x-30):x+30]
        im=h["IMAGE"].section[s]; fl=h["FLAGS"].section[s]; zo=h["ZODI"].section[s]
        wt=h["WCS-WAVE"].data
        if verbose:
            print("pix",x,y,"im",im.shape, float(np.nanmax(im)))
            print("WAVE cols", h["WCS-WAVE"].columns)
            print("WAVE hdr", {k:v for k,v in h["WCS-WAVE"].header.items() if k not in ("XTENSION","BITPIX")})
            print("W keys", {k:hdr[k] for k in hdr if k.endswith("W") or k.startswith("PS") or k.startswith("PV")})
            print("X", wt["X"][0], "\nY", wt["Y"][0], "\nV", np.array(wt["VALUES"][0]).reshape(-1)[:8], np.array(wt["VALUES"][0]).shape)
    return time.time()-t0
print("first:", round(get(keys[0], True),1),"s")
for n in (8,24):
    t0=time.time()
    with ThreadPoolExecutor(n) as ex: r=list(ex.map(get, keys[1:n+1]))
    print(n,"parallel:", round(time.time()-t0,1),"s; per-file", round(np.mean(r),1))
