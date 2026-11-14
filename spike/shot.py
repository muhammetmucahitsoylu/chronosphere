"""usage: shot.py URL WIDTH HEIGHT step...   steps: wait:SEC | click:SEL | wheel:X,Y,DELTA,N | mclick:X,Y | shot:FILE | clip:FILE (stage only) | eval:JS"""
import sys, time
from playwright.sync_api import sync_playwright
url=sys.argv[1]; w=int(sys.argv[2]); h=int(sys.argv[3])
with sync_playwright() as p:
    b=p.chromium.launch(channel="msedge", headless=True)
    pg=b.new_page(viewport={"width":w,"height":h}, device_scale_factor=1)
    logs=[]
    pg.on("console", lambda m: logs.append(f"{m.type}: {m.text} @ {m.location.get('url','')}") if m.type in ("error","warning") else None)
    pg.on("pageerror", lambda e: logs.append(f"PAGEERROR: {e}"))
    pg.goto(url)
    for st in sys.argv[4:]:
        k,_,v=st.partition(":")
        if k=="wait": time.sleep(float(v))
        elif k=="click": pg.click(v); time.sleep(0.8)
        elif k=="wheel":
            x,y,d,n=v.split(","); pg.mouse.move(float(x),float(y))
            for _ in range(int(n)): pg.mouse.wheel(0,float(d)); time.sleep(0.05)
            time.sleep(0.5)
        elif k=="mclick":
            x,y=v.split(","); pg.mouse.click(float(x),float(y)); time.sleep(1.0)
        elif k=="shot": pg.screenshot(path=v, full_page=True)
        elif k=="clip": pg.locator(".stage").screenshot(path=v)
        elif k=="eval": print("eval:", pg.evaluate(v))
    print("\n".join(logs[:12]) or "no console errors")
    print("scrollW", pg.evaluate("document.documentElement.scrollWidth"))
    b.close()
