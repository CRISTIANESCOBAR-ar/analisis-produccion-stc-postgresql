const fs = require('fs');
const readline = require('readline');
const { Pool } = require('pg');

const pool = new Pool({
  host: '127.0.0.1',
  port: 5433,
  database: 'stc_produccion',
  user: 'stc_user',
  password: 'stc_password_2026'
});

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Create table
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.tb_metas (
          id bigserial PRIMARY KEY,
          "Dia" date NOT NULL,
          "Indigo" numeric,
          "Meta_Eficiencia_INDIGO" numeric,
          "Meta_Rotura_INDIGO" numeric,
          "Meta_Estopa_Azul" numeric,
          "Tejeduria" numeric,
          "RU105" numeric,
          "RT105" numeric,
          "EFI_Percent" numeric,
          "Meta_Estopa_Azul_Tejeduria" numeric,
          "Integrada" numeric,
          "Meta_Velocidad_Integrada" numeric,
          "Meta_ENC_URD_Integrada" numeric,
          "Revision" numeric,
          "Dia_Invertido" integer,
          created_at timestamp without time zone DEFAULT now(),
          updated_at timestamp without time zone DEFAULT now()
      );
    `);
    
    // Also create the index like it was in db_schema or backend scripts
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_tb_metas_dia_unique ON public.tb_metas ("Dia");`);

    // Read CSV
    const fileStream = fs.createReadStream('C:\\stc-produccion-v2\\csv\\metas.csv');
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    let isFirstLine = true;
    let count = 0;

    for await (const line of rl) {
      if (isFirstLine) {
        isFirstLine = false;
        continue;
      }
      if (!line.trim()) continue;

      const cols = line.split(';');
      // Cols: Dia;Indigo;Meta_Eficiencia_INDIGO;Meta_Rotura_INDIGO;Meta_Estopa_Azul;Tejeduria;RU105;RT105;EFI%;Meta_Estopa_Azul_TEJ;Integrada;Meta_Velocidad_Integrada;Meta_ENC_URD_Integrada;Revision;Dia_Invertido
      // Note: Dia is cols[0]
      const rawDate = cols[0];
      const dateParts = rawDate.split('/');
      const formattedDate = `${dateParts[2]}-${dateParts[1].padStart(2, '0')}-${dateParts[0].padStart(2, '0')}`;

      const parseNumber = (str) => {
        if (!str || str === '') return null;
        // remove thousands separator '.' and replace decimal separator ',' with '.'
        let val = str.replace(/\./g, '').replace(/,/g, '.');
        return val === '' ? null : Number(val);
      };

      const values = [
        formattedDate,
        parseNumber(cols[1]),
        parseNumber(cols[2]),
        parseNumber(cols[3]),
        parseNumber(cols[4]),
        parseNumber(cols[5]),
        parseNumber(cols[6]),
        parseNumber(cols[7]),
        parseNumber(cols[8]),
        parseNumber(cols[9]),
        parseNumber(cols[10]),
        parseNumber(cols[11]),
        parseNumber(cols[12]),
        parseNumber(cols[13]),
        parseNumber(cols[14]) // Dia_Invertido
      ];

      await client.query(`
        INSERT INTO public.tb_metas (
          "Dia", "Indigo", "Meta_Eficiencia_INDIGO", "Meta_Rotura_INDIGO", "Meta_Estopa_Azul",
          "Tejeduria", "RU105", "RT105", "EFI_Percent", "Meta_Estopa_Azul_Tejeduria",
          "Integrada", "Meta_Velocidad_Integrada", "Meta_ENC_URD_Integrada", "Revision", "Dia_Invertido"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        ON CONFLICT ("Dia") DO UPDATE SET
          "Indigo" = EXCLUDED."Indigo",
          "Meta_Eficiencia_INDIGO" = EXCLUDED."Meta_Eficiencia_INDIGO",
          "Meta_Rotura_INDIGO" = EXCLUDED."Meta_Rotura_INDIGO",
          "Meta_Estopa_Azul" = EXCLUDED."Meta_Estopa_Azul",
          "Tejeduria" = EXCLUDED."Tejeduria",
          "RU105" = EXCLUDED."RU105",
          "RT105" = EXCLUDED."RT105",
          "EFI_Percent" = EXCLUDED."EFI_Percent",
          "Meta_Estopa_Azul_Tejeduria" = EXCLUDED."Meta_Estopa_Azul_Tejeduria",
          "Integrada" = EXCLUDED."Integrada",
          "Meta_Velocidad_Integrada" = EXCLUDED."Meta_Velocidad_Integrada",
          "Meta_ENC_URD_Integrada" = EXCLUDED."Meta_ENC_URD_Integrada",
          "Revision" = EXCLUDED."Revision",
          "Dia_Invertido" = EXCLUDED."Dia_Invertido",
          updated_at = now();
      `, values);
      count++;
    }

    await client.query('COMMIT');
    console.log(`Successfully loaded ${count} records into tb_metas.`);
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Error loading data:', e);
  } finally {
    client.release();
    pool.end();
  }
}

main();
