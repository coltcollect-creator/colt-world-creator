import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Image, UploadCloud, X, CheckCircle2 } from "lucide-react";

type Props = {
  value?: string | null;
  onChange: (url: string | null) => void;
  folder?: string;
  label?: string;
};

const TEN_YEARS = 60 * 60 * 24 * 365 * 10;

async function compressImageFile(file: File, maxDim = 800, quality = 0.82): Promise<{ dataUrl: string; blob: Blob }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;
        if (width > maxDim || height > maxDim) {
          const ratio = Math.min(maxDim / width, maxDim / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          const raw = (e.target?.result as string) || "";
          resolve({ dataUrl: raw, blob: file });
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        canvas.toBlob(
          (blob) => {
            resolve({ dataUrl, blob: blob || file });
          },
          "image/jpeg",
          quality
        );
      };
      img.onerror = () => reject(new Error("שגיאה בטעינת קובץ תמונה"));
      img.src = (e.target?.result as string) || "";
    };
    reader.onerror = () => reject(new Error("שגיאה בקריאת הקובץ"));
    reader.readAsDataURL(file);
  });
}

export function ImageUpload({ value, onChange, folder = "misc", label }: Props) {
  const [uploading, setUploading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  const upload = async (file: File) => {
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      toast.error("קובץ גדול מדי (מקסימום 15MB)");
      return;
    }
    setUploading(true);
    setFileName(file.name);
    try {
      const { dataUrl, blob } = await compressImageFile(file);
      const ext = "jpg";
      const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from("assets").upload(path, blob, {
        upsert: false,
        contentType: "image/jpeg",
      });
      if (error) {
        toast.error(error.message);
        setUploading(false);
        return;
      }
      const { data: signed } = await supabase.storage.from("assets").createSignedUrl(path, TEN_YEARS);
      setUploading(false);
      const finalUrl = signed?.signedUrl || dataUrl;
      if (finalUrl) {
        onChange(finalUrl);
        toast.success("תמונה הועלתה בהצלחה");
      } else {
        toast.error("שגיאה בהפקת קישור");
      }
    } catch (e: any) {
      setUploading(false);
      toast.error(e?.message || "שגיאה בעיבוד התמונה");
    }
  };

  const isDataOrLongUrl = value && (value.startsWith("data:") || value.length > 80);

  return (
    <div className="space-y-1.5 text-start">
      {label && <div className="text-xs font-semibold text-foreground">{label}</div>}
      
      <div className="flex flex-wrap items-center gap-2">
        {value ? (
          <div className="relative group">
            <img
              src={value}
              alt=""
              className="h-14 w-14 rounded-xl border-2 border-primary/30 bg-white/70 object-contain shadow-sm"
            />
            <button
              type="button"
              onClick={() => {
                onChange(null);
                setFileName(null);
              }}
              className="absolute -top-1.5 -end-1.5 grid h-5 w-5 place-items-center rounded-full bg-destructive text-white shadow hover:scale-110 transition-transform"
              title="הסר תמונה"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <div className="grid h-14 w-14 place-items-center rounded-xl border-2 border-dashed border-border text-xs text-muted-foreground bg-muted/40">
            <Image className="h-5 w-5 opacity-50" />
          </div>
        )}

        <label className="btn-plastic cursor-pointer flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold shadow-sm hover:brightness-105 active:scale-95 transition-all">
          <UploadCloud className="h-3.5 w-3.5" />
          {uploading ? "מעלה…" : value ? "החלף קובץ" : "העלה תמונה"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f);
              e.currentTarget.value = "";
            }}
          />
        </label>

        {value && isDataOrLongUrl && (
          <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1.5 rounded-xl border border-emerald-500/20">
            <CheckCircle2 className="h-4 w-4" />
            {fileName || "קובץ תמונה נטען בהצלחה"}
          </span>
        )}
      </div>

      {/* Clean URL input only if user wants to enter custom short URL */}
      {!value && (
        <input
          type="text"
          placeholder="או הדבק קישור חיצוני לתמונה (URL)"
          value=""
          onChange={(e) => {
            if (e.target.value) onChange(e.target.value);
          }}
          className="w-full rounded-xl border-2 border-border bg-input px-3 py-1.5 text-xs outline-none focus:border-primary"
        />
      )}
    </div>
  );
}
