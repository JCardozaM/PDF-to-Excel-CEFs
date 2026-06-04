document.addEventListener("DOMContentLoaded", () => {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js";

    const meses = {
        "enero": "01", "febrero": "02", "marzo": "03", "abril": "04",
        "mayo": "05", "junio": "06", "julio": "07", "agosto": "08",
        "septiembre": "09", "octubre": "10", "noviembre": "11", "diciembre": "12"
    };

    function extraerCEF(text) {
        // Ajuste para mayor flexibilidad
        const match = text.match(/CEF[\s\.]+\s*([A-Z0-9]{6})/i);
        return match ? match[1] : "N/A";
    }

    function mapISR(text) {
        if (/pago directo/i.test(text)) return 2;
        if (/pagos trimestrales/i.test(text)) return 3;
        if (/no genera derecho/i.test(text)) return 4;
        if (/retención definitiva ISR/i.test(text)) return 2;
        return "";
    }

    function calcularISR(totalQ, isr) {
        const total = Number(totalQ.replace(/[^\d.-]/g, "")) || 0;
        const isrNum = Number(isr);
        return (isrNum === 2 && total >= 2800) ? ((total / 1.12) * 0.05).toFixed(3) : "0.000";
    }

    function calcularRET(totalQ, isr) {
        const total = Number(totalQ.replace(/[^\d.-]/g, "")) || 0;
        const isrNum = Number(isr);
        if (isrNum === 4 && total > 2500) return (total * 0.05).toFixed(2);
        if ((isrNum === 2 || isrNum === 3) && total >= 2500) return ((total / 1.12) * 0.12 * 0.15).toFixed(3);
        return "0.000";
    }

    // 1. Agregada la columna FECHA DE CERTIFICACION
    const columnas = [
        "ARCHIVO", "FECHA DE EMISION", "FECHA DE CERTIFICACION", "CANTIDAD", "B/S", "NIT RECEPTOR", 
        "NIT EMISOR", "AÑO", "MES", "CEF", "NOMBRE EMISOR", "TOTAL Q", "SERIE", "NUMERO DTE", "REGIMEN",
        "CALCULO ISR", "CALCULO RET"
    ];

    let registros = [];
    const headerRow = document.getElementById("headerRow");
    columnas.forEach(col => {
        const th = document.createElement("th");
        th.textContent = col;
        headerRow.appendChild(th);
    });

    document.getElementById("pdfFiles").addEventListener("change", async (e) => {
        const files = e.target.files;
        const tableBody = document.querySelector("#dataTable tbody");
        tableBody.innerHTML = "";
        registros = [];

        for (const file of files) {
            const reader = new FileReader();
            reader.onload = async function () {
                const pdf = await pdfjsLib.getDocument(new Uint8Array(this.result)).promise;

                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const textContent = await page.getTextContent();
                    const items = textContent.items.map(it => it.str);
                    const fullText = items.join(" ");

                    let mes = "", anio = "", cantidad = "1", nitEmisor = "", nombreEmisor = "", totalQ = "", serie = "", numeroDTE = "", isr = "";
                    let bs = "", nitReceptor = "", fechaEmision = "", fechaCert = "";

                    const cefCode = extraerCEF(fullText);

                    // Lógica de fechas
                    const mesesCortos = { "ene": "01", "feb": "02", "mar": "03", "abr": "04", "may": "05", "jun": "06", "jul": "07", "ago": "08", "sep": "09", "oct": "10", "nov": "11", "dic": "12" };
                    
                    const emisionMatch = fullText.match(/Fecha y hora de emision:\s*(\d{2})-([A-Za-z]{3})-(\d{4})/i);
                    if (emisionMatch) fechaEmision = `${emisionMatch[1]}.${mesesCortos[emisionMatch[2].toLowerCase()] || ""}.${emisionMatch[3]}`;

                    const certMatch = fullText.match(/Fecha y hora de certificación:\s*(\d{2})-([A-Za-z]{3})-(\d{4})/i);
                    if (certMatch) fechaCert = `${certMatch[1]}.${mesesCortos[certMatch[2].toLowerCase()] || ""}.${certMatch[3]}`;

                    const descripcionMatch = fullText.match(/mes\s*(de)?\s*([A-Za-zÁÉÍÓÚáéíóú]+)[^\d]*(\d{4})/i);
                    if (descripcionMatch) {
                        mes = meses[descripcionMatch[2].toLowerCase().trim()] || "";
                        anio = descripcionMatch[3];
                    }

                    // Extracción de otros datos
                    for (let idx = 0; idx < items.length; idx++) {
                        const str = items[idx];
                        if (/Nit\s*Emisor/i.test(str)) {
                            nitEmisor = str.replace(/[^0-9]/g, "").trim();
                            for (let j = idx - 1; j >= 0; j--) {
                                if (/[A-ZÁÉÍÓÚÑ]/i.test(items[j]) && !/NÚMERO DE AUTORIZACIÓN/i.test(items[j])) { nombreEmisor = items[j].trim(); break; }
                            }
                        }
                        if (/Total\s*\(Q\)/i.test(str)) {
                            for (let k = idx + 1; k < items.length; k++) {
                                if (/[\d,]+\.\d{2}/.test(items[k])) { totalQ = items[k].trim(); break; }
                            }
                        }
                        if (/Serie\s*:/i.test(str) && /DTE\s*:/i.test(str)) {
                            const serieMatch = str.match(/Serie\s*:\s*([A-Z0-9]+)/i);
                            const dteMatch = str.match(/DTE\s*:\s*([0-9]+)/i);
                            if (serieMatch) serie = serieMatch[1].trim();
                            if (dteMatch) numeroDTE = dteMatch[1].trim();
                        }
                        const nitReceptorMatch = str.match(/NIT\s*Receptor\s*[:\-]?\s*(\d+)/i);
                        if (nitReceptorMatch) nitReceptor = nitReceptorMatch[1];
                        const bsMatch = str.match(/\b(Bien|Servicio)\b/i);
                        if (bsMatch) bs = bsMatch[1].trim();
                    }

                    isr = mapISR(fullText);
                    const registro = {
                        "fileObject": file,
                        "ARCHIVO": file.name.replace(/\.pdf$/i, ""),
                        "FECHA DE EMISION": fechaEmision,
                        "FECHA DE CERTIFICACION": fechaCert,
                        "CANTIDAD": cantidad,
                        "B/S": bs,
                        "NIT RECEPTOR": nitReceptor,
                        "NIT EMISOR": nitEmisor,
                        "AÑO": anio,
                        "MES": mes,
                        "CEF": cefCode,
                        "NOMBRE EMISOR": nombreEmisor,
                        "TOTAL Q": totalQ,
                        "SERIE": serie,
                        "NUMERO DTE": numeroDTE,
                        "REGIMEN": isr,
                        "CALCULO ISR": calcularISR(totalQ, isr),
                        "CALCULO RET": calcularRET(totalQ, isr)
                    };
                    registros.push(registro);
                }

                tableBody.innerHTML = "";
                registros.forEach(reg => {
                    const row = document.createElement("tr");
                    row.style.cursor = "pointer";
                    row.title = "Clic para abrir el PDF";
                    row.addEventListener("click", () => {
                        const fileURL = URL.createObjectURL(reg.fileObject);
                        window.open(fileURL, '_blank');
                    });

                    columnas.forEach(col => {
                        const cell = document.createElement("td");
                        cell.textContent = reg[col] || "";
                        if ((col === "B/S" && reg[col].toLowerCase() !== "servicio") || (col === "NIT RECEPTOR" && reg[col] !== "7545657")) {
                            cell.style.backgroundColor = "#ffcccc";
                        }
                        row.appendChild(cell);
                    });
                    tableBody.appendChild(row);
                });
            };
            reader.readAsArrayBuffer(file);
        }
    });

    document.getElementById("exportExcel").addEventListener("click", () => {
        if (registros.length === 0) { alert("Primero carga los PDFs"); return; }
        const dataExport = registros.map(({fileObject, ...rest}) => rest);
        const worksheet = XLSX.utils.json_to_sheet(dataExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Facturas");
        saveAs(new Blob([XLSX.write(workbook, { bookType: "xlsx", type: "array" })], { type: "application/octet-stream" }), "facturas_diarias.xlsx");
    });
});
