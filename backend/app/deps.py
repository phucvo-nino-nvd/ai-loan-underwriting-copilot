"""Shared, lazily-loaded state: models, explainer, curated test features, session memory."""
from functools import lru_cache
from fastapi_clerk_auth import ClerkConfig, ClerkHTTPBearer
from pathlib import Path
import json
import os

import pandas as pd

from .ml.config import CURATED_TEST, META_COLS
from .ml.model import EnsembleModels
from .ml.explain import Explainer
from .ml.features import convert_strings

MEMORY_DIR = Path(__file__).resolve().parents[1] / "memory"
MEMORY_DIR.mkdir(exist_ok=True)

clerk_guard = ClerkHTTPBearer(ClerkConfig(jwks_url=os.getenv("CLERK_JWKS_URL")))


@lru_cache(maxsize=1)
def get_models() -> EnsembleModels:
    return EnsembleModels()


@lru_cache(maxsize=1)
def get_explainer() -> Explainer:
    return Explainer(get_models())


@lru_cache(maxsize=1)
def get_features() -> pd.DataFrame:
    """Curated test features, indexed by case_id, meta columns dropped."""
    df = pd.read_parquet(CURATED_TEST).set_index("case_id")
    df = df.drop(columns=[c for c in META_COLS if c in df.columns])
    # parquet round-trip drops the category dtype the models were trained with
    return convert_strings(df)


def get_case(case_id: int) -> pd.DataFrame:
    """Single-row frame for one application. Raises KeyError if unknown."""
    return get_features().loc[[case_id]]


def _path(user_id: str, session_id: str) -> Path:
    # namespaced by Clerk user so one user can't read another's session by guessing the uuid
    if "/" in session_id or "/" in user_id or ".." in session_id + user_id:
        raise ValueError("bad session id")
    return MEMORY_DIR / f"{user_id}__{session_id}.json"


def load_conversation(user_id: str, session_id: str) -> list[dict]:
    path = _path(user_id, session_id)
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else []


def save_conversation(user_id: str, session_id: str, messages: list[dict]) -> None:
    _path(user_id, session_id).write_text(
        json.dumps(messages, indent=2, ensure_ascii=False), encoding="utf-8"
    )
