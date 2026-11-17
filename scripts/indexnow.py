"""Tell the search engines that take part in IndexNow (Bing, Yandex, Seznam, Naver and others) which pages
of the site exist or have changed: every address in web/sitemap.xml, or only the ones given.

    python scripts/indexnow.py                      # every page in the sitemap
    python scripts/indexnow.py tr/about.html ...    # only these

The key is the name of the one 32-character .txt file in web/; the engines fetch it from the site to check
that the notice comes from the site's owner. Run this after the pages have been published, not before."""
import json, re, sys, urllib.request
from pathlib import Path

WEB = Path(__file__).resolve().parent.parent / "web"
SITE = "https://chronospherex.com/"
keys = [p.stem for p in WEB.glob("*.txt") if re.fullmatch(r"[0-9a-f]{32}", p.stem) and p.read_text().strip() == p.stem]
if len(keys) != 1:
    sys.exit(f"expected one key file in web/, found {len(keys)}")
key = keys[0]
urls = [SITE + a.lstrip("/") for a in sys.argv[1:]] or re.findall(r"<loc>([^<]+)</loc>", (WEB / "sitemap.xml").read_text(encoding="utf-8"))
body = json.dumps({"host": "chronospherex.com", "key": key, "keyLocation": f"{SITE}{key}.txt", "urlList": urls}).encode()
req = urllib.request.Request("https://api.indexnow.org/indexnow", data=body, headers={"Content-Type": "application/json; charset=utf-8"})
try:
    with urllib.request.urlopen(req, timeout=30) as r:
        print(f"{r.status}: {len(urls)} addresses accepted")      # 200 or 202
except urllib.error.HTTPError as e:
    sys.exit(f"{e.code}: {e.read().decode(errors='replace')[:300]}")
