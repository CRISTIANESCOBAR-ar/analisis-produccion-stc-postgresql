const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

const inputFile = path.join(__dirname, 'metas_input.txt');

if (!fs.existsSync(inputFile)) {
    console.error(`El archivo de entrada no existe. Por favor, crea '${inputFile}' y pega allí los datos tabulares.`);
    // Lo creamos vacío para facilitarle la vida al usuario
    fs.writeFileSync(inputFile, '', 'utf8');
    process.exit(1);
}

const data = fs.readFileSync(inputFile, 'utf8').trim();

if (!data) {
    console.error(`El archivo '${inputFile}' está vacío. Pega los datos de las metas (copiados de Excel/hoja de cálculo) e inténtalo de nuevo.`);
    process.exit(1);
}

// Omitir la primera línea si parece ser un encabezado
let lines = data.split('\n').map(l => l.trim()).filter(l => l.length > 0);
if (lines[0].toLowerCase().includes('indigo') || lines[0].toLowerCase().includes('meta_')) {
    console.log('Se detectó una fila de encabezado. Omitiendo la primera línea...');
    lines.shift();
}

function parseVal(v) {
    let s = v.replace(/\./g, ''); // Remover separador de miles
    s = s.replace(/,/g, '.');     // Reemplazar coma decimal por punto
    const parsed = parseFloat(s);
    return isNaN(parsed) ? 'NULL' : parsed;
}

const sqlLines = lines.map((line, index) => {
    try {
        const parts = line.split('\t');
        if (parts.length < 15) {
            throw new Error(`La línea ${index + 1} no tiene suficientes columnas (esperadas 15, encontradas ${parts.length}). Revisa que los datos estén separados por tabulaciones.`);
        }

        // El formato de fecha esperado es ej: "jueves 01-oct-26" o solo "01-oct-26"
        let dateStr = parts[0];
        if (dateStr.includes(' ')) {
            dateStr = dateStr.split(' ')[1];
        }

        const meses = {"ene": 1, "feb": 2, "mar": 3, "abr": 4, "may": 5, "jun": 6, "jul": 7, "ago": 8, "sep": 9, "oct": 10, "nov": 11, "dic": 12};
        const [d, mStr, y] = dateStr.split('-');
        
        if (!meses[mStr.toLowerCase()]) {
            throw new Error(`Mes no reconocido en la fecha: ${mStr}`);
        }

        const month = meses[mStr.toLowerCase()];
        const year = 2000 + parseInt(y, 10);
        const day = parseInt(d, 10);
        
        const formattedDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        
        const vals = parts.slice(1).map(parseVal);
        
        return `INSERT INTO public.tb_metas ("Dia", "Indigo", "Meta_Eficiencia_INDIGO", "Meta_Rotura_INDIGO", "Meta_Estopa_Azul", "Tejeduria", "RU105", "RT105", "EFI_Percent", "Meta_Estopa_Azul_Tejeduria", "Integrada", "Meta_Velocidad_Integrada", "Meta_ENC_URD_Integrada", "Revision", "Dia_Invertido") VALUES ('${formattedDate}', ${vals[0]}, ${vals[1]}, ${vals[2]}, ${vals[3]}, ${vals[4]}, ${vals[5]}, ${vals[6]}, ${vals[7]}, ${vals[8]}, ${vals[9]}, ${vals[10]}, ${vals[11]}, ${vals[12]}, ${vals[13]}) ON CONFLICT ("Dia") DO UPDATE SET "Indigo" = EXCLUDED."Indigo", "Meta_Eficiencia_INDIGO" = EXCLUDED."Meta_Eficiencia_INDIGO", "Meta_Rotura_INDIGO" = EXCLUDED."Meta_Rotura_INDIGO", "Meta_Estopa_Azul" = EXCLUDED."Meta_Estopa_Azul", "Tejeduria" = EXCLUDED."Tejeduria", "RU105" = EXCLUDED."RU105", "RT105" = EXCLUDED."RT105", "EFI_Percent" = EXCLUDED."EFI_Percent", "Meta_Estopa_Azul_Tejeduria" = EXCLUDED."Meta_Estopa_Azul_Tejeduria", "Integrada" = EXCLUDED."Integrada", "Meta_Velocidad_Integrada" = EXCLUDED."Meta_Velocidad_Integrada", "Meta_ENC_URD_Integrada" = EXCLUDED."Meta_ENC_URD_Integrada", "Revision" = EXCLUDED."Revision", "Dia_Invertido" = EXCLUDED."Dia_Invertido";`;
    } catch (err) {
        console.error(`Error procesando la línea ${index + 1}: ${line}`);
        console.error(err.message);
        process.exit(1);
    }
});

const sqlContent = sqlLines.join('\n') + '\n';
console.log(`Ejecutando ${sqlLines.length} sentencias en el contenedor de PostgreSQL...`);

try {
    const command = `podman exec -i stc_postgres psql -U stc_user -d stc_produccion`;
    execSync(command, { 
        input: sqlContent,
        stdio: ['pipe', 'inherit', 'inherit'] 
    });
    
    console.log('¡Las metas se importaron correctamente a la base de datos!');
} catch (error) {
    console.error('Ocurrió un error al ejecutar las sentencias SQL en Podman.', error);
}
