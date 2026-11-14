"""The old ``harvey`` command: says it moved, then runs ``outreach``."""

import sys
from pathlib import Path

from harvey import NOTICE


def _find_outreach():
    """An editable install made before the rename only maps the ``harvey``
    package, so after a plain ``git pull`` Python can't see ``outreach``
    until ``pip install -e .`` runs again. It sits next to this package in
    the same checkout, so point Python at the checkout."""
    try:
        import outreach  # noqa: F401
    except ModuleNotFoundError:
        checkout = Path(__file__).resolve().parent.parent
        if (checkout / "outreach" / "__init__.py").is_file():
            sys.path.insert(0, str(checkout))


def main():
    print(NOTICE, file=sys.stderr)
    _find_outreach()
    from outreach.cli import main as outreach_main
    sys.argv[0] = "outreach"
    return outreach_main()
