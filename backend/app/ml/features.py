from __future__ import annotations

from dataclasses import dataclass
from .config import TIME_BUCKET_PREFIXES, BINARY_FLAG_SUBSTRINGS, LOW_MEMORY_MODE, MAX_FEATURES_PER_TABLE, CORRELATION_SAMPLE_SIZE, META_COLS

import json
import gc
import pandas as pd
import polars as pl


def set_table_dtypes(df: pl.DataFrame, schema=None) -> pl.DataFrame:
    if schema is not None:
        schema_to_apply = {col: dtype for col, dtype in schema.items() if col in df.columns}
        return df.cast(schema_to_apply, strict=False)
    
    for col in df.columns:
        # if col == "isdebitcard_527L":
        #     df = df.with_columns(pl.col(col).cast(pl.Boolean).alias(col))
        if col[-1] in ("P", "A"):
            df = df.with_columns(pl.col(col).cast(pl.Float32).alias(col))

    return df

def convert_strings(df: pd.DataFrame) -> pd.DataFrame:
    for col in df.columns:
        if df[col].dtype.name in ['object', 'string', 'str', 'bool']:
            df[col] = df[col].astype("string").astype('category')
            current_categories = df[col].cat.categories
            new_categories = current_categories.to_list() + ["Unknown"]
            new_dtype = pd.CategoricalDtype(categories=new_categories, ordered=True)
            df[col] = df[col].astype(new_dtype)
            df[col] = df[col].fillna("Unknown")

    return df

def process_dates(df: pl.DataFrame) -> pl.DataFrame:
    date_cols = [c for c in df.columns if c[-1] == "D"]

    
    df = df.with_columns([pl.col(c).str.to_date("%Y-%m-%d") for c in (date_cols + ["date_decision"])])
    
    exprs = []
    for col in date_cols:
        if col == "date_decision":
            continue
        exprs.append((pl.col("date_decision") - pl.col(col)).dt.total_days().fill_null(-1).alias(f"days_since_{col}"))

    df = df.with_columns(exprs).drop(date_cols)
    return df

def aggregate_helper(col: str = "case_id", ):
    suffix = col[-1]
    exprs = []

    if suffix == "A":
        exprs.extend([
            pl.col(col).mean().alias(f"{col}_mean"),
            pl.col(col).max().alias(f"{col}_max"),
            pl.col(col).min().alias(f"{col}_min"),
            pl.col(col).std().alias(f"{col}_std"),
            pl.col(col).sum().alias(f"{col}_sum"),
            pl.col(col).tail(3).mean().alias(f"{col}_last3_mean"),
            pl.col(col).count().alias(f"{col}_count"),
            pl.col(col).diff().mean().alias(f"{col}_trend_slope")
        ])
    
    elif suffix == "P":
        exprs.extend([
            pl.col(col).mean().alias(f"{col}_mean"),
            pl.col(col).max().alias(f"{col}_max"),
            pl.col(col).std().alias(f"{col}_std"),
            pl.col(col).tail(3).mean().alias(f"{col}_last3_mean"),
            pl.col(col).count().alias(f"{col}_count"),
            pl.col(col).diff().mean().alias(f"{col}_trend_slope")
        ])

    elif suffix == "L":
        if any(s in col for s in BINARY_FLAG_SUBSTRINGS):
            exprs += [pl.col(col).max().alias(f"{col}_ever")]
        elif any(col.startswith(p) for p in TIME_BUCKET_PREFIXES):
            exprs += [pl.col(col).last().alias(f"{col}_last")]
        else:
            exprs.extend([
                pl.col(col).mean().alias(f"{col}_mean"),
                pl.col(col).max().alias(f"{col}_max"),
                pl.col(col).std().alias(f"{col}_std"),
                pl.col(col).tail(3).mean().alias(f"{col}_last3_mean"),
                pl.col(col).count().alias(f"{col}_count"),
            ])

    elif suffix == "T":
        exprs.extend([
            pl.col(col).drop_nulls().first().alias(f"{col}_mode"),
            pl.col(col).n_unique().alias(f"{col}_nunique"),
        ])

    elif col.startswith("days_since_"):
        exprs.extend([
            pl.col(col).mean().alias(f"{col}_mean"),
            pl.col(col).max().alias(f"{col}_max"),
            pl.col(col).min().alias(f"{col}_min"),
            pl.col(col).tail(3).mean().alias(f"{col}_last3_mean"),
            pl.col(col).count().alias(f"{col}_count"),
            pl.col(col).diff().mean().alias(f"{col}_trend_slope")
        ])
        
    return exprs

def ratio_feature(df: pl.DataFrame):
    exprs = []
    cols = set(df.columns)
    exprs = []

    def find(col: str) -> str | None:
        if col in cols:
            return col
        if f"{col}_sum" in cols:
            return f"{col}_sum"
        return None

    def safe_ratio(num_col: str, den_col: str, alias: str):
        a = find(num_col)
        b = find(den_col)
        if a and b and df[a].dtype.is_numeric() and df[b].dtype.is_numeric():
            exprs.append((pl.col(a) / (pl.col(b) + 1e-6)).alias(alias))


    safe_ratio("credacc_transactions_402L", "credacc_credlmt_575A", "ratio_cash_to_credit_limit")       # Cash drawings activity to credit limit (applprev_1)
    safe_ratio("avgpmtlast12m_4525200A", "currdebt_22A", "ratio_payment_to_balance")                    # Payment to outstanding balance (static)
    safe_ratio("annuity_780A", "maininc_215A", "ratio_dti")                                             # DTI — annuity instalment vs main income (static)
    safe_ratio("totalsettled_863A", "credamount_770A", "ratio_principal_repaid")                        # Principal repaid: total settled vs credit amount (static)
    safe_ratio("currdebt_22A", "credamount_770A", "ratio_debt_to_credit")                               # Current debt utilisation vs credit amount (static)
    safe_ratio("maxdpdlast12m_727P", "numinstls_657L", "ratio_dpd_per_instalment")                      # DPD per instalment — delinquency severity (static)
    safe_ratio("numinstpaidearly_338L", "numinstls_657L", "ratio_early_payment_rate")                   # Early payment rate — financial discipline (static)
    safe_ratio("numinstlsallpaid_934L", "numinstls_657L", "ratio_on_time_payment_rate")                 # On-time payment rate (static)
    safe_ratio("credacc_actualbalance_314A", "credacc_credlmt_575A", "ratio_balance_to_credit_limit")   # Credit card utilisation: balance vs credit limit (applprev_1)
    a = find("credamount_590A")                                                                         # Remaining debt ratio: (loan - debt) / loan (applprev_1)
    b = find("currdebt_94A")
    if a and b:
        exprs.append(
            ((pl.col(a) - pl.col(b)) / (pl.col(a) + 1e-6)).alias("ratio_remaining_debt")
        )
        
    df = df.with_columns(exprs)
    return df

def aggregate(df: pl.DataFrame, group_col: str="case_id") -> pl.DataFrame:
    df = ratio_feature(df)
    feature_cols = [c for c in df.columns if (c[-1] in ["A", "P", "L", "T"] or c.startswith("days_since_") or c.startswith("trend_")) and c != group_col]

    exprs = []
    for col in feature_cols:
        exprs.extend(aggregate_helper(col))

    if not exprs:
        return df.select(group_col).unique()
    
    result = df.group_by(group_col).agg(exprs)
    
    return result

def feature_engineering(base_df: pl.DataFrame, table: dict, schema_dict: dict=None):
    result = base_df.select(["case_id", "date_decision"])
    
    if schema_dict is None:
        schema_dict = {}
        is_train = True
    else:
        is_train = False

    for name, df in table.items():
        if df is None:
            continue
        df_agg = aggregate(df)
        
        if LOW_MEMORY_MODE:
            if not is_train:
                schema = schema_dict.get(name)
                if schema:
                    cols_to_select = [c for c in schema.keys() if c in df_agg.columns]
                    df_agg = df_agg.select(cols_to_select)
                    df_agg = df_agg.cast(schema)
            else:
                if len(df_agg.columns) > MAX_FEATURES_PER_TABLE:
                    num_cols = [c for c, dtype in df_agg.schema.items() if dtype.is_numeric() and c != "case_id"]
                    vars = df_agg.select([pl.col(c).var().alias(c) for c in num_cols]).to_dicts()[0]
                    
                    top_cols = sorted(vars.keys(), key=lambda x: vars[x] or -1, reverse=True)[:MAX_FEATURES_PER_TABLE]
                    
                    final_cols = ["case_id"] + [c for c in df_agg.columns if c not in num_cols] + top_cols
                    df_agg = df_agg.select(list(dict.fromkeys(final_cols)))
                
                schema_dict[name] = df_agg.schema

        df_agg = df_agg.rename({c: f"{name}_{c}" for c in df_agg.columns if c != "case_id"})
        result = result.join(df_agg, on="case_id", how="left")
        
        table[name] = None
        del df_agg
        gc.collect()
        
    result = process_dates(result)
    
    return result.drop("date_decision"), schema_dict

def shrink_dtypes(df: pl.DataFrame) -> pl.DataFrame:
    """
    Shrink dtypes to reduce memory usage
    """

    expressions = []
    for col in df.columns:
        dtype = df[col].dtype
        if dtype == pl.Int64:
            if df[col].min() is not None and -2147483648 <= df[col].min() and df[col].max() <= 2147483647:
                expressions.append(pl.col(col).cast(pl.Int32))
        elif dtype == pl.Float64:
            expressions.append(pl.col(col).cast(pl.Float32))
    
    return df.with_columns(expressions)

def prepare(base_df: pl.DataFrame, table: dict, schema_dict: dict=None):
    df_features, schema_dict = feature_engineering(base_df, table, schema_dict)
    df_features = shrink_dtypes(df_features)
    df_features = df_features.to_pandas()
    df_features = convert_strings(df_features)

    return df_features, schema_dict