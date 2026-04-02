import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const COLORS = {
  primary: [59, 130, 246] as [number, number, number],
  surface: [17, 24, 39] as [number, number, number],
  border: [31, 41, 55] as [number, number, number],
  text: [249, 250, 251] as [number, number, number],
  textMuted: [148, 163, 184] as [number, number, number],
  success: [16, 185, 129] as [number, number, number],
  danger: [239, 68, 68] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
};

interface KPI {
  label: string;
  value: string | number;
}

interface ReportConfig {
  title: string;
  subtitle?: string;
  filterDescription: string;
  kpis: KPI[];
  tables: {
    title: string;
    headers: string[];
    rows: (string | number)[][];
  }[];
}

function addHeader(doc: jsPDF, config: ReportConfig) {
  // Blue header bar
  doc.setFillColor(...COLORS.primary);
  doc.rect(0, 0, 210, 32, 'F');

  doc.setTextColor(...COLORS.white);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(config.title, 14, 14);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(config.subtitle || 'ATS Codelco | Transearch', 14, 22);

  // Date + filters line
  const now = new Date();
  const dateStr = now.toLocaleDateString('es-CL', { year: 'numeric', month: 'long', day: 'numeric' });
  doc.text(`Generado: ${dateStr}`, 210 - 14, 14, { align: 'right' });
  doc.text(config.filterDescription, 210 - 14, 22, { align: 'right' });

  return 38;
}

function addKPIs(doc: jsPDF, kpis: KPI[], startY: number): number {
  const cardW = (210 - 28 - (kpis.length - 1) * 6) / kpis.length;
  let x = 14;

  for (const kpi of kpis) {
    // Card background
    doc.setFillColor(240, 242, 245);
    doc.roundedRect(x, startY, cardW, 22, 3, 3, 'F');

    // Value
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(String(kpi.value), x + cardW / 2, startY + 10, { align: 'center' });

    // Label
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(kpi.label, x + cardW / 2, startY + 17, { align: 'center' });

    x += cardW + 6;
  }

  return startY + 30;
}

function addTable(doc: jsPDF, table: ReportConfig['tables'][0], startY: number): number {
  // Section title
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(table.title, 14, startY + 5);

  autoTable(doc, {
    startY: startY + 9,
    head: [table.headers],
    body: table.rows.map(row => row.map(cell => String(cell))),
    theme: 'grid',
    margin: { left: 14, right: 14 },
    styles: {
      fontSize: 8,
      cellPadding: 3,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.3,
    },
    headStyles: {
      fillColor: [59, 130, 246],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    didDrawPage: (data) => {
      // Footer on each page
      const pageCount = doc.getNumberOfPages();
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `ATS Codelco | Página ${data.pageNumber} de ${pageCount}`,
        105,
        290,
        { align: 'center' },
      );
    },
  });

  return (doc as any).lastAutoTable?.finalY ?? startY + 40;
}

export function generatePDFReport(config: ReportConfig) {
  const doc = new jsPDF('portrait', 'mm', 'a4');

  let y = addHeader(doc, config);
  y = addKPIs(doc, config.kpis, y);

  for (const table of config.tables) {
    if (y > 240) {
      doc.addPage();
      y = 20;
    }
    y = addTable(doc, table, y) + 10;
  }

  // Final footer on all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(`ATS Codelco | Página ${i} de ${totalPages}`, 105, 290, { align: 'center' });
  }

  // Save
  const filename = config.title.replace(/\s+/g, '_').toLowerCase();
  const dateStr = new Date().toISOString().split('T')[0];
  doc.save(`${filename}_${dateStr}.pdf`);
}
