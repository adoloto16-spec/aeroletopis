"""Build the static site locally using only the Python standard library."""

from pathlib import Path
from shutil import copy2, copytree


def build():
    root = Path(__file__).resolve().parent
    output = root / "dist"
    output.mkdir(exist_ok=True)
    copy2(root / "index.html", output / "index.html")
    for folder in ("js", "assets"):
        copytree(root / "site" / folder, output / "site" / folder, dirs_exist_ok=True)
    (output / ".nojekyll").touch()
    print(f"Static build ready: {output}")


if __name__ == "__main__":
    build()
