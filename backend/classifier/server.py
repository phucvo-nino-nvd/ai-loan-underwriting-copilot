from functools import lru_cache

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

import pandas as pd
import uvicorn

from .explain import Explainer
from .model import EnsembleModels

FeatureRow = dict[str, bool | float | int | str | None]

app = FastAPI(title="Aluci Classifier")


class InvocationRequest(BaseModel):
    instances: list[FeatureRow] | None = None
    data: list[FeatureRow] | FeatureRow | None = None
    top_k: int = 10


@lru_cache(maxsize=1)
def get_models():
    return EnsembleModels()


@lru_cache(maxsize=1)
def get_explainer():
    return Explainer(get_models())


@lru_cache(maxsize=1)
def get_schema() -> tuple[list[str], dict[str, pd.CategoricalDtype]]:
    """The notebook's cols_pred + training categories, recovered from the models.

    CatBoost keeps the feature order and which of them are categorical, LightGBM
    keeps each category-dtype column's categories in that same column order.
    """
    models = get_models()
    columns = list(models.cat_models[0].feature_names_)
    dtypes = {
        columns[index]: pd.CategoricalDtype(categories=values, ordered=True)
        for index, values in zip(
            sorted(models.cat_models[0].get_cat_feature_indices()),
            models.lgb_models[0].pandas_categorical,
            strict=True,
        )
    }
    return columns, dtypes


def frame_from_request(request):
    rows = request.instances or request.data
    if rows is None:
        raise HTTPException(status_code=400, detail="Provide instances or data")
    if isinstance(rows, dict):
        rows = [rows]

    columns, dtypes = get_schema()
    # Both models index features by position and JSONB does not preserve key
    # order, so select by `columns` exactly as the notebook selects `cols_pred`:
    # right order, missing features filled with null, extras dropped.
    df = pd.DataFrame(rows).reindex(columns=columns)
    for column in columns:
        dtype = dtypes.get(column)
        if dtype is None:
            df[column] = pd.to_numeric(df[column], errors="coerce")
        else:
            # Categories must be the training ones: LightGBM and XGBoost read
            # category codes, so a locally-inferred category set silently
            # shifts every code. Unseen values become null, then "Unknown".
            df[column] = df[column].astype("string").astype(dtype).fillna("Unknown")
    return df


@app.get("/ping")
def ping():
    get_models()
    return {"status": "healthy"}


@app.post("/invocations")
def invocations(request: InvocationRequest):
    X = frame_from_request(request)
    probabilities = [float(value) for value in get_models().predict(X)]
    return {
        "probabilities": probabilities,
        "top_features": get_explainer().top_features(X, top_k=request.top_k),
        "model": "cat-lgb-xgb-ensemble",
    }


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8080)
