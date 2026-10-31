import json
from pathlib import Path

REPO = Path(__file__).parents[2]
NOTEBOOK = REPO / "ml" / "notebooks" / "train_cardiophon_head.ipynb"
SHARED_FILES = [
    "app/core/audio_config.py",
    "app/services/audio.py",
    "app/services/features.py",
]


def code_cells() -> list[str]:
    notebook = json.loads(NOTEBOOK.read_text(encoding="utf-8"))
    return ["".join(c["source"]) for c in notebook["cells"] if c["cell_type"] == "code"]


def test_notebook_embeds_current_preprocessing():
    embedded = "\n".join(code_cells())

    for relative_path in SHARED_FILES:
        source = (REPO / "backend" / relative_path).read_text(encoding="utf-8")
        assert repr(source) in embedded, f"Run ml/build_notebook.py: {relative_path} changed"


def test_notebook_cells_are_valid_python():
    for cell in code_cells():
        compile(cell, "notebook-cell", "exec")
