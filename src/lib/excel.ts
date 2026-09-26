import * as XLSX from "xlsx";

export function downloadTemplate(tableName: string, headers: string[], example?: Record<string, unknown>, allRows?: Record<string, unknown>[]) {
  const rows = allRows && allRows.length
    ? allRows
    : [example ?? Object.fromEntries(headers.map((h) => [h, ""]))];
  const ws = XLSX.utils.json_to_sheet(rows, { header: headers });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, tableName.slice(0, 30));
  XLSX.writeFile(wb, `${tableName}-template.xlsx`);
}

export async function parseExcelFile(file: File): Promise<Record<string, unknown>[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { defval: null }) as Record<string, unknown>[];
}

export function exportRows(tableName: string, rows: Record<string, unknown>[]) {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, tableName.slice(0, 30));
  XLSX.writeFile(wb, `${tableName}-export.xlsx`);
}
