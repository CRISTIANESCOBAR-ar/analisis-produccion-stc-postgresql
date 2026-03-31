DO $$
DECLARE
    v_col TEXT;
BEGIN
    -- Fix columna TITULO garbled en tb_produccion_oe
    SELECT column_name INTO v_col
    FROM information_schema.columns
    WHERE lower(table_name) = 'tb_produccion_oe'
    AND column_name LIKE '%TULO'
    AND column_name <> 'TÍTULO';

    IF v_col IS NOT NULL THEN
        EXECUTE format('ALTER TABLE tb_produccion_oe RENAME COLUMN %I TO "TÍTULO"', v_col);
        RAISE NOTICE 'OK: Renombrada columna "%" a TITULO', v_col;
    ELSE
        RAISE NOTICE 'SKIP: TITULO ya es correcto o no encontrado';
    END IF;

    -- Fix columna PECA garbled en tb_calidad
    SELECT column_name INTO v_col
    FROM information_schema.columns
    WHERE lower(table_name) = 'tb_calidad'
    AND column_name LIKE 'PE%A'
    AND length(column_name) > 4;

    IF v_col IS NOT NULL THEN
        EXECUTE format('ALTER TABLE tb_calidad RENAME COLUMN %I TO "PEÇA"', v_col);
        RAISE NOTICE 'OK: Renombrada columna "%" a PECA', v_col;
    ELSE
        RAISE NOTICE 'SKIP: PECA ya es correcto o no encontrado';
    END IF;
END;
$$;
