# Orbit Explorer

Interactive visualizer for the cycle structure of polynomials with rational
coefficients on the real line.

For a polynomial f ∈ ℚ[x], the app finds every primitive periodic orbit up to a
configurable period, the real pre-periodic points leading into each cycle, and
reports what Sharkovsky's theorem says about additional cycles. Exact roots are
shown as rationals or radicals when small; deeper algebraic reals are named
A, B, C, … with an expandable legend (minimal polynomial + isolating interval +
high-precision decimal).

## v1 scope

- Polynomials with rational coefficients only. Rational functions (with poles
  and behavior at infinity) are deferred to v2.
- Two views per cycle: a circular cycle graph and a real-line strip with
  cycle points plus pre-periodic preimages.
- Exact-first: SymPy factors `f^n(x) - x` over ℚ for each n up to the cap and
  reports definitive non-existence within the search range.

## Project layout

Single repo, Vercel-monorepo shape:

```
.
├── orbit_explorer/        # Python package (math + FastAPI app)
│   ├── parse.py           # polynomial input → SymPy Poly over Q
│   ├── cycles.py          # primitive-period factoring + cycle grouping
│   ├── preperiodic.py     # backward preimage trees
│   ├── sharkovsky.py      # Sharkovsky ordering + existence/non-existence
│   ├── algebraic.py       # Point ADT (Rational | Radical | Algebraic)
│   ├── naming.py          # letter naming for algebraic points
│   ├── analysis.py        # top-level pipeline
│   └── api.py             # FastAPI app; routes under /api/
├── api/
│   └── index.py           # Vercel serverless entry — re-exports `app`
├── tests/                 # pytest suite for the math layer
├── src/                   # React + TypeScript app
├── public/
├── index.html
├── package.json           # Vite app (root)
├── pyproject.toml         # local dev install (editable)
├── requirements.txt       # runtime deps for Vercel Python
├── vercel.json            # rewrites /api/* to api/index.py
└── README.md
```

## Local development

Two processes side by side. Backend exposes the same `/api/*` routes locally
that Vercel exposes in production, so the frontend's `fetch("/api/analyze")`
works in both environments.

```sh
# one-time setup
python3 -m venv .venv
.venv/bin/pip install -e '.[dev]'
npm install

# terminal 1 — FastAPI on :8000
.venv/bin/uvicorn orbit_explorer.api:app --port 8000

# terminal 2 — Vite on :5173 (proxies /api/* to :8000)
npm run dev
```

Then open <http://localhost:5173>.

Try:

- `x^2 - 29/16` — rational 3-cycle 5/4 → -1/4 → -7/4 plus an algebraic
  3-cycle, and one cycle of every period 1..6 (by Sharkovsky).
- `x^2 - 7/4` — has a 5-cycle but no 3-cycle (proven absent within the sweep).
- `x^2` — two fixed points, nothing else.

## Tests

```sh
.venv/bin/pytest
```

## Deploy (Vercel)

The repo is pre-configured for Vercel's monorepo Python + Vite stack.

1. Push to GitHub (see commit history below).
2. In Vercel: **Add New… → Project → Import** the GitHub repo.
3. Accept the defaults — Vercel auto-detects Vite at the root and the Python
   serverless function at `api/index.py` (deps from `requirements.txt`).
4. First deploy takes ~1–2 minutes. Subsequent pushes to `main` auto-deploy.

**Known limitation**: Vercel Hobby caps a single request at 10 seconds.
A full N=6 sweep on a non-trivial quadratic takes ~9s, so high-N analyses
on slow polynomials may time out. Drop `max period` to 5 in the UI if you
hit this, or upgrade to Vercel Pro (60s cap).

## Memory of decisions

- Stack chosen: Python + FastAPI + SymPy backend, React + TypeScript + KaTeX
  frontend; exact-first symbolic math.
- v1: polynomials only on ℝ. Rational functions (and infinity-handling on
  the projective line) deferred to v2.
