TIME_BUCKET_PREFIXES = (
    "days30_", "days90_", "days120_", "days180_", "days360_",
    "for3years_", "forquarter_", "foryear_", "formonth_", "forweek_", "fortoday_",
    "firstquarter_", "secondquarter_", "thirdquarter_", "fourthquarter_",
)

BINARY_FLAG_SUBSTRINGS = (
    "isbidproduct", "isdebitcard", "isreference", "remitter",
    "safeguarantyflag", "opencred", "mastercontrexist", "mastercontrelectronic",
    "equalityempfrom", "equalitydataagreement", "contaddr_matchlist",
    "contaddr_smempladdr",
)

N_FOLDS = 5
RANDOM_STATE = 42

# Feature selection thresholds
CORRELATION_THRESHOLD = 0.95
NULL_THRESHOLD = 0.95

# Memory optimization
LOW_MEMORY_MODE = True
MAX_FEATURES_PER_TABLE = 50
CORRELATION_SAMPLE_SIZE = 10000

META_COLS = ['case_id', 'target', 'WEEK_NUM', 'MONTH', 'date_decision']

from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
MODELS_DIR = str(REPO_ROOT / "output" / "models") + "/"
CURATED_TEST = REPO_ROOT / "output" / "curated" / "test_data.parquet"
