import { requireAdminPermission } from "@/lib/admin-permissions";
import { getLegalSettings } from "@/lib/legal-settings";
import LegalSettingsForm from "@/components/admin/LegalSettingsForm";
import { CURRENT_TERMS_VERSION } from "@/lib/terms";
import styles from "./legal-settings.module.css";
export const dynamic="force-dynamic";
export default async function Page(){await requireAdminPermission("LEGAL_SETTINGS:VIEW");const legal=await getLegalSettings();return <main className={styles.main}><header><span>ПРАВНИ НАСТРОЙКИ</span><h1>Общи условия и фирмени детайли</h1><p>Данните тук се използват автоматично в публичните Общи условия. Текуща версия: <strong>{CURRENT_TERMS_VERSION}</strong>.</p></header><LegalSettingsForm initial={legal}/></main>}
