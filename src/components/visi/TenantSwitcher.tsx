import { useTenant } from "@/contexts/TenantContext";
import { Building2 } from "lucide-react";

/**
 * Tenant switcher — platform staff only.
 * Regular members are pinned to their own tenant by RLS, so this renders nothing for them.
 */
export const TenantSwitcher = () => {
  const { tenants, activeTenantId, setActiveTenantId, isPlatformAdmin, loading } = useTenant();

  if (loading || !isPlatformAdmin || tenants.length === 0) return null;

  return (
    <div className="px-5 py-4">
      <div className="t-mono mb-3 flex items-center gap-1.5" style={{ fontSize: 10, color: "var(--text-muted)" }}>
        <Building2 size={11} strokeWidth={1.5} />
        PLATFORM · TENANT
      </div>
      <select
        value={activeTenantId ?? ""}
        onChange={(e) => setActiveTenantId(e.target.value)}
        className="input-glass w-full"
        style={{ fontSize: 12, padding: "6px 10px" }}
      >
        {tenants.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name} · {t.plan}
          </option>
        ))}
      </select>
    </div>
  );
};
