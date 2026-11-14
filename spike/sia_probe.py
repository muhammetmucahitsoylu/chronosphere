import time, sys, collections
import pyvo
from astropy.time import Time
svc = pyvo.dal.SIA2Service("https://irsa.ipac.caltech.edu/SIA")
targets = {
 "Barnard": (269.4521, 4.6934),
 "EpsIndiB": (330.8724, -56.7973),
 "WISE0855": (133.7951, -7.2451),
 "RWAur": (76.9563, 30.4011),
 "RDra": (248.1880, 66.7530),
}
cols = ["spherex_qr", "spherex_qr2", "spherex_qr3", "spherex_qr2_deep"]
first = True
for name,(ra,dec) in targets.items():
    for c in cols:
        t0=time.time()
        try:
            r = svc.search(pos=(ra,dec,0.01), collection=c)
        except Exception as e:
            print(name, c, "ERR", str(e)[:120]); continue
        dt=time.time()-t0
        n=len(r)
        if n==0:
            print(f"{name:9s} {c:16s} n=0 ({dt:.1f}s)"); continue
        tb=r.to_table()
        if first:
            print("COLUMNS:", tb.colnames); print("ROW0:", {k:str(tb[0][k])[:150] for k in ["obs_id","energy_bandpassname","t_min","access_url","s_pixel_scale","dataproduct_subtype","calib_level"] if k in tb.colnames}); first=False
        det=collections.Counter(str(x) for x in tb["energy_bandpassname"])
        tm=sorted(float(x) for x in tb["t_min"])
        # epochs: gaps > 30 days
        ep=[[tm[0],tm[0]]]
        for t in tm[1:]:
            if t-ep[-1][1]>30: ep.append([t,t])
            else: ep[-1][1]=t
        eps=", ".join(f"{Time(a,format='mjd').iso[:10]}..{Time(b,format='mjd').iso[:10]}" for a,b in ep)
        print(f"{name:9s} {c:16s} n={n} ({dt:.1f}s) det={dict(sorted(det.items()))}\n    epochs: {eps}")
