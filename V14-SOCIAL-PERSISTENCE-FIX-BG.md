# V14 — Social settings persistence fix

Причината за зануляването на Facebook / Instagram / TikTok настройките не беше 30-минутният demo cleanup.

Visual Editor / theme Apply / Publish / Rollback можеше да запише стар snapshot, в който social URL полетата и enabled token-ите са празни. Така вече записаните Social Networks настройки се презаписваха.

Поправки:
- Social URL полетата вече не се редактират от generic Site Design PUT route.
- designTokensJson запазва social.facebook.enabled / social.instagram.enabled / social.tiktok.enabled при Visual Editor save.
- Apply / Publish / Rollback на тема пазят текущите Facebook / Instagram / TikTok URL-и и enabled flags от SiteDesignSettings.
- 30-minute demo cleanup продължава да не докосва SiteDesignSettings.
- Добавен е regression test tests/social-settings-theme-protection.test.ts.
