document.addEventListener("DOMContentLoaded", () => {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js";
  
    const meses = {
      "enero": "01","febrero": "02","marzo": "03","abril": "04",
      "mayo": "05","junio": "06","julio": "07","agosto": "08",
      "septiembre": "09","octubre": "10","noviembre": "11","diciembre": "12"
    };
  
    function mapISR(text) {
      if (/pago directo/i.test(text)) return 2;
      if (/pagos trimestrales/i.test(text)) return 3;
      if (/no genera derecho/i.test(text)) return 4;
      if (/retención definitiva ISR/i.test(text)) return 2;
      return "";
    }
  
    // 🧮 Funciones de cálculo

    function calcularISR(totalQ, isr) {
        const total = Number(totalQ.replace(/[^\d.-]/g, "")) || 0;
        const isrNum = Number(isr); // convertir ISR a número
        if (isrNum === 2 && total >= 2800) {
          return ((total / 1.12) * 0.05).toFixed(3);
        }
        return "0.000";
    }
      
    function calcularRET(totalQ, isr) {
        const total = Number(totalQ.replace(/[^\d.-]/g, "")) || 0;
        const isrNum = Number(isr); // convertir ISR a número
        if (isrNum === 4 && total > 2500) {
          return (total * 0.05).toFixed(2);
        } else if ((isrNum === 2 || isrNum === 3) && total >= 2500) {
          return ((total / 1.12) * 0.12 * 0.15).toFixed(3);
        }
        return "0.000";
    }
      
      
      
    const columnas = [
      "ARCHIVO","MES","AÑO","CANTIDAD","NIT EMISOR","NOMBRE EMISOR",
      "TOTAL Q","SERIE","NUMERO DTE","ISR","B/S","NIT RECEPTOR",
      "CALCULO ISR","CALCULO RET"
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
        reader.onload = async function() {
          const typedArray = new Uint8Array(this.result);
          const pdf = await pdfjsLib.getDocument(typedArray).promise;
  
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const items = textContent.items.map(it => it.str);
            const fullText = items.join(" ");
  
            if (!items || items.length === 0) continue;
  
            let mes="",anio="",cantidad="1",nitEmisor="",nombreEmisor="",totalQ="",serie="",numeroDTE="",isr="";
            let bs="", nitReceptor="";
  
            // 🗓️ Mes y año
            const descripcionMatch = fullText.match(/mes\s*(de)?\s*([A-Za-zÁÉÍÓÚáéíóú]+)[^\d]*(\d{4})/i);
            if (descripcionMatch) {
              const mesTexto = descripcionMatch[2].toLowerCase().trim();
              mes = meses[mesTexto] || "";
              anio = descripcionMatch[3];
            }
  
            // 🔍 Recorrer items
            for (let idx = 0; idx < items.length; idx++) {
              const str = items[idx];
  
              if (/Nit\s*Emisor/i.test(str)) {
                nitEmisor = str.replace(/[^0-9]/g,"").trim();
                for (let j = idx - 1; j >= 0; j--) {
                  if (/[A-ZÁÉÍÓÚÑ]/i.test(items[j]) && !/NÚMERO DE AUTORIZACIÓN/i.test(items[j])) {
                    nombreEmisor = items[j].trim();
                    break;
                  }
                }
              }
  
              if (/Total\s*\(Q\)/i.test(str)) {
                for (let k = idx + 1; k < items.length; k++) {
                  if (/[\d,]+\.\d{2}/.test(items[k])) {
                    totalQ = items[k].trim();
                    break;
                  }
                }
              }
  
              if (/Serie\s*:/i.test(str) && /DTE\s*:/i.test(str)) {
                const serieMatch = str.match(/Serie\s*:\s*([A-Z0-9]+)/i);
                const dteMatch = str.match(/DTE\s*:\s*([0-9]+)/i);
                if (serieMatch) serie = serieMatch[1].trim();
                if (dteMatch) numeroDTE = dteMatch[1].trim();
              }
  
              // 🔢 NIT Receptor
              const nitReceptorMatch = str.match(/NIT\s*Receptor\s*[:\-]?\s*(\d+)/i);
              if (nitReceptorMatch) nitReceptor = nitReceptorMatch[1];
  
              // 🔍 B/S (valor exacto: Bien o Servicio)
              const bsMatch = str.match(/\b(Bien|Servicio)\b/i);
              if (bsMatch) bs = bsMatch[1].trim();
            }
  
            isr = mapISR(fullText);
  
            // 🧮 Calcular ISR y RET
            const calculoISR = calcularISR(totalQ, isr);
            const calculoRET = calcularRET(totalQ, isr);
  
            const registro = {
              "ARCHIVO": file.name,  
              "MES": mes,
              "AÑO": anio,
              "CANTIDAD": cantidad,
              "NIT EMISOR": nitEmisor,
              "NOMBRE EMISOR": nombreEmisor,
              "TOTAL Q": totalQ,
              "SERIE": serie,
              "NUMERO DTE": numeroDTE,
              "ISR": isr,
              "B/S": bs,
              "NIT RECEPTOR": nitReceptor,
              "CALCULO ISR": calculoISR,
              "CALCULO RET": calculoRET
            };
  
            registros.push(registro);
          }
  
          // 🖥️ Mostrar registros en tabla con validación visual
          tableBody.innerHTML = "";
          registros.forEach(reg => {
            const row = document.createElement("tr");
            columnas.forEach(col => {
              const cell = document.createElement("td");
              cell.textContent = reg[col] || "";
  
              // Validaciones visuales
              if (col === "B/S" && reg[col].toLowerCase() !== "servicio") {
                cell.style.backgroundColor = "#ffcccc";
                cell.style.color = "#b30000";
                cell.style.fontWeight = "bold";
              }
              if (col === "NIT RECEPTOR" && reg[col] !== "7545657") {
                cell.style.backgroundColor = "#ffcccc";
                cell.style.color = "#b30000";
                cell.style.fontWeight = "bold";
              }
  
              row.appendChild(cell);
            });
            tableBody.appendChild(row);
          });
        };
        reader.readAsArrayBuffer(file);
      }
    });
  
    // 📤 Exportar a Excel con alerta visual
    document.getElementById("exportExcel").addEventListener("click", () => {
      let alerta = document.getElementById("alerta");
      if (!alerta) {
        alerta = document.createElement("div");
        alerta.id = "alerta";
        alerta.style.position = "fixed";
        alerta.style.top = "20px";
        alerta.style.right = "20px";
        alerta.style.padding = "15px 25px";
        alerta.style.borderRadius = "8px";
        alerta.style.backgroundColor = "#ff4d4d";
        alerta.style.color = "white";
        alerta.style.fontWeight = "bold";
        alerta.style.boxShadow = "0 4px 10px rgba(0,0,0,0.3)";
        alerta.style.zIndex = "9999";
        alerta.style.transition = "opacity 0.5s";
        document.body.appendChild(alerta);
      }
  
      const errores = registros.filter(r => r["B/S"].toLowerCase() !== "servicio" || r["NIT RECEPTOR"] !== "7545657");
      if (errores.length > 0) {
        alerta.textContent = `⚠️ Hay ${errores.length} registros con errores en B/S o NIT Receptor`;
        alerta.style.display = "block";
        alerta.style.opacity = "1";
        setTimeout(() => alerta.style.opacity = "0", 4000);
      }
  
      if (registros.length === 0) {
        alert("Primero carga los PDFs");
        return;
      }
  
      // Exportar todos los registros incluyendo CALCULO ISR y CALCULO RET
      const worksheet = XLSX.utils.json_to_sheet(registros);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Facturas");
      const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
      const blob = new Blob([excelBuffer], { type: "application/octet-stream" });
      saveAs(blob, "facturas_diarias.xlsx");
    });
  });
