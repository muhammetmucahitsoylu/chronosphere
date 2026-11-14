import collections, pyvo, requests
from astropy.time import Time
svc = pyvo.dal.SIA2Service("https://irsa.ipac.caltech.edu/SIA")
targets = {"Barnard": (269.4521, 4.6934),"EpsIndiB": (330.8724, -56.7973),"WISE0855": (133.7951, -7.2451),"RWAur": (76.9563, 30.4011),"RDra": (248.1880, 66.7530)}
for name,(ra,dec) in targets.items():
    r = svc.search(pos=(ra,dec,0.02), facility="SPHEREx")
    tb=r.to_table()
    print(name, "total", len(tb))
    if len(tb)==0: continue
    g=collections.defaultdict(list)
    for row in tb: g[(str(row["obs_collection"]),str(row["dataproduct_subtype"]),str(row["calib_level"]))].append(float(row["t_min"]))
    for k,tm in sorted(g.items()):
        tm=sorted(tm); ep=[[tm[0],tm[0]]]
        for t in tm[1:]:
            if t-ep[-1][1]>30: ep.append([t,t])
            else: ep[-1][1]=t
        print("   ",k,len(tm)," | ".join(f"{Time(a,format='mjd').iso[:10]}..{Time(b,format='mjd').iso[:10]}" for a,b in ep))
# TAP: list collections
try:
    tap=pyvo.dal.TAPService("https://irsa.ipac.caltech.edu/TAP")
    t=tap.search("SELECT obs_collection, COUNT(*) AS n, MIN(t_min) AS t0, MAX(t_min) AS t1 FROM caom.observation WHERE facility_name='SPHEREx' GROUP BY obs_collection").to_table()
    print(t)
except Exception as e:
    print("TAP ERR", str(e)[:300])
