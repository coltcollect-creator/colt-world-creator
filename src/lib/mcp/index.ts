import { auth, defineMcp } from "@lovable.dev/mcp-js";
import getProfile from "./tools/get-profile";
import listInventory from "./tools/list-inventory";
import listOrders from "./tools/list-orders";
import listQuests from "./tools/list-quests";

// Direct Supabase auth issuer (see app-mcp-server-authoring).
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "colt-a-con-mcp",
  title: "COLT-A-CON",
  version: "0.1.0",
  instructions:
    "Tools for COLT-A-CON players. Each caller is an authenticated player; tools return only their own profile, inventory, orders, and quests.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [getProfile, listInventory, listOrders, listQuests],
});
