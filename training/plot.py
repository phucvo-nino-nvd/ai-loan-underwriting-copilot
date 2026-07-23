from sklearn.metrics import roc_auc_score, roc_curve, auc
from matplotlib.patches import Rectangle

import matplotlib.pyplot as plt
import seaborn as sns
import numpy as np
import pandas as pd

OUTPUT_DIR = 'assets/'

plt.rcParams.update({
    'font.family': 'serif',
    'font.serif': ['Times New Roman', 'DejaVu Serif'],
    'font.size': 12,
    'axes.labelsize': 14,
    'axes.titlesize': 14,
    'xtick.labelsize': 12,
    'ytick.labelsize': 12,
    'legend.fontsize': 11,
    'legend.frameon': False,  
    # 'figure.dpi': 300,        
    'axes.linewidth': 1.2,    
    'lines.linewidth': 2.0,   
})

COLORS = ['#003f5c', '#bc5090', '#ffa600']

logs_data = []
for log_file in ['lgbm_fold.txt', 'cat_fold.txt', 'xgb_fold.txt']:
    log_path = f"output/logs/{log_file}"
    df = pd.read_csv(log_path)
    logs_data.append(df)
metrics_df = pd.concat(logs_data, ignore_index=True)

# ------------------------- VISUALIZATION 1: AUC & GINI COMPARISON -------------------------
fig, axes = plt.subplots(2, 2, figsize=(12, 8))
sns.set_palette(COLORS)

# 1. AUC by Model (Box plot)
ax = axes[0, 0]
sns.boxplot(data=metrics_df, x='model_name', y='auc', ax=ax, width=0.5, linewidth=1.5)
ax.set_title('AUC Distribution Across Folds', fontweight='bold')
ax.set_ylabel('AUC Score')
ax.set_xlabel('Model')
ax.grid(axis='y', linestyle='--', alpha=0.6)

# Add mean values on top
for i, model in enumerate(metrics_df['model_name'].unique()):
    mean_auc = metrics_df[metrics_df['model_name'] == model]['auc'].mean()
    ax.text(i, mean_auc + 0.0005, f'{mean_auc:.3f}', ha='center', va='bottom', fontsize=11, fontweight='bold')

# 2. Gini by Model (Box plot)
ax = axes[0, 1]
sns.boxplot(data=metrics_df, x='model_name', y='gini', ax=ax, width=0.5, linewidth=1.5)
ax.set_title('Gini Distribution Across Folds', fontweight='bold')
ax.set_ylabel('Gini Score')
ax.set_xlabel('Model')
ax.grid(axis='y', linestyle='--', alpha=0.6)

for i, model in enumerate(metrics_df['model_name'].unique()):
    mean_gini = metrics_df[metrics_df['model_name'] == model]['gini'].mean()
    ax.text(i, mean_gini + 0.0009, f'{mean_gini:.3f}', ha='center', va='bottom', fontsize=11, fontweight='bold')

# 3. AUC Across Folds (Line plot)
ax = axes[1, 0]
markers = ['o', 's', '^']
for idx, model_name in enumerate(metrics_df['model_name'].unique()):
    model_data = metrics_df[metrics_df['model_name'] == model_name].sort_values('fold')
    ax.plot(model_data['fold'], model_data['auc'], marker=markers[idx], label=model_name, markersize=8)
ax.set_title('AUC Across Folds', fontweight='bold')
ax.set_xlabel('Fold Number')
ax.set_ylabel('AUC Score')
ax.set_xticks(range(1, 6))
ax.legend()
ax.grid(True, linestyle='--', alpha=0.6)

# 4. Model Comparison (Average scores)
ax = axes[1, 1]
avg_metrics = metrics_df.groupby('model_name')[['auc', 'gini']].mean()
x = np.arange(len(avg_metrics))
width = 0.35
ax.bar(x - width/2, avg_metrics['auc'], width, label='AUC', color='#4a4e69', edgecolor='black', linewidth=1)
ax.bar(x + width/2, avg_metrics['gini'], width, label='Gini', color='#9a8c98', edgecolor='black', linewidth=1)
ax.set_xlabel('Model')
ax.set_ylabel('Score')
ax.set_title('Average Scores by Model', fontweight='bold')
ax.set_xticks(x)
ax.set_xticklabels(avg_metrics.index)
ax.legend()
ax.grid(axis='y', linestyle='--', alpha=0.6)

sns.despine(fig)
plt.tight_layout()
plt.savefig(OUTPUT_DIR + 'metrics_comparison.pdf', format='pdf', bbox_inches='tight')
plt.show()


# ------------------------- VISUALIZATION 2: ROC CURVES -------------------------
base_valid = pd.read_parquet('output/curated/base_valid.parquet')

fig, ax = plt.subplots(figsize=(10, 8))
models_info = [
    ('score_lgb_val', 'LightGBM', COLORS[0], '-'),
    ('score_xgb_val', 'XGBoost',  COLORS[1], '--'),
    ('score_cat_val', 'CatBoost', COLORS[2], '-.')
]

axins = ax.inset_axes([0.4, 0.3, 0.4, 0.4])

for score_col, model_name, color, ls in models_info:
    fpr, tpr, _ = roc_curve(base_valid['target'], base_valid[score_col])
    roc_auc = auc(fpr, tpr)
    
    ax.plot(fpr, tpr, color=color, lw=2.5, label=f'{model_name} (AUC = {roc_auc:.3f})')
    axins.plot(fpr, tpr, color=color, lw=2.5, linestyle=ls)
    
ax.plot([0, 1], [0, 1], color='black', lw=1.5, linestyle=':', alpha=0.7)

ax.set_xlim([0.0, 1.0])
ax.set_ylim([0.0, 1.05])
ax.set_xlabel('False Positive Rate')
ax.set_ylabel('True Positive Rate')
ax.set_title('Receiver Operating Characteristic (Validation)', fontweight='bold')
ax.legend(loc='lower right')
ax.grid(True, linestyle='--', alpha=0.5)

x1, x2, y1, y2 = 0.03, 0.25, 0.45, 0.78 
axins.set_xlim(x1, x2)
axins.set_ylim(y1, y2)
axins.grid(True, linestyle='--', alpha=0.4)
axins.tick_params(labelsize=10)

ax.indicate_inset_zoom(axins, edgecolor="gray", alpha=0.5)

rect = Rectangle((x1, y1), x2-x1, y2-y1, linewidth=0, edgecolor='none', facecolor='green', alpha=0.2)
ax.add_patch(rect)

sns.despine()
plt.tight_layout()
plt.savefig(OUTPUT_DIR + 'roc_curves.pdf', format='pdf', bbox_inches='tight')
plt.show()


# ------------------------- VISUALIZATION 3: GINI STABILITY OVER TIME -------------------------
fig, axes = plt.subplots(1, 3, figsize=(15, 4.5), sharey=True)

for idx, (score_col, model_name, color, _) in enumerate(models_info):
    gini_by_time = base_valid.groupby('WEEK_NUM')[['target', score_col]].apply(
        lambda x: 2*roc_auc_score(x['target'], x[score_col])-1 if len(np.unique(x['target'])) > 1 else 0
    ).reset_index()
    gini_by_time.columns = ['WEEK_NUM', 'Gini']
    
    ax = axes[idx]
    ax.plot(gini_by_time['WEEK_NUM'], gini_by_time['Gini'], marker='o', 
            color=color, linewidth=2, markersize=7, label='Actual Gini', markeredgecolor='white', markeredgewidth=1.5)
    
    # Add trend line
    z = np.polyfit(gini_by_time['WEEK_NUM'], gini_by_time['Gini'], 1)
    p = np.poly1d(z)
    ax.plot(gini_by_time['WEEK_NUM'], p(gini_by_time['WEEK_NUM']), 
            linestyle=":", color='black', alpha=0.7, linewidth=2, label='Trend')
    
    ax.set_xlabel('Week Number')
    if idx == 0:
        ax.set_ylabel('Gini Score')
    ax.set_title(model_name, fontweight='bold')
    ax.grid(True, linestyle='--', alpha=0.5)
    ax.legend(loc='best')

sns.despine(fig)
plt.tight_layout()
plt.savefig(OUTPUT_DIR + 'gini_stability_overtime.pdf', format='pdf', bbox_inches='tight')
plt.show()