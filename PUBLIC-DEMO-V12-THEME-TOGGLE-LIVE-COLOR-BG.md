# V12 — Theme toggle live color fix

## Поправка

Бутонът за светъл/тъмен режим вече не използва твърдо записан винен фон (`#4a0015` / `#570019`).

Фонът на track-а и hover състоянието вече се изчисляват от текущия `--header-utility-bg`, с fallback към `--brand-primary`.

Това означава, че при промяна на основния цвят във Visual Editor бутонът следва live палитрата на горната лента без нужда от refresh или отделна настройка.

## Обхват

- storefront header
- Visual Editor preview
- desktop/tablet/mobile, когато се използва същият ThemeToggle компонент

Не е променена логиката на dark/light режима.
