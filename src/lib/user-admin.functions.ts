import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type CreateInput = {
  email: string;
  password: string;
  username: string;
  role: "player" | "owner";
};

export const adminCreateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: CreateInput) => {
    if (!data?.email || !data?.password || !data?.username) throw new Error("missing fields");
    if (data.password.length < 6) throw new Error("password must be at least 6 characters");
    if (!["player", "owner"].includes(data.role)) throw new Error("invalid role");
    return data;
  })
  .handler(async ({ data, context }) => {
    // Verify caller is owner (RLS-scoped via context.supabase — cannot be spoofed)
    const { data: isOwner, error: roleErr } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "owner",
    });
    if (roleErr) throw new Error(roleErr.message);
    if (!isOwner) throw new Error("Forbidden: owner role required");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Create the auth user (email pre-confirmed so they can sign in immediately)
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { username: data.username },
    });
    if (createErr || !created?.user) throw new Error(createErr?.message ?? "failed to create user");
    const newUserId = created.user.id;

    // The handle_new_user trigger already inserted a profile + default 'player' role.
    // If owner is requested, upgrade the role.
    if (data.role === "owner") {
      // remove default player role, add owner
      await supabaseAdmin.from("user_roles").delete().eq("user_id", newUserId).eq("role", "player");
      const { error: rErr } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: newUserId, role: "owner" });
      if (rErr) throw new Error(rErr.message);
    }

    return { ok: true, user_id: newUserId };
  });

export const adminSetUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { user_id: string; role: "player" | "owner" }) => {
    if (!data?.user_id) throw new Error("user_id required");
    if (!["player", "owner"].includes(data.role)) throw new Error("invalid role");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { data: isOwner } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "owner",
    });
    if (!isOwner) throw new Error("Forbidden: owner role required");
    if (data.user_id === context.userId && data.role !== "owner") {
      throw new Error("Cannot demote yourself");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Replace all roles with the chosen one
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id);
    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: data.user_id, role: data.role });
    if (error) throw new Error(error.message);

    if (data.role === "owner") {
      await supabaseAdmin.from("admins").upsert({
        id: data.user_id,
        user_id: data.user_id,
        role: "owner",
        updated_at: new Date().toISOString(),
      });
    } else {
      await supabaseAdmin.from("admins").delete().eq("user_id", data.user_id);
    }
    return { ok: true };
  });

export const adminDeleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { user_id: string }) => {
    if (!data?.user_id) throw new Error("user_id required");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { data: isOwner } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "owner",
    });
    if (!isOwner) throw new Error("Forbidden: owner role required");
    if (data.user_id === context.userId) throw new Error("Cannot delete yourself");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Best-effort cleanup of public rows before removing the auth user
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id);
    await supabaseAdmin.from("admins").delete().eq("user_id", data.user_id);
    await supabaseAdmin.from("profiles").delete().eq("id", data.user_id);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
