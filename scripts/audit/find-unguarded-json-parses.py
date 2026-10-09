#!/usr/bin/env python3
"""
Finds the defect shape behind U5 and U11 of the 2026-10-09 audit:

    .then((r) => r.json())        <- no r.ok check
    .then((d) => setX(d.foo ?? "")) <- and a ?? default

A failed response is parsed for a field it does not have, the ?? supplies a
plausible empty value, and the FAILURE RENDERS AS AN EMPTY STATE. An outage,
an expired session and "there is genuinely nothing here" become
indistinguishable — to the user and to us, since nothing is logged.

⚠️ THIS IS A HEURISTIC, NOT A BUG LIST. Run it, then READ each hit.
The first version reported 11 sites; four were Connect calls that guard with
`if (!mounted || !d.ok) return;` — perfectly safe, and the regex simply could
not see the `||` form. Checking a body-level `ok` flag is just as valid as
checking r.ok. Reporting unread hits as bugs is its own kind of wrong.

Usage:  python3 -I scripts/audit/find-unguarded-json-parses.py
"""
import re, os
roots = [("web","/Users/soumenroy/Projects/imotaraapp/src"),
         ("mobile","/Users/soumenroy/Projects/imotara-mobile/src")]
hits=[]
for label, root in roots:
    for dp,_,fns in os.walk(root):
        if "__tests__" in dp: continue
        for fn in fns:
            if not fn.endswith((".ts",".tsx")): continue
            p=os.path.join(dp,fn)
            try: s=open(p,encoding="utf-8").read()
            except: continue
            for m in re.finditer(r"\.then\(\s*\(?\s*\(?r\)?\s*\)?\s*=>\s*r\.json\(\)\s*\)", s):
                tail = s[m.end(): m.end()+500]
                line = s[:m.start()].count("\n")+1
                # ANY ok-check counts: r.ok before, or a body .ok anywhere in the handler
                guarded = ("r.ok" in s[max(0,m.start()-400):m.start()]) or re.search(r"\.ok\b", tail[:260])
                coalesces = re.search(r"\?\?\s*(\"\"|''|\[\]|\{\}|0\b)", tail)
                if not guarded and coalesces:
                    hits.append((label,p.split("/src/")[1],line,tail.strip().split("\n")[0][:76]))
print(f"{len(hits)} site(s) genuinely unguarded (no r.ok, no body .ok, and a ?? that hides it):\n")
for l,f,n,t in hits: print(f"  [{l}] {f}:{n}\n        {t}")
if not hits: print("  (none)")
