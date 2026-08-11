import type { Metadata } from "next";

import ContactForm from "@/components/contact/ContactForm";
import ContactEmailLink from "@/components/ContactEmailLink";

import styles from "./contact.module.css";
import { getContactContentValue, getPrimaryContactPhone, getSiteDesign } from "@/lib/site-design";
import { pageContent } from "@/lib/page-content";

export async function generateMetadata(): Promise<Metadata> {
  const design = await getSiteDesign();
  return {
    title: `Контакти | ${design.brandName}`,
    description: `Свържи се с ${design.brandName} за въпрос относно продукт, поръчка, доставка или връщане.`,
  };
}

function telephoneHref(phone: string) {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

export default async function ContactPage() {
  const design = await getSiteDesign();
  const editable = pageContent(design, "contact");
  const primaryPhone = getPrimaryContactPhone(design);
  const secondaryPhone = getContactContentValue(design, "secondaryPhone");
  const workingHours = getContactContentValue(design, "workingHours");
  const contactAddress = getContactContentValue(design, "address");
  const emailContacts = [
    {
      title: "Общи въпроси",
      description: "За общи въпроси относно магазина и услугите:",
      purpose: "office" as const,
    },
    {
      title: "Поръчки",
      description: "За въпроси относно вече направена поръчка, доставка или проследяване на пратката:",
      purpose: "orders" as const,
    },
    {
      title: "Помощ и рекламации",
      description: "При проблем с продукт, връщане, рекламация или възстановяване на сума:",
      purpose: "support" as const,
    },
  ];

  return (
    <>
      <main className={styles.main}>
        <section className={styles.hero}>
          <span className={styles.eyebrow}>{editable.eyebrow}</span>
          <h1>{editable.title}</h1>
          <p>{editable.description}</p>
        </section>

        <section className={styles.formSection} aria-labelledby="contact-form-title">
          <div className={styles.sectionHeading}>
            <span>01</span>
            <div>
              <h2 id="contact-form-title">{getContactContentValue(design, "formTitle")}</h2>
              <p>{getContactContentValue(design, "formDescription")}</p>
            </div>
          </div>
          <ContactForm />
        </section>

        <section className={styles.infoSection} aria-labelledby="contact-info-title">
          <div className={styles.sectionHeading}>
            <span>02</span>
            <div>
              <h2 id="contact-info-title">{getContactContentValue(design, "infoTitle")}</h2>
              <p>{getContactContentValue(design, "infoDescription")}</p>
            </div>
          </div>

          <div className={styles.infoGrid}>
            <article className={styles.infoCard}>
              <span className={styles.cardIcon} aria-hidden="true">
                ☎
              </span>
              <h3>{getContactContentValue(design, "phoneTitle")}</h3>
              {primaryPhone ? <a href={telephoneHref(primaryPhone)}>{primaryPhone}</a> : null}
              {secondaryPhone ? (
                <a href={telephoneHref(secondaryPhone)}>{secondaryPhone}</a>
              ) : null}
              <p>{getContactContentValue(design, "phoneDescription")}</p>
            </article>

            <article className={styles.infoCard}>
              <span className={styles.cardIcon} aria-hidden="true">
                ✉
              </span>
              <h3>{getContactContentValue(design, "emailTitle")}</h3>
              <div className={styles.emailList}>
                {emailContacts.map((contact) => (
                  <div key={contact.purpose}>
                    <strong>{contact.title}</strong>
                    <p>{contact.description}</p>
                    <ContactEmailLink purpose={contact.purpose} />
                  </div>
                ))}
              </div>
              <p>{getContactContentValue(design, "emailDescription")}</p>
            </article>

            <article className={styles.infoCard}>
              <span className={styles.cardIcon} aria-hidden="true">
                ◷
              </span>
              <h3>{getContactContentValue(design, "hoursTitle")}</h3>
              <strong>{workingHours}</strong>
              <p>{getContactContentValue(design, "hoursDescription")}</p>
            </article>

            <article className={styles.infoCard}>
              <span className={styles.cardIcon} aria-hidden="true">
                ◇
              </span>
              <h3>{getContactContentValue(design, "addressTitle")}</h3>
              <strong>{contactAddress}</strong>
              <p>{getContactContentValue(design, "addressDescription")}</p>
            </article>
          </div>
        </section>

        <section className={styles.quickInfo} aria-label="Полезна информация">
          <article>
            <span>{getContactContentValue(design, "quick1Eyebrow")}</span>
            <h3>{getContactContentValue(design, "quick1Title")}</h3>
            <p>{getContactContentValue(design, "quick1Text")}</p>
          </article>
          <article>
            <span>{getContactContentValue(design, "quick2Eyebrow")}</span>
            <h3>{getContactContentValue(design, "quick2Title")}</h3>
            <p>{getContactContentValue(design, "quick2Text")}</p>
          </article>
          <article>
            <span>{getContactContentValue(design, "quick3Eyebrow")}</span>
            <h3>{getContactContentValue(design, "quick3Title")}</h3>
            <p>{getContactContentValue(design, "quick3Text")}</p>
          </article>
        </section>
      </main>
    </>
  );
}
