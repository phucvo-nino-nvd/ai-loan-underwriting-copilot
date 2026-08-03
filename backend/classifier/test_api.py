from pathlib import Path

import json
import os
import subprocess
import sys
import tempfile

PAYLOAD = r'{"instances":[{"actualdpdtolerance_344P":0.0,"amtinstpaidbefduel24m_4187115A":191767.359375,"annuity_780A":3674.6000976562,"annuitynextmonth_57A":1218.2000732422,"applicationcnt_361L":0.0,"applications30d_658L":0.0,"applicationscnt_1086L":0.0,"applicationscnt_464L":0.0,"applicationscnt_867L":9.0,"avgdbddpdlast24m_3658932P":1.0,"avgdbddpdlast3m_4187120P":2.0,"avginstallast24m_3658937A":16049.400390625,"avglnamtstart24m_4525187A":17054.400390625,"avgmaxdpdlast9m_3716943P":2.0,"avgoutstandbalancel6m_4187114A":14554.400390625,"avgpmtlast12m_4525200A":24482.0,"bankacctype_710L":"CA","cardtype_51L":null,"clientscnt12m_3712952L":0.0,"clientscnt_100L":0.0,"clientscnt_1071L":0.0,"clientscnt_1130L":0.0,"clientscnt_157L":0.0,"clientscnt_257L":0.0,"clientscnt_304L":0.0,"clientscnt_360L":0.0,"clientscnt_493L":0.0,"clientscnt_533L":0.0,"clientscnt_887L":0.0,"clientscnt_946L":0.0,"cntincpaycont9m_3716944L":5.0,"cntpmts24_3658933L":20.0,"commnoinclast6m_3546845L":0.0,"credamount_770A":20000.0,"credtype_322L":"CAL","currdebt_22A":12154.400390625,"currdebtcredtyperange_828A":0.0,"daysoverduetolerancedd_3976961L":8.0,"deferredmnthsnum_166L":null,"disbursedcredamount_1113A":20000.0,"disbursementtype_67L":"GBA","downpmt_116A":0.0,"eir_270L":0.3400000036,"equalitydataagreement_891L":null,"homephncnt_628L":0.0,"inittransactioncode_186L":"CASH","isbidproduct_1095L":true,"isdebitcard_729L":false,"lastapprcommoditycat_1041M":"a55475b1","lastapprcommoditytypec_5251766M":"a55475b1","lastapprcredamount_781A":14000.0,"lastcancelreason_561M":"a55475b1","lastrejectcommoditycat_161M":"P109_133_183","lastrejectcommodtypec_5251769M":"P49_111_165","lastrejectcredamount_222A":24000.0,"lastrejectreason_759M":"a55475b1","lastrejectreasonclient_4145040M":"a55475b1","lastst_736L":"K","maininc_215A":34000.0,"mastercontrelectronic_519L":0.0,"mastercontrexist_109L":0.0,"maxannuity_159A":280983.5625,"maxdebt4_972A":231440.03125,"maxdpdfrom6mto36m_3546853P":7.0,"maxdpdinstlnum_3546846P":14.0,"maxdpdlast12m_727P":3.0,"maxdpdlast24m_143P":7.0,"maxdpdlast3m_392P":3.0,"maxdpdlast6m_474P":3.0,"maxdpdlast9m_1059P":3.0,"maxdpdtolerance_374P":7.0,"maxinstallast24m_3658928A":131700.796875,"maxlnamtstart6m_4525199A":16672.599609375,"maxoutstandbalancel12m_4187113A":157731.78125,"maxpmtlast3m_4525190A":16641.400390625,"mobilephncnt_593L":2.0,"monthsannuity_845L":66.0,"numactivecreds_622L":1.0,"numactivecredschannel_414L":0.0,"numactiverelcontr_750L":0.0,"numcontrs3months_479L":1.0,"numincomingpmts_3546848L":112.0,"numinstlallpaidearly3d_817L":34.0,"numinstls_657L":14.0,"numinstlswithdpd10_728L":0.0,"numinstlswithdpd5_4187116L":6.0,"numinstpaidearly5d_1087L":0.0,"numinstpaidlastcontr_4325080L":1.0,"numinstpaidlate1d_3546852L":31.0,"numinsttopaygr_769L":10.0,"numnotactivated_1143L":0.0,"numpmtchanneldd_318L":0.0,"numrejects9m_859L":0.0,"opencred_647L":false,"paytype1st_925L":null,"paytype_783L":null,"pctinstlsallpaidearl3d_427L":0.3541699946,"pctinstlsallpaidlat10d_839L":0.0,"pctinstlsallpaidlate1d_3546856L":0.3229199946,"pctinstlsallpaidlate4d_3546849L":0.072920002,"pmtnum_254L":6.0,"posfpd10lastmonth_333P":0.0,"posfpd30lastmonth_3976960P":0.0,"posfstqpd30lastmonth_3976962P":0.0,"previouscontdistrict_112M":"a55475b1","sellerplacecnt_915L":0.0,"sellerplacescnt_216L":5.0,"totalsettled_863A":456031.09375,"totinstallast1m_4525188A":17859.599609375,"twobodfilling_608L":"FO","typesuite_864L":"AL","days_since_datefirstoffer_1144D":4803,"days_since_datelastinstal40dpd_247D":351,"days_since_datelastunpaid_3546854D":1,"days_since_dtlastpmtallstes_4499206D":-1,"days_since_firstclxcampaign_1125D":1535,"days_since_firstdatedue_489D":3398,"days_since_lastactivateddate_801D":18,"days_since_lastapplicationdate_877D":41,"days_since_lastdelinqdate_224D":1,"days_since_lastrejectdate_50D":2100,"days_since_lastrepayingdate_696D":-1,"days_since_maxdpdinstldate_3546855D":62,"days_since_payvacationpostpone_4187118D":356,"days_since_validfrom_1069D":-1,"contractssum_5085716L":151364.0,"days120_123L":2.0,"days180_256L":4.0,"days30_165L":1.0,"days360_512L":8.0,"days90_310L":2.0,"description_5085714M":"2fc785b2","education_1103M":"6b2ae0fa","education_88M":"a55475b1","firstquarter_103L":4.0,"fourthquarter_440L":9.0,"maritalst_385M":"38c061ee","maritalst_893M":"a55475b1","pmtaverage_3A":null,"pmtcount_4527229L":null,"pmtssum_45A":null,"requesttype_4525192L":null,"secondquarter_766L":2.0,"thirdquarter_1082L":3.0,"days_since_assignmentdate_238D":-1,"days_since_assignmentdate_4527235D":-1,"days_since_assignmentdate_4955616D":-1,"days_since_birthdate_574D":-1,"days_since_dateofbirth_337D":14804,"days_since_dateofbirth_342D":-1,"days_since_responsedate_1012D":-1,"days_since_responsedate_4527233D":-1,"days_since_responsedate_4917613D":-14,"person1_contaddr_matchlist_1032L_ever":false,"person1_contaddr_smempladdr_334L_ever":false,"person1_empl_employedtotal_800L_max":null,"person1_empl_industry_691L_max":null,"person1_familystate_447L_max":"SINGLE","person1_housetype_905L_max":null,"person1_incometype_1044T_mode":"SALARIED_GOVT","person1_relationshiptoclient_415T_mode":"SIBLING","person1_relationshiptoclient_642T_mode":"SIBLING","person1_remitter_829L_ever":false,"person1_role_1084L_max":"PE","person1_safeguarantyflag_411L_ever":false,"person1_sex_738L_max":"F","person1_type_25L_max":"PRIMARY_MOBILE","person1_mainoccupationinc_384A_mean":34000.0,"person1_persontype_1072L_max":5.0,"person1_persontype_792L_last3_mean":3.0,"person1_persontype_1072L_count":2.0,"person1_incometype_1044T_nunique":2.0,"person1_familystate_447L_count":1.0,"person1_empl_employedtotal_800L_count":0.0,"person1_persontype_792L_std":2.8284270763,"person1_housetype_905L_count":0.0,"person1_gender_992L_count":0.0,"person1_maritalst_703L_count":0.0,"person1_childnum_185L_count":0.0,"person1_mainoccupationinc_384A_count":1.0,"person1_sex_738L_count":1.0,"applprev_1_credacc_status_367L_max":null,"applprev_1_credtype_587L_max":"COL","applprev_1_familystate_726L_max":"SINGLE","applprev_1_inittransactioncode_279L_max":"POS","applprev_1_isbidproduct_390L_ever":false,"applprev_1_isdebitcard_527L_ever":null,"applprev_1_status_219L_max":"K","applprev_1_revolvingaccount_394A_sum":0.0,"applprev_1_revolvingaccount_394A_min":null,"applprev_1_mainoccupationinc_437A_sum":304000.0,"applprev_1_credamount_590A_sum":368253.0,"applprev_1_credamount_590A_max":104299.0,"applprev_1_credacc_credlmt_575A_sum":0.0,"applprev_1_mainoccupationinc_437A_max":40000.0,"applprev_1_byoccupationinc_3656910L_max":15000.0,"applprev_1_credamount_590A_last3_mean":76099.6640625,"applprev_1_credacc_maxhisbal_375A_last3_mean":null,"applprev_1_outstandingdebt_522A_last3_mean":0.0,"applprev_1_credacc_maxhisbal_375A_max":null,"applprev_1_byoccupationinc_3656910L_last3_mean":1.0,"applprev_1_outstandingdebt_522A_std":3843.5588378906,"applprev_1_credacc_actualbalance_314A_max":null,"applprev_1_outstandingdebt_522A_trend_slope":0.0,"applprev_1_mainoccupationinc_437A_last3_mean":35333.33203125,"applprev_1_credamount_590A_mean":36825.30078125,"applprev_1_byoccupationinc_3656910L_mean":3750.75,"applprev_1_mainoccupationinc_437A_mean":30400.0,"applprev_1_credacc_credlmt_575A_max":0.0,"applprev_1_credamount_590A_trend_slope":10655.6669921875,"applprev_1_mainoccupationinc_437A_min":10000.0,"applprev_1_credamount_590A_std":35057.609375,"applprev_1_credamount_590A_min":8398.0,"applprev_1_byoccupationinc_3656910L_std":7499.5,"applprev_1_outstandingdebt_522A_mean":1215.4400634766,"applprev_1_mainoccupationinc_437A_trend_slope":1111.1110839844,"applprev_1_credacc_minhisbal_90A_min":null,"applprev_1_annuity_853A_sum":30732.400390625,"debitcard_last180dayaveragebalance_704A_sum":null,"debitcard_last180dayaveragebalance_704A_count":null,"debitcard_last180dayturnover_1134A_sum":null,"debitcard_last180dayturnover_1134A_count":null,"debitcard_last30dayturnover_651A_sum":null,"deposit_amount_416A_mean":null,"deposit_amount_416A_max":null,"deposit_amount_416A_count":null,"tax_reg_a_amount_4527230A_mean":null,"tax_reg_a_amount_4527230A_max":null,"tax_reg_a_amount_4527230A_min":null,"tax_reg_a_amount_4527230A_std":null,"tax_reg_a_amount_4527230A_trend_slope":null,"bureau_a_1_credlmt_935A_trend_slope":null,"bureau_a_1_credlmt_935A_std":null,"bureau_a_1_totalamount_6A_sum":157804.203125,"bureau_a_1_overdueamountmax2_398A_sum":4092.6281738281,"bureau_a_1_overdueamountmax_35A_sum":4092.6281738281,"bureau_a_1_totalamount_996A_sum":17054.400390625,"bureau_a_1_totalamount_6A_max":46000.0,"bureau_a_1_totalamount_996A_trend_slope":null,"bureau_a_1_outstandingamount_362A_trend_slope":null,"bureau_a_1_totaloutstanddebtvalue_39A_mean":30272.80078125,"bureau_a_1_totalamount_996A_mean":17054.400390625,"bureau_a_1_residualamount_856A_max":16873.0,"bureau_a_1_totaloutstanddebtvalue_39A_min":30272.80078125,"bureau_a_1_totalamount_996A_min":17054.400390625,"bureau_a_1_credlmt_230A_max":0.0,"bureau_a_1_residualamount_856A_trend_slope":null,"bureau_a_1_monthlyinstlamount_674A_sum":55337.1171875,"bureau_a_1_totalamount_6A_last3_mean":18857.732421875,"bureau_a_1_totalamount_6A_std":15411.5478515625}]}'


def main():
    repo_root = Path(__file__).resolve().parents[2]
    terraform_dir = repo_root / "terraform" / "1_sagemaker"
    endpoint = os.getenv("CLASSIFIER_ENDPOINT") or os.getenv("SAGEMAKER_ENDPOINT")

    if not endpoint:
        result = subprocess.run(
            ["terraform", "output", "-raw", "classifier_endpoint_name"],
            cwd=terraform_dir,
            capture_output=True,
            text=True,
        )
        endpoint = result.stdout.strip()

    if not endpoint:
        print("Set CLASSIFIER_ENDPOINT or deploy Terraform first")
        return 1

    body = json.loads(PAYLOAD)
    row = body["instances"][0]
    # Aurora stores features as JSONB, which reorders keys by (length, bytes);
    # the endpoint must give the same answer for both orderings.
    jsonb_row = {key: row[key] for key in sorted(row, key=lambda k: (len(k), k))}
    cases = {"as-trained": row, "jsonb-order": jsonb_row, "all-null": {}}

    with tempfile.TemporaryDirectory() as tmp:
        probabilities = []
        for name, instance in cases.items():
            payload = Path(tmp) / f"{name}.json"
            output = Path(tmp) / f"{name}-out.json"
            payload.write_text(json.dumps({"instances": [instance]}), encoding="utf-8")
            result = subprocess.run([
                "aws", "sagemaker-runtime", "invoke-endpoint",
                "--endpoint-name", endpoint,
                "--content-type", "application/json",
                "--body", f"fileb://{payload}",
                str(output),
            ], capture_output=True, text=True)

            if result.returncode != 0:
                print(f"{name}: {result.stderr}")
                return result.returncode

            text = output.read_text(encoding="utf-8")
            print(f"{name}: {text}")
            probabilities.append(json.loads(text)["probabilities"])

        assert probabilities[0] == probabilities[1], f"key order changed the prediction: {probabilities}"
        return 0


if __name__ == "__main__":
    sys.exit(main())
