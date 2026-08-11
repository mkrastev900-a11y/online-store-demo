/* eslint-disable @next/next/no-img-element -- Existing behavior is intentional; warning-only patterns are retained to avoid release-risk refactors. */
import type { Metadata } from "next";
import Link from "next/link";

import styles from "./about.module.css";
import { contactMailto } from "@/lib/contact-config";
import { getPrimaryContactPhone, getSiteDesign } from "@/lib/site-design";
import { getLegalSettings } from "@/lib/legal-settings";
import { pageContent } from "@/lib/page-content";

export async function generateMetadata(): Promise<Metadata> {
  const design = await getSiteDesign();
  return {
    title: `За нас | ${design.brandName}`,
    description: `Научи повече за ${design.brandName}, начина ни на работа и обслужването на клиенти.`,
  };
}

type CompanyDetail = {
  label: string;
  value: string | undefined;
  href?: string;
};

export default async function AboutPage() {
  const [design, legal] = await Promise.all([getSiteDesign(), getLegalSettings()]);
  const editable = pageContent(design, "about");
  const brandName = design.brandName;
  const phone = getPrimaryContactPhone(design);
  const email = legal.contactEmail;
  const configured = (value: string | undefined) => value && value !== "Не е конфигуриран" ? value : undefined;
  const companyDetails: CompanyDetail[] = [
    { label: "Търговско наименование", value: brandName },
    { label: "Юридическо лице", value: configured(legal.companyName) },
    { label: "ЕИК / Булстат", value: configured(legal.companyId) },
    { label: "Адрес на управление", value: configured(legal.registeredAddress) },
    { label: "Телефон", value: configured(phone) },
    { label: "Имейл", value: email, href: contactMailto(email) },
  ].filter((detail) => Boolean(detail.value));

  return (
    <>
      <main className={styles.main}>
        <section className={styles.hero} data-about-hero data-image-hidden={editable.imageVisible ? "false" : "true"}>
          <div className={styles.heroContent}>
            <span className={styles.eyebrow}>{editable.eyebrow}</span>
            <h1>{editable.title}</h1>
            <p>{editable.description}</p>
            <div className={styles.heroActions}>
              <Link href={editable.buttonHref || "/new"} className={styles.primaryAction}>
                {editable.buttonText || "Разгледай новите предложения"}
              </Link>
              <Link href="/contact" className={styles.secondaryAction}>
                Свържи се с нас
              </Link>
            </div>
          </div>
          <div className={styles.heroMark} data-about-hero-mark style={{ display: editable.imageVisible ? "grid" : "none" }}>
            <img
              src={editable.imageUrl || undefined}
              alt="Изображение за страницата За нас"
              decoding="async"
              fetchPriority="high"
              className={styles.heroImage}
              data-about-hero-image
              style={{ display: editable.imageUrl ? "block" : "none" }}
            />
            <span className={styles.heroFallback} data-about-hero-fallback style={{ display: editable.imageUrl ? "none" : "grid" }}>
              <b>{brandName}</b>
              <small>{design.tagline}</small>
            </span>
          </div>
        </section>

        <section className={styles.story} aria-labelledby="about-story-title">
          <div className={styles.storyNumber}>01</div>
          <div className={styles.storyHeading}>
            <span>КОИ СМЕ НИЕ</span>
            <h2 id="about-story-title">
              Магазин, създаден около доброто обслужване
            </h2>
          </div>
          <div className={styles.storyCopy}>
            <p>
              {brandName} предлага подбрани продукти и ясен процес от избора до
              доставката. Стремим се информацията за всеки артикул да бъде
              точна, а пазаруването да е сигурно и предвидимо.
            </p>
            <p>
              Каталогът се организира по категории, размери и наличности, за да
              можеш лесно да сравняваш предложенията и да направиш информиран
              избор. При въпрос за продукт, плащане или доставка можеш да се
              свържеш с екипа през страницата за контакти.
            </p>
            <p>
              След направена поръчка статусът и данните за пратката остават
              достъпни в клиентския профил. При необходимост от връщане или
              рекламация обслужването продължава през същия защитен акаунт.
            </p>
            <p>
              Работим за последователно качество, прозрачни условия и коректна
              комуникация. Това са принципите, върху които се развива
              {` ${brandName}`}.
            </p>

            <div className={styles.experienceFacts}>
              <div>
                <strong>3</strong>
                <span>основни продуктови направления</span>
              </div>
              <div>
                <strong>14</strong>
                <span>дни право на връщане</span>
              </div>
              <div>
                <strong>1</strong>
                <span>единен профил за поръчки и обслужване</span>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.journey} aria-labelledby="journey-title">
          <div className={styles.journeyIntro}>
            <span>НАШИЯТ ПЪТ</span>
            <h2 id="journey-title">От избора до обслужването след покупка</h2>
            <p>
              Развиваме {brandName} с фокус върху точната информация, удобната
              поръчка и навременната комуникация.
            </p>
          </div>

          <div className={styles.journeyCards}>
            <article>
              <span>ДНЕС</span>
              <h3>Подреден каталог и ясни наличности</h3>
              <p>
                Всеки продукт има структурирани варианти, размери и информация
                за наличността, за да виждаш какво можеш да поръчаш в момента.
              </p>
            </article>
            <article>
              <span>СЛЕД ПОРЪЧКАТА</span>
              <h3>Проследяване и достъпна поддръжка</h3>
              <p>
                Профилът събира статуса на поръчката, пратката и разговорите с
                обслужването, така че важната информация да остава на едно място.
              </p>
            </article>
          </div>

          <blockquote>
            „Вярваме, че доверието на клиентите се печели с качество,
            коректност и професионално отношение.“
          </blockquote>
        </section>

        <section className={styles.values} aria-labelledby="values-title">
          <div className={styles.sectionHeading}>
            <span>02</span>
            <div>
              <p>КАК РАБОТИМ</p>
              <h2 id="values-title">Принципите зад всяко наше решение</h2>
            </div>
          </div>

          <div className={styles.valueGrid}>
            <article>
              <strong>01</strong>
              <h3>Професионален подбор</h3>
              <p>
                Оценяваме кройката, материята и изработката с погледа на хора,
                които познават процеса на създаване на облекло.
              </p>
            </article>
            <article>
              <strong>02</strong>
              <h3>Качество и достъпност</h3>
              <p>
                Търсим правилния баланс между надеждно качество, модерна визия
                и цена, достъпна за повече клиенти.
              </p>
            </article>
            <article>
              <strong>03</strong>
              <h3>Коректност и доверие</h3>
              <p>
                Даваме точна информация и заставаме открито зад продуктите,
                условията и поетите към клиента ангажименти.
              </p>
            </article>
            <article>
              <strong>04</strong>
              <h3>Лично отношение</h3>
              <p>
                Зад магазина стои екип, готов да помогне при
                въпрос за продукт, размер, доставка или връщане.
              </p>
            </article>
          </div>
        </section>

        <section className={styles.service} aria-labelledby="service-title">
          <div className={styles.serviceIntro}>
            <span>ОТ ИЗБОРА ДО ДОСТАВКАТА</span>
            <h2 id="service-title">До теб на всяка стъпка</h2>
            <p>
              Следиш поръчката от своя профил, а когато има товарителница,
              получаваш актуална информация от куриера директно в сайта.
            </p>
          </div>
          <ol>
            <li>
              <span>1</span>
              <div><strong>Избираш</strong><small>Продукти и точен размер</small></div>
            </li>
            <li>
              <span>2</span>
              <div><strong>Поръчваш</strong><small>С удобен куриер и плащане</small></div>
            </li>
            <li>
              <span>3</span>
              <div><strong>Проследяваш</strong><small>От профила си в реално време</small></div>
            </li>
            <li>
              <span>4</span>
              <div><strong>Получаваш</strong><small>До офис, автомат или адрес</small></div>
            </li>
          </ol>
        </section>

        <section className={styles.company} aria-labelledby="company-title">
          <div className={styles.companyIntro}>
            <span>03</span>
            <p>ПРОЗРАЧНОСТ И ДОВЕРИЕ</p>
            <h2 id="company-title">Фирмена информация</h2>
            <p className={styles.companyText}>
              Данните в този раздел се управляват от настройките на магазина,
              за да бъдат винаги точни и актуални.
            </p>
          </div>
          <dl className={styles.companyDetails}>
            {companyDetails.map((detail) => (
              <div key={detail.label}>
                <dt>{detail.label}</dt>
                <dd>{detail.href ? <a href={detail.href}>{detail.value}</a> : detail.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className={styles.contactCta}>
          <div>
            <span>ИМАШ ВЪПРОС?</span>
            <h2>Ще се радваме да помогнем.</h2>
          </div>
          <Link href="/contact">Към контакти <span>→</span></Link>
        </section>
      </main>
    </>
  );
}
