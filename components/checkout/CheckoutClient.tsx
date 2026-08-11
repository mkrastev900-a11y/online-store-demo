/* eslint-disable @next/next/no-html-link-for-pages -- Existing behavior is intentional; warning-only patterns are retained to avoid release-risk refactors. */
"use client";

import Image from "next/image";
import { FormEvent, useEffect, useState } from "react";
import { announceCartUpdate, EMPTY_CART_SUMMARY } from "@/lib/cart-events";
import ContactEmailLink from "@/components/ContactEmailLink";
import { trackMarketingEvent } from "@/components/MarketingPixelManager";
import { digitsOnly, phoneCharactersOnly } from "@/lib/numeric-fields";
import styles from "./CheckoutClient.module.css";

type Item = { id: number; quantity: number; name: string; size: string; price: number; imageUrl: string; lineTotal: number };
type Cart = { items: Item[]; totalItems: number; subtotal: number };
type Profile = { name?: string; phone?: string | null; address?: string | null; addressLine2?: string | null; city?: string | null; postalCode?: string | null; country?: string | null };
type Provider = "ECONT" | "SPEEDY";
type Office = { provider: Provider; id: string; code?: string; name: string; address: string; city: string; postalCode: string; type: "OFFICE" | "LOCKER"; cardPaymentAllowed?: boolean };
type ShippingConfig = {
  providers: Record<Provider, { configured: boolean; demo: boolean; label: string }>;
  cardPaymentEnabled: boolean;
  fallbackEnabled: boolean;
  freeThreshold: number;
};
type Quote = { customerCost: number; amount: number; source: "LIVE" | "DEMO" | "FALLBACK"; warning?: string; expectedDeliveryDate?: string };
type RemovedItem = { id: number; name: string; size: string; quantity: number; availableStock: number };
type CartAdjustment = { removedItems: RemovedItem[]; reservationMinutes: number };
type AppliedPromo = { code: string; regularDiscountPercent: number; saleDiscountPercent: number; discount: number; discountedSubtotal: number };

const money = (value: number) => new Intl.NumberFormat("bg-BG", { style: "currency", currency: "EUR" }).format(value);
const providerName = (provider: Provider) => provider === "ECONT" ? "Еконт" : "Спиди";

function CourierLogo({ provider, compact = false }: { provider: Provider; compact?: boolean }) {
  const econt = provider === "ECONT";

  return <div className={`${styles.courierLogo}${compact ? ` ${styles.courierLogoCompact}` : ""}`}>
    <Image
      className={styles.courierLogoImage}
      src={econt ? "/couriers/econt-logo.svg" : "/couriers/speedy-logo.svg"}
      alt=""
      width={econt ? 116 : 124}
      height={econt ? 26 : 40}
      unoptimized
    />
  </div>;
}

export default function CheckoutClient() {
  const [cart, setCart] = useState<Cart | null>(null);
  const [config, setConfig] = useState<ShippingConfig | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [officeQuery, setOfficeQuery] = useState("");
  const [offices, setOffices] = useState<Office[]>([]);
  const [officeBusy, setOfficeBusy] = useState(false);
  const [officeError, setOfficeError] = useState("");
  const [selectedOffice, setSelectedOffice] = useState<Office | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteBusy, setQuoteBusy] = useState(false);
  const [cartAdjustment, setCartAdjustment] = useState<CartAdjustment | null>(null);
  const [damageConsentOpen, setDamageConsentOpen] = useState(false);
  const [damageConsentChecked, setDamageConsentChecked] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<AppliedPromo | null>(null);
  const [promoBusy, setPromoBusy] = useState(false);
  const [promoMessage, setPromoMessage] = useState("");
  const [form, setForm] = useState({
    customerName: "", customerPhone: "", address: "", addressLine2: "", city: "", postalCode: "", country: "Bulgaria",
    courierProvider: "ECONT" as Provider, deliveryMethod: "ADDRESS" as "ADDRESS" | "OFFICE",
    officeId: "", paymentMethod: "CASH_ON_DELIVERY" as "CASH_ON_DELIVERY" | "CARD", notes: "",
  });

  useEffect(() => {
    Promise.all([fetch("/api/cart", { cache: "no-store" }), fetch("/api/profile", { cache: "no-store" }), fetch("/api/shipping/config", { cache: "no-store" })])
      .then(async ([cartResponse, profileResponse, configResponse]) => {
        if ([cartResponse, profileResponse, configResponse].some((response) => response.status === 401)) { location.href = "/login?next=/checkout"; return; }
        const cartData = await cartResponse.json();
        if (!cartResponse.ok) { setError(cartData.error || "Количката не можа да се зареди."); return; }
        setCart(cartData);
        trackMarketingEvent({ event: "initiateCheckout", value: Number(cartData.subtotal) || 0, currency: "EUR", quantity: Number(cartData.totalItems) || 0, contentIds: (cartData.items || []).map((item: Item) => item.id) });
        if (configResponse.ok) setConfig(await configResponse.json());
        if (profileResponse.ok) {
          const profile = await profileResponse.json() as Profile;
          setForm((current) => ({ ...current, customerName: profile.name || "", customerPhone: profile.phone || "", address: profile.address || "", addressLine2: profile.addressLine2 || "", city: profile.city || "", postalCode: profile.postalCode || "", country: profile.country || "Bulgaria" }));
        }
        setProfileLoaded(true);
      })
      .catch(() => setError("Данните за поръчката не можаха да се заредят."));
  }, []);

  const quotePayload = JSON.stringify({ ...form, promoCode: appliedPromo?.code || "" });
  const quoteReady = form.deliveryMethod === "OFFICE" ? Boolean(form.officeId) : Boolean(form.address.trim() && form.city.trim() && form.postalCode.trim());

  useEffect(() => {
    if (!cart || !profileLoaded) return;
    if (!quoteReady) return;
    const timeout = window.setTimeout(async () => {
      setQuoteBusy(true);
      const response = await fetch("/api/shipping/quote", { method: "POST", headers: { "Content-Type": "application/json" }, body: quotePayload });
      const data = await response.json().catch(() => ({}));
      if (response.ok) setQuote(data.shipping);
      else { setQuote(null); setError(data.error || "Доставката не можа да бъде изчислена."); }
      setQuoteBusy(false);
    }, 650);
    return () => window.clearTimeout(timeout);
  }, [cart, profileLoaded, quotePayload, quoteReady]);

  async function searchOffices() {
    if (officeQuery.trim().length < 2) { setOfficeError("Въведи поне 2 знака от град, квартал или офис."); return; }
    setOfficeBusy(true); setOfficeError(""); setOffices([]);
    const params = new URLSearchParams({ provider: form.courierProvider, q: officeQuery.trim(), city: form.city.trim() });
    const response = await fetch(`/api/shipping/offices?${params}`, { cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (response.ok) { setOffices(data.offices || []); if (!data.offices?.length) setOfficeError("Няма намерени офиси. Опитай само с името на града."); }
    else setOfficeError(data.error || "Офисите не можаха да се заредят.");
    setOfficeBusy(false);
  }

  function selectProvider(provider: Provider) {
    setForm((current) => ({ ...current, courierProvider: provider, officeId: "" }));
    setSelectedOffice(null); setOffices([]); setOfficeError(""); setQuote(null);
  }

  function selectDeliveryMethod(method: "ADDRESS" | "OFFICE") {
    setForm((current) => ({ ...current, deliveryMethod: method, officeId: method === "OFFICE" ? current.officeId : "" }));
    if (method === "ADDRESS") setSelectedOffice(null);
    setQuote(null);
  }

  function chooseOffice(office: Office) {
    setSelectedOffice(office);
    setForm((current) => ({ ...current, officeId: office.id, address: office.address, city: office.city || current.city, postalCode: office.postalCode || current.postalCode }));
    setOffices([]); setOfficeQuery(office.name); setQuote(null);
  }

  async function placeOrder() {
    setBusy(true); setError("");
    const response = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, promoCode: appliedPromo?.code || "", shipmentDamageInstructionsAccepted: true }),
    });
    const data = await response.json().catch(() => ({}));
    setBusy(false);
    if (response.status === 409 && data.code === "CART_ITEMS_REMOVED" && data.cart) {
      setCart(data.cart);
      announceCartUpdate(data.cart);
      setQuote(null);
      setCartAdjustment({ removedItems: data.removedItems || [], reservationMinutes: Number(data.reservationMinutes) || 15 });
      setAppliedPromo(null);
      setPromoMessage(promoCode.trim() ? "Количката се промени. Приложи промокода отново." : "");
      return;
    }
    if (!response.ok) { setError(data.error || "Поръчката не беше създадена."); return; }
    announceCartUpdate(EMPTY_CART_SUMMARY);
    location.href = data.paymentUrl || `/order-success?order=${data.orderId}`;
  }


  async function applyPromoCode() {
    const code = promoCode.trim();
    if (!code) { setAppliedPromo(null); setPromoMessage("Въведи промокод."); return; }
    setPromoBusy(true); setPromoMessage("");
    const response = await fetch("/api/promo-codes/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const data = await response.json().catch(() => ({}));
    setPromoBusy(false);
    if (!response.ok) { setAppliedPromo(null); setPromoMessage(data.error || "Промокодът е невалиден."); return; }
    setPromoCode(data.promo.code);
    setAppliedPromo({
      code: data.promo.code,
      regularDiscountPercent: Number(data.promo.regularDiscountPercent),
      saleDiscountPercent: Number(data.promo.saleDiscountPercent),
      discount: Number(data.discount),
      discountedSubtotal: Number(data.discountedSubtotal),
    });
    setPromoMessage(`Промокод ${data.promo.code} е приложен.`);
    setQuote(null);
  }

  function removePromoCode() {
    setAppliedPromo(null);
    setPromoCode("");
    setPromoMessage("");
    setQuote(null);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setDamageConsentChecked(false);
    setDamageConsentOpen(true);
  }

  function confirmDamageInstructions() {
    if (!damageConsentChecked || busy) return;
    setDamageConsentOpen(false);
    void placeOrder();
  }

  function confirmRemainingItems() {
    setCartAdjustment(null);
    void placeOrder();
  }

  if (error && !cart) return <div className={styles.notice}>{error}</div>;
  if (!cart || !profileLoaded || !config) return <div className={styles.notice}>Зареждане...</div>;
  if (!cart.items.length) return <div className={styles.notice}>Количката е празна.</div>;
  const discountedSubtotal = appliedPromo?.discountedSubtotal ?? cart.subtotal;
  const estimatedShipping = discountedSubtotal >= config.freeThreshold ? 0 : Number(process.env.NEXT_PUBLIC_SHIPPING_FALLBACK_PRICE_EUR || 7);
  const shipping = quote?.customerCost ?? estimatedShipping;

  return <form className={styles.layout} onSubmit={submit}>
    <section className={styles.form}>
      <div className={styles.sectionHeading}><div><h2>Контакт</h2><p>Ще използваме тези данни единствено за поръчката и доставката.</p></div><a href="/account">Редактирай профила</a></div>
      <div className={styles.grid}>
        <label>Име и фамилия<input required autoComplete="name" value={form.customerName} onChange={(event) => setForm({ ...form, customerName: event.target.value })} /></label>
        <label>Телефон<input required type="tel" inputMode="tel" pattern="[+]?[0-9]+" autoComplete="tel" value={form.customerPhone} onChange={(event) => setForm({ ...form, customerPhone: phoneCharactersOnly(event.target.value) })} /></label>
      </div>

      <div className={styles.stepTitle}><span>1</span><div><h2>Избери куриер</h2><p>Еконт или Спиди — ти решаваш.</p></div></div>
      <div className={styles.couriers}>
        {(["ECONT", "SPEEDY"] as const).map((provider) => <button type="button" key={provider} className={form.courierProvider === provider ? styles.selectedCourier : ""} onClick={() => selectProvider(provider)}>
          <CourierLogo provider={provider} />
          <span><strong>{providerName(provider)}</strong><small>{config.providers[provider].demo ? "Тестов режим — без реални пратки" : config.providers[provider].configured ? "Свързан с куриерската система" : config.fallbackEnabled ? "Резервна тарифа до свързване" : "Очаква API настройка"}</small></span>
          <b>{form.courierProvider === provider ? "✓" : ""}</b>
        </button>)}
      </div>

      {config.providers[form.courierProvider].demo && <div className={styles.demoNotice}><strong>ТЕСТОВ РЕЖИМ: {providerName(form.courierProvider)}</strong><span>Офисите, цените и товарителниците не са реални и няма да бъде заявен куриер.</span></div>}

      <div className={styles.stepTitle}><span>2</span><div><h2>Начин на доставка</h2><p>До удобен офис или направо до адрес.</p></div></div>
      <div className={styles.options}>
        <label className={form.deliveryMethod === "OFFICE" ? styles.selectedOption : ""}><input type="radio" checked={form.deliveryMethod === "OFFICE"} onChange={() => selectDeliveryMethod("OFFICE")} /><span><strong>До офис / автомат</strong><small>Избери точен обект на {providerName(form.courierProvider)}</small></span></label>
        <label className={form.deliveryMethod === "ADDRESS" ? styles.selectedOption : ""}><input type="radio" checked={form.deliveryMethod === "ADDRESS"} onChange={() => selectDeliveryMethod("ADDRESS")} /><span><strong>До твоя адрес</strong><small>Куриерът ще достави до посочения адрес</small></span></label>
      </div>

      {form.deliveryMethod === "OFFICE" ? <div className={styles.officePicker}>
        <label>Град<input value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value, officeId: "" })} placeholder="напр. София" /></label>
        <div className={styles.officeSearch}><label>Офис, квартал или адрес<input value={officeQuery} onChange={(event) => { setOfficeQuery(event.target.value); setSelectedOffice(null); setForm({ ...form, officeId: "" }); }} placeholder={`Търси офис на ${providerName(form.courierProvider)}`} /></label><button type="button" onClick={searchOffices} disabled={officeBusy}>{officeBusy ? "Търсене..." : "Намери офис"}</button></div>
        {officeError && <p className={styles.inlineError}>{officeError}</p>}
        {offices.length > 0 && <div className={styles.officeResults}>{offices.map((office) => <button type="button" key={office.id} onClick={() => chooseOffice(office)}><span><strong>{office.name}</strong><small>{office.address}</small></span><b>{office.type === "LOCKER" ? "Автомат" : "Офис"}</b></button>)}</div>}
        {selectedOffice && <div className={styles.selectedOffice}><span>✓</span><div><strong>{selectedOffice.name}</strong><small>{selectedOffice.address}</small>{selectedOffice.cardPaymentAllowed === false && <small>Този офис може да не приема плащане с карта на място.</small>}</div></div>}
      </div> : <div className={styles.grid}>
        <label className={styles.full}>Адрес<input required autoComplete="street-address" value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} placeholder="Улица и номер" /></label>
        <label className={styles.full}>Допълнение<input value={form.addressLine2} onChange={(event) => setForm({ ...form, addressLine2: event.target.value })} placeholder="Вход, етаж, апартамент — по желание" /></label>
        <label>Град<input required autoComplete="address-level2" value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} /></label>
        <label>Пощенски код<input required inputMode="numeric" pattern="[0-9]*" autoComplete="postal-code" value={form.postalCode} onChange={(event) => setForm({ ...form, postalCode: digitsOnly(event.target.value) })} /></label>
      </div>}

      <div className={styles.stepTitle}><span>3</span><div><h2>Плащане</h2><p>Банковият превод е премахнат.</p></div></div>
      <div className={styles.options}>
        <label className={form.paymentMethod === "CASH_ON_DELIVERY" ? styles.selectedOption : ""}><input type="radio" checked={form.paymentMethod === "CASH_ON_DELIVERY"} onChange={() => setForm({ ...form, paymentMethod: "CASH_ON_DELIVERY" })} /><span><strong>Плащане при получаване</strong><small>Пощенски паричен превод — в брой или с карта, когато избраният офис го поддържа</small></span></label>
        {config.cardPaymentEnabled && <label className={form.paymentMethod === "CARD" ? styles.selectedOption : ""}><input type="radio" checked={form.paymentMethod === "CARD"} onChange={() => setForm({ ...form, paymentMethod: "CARD" })} /><span><strong>Онлайн с карта</strong><small>Защитено плащане през ePay.bg</small></span></label>}
      </div>
      {!config.cardPaymentEnabled && <div className={styles.cardSoon}><span>Карта</span><p><strong>Онлайн плащането е подготвено.</strong><small>Ще се активира автоматично след добавяне на ePay MIN и секрет в настройките.</small></p></div>}
      <label className={styles.notes}>Бележка към поръчката<textarea rows={4} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>
    </section>

    <aside className={styles.summary}>
      <h2>Твоята поръчка</h2>
      {cart.items.map((item) => <div className={styles.item} key={item.id}><Image src={item.imageUrl} alt="" width={64} height={78} sizes="64px" /><div><strong>{item.name}</strong><small>Размер: {item.size} · {item.quantity} бр.</small></div><b>{money(item.lineTotal)}</b></div>)}
      <div className={styles.promoBox}>
        <label htmlFor="checkout-promo">Промокод</label>
        <div className={styles.promoRow}><input id="checkout-promo" value={promoCode} onChange={(event) => { setPromoCode(event.target.value.toUpperCase()); if (appliedPromo) setAppliedPromo(null); }} placeholder="Въведи код" maxLength={60} /><button type="button" onClick={applyPromoCode} disabled={promoBusy}>{promoBusy ? "Проверка..." : "Приложи"}</button></div>
        {promoMessage && <small className={appliedPromo ? styles.promoSuccess : styles.promoInfo}>{promoMessage}</small>}
        {appliedPromo && <div className={styles.promoApplied}><span><strong>{appliedPromo.code}</strong><small>Редовни -{appliedPromo.regularDiscountPercent}% · Намалени -{appliedPromo.saleDiscountPercent}%</small></span><button type="button" onClick={removePromoCode}>Премахни</button></div>}
      </div>
      <div className={styles.deliverySummary}><CourierLogo provider={form.courierProvider} compact /><span><strong>{providerName(form.courierProvider)} · {form.deliveryMethod === "OFFICE" ? "до офис" : "до адрес"}</strong><small>{selectedOffice?.name || (quoteBusy ? "Изчисляваме цената..." : quote?.source === "LIVE" ? "Цена от куриерската система" : quote?.source === "DEMO" ? "Тестова цена — не е реална пратка" : "Предварителна цена")}</small></span></div>
      <div className={styles.totals}><p><span>Междинна сума</span><b>{money(cart.subtotal)}</b></p>{appliedPromo && <p className={styles.discountLine}><span>Промокод {appliedPromo.code}</span><b>-{money(appliedPromo.discount)}</b></p>}<p><span>Доставка</span><b>{quoteBusy ? "..." : shipping === 0 ? "Безплатна" : money(shipping)}</b></p><p className={styles.grand}><span>Общо</span><b>{money(discountedSubtotal + shipping)}</b></p></div>
      {quote?.warning && <div className={styles.quoteWarning}>Използвана е резервна цена. Крайната куриерска цена ще се провери при обработката.</div>}
      {error && <div className={styles.error}>{error}</div>}
      <button disabled={busy || quoteBusy || (form.deliveryMethod === "OFFICE" && !form.officeId)}>{busy ? "Създаване..." : form.paymentMethod === "CARD" ? "Продължи към плащане" : "Потвърди поръчката"}</button>
      <small className={styles.terms}>С потвърждаването приемаш условията за доставка и връщане.</small>
    </aside>

    {damageConsentOpen && <div className={styles.reservationModal} role="alertdialog" aria-modal="true" aria-labelledby="damage-consent-title" aria-describedby="damage-consent-description">
      <button type="button" className={styles.modalBackdrop} aria-label="Затвори" onClick={() => setDamageConsentOpen(false)} />
      <section className={`${styles.modalCard} ${styles.damageConsentCard}`}>
        <div className={styles.modalIcon}>!</div>
        <span className={styles.modalEyebrow}>ВАЖНО ПРИ ПОЛУЧАВАНЕ</span>
        <h2 id="damage-consent-title">Провери пратката преди да я отвориш</h2>
        <div id="damage-consent-description" className={styles.damageInstructions}>
          <p>Ако при получаване видиш, че пликът, пакетът, кашонът или защитната опаковка са скъсани, смачкани, мокри, пробити, разлепени или по друг начин нарушени, <strong>не бързай да отваряш пратката</strong>.</p>
          <ol>
            <li>Снимай цялата пратка и всички видими повреди по опаковката.</li>
            <li>Снимай ясно товарителницата и номера ѝ.</li>
            <li>След това отвори страницата <a href="/contact" target="_blank" rel="noreferrer">„Контакти“</a> и прикачи снимките с кратко описание на случая. За помощ при рекламация можеш да пишеш и на <ContactEmailLink purpose="support" />.</li>
          </ol>
          <p>Тези снимки ще помогнат при проверка и евентуална рекламация към куриера или магазина. Инструкцията не ограничава законовите ти права като потребител.</p>
        </div>
        <label className={styles.damageConsentCheck}>
          <input type="checkbox" checked={damageConsentChecked} onChange={(event) => setDamageConsentChecked(event.target.checked)} />
          <span>Прочетох и разбрах какво трябва да направя при видимо нарушена пратка.</span>
        </label>
        <div className={styles.modalActions}>
          <button type="button" className={styles.modalSecondary} onClick={() => setDamageConsentOpen(false)}>Назад към поръчката</button>
          <button type="button" className={styles.modalPrimary} disabled={!damageConsentChecked || busy} onClick={confirmDamageInstructions}>{busy ? "Създаване..." : form.paymentMethod === "CARD" ? "Приеми и продължи към плащане" : "Приеми и потвърди поръчката"}</button>
        </div>
      </section>
    </div>}

    {cartAdjustment && <div className={styles.reservationModal} role="alertdialog" aria-modal="true" aria-labelledby="reservation-modal-title" aria-describedby="reservation-modal-description">
      <button type="button" className={styles.modalBackdrop} aria-label="Затвори" onClick={() => setCartAdjustment(null)} />
      <section className={styles.modalCard}>
        <div className={styles.modalIcon}>!</div>
        <span className={styles.modalEyebrow}>ОБНОВЕНА КОЛИЧКА</span>
        <h2 id="reservation-modal-title">Някои артикули вече са разпродадени</h2>
        <p id="reservation-modal-description">15-минутната резервация беше изтекла. Опитахме да я подновим автоматично, но премахнахме продуктите без достатъчна наличност.</p>
        <ul className={styles.removedItems}>
          {cartAdjustment.removedItems.map((item) => <li key={item.id}><span><strong>{item.name}</strong><small>Размер {item.size} · поискани {item.quantity} бр.</small></span><b>{item.availableStock > 0 ? `Останали ${item.availableStock} бр.` : "Разпродаден"}</b></li>)}
        </ul>
        {cart.items.length > 0 ? <>
          <p className={styles.reservedAgain}>Останалите {cart.totalItems} артикула са резервирани отново за {cartAdjustment.reservationMinutes} минути.</p>
          <div className={styles.modalActions}>
            <button type="button" className={styles.modalSecondary} onClick={() => setCartAdjustment(null)}>Прегледай промените</button>
            <button type="button" className={styles.modalPrimary} disabled={busy} onClick={confirmRemainingItems}>{busy ? "Потвърждаване..." : "Потвърди останалите"}</button>
          </div>
        </> : <div className={styles.modalActions}><a className={styles.modalPrimary} href="/women">Към продуктите</a></div>}
      </section>
    </div>}
  </form>;
}
