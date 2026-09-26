import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Public server fn: look up the auth email that corresponds to a username
export const emailForUsername = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ username: z.string().min(1).max(64) }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("username", data.username)
      .maybeSingle();

    if (!profile) return { email: null as string | null };
    return { email: profile.email || `${profile.username}@colt.market` };
  });
