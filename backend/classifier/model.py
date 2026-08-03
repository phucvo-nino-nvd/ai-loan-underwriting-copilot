from catboost import CatBoostClassifier
from tqdm import tqdm

import lightgbm as lgb
import numpy as np
import sys
import xgboost as xgb

from .config import N_FOLDS, MODELS_DIR

class EnsembleModels:
    def __init__(self):
        self.cat_models = []
        self.lgb_models = []
        self.xgb_models = []
        self.load_models()

    def load_models(self):
        for fold in range(N_FOLDS):
            # 1. Load CatBoost (.cbm)
            cat_model = CatBoostClassifier()
            cat_model.load_model(str(MODELS_DIR + f"cat_fold_{fold}.cbm"))
            self.cat_models.append(cat_model)
            
            # 2. Load LightGBM (.txt)
            lgb_model = lgb.Booster(model_file=str(MODELS_DIR + f"lgbm_fold_{fold}.txt"))
            self.lgb_models.append(lgb_model)
            
            # 3. Load XGBoost (.json)
            xgb_model = xgb.Booster()
            xgb_model.load_model(str(MODELS_DIR + f"xgb_fold_{fold}.json"))
            self.xgb_models.append(xgb_model)

    def predict(self, X_test):
        def predict_cv(models, X_test, model_name):
            X_ptr = X_test.copy()
            if model_name == 'cat':
                cat_features = X_ptr.select_dtypes(include=['category']).columns.tolist()
                for col in cat_features:
                    X_ptr[col] = X_ptr[col].fillna("Unknown")
                    
            preds = np.zeros(len(X_ptr))
            for model in tqdm(models, desc=f"Predicting {model_name.upper()}", file=sys.stdout):
                if model_name == "lgb":
                    preds += model.predict(X_ptr, num_iteration=model.best_iteration)
                elif model_name == "xgb":
                    preds += model.predict(xgb.DMatrix(X_ptr, enable_categorical=True), iteration_range=(0, model.best_iteration))
                elif model_name == 'cat':
                    preds += model.predict(X_ptr, prediction_type='Probability')[:, 1]
            return preds / len(models)
        
        cat_preds = predict_cv(self.cat_models, X_test, 'cat')
        lgb_preds = predict_cv(self.lgb_models, X_test, 'lgb')
        xgb_preds = predict_cv(self.xgb_models, X_test, 'xgb')

        final_preds = (0.35 * lgb_preds) + (0.15 * xgb_preds) + (0.50 * cat_preds)
        return final_preds
