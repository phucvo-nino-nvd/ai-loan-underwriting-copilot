from math import isfinite

import numpy as np
import shap

from .model import EnsembleModels

class Explainer:
    def __init__(self, model: EnsembleModels):
        self.model = model

        self.cat_explainers = [shap.TreeExplainer(model) for model in self.model.cat_models]
        self.lgb_explainers = [shap.TreeExplainer(model) for model in self.model.lgb_models]
        self.xgb_explainers = [shap.TreeExplainer(model) for model in self.model.xgb_models]

    def explain(self, X):
        def explain_cv(self, explainers, X):
            shap_values_list = []
            for i, explainer in enumerate(explainers):
                shap_values = explainer.shap_values(X)
                shap_values_list.append(shap_values)

            mean_shap_values = np.mean(shap_values_list, axis=0)
            return mean_shap_values
        
        cat_shap = explain_cv(self, self.cat_explainers, X)
        lgb_shap = explain_cv(self, self.lgb_explainers, X)
        xgb_shap = explain_cv(self, self.xgb_explainers, X)

        ensemble_shap = 0.5 * cat_shap + 0.35 * lgb_shap + 0.15 * xgb_shap

        return ensemble_shap
    
    def top_features(self, X, top_k=10):
        shap_values = self.explain(X)
        sample_shap = shap_values[0]

        importance = np.abs(sample_shap)
        top_indices = np.argsort(importance)[::-1][:top_k]

        results = []

        for idx in top_indices:
            value = X.iloc[0, idx]
            value = value.item() if hasattr(value, "item") else value
            results.append({
                "feature": X.columns[idx],
                "value": None if isinstance(value, float) and not isfinite(value) else value,
                "shap_value": float(sample_shap[idx]),
                "importance": float(importance[idx])
            })

        return results