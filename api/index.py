"""Vercel serverless entry point.

Vercel's Python runtime detects an ASGI app exported as ``app`` and routes
matching requests to it. We re-export the FastAPI instance defined in the
``orbit_explorer`` package — all routes are declared under the ``/api/``
prefix so a single rewrite rule in ``vercel.json`` covers them.
"""

from orbit_explorer.api import app  # noqa: F401  (Vercel discovers `app` by name)
