import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Props = {
  value?: string | null;
  onChange: (url: string | null) => void;
  folder?: string;
  label?: string;
};

const TEN_YEARS = 60 * 60 * 24 * 365 * 10;

export function ImageUpload({ value, onChange, folder = "misc", label }: Props) {
  const [uploading, setUploading] = useState(false);

  const upload = async (file: File) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("קובץ גדול מדי (מקסימום 5MB)"); return; }
    setUploading(true);
    const ext = file.name.split(".").pop() ?? "png";
    const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from("assets").upload(path, file, { upsert: false, contentType: file.type });
    if (error) { toast.error(error.message); setUploading(false); return; }
    const { data: signed } = await supabase.storage.from("assets").createSignedUrl(path, TEN_YEARS);
    setUploading(false);
    if (signed?.signedUrl) { onChange(signed.signedUrl); toast.success("הועלה"); }
    else toast.error("שגיאה בהפקת קישור");
  };

  return (
    <div className="space-y-1">
      {label && <div className="text-xs font-semibold">{label}</div>}
      <div className="flex items-center gap-2">
        {value ? (
          <img src={value} alt="" className="h-14 w-14 rounded-lg border-2 border-border bg-white/60 object-contain" />
        ) : (
          <div className="grid h-14 w-14 place-items-center rounded-lg border-2 border-dashed border-border text-xs text-muted-foreground">—</div>
        )}
        <label className="chrome-panel cursor-pointer px-3 py-1 text-xs">
          {uploading ? "מעלה…" : value ? "החלף" : "העלה"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.currentTarget.value = ""; }}
          />
        </label>
        {value && (
          <button type="button" onClick={() => onChange(null)} className="text-xs text-destructive underline">הסר</button>
        )}
      </div>
      <input
        type="text"
        placeholder="או הדבק URL"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className="w-full rounded-xl border-2 border-border bg-input px-3 py-1 text-xs"
      />
    </div>
  );
}
