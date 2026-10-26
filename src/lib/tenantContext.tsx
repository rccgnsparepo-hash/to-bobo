import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import {
  Tenant,
  getSavedTenants,
  getActiveTenantId,
  setActiveTenantId as persistActiveTenantId,
  fetchUserTenants,
  createTenantWorkspace,
  joinTenantByCode,
} from "./multitenant";
import { useAuth } from "./auth";
import { trigger3DToast } from "@/components/ui/Auth3DToast";
import { fireSparkleConfetti } from "./confetti";

type TenantContextType = {
  currentTenant: Tenant;
  tenants: Tenant[];
  isLoading: boolean;
  switchTenant: (tenantId: string) => void;
  createTenant: (data: { name: string; description?: string; accent_color?: string }) => Promise<Tenant>;
  joinTenant: (inviteCode: string) => Promise<Tenant | null>;
  refreshTenants: () => Promise<void>;
};

const TenantContext = createContext<TenantContextType | null>(null);

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [tenants, setTenants] = useState<Tenant[]>(getSavedTenants);
  const [activeId, setActiveId] = useState<string>(getActiveTenantId);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const refreshTenants = useCallback(async () => {
    setIsLoading(true);
    try {
      const list = await fetchUserTenants(user?.id);
      setTenants(list);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void refreshTenants();
  }, [refreshTenants]);

  // Sync when changed elsewhere
  useEffect(() => {
    const handleTenantChange = (e: Event) => {
      const detail = (e as CustomEvent<{ tenantId: string }>).detail;
      if (detail?.tenantId) {
        setActiveId(detail.tenantId);
      }
    };
    window.addEventListener("flick:tenant-changed", handleTenantChange);
    return () => window.removeEventListener("flick:tenant-changed", handleTenantChange);
  }, []);

  const currentTenant =
    tenants.find((t) => t.id === activeId) ||
    tenants[0] || {
      id: "tenant_public",
      name: "Public Flick Universe",
      slug: "public",
      description: "The global feed, public stories, wallpapers, games, and community chats.",
      accent_color: "#c5e863",
      owner_id: "system",
      tier: "community" as const,
      member_count: 14200,
      created_at: new Date().toISOString(),
    };

  const switchTenant = (tenantId: string) => {
    const target = tenants.find((t) => t.id === tenantId);
    if (!target) return;
    setActiveId(tenantId);
    persistActiveTenantId(tenantId);
    trigger3DToast({
      type: "info",
      title: `Switched to ${target.name}`,
      description: target.description,
      durationMs: 3000,
    });
  };

  const createTenant = async (data: {
    name: string;
    description?: string;
    accent_color?: string;
  }) => {
    const created = await createTenantWorkspace({
      ...data,
      ownerId: user?.id || "anon",
    });
    setTenants((prev) => [created, ...prev.filter((t) => t.id !== created.id)]);
    setActiveId(created.id);
    fireSparkleConfetti();
    trigger3DToast({
      type: "success",
      title: "Workspace Created! 🚀",
      description: `${created.name} is now live and ready for your team.`,
    });
    return created;
  };

  const joinTenant = async (inviteCode: string) => {
    const joined = await joinTenantByCode(inviteCode, user?.id || "anon");
    if (joined) {
      setTenants((prev) => {
        if (!prev.some((t) => t.id === joined.id)) {
          return [joined, ...prev];
        }
        return prev;
      });
      setActiveId(joined.id);
      fireSparkleConfetti();
      trigger3DToast({
        type: "success",
        title: "Joined Workspace! 🎉",
        description: `You are now a member of ${joined.name}.`,
      });
    }
    return joined;
  };

  return (
    <TenantContext.Provider
      value={{
        currentTenant,
        tenants,
        isLoading,
        switchTenant,
        createTenant,
        joinTenant,
        refreshTenants,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const ctx = useContext(TenantContext);
  if (!ctx) {
    throw new Error("useTenant must be used within TenantProvider");
  }
  return ctx;
}
