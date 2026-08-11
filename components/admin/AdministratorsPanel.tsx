"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./AdministratorsPanel.module.css";
import { ACTION_LABELS, ADMIN_SECTIONS } from "@/lib/admin-permission-catalog";

type ManagedUser = {
  id: number;
  name: string;
  email: string;
  role: "CUSTOMER" | "ADMIN" | "SUPER_ADMIN";
  isActive: boolean;
  createdAt: string | Date;
  createdByAdmin: { name: string; email: string } | null;
  isFixedSuperAdmin: boolean;
  permissions: string[];
};

export default function AdministratorsPanel({
  users = [],
  currentAdminId,
  canManage,
  canManageSuperAdmins,
}: {
  users?: ManagedUser[];
  currentAdminId: number;
  canManage: boolean;
  canManageSuperAdmins: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [roleBusyId, setRoleBusyId] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [permissionUser, setPermissionUser] = useState<ManagedUser | null>(null);
  const [permissionKeys, setPermissionKeys] = useState<string[]>([]);
  const [permissionBusy, setPermissionBusy] = useState(false);

  const safeUsers = useMemo(() => (Array.isArray(users) ? users : []), [users]);

  const customers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return safeUsers.filter((user) => {
      if (user.role !== "CUSTOMER") return false;
      if (!normalized) return true;
      return (user.name ?? "").toLowerCase().includes(normalized) || (user.email ?? "").toLowerCase().includes(normalized);
    });
  }, [query, safeUsers]);

  const administrators = useMemo(
    () => safeUsers.filter((user) => user.role === "ADMIN" || user.role === "SUPER_ADMIN"),
    [safeUsers],
  );


  function openPermissions(user: ManagedUser) {
    setPermissionUser(user);
    setPermissionKeys(Array.isArray(user.permissions) ? user.permissions : []);
    setError("");
    setSuccess("");
  }

  function togglePermission(key: string) {
    const [section, action] = key.split(":");
    setPermissionKeys((current) => {
      if (current.includes(key)) {
        if (action === "VIEW") return current.filter((item) => !item.startsWith(`${section}:`));
        return current.filter((item) => item !== key);
      }
      const additions = action === "VIEW" ? [key] : [key, `${section}:VIEW`];
      return [...new Set([...current, ...additions])];
    });
  }

  function toggleSection(section: string, actions: readonly string[]) {
    const keys = actions.map((action) => `${section}:${action}`);
    const allSelected = keys.every((key) => permissionKeys.includes(key));
    setPermissionKeys((current) => {
      if (allSelected) return current.filter((key) => !keys.includes(key));
      const additions = [...keys];
      return [...new Set([...current, ...additions])];
    });
  }

  async function savePermissions() {
    if (!permissionUser) return;
    setPermissionBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/administrators/${permissionUser.id}/permissions`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissions: permissionKeys }),
      });
      const data = await response.json();
      if (!response.ok) return setError(data.error ?? "Правата не бяха записани.");
      setSuccess(`Правата на ${permissionUser.name} са обновени успешно.`);
      setPermissionUser(null);
      router.refresh();
    } catch {
      setError("Няма връзка със сървъра.");
    } finally { setPermissionBusy(false); }
  }
  async function grantAccess(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!selectedUserId) {
      setError("Избери съществуващ потребител.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/admin/administrators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: Number(selectedUserId) }),
      });
      const data = await response.json();
      if (!response.ok) return setError(data.error ?? "Грешка.");

      setSelectedUserId("");
      setQuery("");
      setSuccess("Администраторските права са добавени успешно.");
      router.refresh();
    } catch {
      setError("Няма връзка със сървъра.");
    } finally {
      setLoading(false);
    }
  }

  async function changeAdminLevel(id: number, name: string, action: "promote" | "demote") {
    const verb = action === "promote" ? "повиша" : "понижа";
    const targetRole = action === "promote" ? "главен администратор" : "подадминистратор";
    if (!confirm(`Да ${verb} ли „${name}“ в ${targetRole}?`)) return;

    setError("");
    setSuccess("");
    setRoleBusyId(id);
    try {
      const response = await fetch(`/api/admin/administrators/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await response.json();
      if (!response.ok) return setError(data.error ?? "Ролята не беше променена.");

      setSuccess(action === "promote"
        ? "Подадминистраторът е повишен успешно в главен администратор."
        : "Главният администратор е понижен успешно в подадминистратор.");
      router.refresh();
    } catch {
      setError("Няма връзка със сървъра.");
    } finally {
      setRoleBusyId(null);
    }
  }

  async function deleteAccount(id: number, name: string, email: string) {
    if (!confirm(`Наистина ли да изтрия администраторския акаунт „${name}“ (${email})?\n\nАкаунтът ще бъде деактивиран, личните данни ще бъдат премахнати и повече няма да може да се влиза с него.`)) return;

    setError("");
    setSuccess("");
    setRoleBusyId(id);
    try {
      const response = await fetch(`/api/admin/administrators/${id}/account`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) return setError(data.error ?? "Акаунтът не беше изтрит.");
      setSuccess("Администраторският акаунт е изтрит и деактивиран.");
      router.refresh();
    } catch {
      setError("Няма връзка със сървъра.");
    } finally {
      setRoleBusyId(null);
    }
  }

  async function removeAccess(id: number, name: string) {
    if (!confirm(`Да премахна ли администраторските права на „${name}“? Акаунтът ще остане активен като клиентски.`)) return;

    setError("");
    setSuccess("");
    const response = await fetch(`/api/admin/administrators/${id}`, { method: "DELETE" });
    const data = await response.json();
    if (!response.ok) return setError(data.error ?? "Грешка.");

    setSuccess("Администраторските права са премахнати. Акаунтът остава активен като клиентски.");
    router.refresh();
  }

  return (
    <div className={styles.grid}>
      {canManage ? <section className={styles.card}>
        <span className={styles.eyebrow}>УПРАВЛЕНИЕ НА ДОСТЪПА</span>
        <h2>Добави права</h2>
        <p>
          Избери вече регистриран акаунт в магазина. Няма да се създава нов имейл или нова парола — ще се промени само ролята на потребителя.
        </p>

        <form onSubmit={grantAccess} className={styles.form}>
          <label>
            Търси потребител
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setSelectedUserId("");
              }}
              placeholder="Име или имейл"
            />
          </label>

          <label>
            Съществуващ акаунт
            <select value={selectedUserId} onChange={(event) => setSelectedUserId(event.target.value)} required>
              <option value="">Избери потребител</option>
              {customers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name} — {user.email}{user.isActive ? "" : " (неактивен)"}
                </option>
              ))}
            </select>
          </label>

          <div className={styles.searchResultCount}>
            Намерени клиентски акаунти: <strong>{customers.length}</strong>
          </div>

          {error && <div className={styles.error}>{error}</div>}
          {success && <div className={styles.success}>{success}</div>}
          <button disabled={loading || !selectedUserId}>
            {loading ? "Добавяне..." : "Дай администраторски права"}
          </button>
        </form>
      </section> : null}

      <section className={styles.listCard}>
        <div className={styles.listHeader}>
          <div><span className={styles.eyebrow}>ДОСТЪП ДО УПРАВЛЕНИЕТО</span><h2>Администратори</h2></div>
          <strong>{administrators.length}</strong>
        </div>

        <div className={styles.list}>
          {administrators.map((item) => (
            <article key={item.id} className={styles.row}>
              <div className={styles.avatar}>{(item.name || item.email || "A").charAt(0).toUpperCase()}</div>
              <div className={styles.identity}>
                <strong>{item.name}</strong>
                <span>{item.email}</span>
                <small>
                  {item.isFixedSuperAdmin
                      ? "Защитен системен главен администратор"
                      : item.role === "SUPER_ADMIN"
                      ? "Главен администратор"
                      : item.createdByAdmin
                        ? `Права дадени от ${item.createdByAdmin.name}`
                        : "Подадминистраторски акаунт"}
                </small>
                {item.role === "ADMIN" && <div className={styles.permissionSummary}>Активни права: {item.permissions?.length ?? 0}</div>}
              </div>
              <span className={item.isFixedSuperAdmin ? styles.fixedSuperRole : item.role === "SUPER_ADMIN" ? styles.superRole : styles.adminRole}>
                {item.isFixedSuperAdmin ? "🔒 Системен главен" : item.role === "SUPER_ADMIN" ? "Главен" : "Админ"}
              </span>
              <div className={styles.actions}>
                {item.isFixedSuperAdmin ? (
                  <span className={styles.protectedAdminNotice}>🔒 Защитен акаунт</span>
                ) : canManage && item.role === "ADMIN" && item.id !== currentAdminId ? (
                  <>
                    <button className={styles.permissionsButton} onClick={() => openPermissions(item)}>🔐 Права</button>
                    {canManageSuperAdmins ? <button
                      className={styles.promote}
                      disabled={roleBusyId === item.id}
                      onClick={() => changeAdminLevel(item.id, item.name, "promote")}
                    >
                      {roleBusyId === item.id ? "Обработка..." : "Повиши в главен"}
                    </button> : null}
                    <button className={styles.delete} onClick={() => removeAccess(item.id, item.name)}>
                      Премахни права
                    </button>
                  </>
                ) : canManageSuperAdmins && item.role === "SUPER_ADMIN" && item.id !== currentAdminId ? (
                  <>
                    <button
                      className={styles.demote}
                      disabled={roleBusyId === item.id}
                      onClick={() => changeAdminLevel(item.id, item.name, "demote")}
                    >
                      {roleBusyId === item.id ? "Обработка..." : "Понижи в подадмин"}
                    </button>
                    <button
                      className={styles.delete}
                      disabled={roleBusyId === item.id}
                      onClick={() => deleteAccount(item.id, item.name, item.email)}
                    >
                      {roleBusyId === item.id ? "Обработка..." : "Изтрий акаунта"}
                    </button>
                  </>
                ) : (
                  <span className={styles.protected}>{item.id === currentAdminId ? "Текущ акаунт" : "Само преглед"}</span>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>

      {permissionUser && (
        <div className={styles.modalBackdrop} onMouseDown={(event) => { if (event.target === event.currentTarget) setPermissionUser(null); }}>
          <section className={styles.modal} role="dialog" aria-modal="true" aria-label="Права на подадминистратор">
            <div className={styles.modalHeader}>
              <div><span className={styles.eyebrow}>ИНДИВИДУАЛЕН ДОСТЪП</span><h2>Права на {permissionUser.name}</h2><p>{permissionUser.email}</p></div>
              <button onClick={() => setPermissionUser(null)} aria-label="Затвори">×</button>
            </div>
            <div className={styles.permissionGrid}>
              {ADMIN_SECTIONS.map((section) => {
                const sectionKeys = section.actions.map((action) => `${section.key}:${action}`);
                const allSelected = sectionKeys.every((key) => permissionKeys.includes(key));
                return (
                  <div className={styles.permissionGroup} key={section.key}>
                    <div className={styles.permissionGroupHeader}>
                      <strong>{section.label}</strong>
                      <label><input type="checkbox" checked={allSelected} onChange={() => toggleSection(section.key, section.actions)} /> Всички</label>
                    </div>
                    <div className={styles.permissionActions}>
                      {section.actions.map((action) => { const key = `${section.key}:${action}`; return (
                        <label key={key}><input type="checkbox" checked={permissionKeys.includes(key)} onChange={() => togglePermission(key)} /> {ACTION_LABELS[action] ?? action}</label>
                      ); })}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.secondaryButton} onClick={() => setPermissionKeys([])}>Изчисти всички</button>
              <button className={styles.secondaryButton} onClick={() => setPermissionUser(null)}>Отказ</button>
              <button className={styles.savePermissions} disabled={permissionBusy} onClick={savePermissions}>{permissionBusy ? "Записване..." : "Запази правата"}</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
