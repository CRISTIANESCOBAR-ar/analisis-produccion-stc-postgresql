SELECT DISTINCT
    v."ROLADA",
    p."ARTIGO",
    v.efic_tej as "Eficiencia",
    v.sci as "SCI",
    v.str as "Resistencia"
FROM view_golden_batch_data v
JOIN tb_produccion p ON v."ROLADA" = p."ROLADA"
WHERE v.efic_tej >= 90
ORDER BY v.efic_tej DESC;