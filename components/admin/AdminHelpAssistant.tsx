"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ADMIN_GLOSSARY,
  ADMIN_HELP_SECTIONS,
  getAdminHelpSectionForPath,
  getVisibleAdminHelpSections,
  searchAdminGlossary,
  searchAdminHelp,
  type AdminHelpControl,
  type AdminHelpSection,
} from "@/lib/admin-help-content";
import styles from "./AdminHelpAssistant.module.css";

type Props = {
  isSuperAdmin: boolean;
  permissions?: string[];
  isDesignOwner?: boolean;
  mode?: "floating" | "page";
};

const controlKindLabels: Record<AdminHelpControl["kind"], string> = {
  button: "Бутон",
  field: "Поле",
  select: "Падащо меню",
  checkbox: "Отметка",
  radio: "Единичен избор",
  filter: "Филтър",
  status: "Статус",
  table: "Таблица",
  link: "Линк",
  navigation: "Навигация",
  modal: "Диалог",
  display: "Информация",
};

function GuideArticle({ section }: { section: AdminHelpSection }) {
  return (
    <article className={styles.article}>
      <span className={styles.eyebrow}>ПЪЛНО ОБУЧЕНИЕ</span>
      <h3>{section.title}</h3>
      <p className={styles.lead}>{section.purpose}</p>

      <section className={styles.beginner}>
        <strong>Ако си тук за първи път</strong>
        <p>{section.beginner}</p>
      </section>

      <details className={styles.accordion} open>
        <summary>Какво представлява страницата?</summary>
        <div className={styles.accordionBody}>
          <p>{section.summary}</p>
          <h4>За какво се използва?</h4>
          <p>{section.purpose}</p>
        </div>
      </details>

      <details className={styles.accordion}>
        <summary>Кога да я използваш и кога да не я използваш</summary>
        <div className={styles.splitGuidance}>
          <section>
            <h4>Използвай страницата</h4>
            <ul>{section.whenToUse.map((item) => <li key={item}>{item}</li>)}</ul>
          </section>
          <section className={styles.dangerSection}>
            <h4>Не я използвай</h4>
            <ul>{section.whenNotToUse.map((item) => <li key={item}>{item}</li>)}</ul>
          </section>
        </div>
      </details>

      <details className={styles.accordion}>
        <summary>Какво виждаш на екрана?</summary>
        <div className={styles.accordionBody}><ul>{section.screen.map((item) => <li key={item}>{item}</li>)}</ul></div>
      </details>

      <details className={styles.accordion} open>
        <summary>Всеки бутон, поле и контрол ({section.controls.length})</summary>
        <div className={styles.controlsList}>
          {section.controls.map((item) => (
            <details className={styles.controlDetail} key={item.id}>
              <summary>
                <span>{controlKindLabels[item.kind]}</span>
                <strong>{item.name}</strong>
              </summary>
              <div className={styles.controlBody}>
                <section><h5>Какво прави?</h5><p>{item.purpose}</p></section>
                <section><h5>Кога се използва?</h5><p>{item.when}</p></section>
                <section>
                  <h5>Как се използва?</h5>
                  <ol>{item.how.map((step) => <li key={step}>{step}</li>)}</ol>
                </section>
                {item.format ? <section><h5>Формат</h5><p>{item.format}</p></section> : null}
                {item.example ? <section className={styles.example}><h5>Пример</h5><p>{item.example}</p></section> : null}
                <section><h5>Какво става след това?</h5><p>{item.after}</p></section>
                <section><h5>Какво вижда клиентът?</h5><p>{item.customerImpact}</p></section>
                <section><h5>Как разбираш, че е успешно?</h5><p>{item.success}</p></section>
                {item.errors.length ? <section><h5>Възможни грешки</h5><ul>{item.errors.map((error) => <li key={error}>{error}</li>)}</ul></section> : null}
                {item.avoid.length ? <section className={styles.warning}><h5>Не прави това</h5><ul>{item.avoid.map((warning) => <li key={warning}>{warning}</li>)}</ul></section> : null}
              </div>
            </details>
          ))}
        </div>
      </details>

      {section.statuses.length ? (
        <details className={styles.accordion}>
          <summary>Статуси и какво означават ({section.statuses.length})</summary>
          <div className={styles.statusList}>
            {section.statuses.map((item) => (
              <article key={`${item.name}-${item.meaning}`}>
                <h4>{item.name}</h4>
                <p>{item.meaning}</p>
                <div><strong>Следваща стъпка:</strong> {item.next}</div>
                {item.warning ? <div className={styles.inlineWarning}><strong>Важно:</strong> {item.warning}</div> : null}
              </article>
            ))}
          </div>
        </details>
      ) : null}

      {section.workflows.length ? (
        <details className={styles.accordion} open>
          <summary>Практически примери „Как да...“ ({section.workflows.length})</summary>
          <div className={styles.workflowList}>
            {section.workflows.map((item) => (
              <article key={item.id}>
                <h4>{item.title}</h4>
                <p className={styles.workflowGoal}><strong>Цел:</strong> {item.goal}</p>
                <ol>{item.steps.map((step) => <li key={step}>{step}</li>)}</ol>
                <p className={styles.result}><strong>Краен резултат:</strong> {item.result}</p>
                {item.warning ? <div className={styles.inlineWarning}><strong>Важно:</strong> {item.warning}</div> : null}
              </article>
            ))}
          </div>
        </details>
      ) : null}

      {section.errors.length ? (
        <details className={styles.accordion}>
          <summary>Грешки: какво означават и какво да направиш</summary>
          <div className={styles.errorList}>
            {section.errors.map((item) => (
              <article key={item.message}>
                <h4>{item.message}</h4>
                <p><strong>Означава:</strong> {item.meaning}</p>
                <p><strong>Направи:</strong> {item.action}</p>
              </article>
            ))}
          </div>
        </details>
      ) : null}

      {section.mistakes.length ? (
        <details className={styles.accordion}>
          <summary>Често срещани грешки на служителите</summary>
          <div className={`${styles.accordionBody} ${styles.warning}`}><ul>{section.mistakes.map((item) => <li key={item}>{item}</li>)}</ul></div>
        </details>
      ) : null}

      <details className={styles.accordion} open>
        <summary>Checklist преди да приключиш</summary>
        <div className={styles.checklist}>
          {section.checklist.map((item) => <label key={item}><input type="checkbox" /> <span>{item}</span></label>)}
        </div>
      </details>

      {section.tips.length ? (
        <section className={styles.tips}>
          <strong>Практични съвети</strong>
          {section.tips.map((tip) => <p key={tip}>{tip}</p>)}
        </section>
      ) : null}
    </article>
  );
}

export default function AdminHelpAssistant(props: Props) {
  const pathname = usePathname();
  const { isSuperAdmin, permissions, isDesignOwner, mode } = props;
  const isPage = mode === "page";
  const visibleSections = useMemo(
    () => getVisibleAdminHelpSections(ADMIN_HELP_SECTIONS, { isSuperAdmin, permissions, isDesignOwner }),
    [isSuperAdmin, permissions, isDesignOwner],
  );
  const contextual = getAdminHelpSectionForPath(pathname);
  const contextualVisible = contextual && visibleSections.some((item) => item.id === contextual.id)
    ? visibleSections.find((item) => item.id === contextual.id)
    : visibleSections[0];

  const [open, setOpen] = useState(isPage);
  const [selection, setSelection] = useState<{ pathname: string; id: string } | null>(null);
  const [search, setSearch] = useState<{ pathname: string; value: string } | null>(null);
  const [tabSelection, setTabSelection] = useState<{ pathname: string; value: "guide" | "glossary" } | null>(null);

  const selectedId = selection?.pathname === pathname ? selection.id : contextualVisible?.id ?? "";
  const query = search?.pathname === pathname ? search.value : "";
  const tab = tabSelection?.pathname === pathname ? tabSelection.value : "guide";
  const setSelectedId = (id: string) => setSelection({ pathname, id });
  const setQuery = (value: string) => setSearch({ pathname, value });
  const setTab = (value: "guide" | "glossary") => setTabSelection({ pathname, value });

  useEffect(() => {
    if (isPage) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [isPage]);

  const selected = visibleSections.find((section) => section.id === selectedId) ?? contextualVisible;
  const sectionResults = query.trim() ? searchAdminHelp(query, visibleSections) : [];
  const glossaryResults = searchAdminGlossary(query, ADMIN_GLOSSARY);

  const panel = (
    <section className={`${styles.panel} ${isPage ? styles.pagePanel : ""}`} aria-label="Административен помощник">
      {!isPage ? (
        <button type="button" className={styles.floatingClose} onClick={() => setOpen(false)} aria-label="Затвори помощника">×</button>
      ) : null}

      <div className={styles.panelScroller} data-help-scroll-container>
        <div className={styles.controlsBlock}>
          <header className={styles.header}>
            <span>ОБУЧЕНИЕ ЗА АДМИНИСТРАТОРИ</span>
            <h2>Помощник</h2>
          </header>

          <div className={styles.contextBox}>
            <div>
              <span>ТЕКУЩА СТРАНИЦА</span>
              <strong>{contextualVisible?.shortTitle ?? "Администрация"}</strong>
            </div>
            <p>{contextualVisible?.summary ?? "Избери тема от ръководството."}</p>
          </div>

          <div className={styles.tabs} role="tablist" aria-label="Вид на помощното съдържание">
            <button type="button" role="tab" aria-selected={tab === "guide"} className={tab === "guide" ? styles.tabActive : ""} onClick={() => setTab("guide")}>Ръководство</button>
            <button type="button" role="tab" aria-selected={tab === "glossary"} className={tab === "glossary" ? styles.tabActive : ""} onClick={() => setTab("glossary")}>Тълковен речник</button>
          </div>

          <div className={`${styles.tools} ${tab === "glossary" ? styles.toolsSingle : ""}`}>
            <label className={styles.search}>
              <span>Търсене</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={tab === "guide" ? "Как да върна пари, размер, запази..." : "Термин или българско значение..."} />
            </label>

            {tab === "guide" ? (
              <label className={styles.selector}>
                <span>Смени темата</span>
                <select value={selected?.id ?? ""} onChange={(event) => { setSelectedId(event.target.value); setQuery(""); }}>
                  {visibleSections.map((section) => <option key={section.id} value={section.id}>{section.shortTitle}</option>)}
                </select>
              </label>
            ) : null}
          </div>
        </div>

        {tab === "guide" ? (
          query.trim() ? (
            <div className={styles.results}>
              <span>{sectionResults.length} намерени теми</span>
              {sectionResults.map((result) => (
                <article key={result.topicId}>
                  <h3>{result.title}</h3>
                  <p>{result.context}</p>
                  <button type="button" onClick={() => { setSelectedId(result.topicId); setQuery(""); }}>Отвори темата</button>
                </article>
              ))}
              {sectionResults.length === 0 ? <p className={styles.empty}>Няма намерена инструкция. Опитай с по-кратка дума или с името на бутона.</p> : null}
            </div>
          ) : selected ? <GuideArticle section={selected} /> : null
        ) : (
          <div className={styles.glossary}>
            <div className={styles.glossaryIntro}>
              <strong>Термини на прост език</strong>
              <p>Всеки термин съдържа пълно име, българско значение, обяснение, място в онлайн магазина и пример.</p>
            </div>
            {glossaryResults.map((entry) => (
              <article key={entry.term}>
                <h3>{entry.term}</h3>
                <p className={styles.glossaryFull}>{entry.fullName} · {entry.bulgarian}</p>
                {entry.aliases?.length ? <small>{entry.aliases.join(" · ")}</small> : null}
                <p>{entry.meaning}</p>
                <div><strong>Къде се среща:</strong> {entry.inStore}</div>
                <div className={styles.glossaryExample}><strong>Пример:</strong> {entry.example}</div>
              </article>
            ))}
            {glossaryResults.length === 0 ? <p className={styles.empty}>Няма намерен термин. Опитай с част от думата или български синоним.</p> : null}
          </div>
        )}

        {!isPage ? (
          <footer className={styles.footer}>
            <Link href="/admin/help" onClick={() => setOpen(false)}>Отвори пълното ръководство</Link>
          </footer>
        ) : null}
      </div>
    </section>
  );

  if (isPage) return <div className={styles.pageWrap}>{panel}</div>;
  if (pathname === "/admin/help") return null;

  return (
    <>
      <button type="button" className={styles.floatingButton} onClick={() => setOpen(true)} aria-label="Отвори административния помощник" aria-expanded={open}>
        <span>?</span><strong>Помощник</strong>
      </button>
      <button type="button" aria-label="Затвори помощника" onClick={() => setOpen(false)} className={`${styles.backdrop} ${open ? styles.backdropOpen : ""}`} />
      <div className={`${styles.drawer} ${open ? styles.drawerOpen : ""}`} aria-hidden={!open} inert={!open}>
        {panel}
      </div>
    </>
  );
}
