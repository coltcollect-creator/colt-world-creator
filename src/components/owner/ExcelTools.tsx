import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { downloadTemplate, parseExcelFile } from "@/lib/excel";

type Field = { key: string; label: string; type: string; default?: unknown };

export function ExcelTools({ table, fields, onImported }: { table: string; fields: Field[]; onImported: () => void }) {
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const headers = fields.filter((f) => f.type !== "image").map((f) => f.key);

  const template = async () => {
    // Try to include existing rows so owners can see real examples of correct data.
    const { data: existing } = await (supabase.from(table as never) as never as {
      select: (s: string) => { limit: (n: number) => Promise<{ data: Record<string, unknown>[] | null }> };
    }).select(headers.join(",")).limit(200);

    const rows: Record<string, unknown>[] = [];
    if (existing && existing.length) {
      for (const r of existing) {
        const clean: Record<string, unknown> = {};
        for (const h of headers) clean[h] = r[h] ?? "";
        rows.push(clean);
      }
    } else {
      const example: Record<string, unknown> = {};
      for (const f of fields.filter((x) => x.type !== "image")) {
        example[f.key] =
          f.default !== undefined
            ? f.default
            : f.type === "number"
            ? 0
            : f.type === "boolean"
            ? "true"
            : "";
      }
      rows.push(example);
    }
    downloadTemplate(table, headers, rows[0], rows);
  };


  const importFile = async (file: File) => {
    setBusy(true);
    try {
      const rows = await parseExcelFile(file);
      if (!rows.length) { toast.error("הקובץ ריק"); return; }
      const cleaned = rows.map((r) => {
        const out: Record<string, unknown> = {};
        for (const f of fields) {
          if (f.type === "image") continue;
          const raw = r[f.key];
          if (raw === null || raw === undefined || raw === "") continue;
          if (f.type === "number") out[f.key] = Number(raw);
          else if (f.type === "boolean") out[f.key] = String(raw).toLowerCase() === "true" || raw === true || raw === 1;
          else out[f.key] = raw;
        }
        return out;
      }).filter((r) => Object.keys(r).length > 0);
      if (!cleaned.length) { toast.error("אין שורות תקפות"); return; }
      // Chunk inserts of 500
      let inserted = 0;
      for (let i = 0; i < cleaned.length; i += 500) {
        const chunk = cleaned.slice(i, i + 500);
        const { error } = await (supabase.from(table as never) as never as { insert: (v: unknown) => Promise<{ error: unknown }> }).insert(chunk);
        if (error) { toast.error(String((error as { message?: string })?.message ?? error)); return; }
        inserted += chunk.length;
      }
      toast.success(`הוזנו ${inserted} שורות`);
      onImported();
    } catch (e) {
      toast.error(String((e as Error).message));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="flex items-center gap-1">
      <button onClick={template} className="chrome-panel px-2 py-1 text-[11px]" type="button">📥 תבנית</button>
      <label className="chrome-panel cursor-pointer px-2 py-1 text-[11px]">
        {busy ? "…" : "📤 ייבוא Excel"}
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) importFile(f); }}
        />
      </label>
    </div>
  );
}
