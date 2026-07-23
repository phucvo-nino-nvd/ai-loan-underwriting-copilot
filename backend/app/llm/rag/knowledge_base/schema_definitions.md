# Home Credit Default Risk Schema and Feature Definitions

Please be aware that the same naming conventions apply to the test files. It's worth noting that some external data providers might not be available for future (test) evaluations, which is anticipated. Each group of tables can comprise one or more individual tables. If a group contains more than one table, they are divided based on WEEK_NUM. This division was implemented to restrict the maximum size of the tables. Depth values:

*   **depth=0** - These are static features directly tied to a specific case_id.
*   **depth=1** - Each case_id has an associated historical record, indexed by num_group1.
*   **depth=2** - Each case_id has an associated historical record, indexed by both num_group1 and num_group2.

You can read more about Credit bureau (CB) here https://en.wikipedia.org/wiki/Credit_bureau.

## Special Columns

*   **case_id** - This is the unique identifier for each credit case. You'll need this ID to join relevant tables to the base table.
*   **date_decision** - This refers to the date when a decision was made regarding the approval of the loan.
*   **WEEK_NUM** - This is the week number used for aggregation. In the test sample, WEEK_NUM continues sequentially from the last training value of WEEK_NUM.
*   **MONTH** - This column represents the month and is intended for aggregation purposes.
*   **target** - This is the target value, determined after a certain period based on whether or not the client defaulted on the specific credit case (loan).
*   **num_group1** - This is an indexing column used for the historical records of case_id in both depth=1 and depth=2 tables.
*   **num_group2** - This is the second indexing column for depth=2 tables' historical records of case_id. The order of num_group1 and num_group2 is important and will be clarified in feature definitions.

All other raw columns in the tables serve as predictors. Their definitions can be found in the file feature_definitions.csv. For depth=0 tables, predictors can be directly used as features. However, for tables with depth>0, you may need to employ aggregation functions that will condense the historical records associated with each case_id into a single feature. In case num_group1 or num_group2 stands for person index (this is clear with predictor definitions) the zero index has special meaning. When num_groupN=0 it is the applicant (the person who applied for a loan).

## Transformations and Predictor Suffixes

Various predictors were transformed, therefore we have the following notation for similar groups of transformations:

*   **P** - Transform DPD (Days past due)
*   **M** - Masking categories
*   **A** - Transform amount
*   **D** - Transform date
*   **T** - Unspecified Transform
*   **L** - Unspecified Transform

Please note that transformations within a group are denoted by a capital letter at the end of the predictor name (e.g., maxdbddpdtollast6m_4187119P). We hope that this will simplify the manipulation with predictors.

**Edits:**
*   **pmts_month_158T** is for active contract
*   **pmts_month_706T** is for closed contract
*   **dateofcredstart_181D** - Start date of a credit contract.

---

## Engineered Columns (Created during Training)

To help the model learn complex relationships and reduce historical records to a single feature per case_id, the following columns were engineered during training:

### 1. Ratio Features
These features express the relationship (ratios) between key amounts and financial indicators:
*   **ratio_cash_to_credit_limit**: Cash drawings activity compared to the credit limit (credacc_transactions_402L / credacc_credlmt_575A).
*   **ratio_payment_to_balance**: Payment size compared to outstanding balance (avgpmtlast12m_4525200A / currdebt_22A).
*   **ratio_dti**: Debt-To-Income ratio — annuity instalment compared to main income (annuity_780A / maininc_215A).
*   **ratio_principal_repaid**: Principal repaid — total settled amount compared to original credit amount (totalsettled_863A / credamount_770A).
*   **ratio_debt_to_credit**: Current debt utilisation compared to original credit amount (currdebt_22A / credamount_770A).
*   **ratio_dpd_per_instalment**: Delinquency severity — max days past due per instalment count (maxdpdlast12m_727P / numinstls_657L).
*   **ratio_early_payment_rate**: Financial discipline — ratio of instalments paid early to total instalments (numinstpaidearly_338L / numinstls_657L).
*   **ratio_on_time_payment_rate**: On-time payment rate — ratio of instalments paid on time to total instalments (numinstlsallpaid_934L / numinstls_657L).
*   **ratio_balance_to_credit_limit**: Credit card utilisation — actual balance compared to credit limit (credacc_actualbalance_314A / credacc_credlmt_575A).
*   **ratio_remaining_debt**: Remaining debt ratio calculated as (loan amount - current debt) / loan amount.

### 2. Date/Time Features
*   **days_since_{date_col}**: For every date column (suffix `D`), the date was converted to the number of days passed relative to `date_decision`. E.g., `days_since_dateofcredstart_181D`. 

### 3. Aggregation Suffixes (For Depth > 0)
When historical tables (depth 1 or 2) are rolled up to the case_id, the predictors receive the following suffixes indicating the aggregation method applied:
*   **_mean**: The average value of the historical records.
*   **_max**: The maximum value across historical records.
*   **_min**: The minimum value across historical records.
*   **_std**: The standard deviation of the historical values.
*   **_sum**: The total sum of the historical values.
*   **_count**: The number of historical records available for that case_id.
*   **_last3_mean**: The average value of the last 3 historical records.
*   **_trend_slope**: The mean of the consecutive differences (diff().mean()), indicating the upward or downward trend over time.
*   **_ever**: Used for binary flags. Represents if the flag was *ever* true (max value).
*   **_last**: The most recent (last) recorded value in a sequence.
*   **_mode**: The most frequent or first non-null category/value (used for 'T' suffix categorical transforms).
*   **_nunique**: The number of unique categories/values in the history.