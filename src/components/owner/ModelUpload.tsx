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

/** Upload for 3D model files (GLB / GLTF) used inside 3D maps. */
export function ModelUpload({ value, onChange, folder = "models", label }: Props) {
  const [uploading, setUploading] = useState(false);

  const upload = async (file: File) => {
    const name = file.name.toLowerCase();
    if (!name.endsWith(".glb") && !name.endsWith(".gltf")) {
      toast.error("יש להעלות קובץ תלת-מימד מסוג GLB או GLTF");
      return;
    }
    if (file.size > 25 * 1024 * 1024) { toast.error("קובץ גדול מדי (מקסימום 25MB)"); return; }
    setUploading(true);
    const ext = name.endsWith(".gltf") ? "gltf" : "glb";
    const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from("assets").upload(path, file, {
      upsert: false,
      contentType: ext === "glb" ? "model/gltf-binary" : "model/gltf+json",
    });
    if (error) { toast.error(error.message); setUploading(false); return; }
    const { data: signed } = await supabase.storage.from("assets").createSignedUrl(path, TEN_YEARS);
    setUploading(false);
    if (signed?.signedUrl) { onChange(signed.signedUrl); toast.success("קובץ התלת-מימד הועלה"); }
    else toast.error("שגיאה בהפקת קישור");
  };

  return (
    <div className="space-y-1">
      {label && <div className="text-xs font-semibold">{label}</div>}
      <div className="flex items-center gap-2">
        <div className="grid h-10 w-10 place-items-center rounded-lg border-2 border-dashed border-border text-base">
          {value ? "🧊" : "—"}
        </div>
        <label className="chrome-panel cursor-pointer px-3 py-1 text-xs">
          {uploading ? "מעלה…" : value ? "החלף קובץ" : "העלה GLB / GLTF"}
          <input
            type="file"
            accept=".glb,.gltf,model/gltf-binary,model/gltf+json"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.currentTarget.value = ""; }}
          />
        </label>
        {value && <button type="button" onClick={() => onChange(null)} className="text-xs text-destructive underline">הסר</button>}
      </div>
      <input
        type="text"
        placeholder="או הדבק קישור לקובץ .glb"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className="w-full rounded-xl border-2 border-border bg-input px-3 py-1 text-xs"
      />
    </div>
  );
}
