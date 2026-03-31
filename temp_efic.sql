SELECT LEFT(p."ARTIGO", 10) AS artigo, p."COR", p."EFIC_DIA", p."MT_A_BATER", p."BATIDAS",
       COALESCE(NULLIF(f."ENC#ACAB URD", '')::numeric, 0) AS enc_acab_urd
FROM tb_proceso p
LEFT JOIN tb_fichas f ON f."ARTIGO CODIGO" = p."ARTIGO"
WHERE BTRIM(p."PROCESSO") = 'TECELAGEM'
LIMIT 3;
