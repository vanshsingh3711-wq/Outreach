"""Outreacho — Personal AI Prospecting & Autonomous Outreach Platform."""

from __future__ import annotations

import sys
import sellbird

# Transparently alias package path so all submodules (outreacho.cli, outreacho.enrichment, etc.) resolve
__path__ = sellbird.__path__
__version__ = "0.5.0"

for attr in getattr(sellbird, "__all__", ()):
    globals()[attr] = getattr(sellbird, attr)

