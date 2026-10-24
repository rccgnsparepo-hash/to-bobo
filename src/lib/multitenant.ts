import { supabase } from "@/integrations/supabase/client";

export type TenantRole = "owner" | "admin" | "member";

export type Tenant = {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon_url?: string | null;
  accent_color: string;
  is_default?: boolean;
  owner_id: string;
  tier: "community" | "pro" | "enterprise";
  member_count: number;
  invite_code?: string;
  created_at: string;
};

export type TenantMember = {
  tenant_id: string;
  user_id: string;
  role: TenantRole;
  joined_at: string;
};

const DEFAULT_TENANTS: Tenant[] = [
  {
    id: "tenant_public",
    name: "Public Flick Universe",
    slug: "public",
    description: "The global feed, public stories, comics, and community chats.",
    accent_color: "#c5e863",
    is_default: true,
    owner_id: "system",
    tier: "community",
    member_count: 14200,
    invite_code: "FLICK-GLOBAL",
    created_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "tenant_creators",
    name: "Creator Collective",
    slug: "creators",
    description: "Exclusive creator space for collaborations, analytics, and private drops.",
    accent_color: "#a855f7",
    is_default: false,
    owner_id: "system",
    tier: "pro",
    member_count: 840,
    invite_code: "CREATORS-2026",
    created_at: "2026-02-15T00:00:00Z",
  },
  {
    id: "tenant_studios",
    name: "Faratech Studios",
    slug: "faratech",
    description: "Multi-tenant dev and production sandbox for cutting-edge builds.",
    accent_color: "#38bdf8",
    is_default: false,
    owner_id: "system",
    tier: "enterprise",
    member_count: 120,
    invite_code: "STUDIOS-DEV",
    created_at: "2026-03-01T00:00:00Z",
  },
];

const TENANTS_STORAGE_KEY = "flick:multi_tenants_store";
const ACTIVE_TENANT_KEY = "flick:active_tenant_id";

/**
 * Gets all saved tenants from local database cache + default workspaces
 */
export function getSavedTenants(): Tenant[] {
  try {
    const raw = localStorage.getItem(TENANTS_STORAGE_KEY);
    if (!raw) return DEFAULT_TENANTS;
    const parsed = JSON.parse(raw) as Tenant[];
    // Ensure all default tenants exist
    const map = new Map<string, Tenant>();
    DEFAULT_TENANTS.forEach((t) => map.set(t.id, t));
    parsed.forEach((t) => map.set(t.id, t));
    return Array.from(map.values());
  } catch {
    return DEFAULT_TENANTS;
  }
}

/**
 * Persists the tenant list
 */
function saveTenants(tenants: Tenant[]) {
  try {
    localStorage.setItem(TENANTS_STORAGE_KEY, JSON.stringify(tenants));
  } catch {}
}

/**
 * Gets currently active tenant id
 */
export function getActiveTenantId(): string {
  try {
    const active = localStorage.getItem(ACTIVE_TENANT_KEY);
    if (active) return active;
  } catch {}
  return "tenant_public";
}

/**
 * Sets currently active tenant and dispatches broadcast
 */
export function setActiveTenantId(tenantId: string) {
  try {
    localStorage.setItem(ACTIVE_TENANT_KEY, tenantId);
    window.dispatchEvent(
      new CustomEvent("flick:tenant-changed", { detail: { tenantId } })
    );
  } catch {}
}

/**
 * Fetch tenant records with database sync
 */
export async function fetchUserTenants(userId?: string): Promise<Tenant[]> {
  const currentTenants = getSavedTenants();

  // Try checking Supabase tenants table if provisioned
  try {
    const { data, error } = await supabase
      .from("tenants" as unknown as "profiles")
      .select("*");
    if (!error && data && Array.isArray(data) && data.length > 0) {
      const merged = [...currentTenants];
      (data as unknown as Tenant[]).forEach((dbTenant) => {
        if (!merged.some((t) => t.id === dbTenant.id)) {
          merged.push(dbTenant);
        }
      });
      saveTenants(merged);
      return merged;
    }
  } catch {
    // Falls back gracefully to multi-tenant store
  }

  return currentTenants;
}

/**
 * Creates a new tenant workspace
 */
export async function createTenantWorkspace(params: {
  name: string;
  slug?: string;
  description?: string;
  accent_color?: string;
  ownerId: string;
  tier?: "community" | "pro" | "enterprise";
}): Promise<Tenant> {
  const slug = (params.slug || params.name.toLowerCase().replace(/[^a-z0-9]/g, "-")).slice(0, 24);
  const newTenant: Tenant = {
    id: `tenant_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: params.name.trim(),
    slug: slug.startsWith("-") ? slug.slice(1) : slug,
    description: params.description || `Dedicated workspace for ${params.name}`,
    accent_color: params.accent_color || "#c5e863",
    owner_id: params.ownerId,
    tier: params.tier || "pro",
    member_count: 1,
    invite_code: `INV-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
    created_at: new Date().toISOString(),
  };

  const existing = getSavedTenants();
  const updated = [newTenant, ...existing];
  saveTenants(updated);

  // Attempt database persistence in Supabase
  try {
    await supabase.from("tenants" as unknown as "profiles").insert({
      id: newTenant.id,
      name: newTenant.name,
      slug: newTenant.slug,
      description: newTenant.description,
      owner_id: newTenant.owner_id,
      created_at: newTenant.created_at,
    } as unknown as Record<string, unknown>);
  } catch {
    // Handled by local persistence
  }

  setActiveTenantId(newTenant.id);
  return newTenant;
}

/**
 * Join an existing tenant by invite code
 */
export async function joinTenantByCode(inviteCode: string, userId: string): Promise<Tenant | null> {
  const code = inviteCode.trim().toUpperCase();
  const all = getSavedTenants();
  const found = all.find(
    (t) => t.invite_code?.toUpperCase() === code || t.slug.toUpperCase() === code
  );

  if (!found) {
    throw new Error(`No workspace found matching invite code "${inviteCode}".`);
  }

  // Update member count
  found.member_count += 1;
  saveTenants(all);
  setActiveTenantId(found.id);
  return found;
}
