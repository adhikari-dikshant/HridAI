"""Writes docs/openapi.json for the app team. Run: python -m scripts.export_openapi"""

import json
from pathlib import Path

from app.core.config import Settings
from app.main import create_app

TARGET = Path(__file__).parents[1] / "docs" / "openapi.json"


def main() -> None:
    schema = create_app(Settings(_env_file=None)).openapi()
    TARGET.write_text(json.dumps(schema, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {TARGET}")


if __name__ == "__main__":
    main()
