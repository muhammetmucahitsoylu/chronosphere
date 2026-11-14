import sys, json, warnings, numpy as np
warnings.simplefilter("ignore"); sys.path.insert(0,"backend")
import spherex as sx
from astropy.io import fits; from astropy.wcs import WCS
from scipy.interpolate import RegularGridInterpolator as RGI
meta=json.load(open("spike/out/barnard_d2.json"))
for r in (meta[0], meta[-1]):
    with fits.open(sx.S3_BASE+r["key"], use_fsspec=True) as h:
        ww=WCS(h["IMAGE"].header, fobj=h, key="W")
        t=h["WCS-WAVE"].data
        X=np.array(t["X"][0],float); Y=np.array(t["Y"][0],float); V=np.array(t["VALUES"][0],float)
        print("V shape", V.shape, "lam corners [0,0],[0,-1],[-1,0],[-1,-1]:", V[0,0,0],V[0,-1,0],V[-1,0,0],V[-1,-1,0])
        tx,ty,tv=sx._wave_table(r["key"]); print("same table:", np.allclose(tv,V), np.allclose(tx,X))
        for (x,y) in [(r["px"][0],r["px"][1]),(1020,1020),(100,100),(1900,300),(204,204),(0,0)]:
            a=float(ww.all_pix2world(x,y,0)[0])
            m1=float(RGI((Y,X),V[:,:,0])([[y+1,x+1]])[0]); m2=float(RGI((X,Y),V[:,:,0])([[x+1,y+1]])[0])
            print(f"  ({x},{y}) astropy {a:.5f}  mine[y,x] {m1:.5f}  swapped {m2:.5f}")
