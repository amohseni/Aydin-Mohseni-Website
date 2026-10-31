# Builds the site icon: a capital A (90% black) and M (the site red) in CMU Serif, kerned together.
# Writes src/assets/img/favicon.svg and the PNG sizes. Run: python3 tools/favicon/make.py
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
import subprocess, sys
GAP = int(sys.argv[1]) if len(sys.argv) > 1 else -10   # font units between the A's and M's ink
f = TTFont("src/assets/fonts/cmu-serif-500-roman.woff2")
gs = f.getGlyphSet(); cmap = f.getBestCmap()
A, M = gs[cmap[ord("A")]], gs[cmap[ord("M")]]
dx = 717 + GAP - 37                    # ink right of A is 717; ink left of M is 37
x0, x1, top = 32, dx + 879, 716        # ink box of the pair
w = x1 - x0; pad = 0.015 * w; side = w + 2 * pad
oy = (side + top) / 2                  # baseline, centering the cap height
def d(g, ox):
    p = SVGPathPen(gs); g.draw(TransformPen(p, (1, 0, 0, -1, ox - x0 + pad, oy))); return p.getCommands()
svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {side:.0f} {side:.0f}">
<style>.a{{fill:#1a1a1a}}.m{{fill:#d11c3d}}@media (prefers-color-scheme:dark){{.a{{fill:#ececec}}.m{{fill:#e8384f}}}}</style>
<path class="a" d="{d(A, 0)}"/><path class="m" d="{d(M, dx)}"/></svg>
'''
open("src/assets/img/favicon.svg", "w").write(svg)
light = svg.replace("@media (prefers-color-scheme:dark){.a{fill:#ececec}.m{fill:#e8384f}}", "")
open("/tmp/fav-light.svg", "w").write(light)
