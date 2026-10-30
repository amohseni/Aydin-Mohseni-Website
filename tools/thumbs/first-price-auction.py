# Thumbnail for the first-price auction model: the app's "Probability of Bid Accepted" plot
# (app.R, buyProbabilityPlot) at the app's default inputs, redrawn in Python because no
# screenshot survived the move off WordPress. Run: python3 tools/thumbs/first-price-auction.py
from math import erf, sqrt
import matplotlib; matplotlib.use("Agg")
import matplotlib.pyplot as plt
Phi = lambda z: 0.5 * (1 + erf(z / sqrt(2)))
v, mu, hw80, n_max = 1_100_000, 1_050_000, 50_000, 5   # app defaults
sig = hw80 / 1.28155
xs = [mu - 100_000 + 200_000 * i / 500 for i in range(501)]
blues = ["#08519c", "#3182bd", "#6baed6", "#bdd7e7", "#eff3ff"]  # Brewer Blues(5), reversed
def opt(n):
    bids = [v * i / 2000 for i in range(2001)]
    return max(bids, key=lambda b: (v - b) * Phi((b - mu) / sig) ** n)
fig, ax = plt.subplots(figsize=(9.6, 6.86), dpi=100)
for n in range(1, n_max + 1):
    ax.plot(xs, [100 * Phi((x - mu) / sig) ** n for x in xs], color=blues[n - 1], lw=2.2, label=str(n))
ob = [opt(n) for n in range(1, n_max + 1)]
op = [100 * Phi((b - mu) / sig) ** n for n, b in zip(range(1, n_max + 1), ob)]
ax.plot(ob, op, color="#0B6623", lw=2.2, label="Optimal Bid"); ax.scatter(ob, op, color="#0B6623", s=40, zorder=3)
ax.axvline(v, color="#B80F0A", lw=2.2); ax.text(v, 10, "Valuation", rotation=90, color="#B80F0A", ha="right", va="bottom", fontsize=13)
ax.set_ylim(0, 100); ax.set_yticks(range(0, 101, 10))
ax.xaxis.set_major_formatter(matplotlib.ticker.FuncFormatter(lambda x, _: f"{x:,.0f}"))
ax.set_xlabel("Your Bid ($)", fontsize=13); ax.set_ylabel("Probability of Acceptance (%)", fontsize=13)
ax.set_title("Probability of Bid Accepted", loc="left", fontsize=15)
ax.grid(color="#e5e5e5"); [s.set_visible(False) for s in ax.spines.values()]; ax.tick_params(length=0, labelsize=11)
ax.legend(title="Number of Competitors", frameon=False, loc="center left", bbox_to_anchor=(1, 0.5), fontsize=11)
fig.tight_layout(); fig.savefig("src/assets/img/models/first-price-auction.png", facecolor="white")
