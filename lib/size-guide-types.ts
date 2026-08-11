export type SizeGuideMeasurementPreset = { marker: string; label: string };
export type SizeGuideTypeOption = {
  value: string;
  label: string;
  group: string;
  icon: string;
  measurements: SizeGuideMeasurementPreset[];
};

const top = [
  { marker: "A", label: "Рамене" },
  { marker: "B", label: "Гръдна ширина" },
  { marker: "C", label: "Дължина" },
  { marker: "D", label: "Ръкав" },
];
const fittedTop = [
  { marker: "A", label: "Бюст" },
  { marker: "B", label: "Талия" },
  { marker: "C", label: "Дължина" },
  { marker: "D", label: "Ръкав" },
];
const outerwear = [
  { marker: "A", label: "Рамене" },
  { marker: "B", label: "Гръдна ширина" },
  { marker: "C", label: "Дължина" },
  { marker: "D", label: "Ръкав" },
  { marker: "E", label: "Ширина долу" },
];
const pants = [
  { marker: "A", label: "Талия" },
  { marker: "B", label: "Ханш" },
  { marker: "C", label: "Вътрешен шев" },
  { marker: "D", label: "Външна дължина" },
  { marker: "E", label: "Ширина на крачола" },
  { marker: "F", label: "Височина на талията" },
];
const skirt = [
  { marker: "A", label: "Талия" },
  { marker: "B", label: "Ханш" },
  { marker: "C", label: "Обща дължина" },
  { marker: "D", label: "Ширина долу" },
];
const dress = [
  { marker: "A", label: "Бюст" },
  { marker: "B", label: "Талия" },
  { marker: "C", label: "Ханш" },
  { marker: "D", label: "Рамене" },
  { marker: "E", label: "Обща дължина" },
  { marker: "F", label: "Ръкав" },
];
const underwearTop = [
  { marker: "A", label: "Подгръдна обиколка" },
  { marker: "B", label: "Гръдна обиколка" },
  { marker: "C", label: "Височина на чашката" },
];
const underwearBottom = [
  { marker: "A", label: "Талия" },
  { marker: "B", label: "Ханш" },
  { marker: "C", label: "Височина отпред" },
];
const shoes = [
  { marker: "A", label: "Дължина на стъпалото" },
  { marker: "B", label: "Ширина на стъпалото" },
  { marker: "C", label: "Обиколка на свода" },
];
const boots = [
  ...shoes,
  { marker: "D", label: "Височина на ботуша" },
  { marker: "E", label: "Обиколка на прасеца" },
];
const hat = [
  { marker: "A", label: "Обиколка на главата" },
  { marker: "B", label: "Височина" },
];
const belt = [
  { marker: "A", label: "Дължина до средната дупка" },
  { marker: "B", label: "Обща дължина" },
  { marker: "C", label: "Ширина" },
];
const gloves = [
  { marker: "A", label: "Обиколка на дланта" },
  { marker: "B", label: "Дължина на дланта" },
  { marker: "C", label: "Дължина на средния пръст" },
];
const bag = [
  { marker: "A", label: "Ширина" },
  { marker: "B", label: "Височина" },
  { marker: "C", label: "Дълбочина" },
  { marker: "D", label: "Дължина на дръжката" },
];
const jewelry = [
  { marker: "A", label: "Обиколка" },
  { marker: "B", label: "Диаметър" },
  { marker: "C", label: "Дължина" },
];
const baby = [
  { marker: "A", label: "Ръст на детето" },
  { marker: "B", label: "Гръдна обиколка" },
  { marker: "C", label: "Талия" },
  { marker: "D", label: "Дължина" },
];
const ensemble = [
  { marker: "A", label: "Горнище · Рамене" },
  { marker: "B", label: "Горнище · Гръдна ширина" },
  { marker: "C", label: "Горнище · Дължина" },
  { marker: "D", label: "Горнище · Ръкав" },
  { marker: "E", label: "Долнище · Талия" },
  { marker: "F", label: "Долнище · Ханш" },
  { marker: "G", label: "Долнище · Вътрешен шев" },
  { marker: "H", label: "Долнище · Външна дължина" },
];
const custom = [{ marker: "A", label: "Измерване" }];

const t = (value:string,label:string,group:string,icon:string,measurements:SizeGuideMeasurementPreset[]):SizeGuideTypeOption => ({value,label,group,icon,measurements});

export const SIZE_GUIDE_TYPES: SizeGuideTypeOption[] = [
  // Горни дрехи
  t("TSHIRT","Тениска","Горни дрехи","👕",top),
  t("POLO_SHIRT","Поло тениска","Горни дрехи","👕",top),
  t("TANK_TOP","Потник","Горни дрехи","🎽",top),
  t("BLOUSE","Блуза","Горни дрехи","👚",fittedTop),
  t("SHIRT","Риза","Горни дрехи","👔",top),
  t("TUNIC","Туника","Горни дрехи","👚",fittedTop),
  t("CROP_TOP","Кроп топ","Горни дрехи","👚",fittedTop),
  t("BODYSUIT","Боди","Горни дрехи","👚",fittedTop),
  t("CORSET","Корсет","Горни дрехи","🎽",fittedTop),
  t("SWEATER","Пуловер","Горни дрехи","🧶",top),
  t("TURTLENECK","Поло пуловер","Горни дрехи","🧶",top),
  t("CARDIGAN","Жилетка","Горни дрехи","🧥",top),
  t("SWEATSHIRT","Суичър","Горни дрехи","👕",top),
  t("HOODIE","Худи","Горни дрехи","🧥",top),
  t("VEST","Елек","Горни дрехи","🦺",outerwear),
  t("BLAZER","Блейзър","Горни дрехи","🧥",outerwear),
  t("SUIT_JACKET","Сако","Горни дрехи","🧥",outerwear),

  // Връхни дрехи
  t("JACKET","Яке","Връхни дрехи","🧥",outerwear),
  t("LEATHER_JACKET","Кожено яке","Връхни дрехи","🧥",outerwear),
  t("DENIM_JACKET","Дънково яке","Връхни дрехи","🧥",outerwear),
  t("BOMBER_JACKET","Бомбър яке","Връхни дрехи","🧥",outerwear),
  t("PUFFER_JACKET","Пухено яке","Връхни дрехи","🧥",outerwear),
  t("SPORT_JACKET","Спортно яке","Връхни дрехи","🧥",outerwear),
  t("PARKA","Парка","Връхни дрехи","🧥",outerwear),
  t("COAT","Палто","Връхни дрехи","🧥",outerwear),
  t("TRENCH_COAT","Тренчкот","Връхни дрехи","🧥",outerwear),
  t("RAINCOAT","Дъждобран","Връхни дрехи","🧥",outerwear),
  t("CAPE","Пелерина","Връхни дрехи","🧥",outerwear),
  t("PONCHO","Пончо","Връхни дрехи","🧥",outerwear),

  // Долни дрехи
  t("JEANS","Дънки","Долни дрехи","👖",pants),
  t("TROUSERS","Панталон","Долни дрехи","👖",pants),
  t("CHINOS","Чино панталон","Долни дрехи","👖",pants),
  t("CARGO_PANTS","Карго панталон","Долни дрехи","👖",pants),
  t("JOGGERS","Джогър","Долни дрехи","👖",pants),
  t("TRACK_PANTS","Анцуг долнище","Долни дрехи","👖",pants),
  t("LEGGINGS","Клин","Долни дрехи","👖",pants),
  t("CAPRI_PANTS","Капри панталон","Долни дрехи","👖",pants),
  t("SHORTS","Къси панталони","Долни дрехи","🩳",pants),
  t("BERMUDA_SHORTS","Бермуди","Долни дрехи","🩳",pants),
  t("CYCLING_SHORTS","Колоездачни клинове","Долни дрехи","🩳",pants),
  t("SKIRT","Пола","Долни дрехи","👗",skirt),
  t("MINI_SKIRT","Мини пола","Долни дрехи","👗",skirt),
  t("MIDI_SKIRT","Миди пола","Долни дрехи","👗",skirt),
  t("MAXI_SKIRT","Макси пола","Долни дрехи","👗",skirt),
  t("PENCIL_SKIRT","Пола тип молив","Долни дрехи","👗",skirt),
  t("PLEATED_SKIRT","Плисирана пола","Долни дрехи","👗",skirt),

  // Рокли и гащеризони
  t("DRESS","Рокля","Рокли и гащеризони","👗",dress),
  t("MINI_DRESS","Мини рокля","Рокли и гащеризони","👗",dress),
  t("MIDI_DRESS","Миди рокля","Рокли и гащеризони","👗",dress),
  t("MAXI_DRESS","Макси рокля","Рокли и гащеризони","👗",dress),
  t("EVENING_DRESS","Официална рокля","Рокли и гащеризони","👗",dress),
  t("COCKTAIL_DRESS","Коктейлна рокля","Рокли и гащеризони","👗",dress),
  t("WEDDING_DRESS","Булчинска рокля","Рокли и гащеризони","👰",dress),
  t("SUMMER_DRESS","Лятна рокля","Рокли и гащеризони","👗",dress),
  t("SHIRT_DRESS","Риза-рокля","Рокли и гащеризони","👗",dress),
  t("JUMPSUIT","Гащеризон","Рокли и гащеризони","👗",dress),
  t("PLAYSUIT","Къс гащеризон","Рокли и гащеризони","👗",dress),
  t("OVERALLS","Работен гащеризон","Рокли и гащеризони","🥼",dress),

  // Комплекти и костюми
  t("SUIT","Костюм (сако и панталон)","Комплекти и костюми","🤵",ensemble),
  t("TWO_PIECE_SET","Комплект от две части","Комплекти и костюми","👚",ensemble),
  t("THREE_PIECE_SET","Комплект от три части","Комплекти и костюми","👔",ensemble),
  t("TRACKSUIT","Анцуг / спортен екип","Комплекти и костюми","🏃",ensemble),
  t("PAJAMA_SET","Пижама комплект","Комплекти и костюми","🛌",ensemble),
  t("SKIRT_SET","Комплект горнище и пола","Комплекти и костюми","👚",ensemble),
  t("SHORTS_SET","Комплект горнище и къси панталони","Комплекти и костюми","🩳",ensemble),
  t("GENERIC_SET","Друг комплект","Комплекти и костюми","🧥",ensemble),

  // Бельо и бански
  t("BRA","Сутиен","Бельо и бански","👙",underwearTop),
  t("BRALETTE","Бралет","Бельо и бански","👙",underwearTop),
  t("PANTIES","Бикини бельо","Бельо и бански","🩲",underwearBottom),
  t("THONG","Прашки","Бельо и бански","🩲",underwearBottom),
  t("BOXERS","Боксерки","Бельо и бански","🩲",underwearBottom),
  t("BRIEFS","Слипове","Бельо и бански","🩲",underwearBottom),
  t("SHAPEWEAR","Оформящо бельо","Бельо и бански","🩱",fittedTop),
  t("LINGERIE_BODYSUIT","Боди бельо","Бельо и бански","🩱",fittedTop),
  t("NIGHTGOWN","Нощница","Бельо и бански","👗",dress),
  t("ROBE","Халат","Бельо и бански","🥋",outerwear),
  t("ONE_PIECE_SWIMSUIT","Цял бански","Бельо и бански","🩱",dress),
  t("BIKINI_TOP","Горнище на бански","Бельо и бански","👙",underwearTop),
  t("BIKINI_BOTTOM","Долнище на бански","Бельо и бански","👙",underwearBottom),
  t("SWIM_SHORTS","Плувни шорти","Бельо и бански","🩳",pants),

  // Обувки
  t("SNEAKERS","Маратонки","Обувки","👟",shoes),
  t("CASUAL_SHOES","Ежедневни обувки","Обувки","👞",shoes),
  t("FORMAL_SHOES","Официални обувки","Обувки","👞",shoes),
  t("OXFORD_SHOES","Оксфорд обувки","Обувки","👞",shoes),
  t("LOAFERS","Мокасини","Обувки","👞",shoes),
  t("BALLET_FLATS","Балеринки","Обувки","🥿",shoes),
  t("ESPADRILLES","Еспадрили","Обувки","🥿",shoes),
  t("HIGH_HEELS","Обувки на ток","Обувки","👠",shoes),
  t("SANDALS","Сандали","Обувки","👡",shoes),
  t("SLIPPERS","Чехли","Обувки","🩴",shoes),
  t("HOUSE_SLIPPERS","Пантофи","Обувки","🥿",shoes),
  t("ANKLE_BOOTS","Боти","Обувки","🥾",boots),
  t("BOOTS","Ботуши","Обувки","👢",boots),
  t("KNEE_HIGH_BOOTS","Високи ботуши","Обувки","👢",boots),
  t("COMBAT_BOOTS","Кубинки","Обувки","🥾",boots),
  t("HIKING_BOOTS","Туристически обувки","Обувки","🥾",boots),
  t("WORK_BOOTS","Работни обувки","Обувки","🥾",boots),
  t("CLEATS","Футболни обувки","Обувки","👟",shoes),

  // Аксесоари
  t("HAT","Шапка","Аксесоари","🧢",hat),
  t("CAP","Каскет","Аксесоари","🧢",hat),
  t("BEANIE","Зимна шапка","Аксесоари","🧢",hat),
  t("BELT","Колан","Аксесоари","👖",belt),
  t("GLOVES","Ръкавици","Аксесоари","🧤",gloves),
  t("SCARF","Шал","Аксесоари","🧣",[{marker:"A",label:"Дължина"},{marker:"B",label:"Ширина"}]),
  t("TIE","Вратовръзка","Аксесоари","👔",[{marker:"A",label:"Дължина"},{marker:"B",label:"Максимална ширина"}]),
  t("BOW_TIE","Папионка","Аксесоари","🎀",[{marker:"A",label:"Обиколка на врата"},{marker:"B",label:"Ширина"}]),
  t("SOCKS","Чорапи","Аксесоари","🧦",[{marker:"A",label:"Дължина на стъпалото"},{marker:"B",label:"Височина"}]),
  t("TIGHTS","Чорапогащник","Аксесоари","🧦",pants),
  t("HANDBAG","Дамска чанта","Аксесоари","👜",bag),
  t("BACKPACK","Раница","Аксесоари","🎒",bag),
  t("WALLET","Портфейл","Аксесоари","👛",bag),

  // Бижута
  t("RING","Пръстен","Бижута","💍",jewelry),
  t("BRACELET","Гривна","Бижута","📿",jewelry),
  t("NECKLACE","Колие","Бижута","📿",jewelry),
  t("PENDANT","Медальон","Бижута","📿",jewelry),
  t("EARRINGS","Обеци","Бижута","💎",jewelry),
  t("BROOCH","Брошка","Бижута","💎",jewelry),
  t("ANKLET","Гривна за глезен","Бижута","📿",jewelry),

  // Бебешки и детски
  t("BABY_BODYSUIT","Бебешко боди","Бебешки и детски","👶",baby),
  t("BABY_ROMPER","Бебешки гащеризон","Бебешки и детски","👶",baby),
  t("BABY_SET","Бебешки комплект","Бебешки и детски","👶",baby),
  t("KIDS_TSHIRT","Детска тениска","Бебешки и детски","👕",baby),
  t("KIDS_BLOUSE","Детска блуза","Бебешки и детски","👚",baby),
  t("KIDS_SHIRT","Детска риза","Бебешки и детски","👔",baby),
  t("KIDS_DRESS","Детска рокля","Бебешки и детски","👗",baby),
  t("KIDS_JEANS","Детски дънки","Бебешки и детски","👖",baby),
  t("KIDS_TROUSERS","Детски панталон","Бебешки и детски","👖",baby),
  t("KIDS_JACKET","Детско яке","Бебешки и детски","🧥",baby),
  t("KIDS_COAT","Детско палто","Бебешки и детски","🧥",baby),
  t("KIDS_SHOES","Детски обувки","Бебешки и детски","👟",shoes),

  // Специализирани
  t("WORKWEAR_TOP","Работна горна дреха","Специализирани","🥼",outerwear),
  t("WORKWEAR_PANTS","Работен панталон","Специализирани","👖",pants),
  t("MEDICAL_SCRUB_TOP","Медицинска туника","Специализирани","🥼",top),
  t("MEDICAL_SCRUB_PANTS","Медицински панталон","Специализирани","👖",pants),
  t("MOTORCYCLE_JACKET","Мото яке","Специализирани","🧥",outerwear),
  t("MOTORCYCLE_PANTS","Мото панталон","Специализирани","👖",pants),
  t("SKI_JACKET","Ски яке","Специализирани","🧥",outerwear),
  t("SKI_PANTS","Ски панталон","Специализирани","👖",pants),
  t("CYCLING_JERSEY","Колоездачна фланелка","Специализирани","🚴",top),
  t("DANCEWEAR","Танцово облекло","Специализирани","💃",dress),
  t("UNIFORM","Униформа","Специализирани","🥼",outerwear),

  t("CUSTOM","Друг / собствен тип","Други","📐",custom),
];

export const SIZE_GUIDE_TYPE_GROUPS = Array.from(new Set(SIZE_GUIDE_TYPES.map((item) => item.group)));
export const SIZE_GUIDE_TYPE_MAP = Object.fromEntries(SIZE_GUIDE_TYPES.map((item) => [item.value, item])) as Record<string, SizeGuideTypeOption>;
export function getSizeGuideType(value:string) { return SIZE_GUIDE_TYPE_MAP[value] ?? SIZE_GUIDE_TYPE_MAP.CUSTOM; }

const LEGACY_TYPE_KEYWORDS: Array<[RegExp, string]> = [
  [/анцуг|спортен екип|tracksuit|track suit/i, "TRACKSUIT"],
  [/костюм|suit/i, "SUIT"],
  [/пижам.*комплект|pajama set|pyjama set/i, "PAJAMA_SET"],
  [/комплект.*пола|skirt set/i, "SKIRT_SET"],
  [/комплект.*шорт|комплект.*къси|shorts set/i, "SHORTS_SET"],
  [/комплект.*три|three.?piece|3.?piece/i, "THREE_PIECE_SET"],
  [/комплект|сет|two.?piece|2.?piece|ensemble/i, "TWO_PIECE_SET"],
  [/пръстен|ring/i, "RING"], [/гривна за глезен|anklet/i, "ANKLET"], [/гривна|bracelet/i, "BRACELET"], [/колие|necklace/i, "NECKLACE"], [/медальон|pendant/i, "PENDANT"], [/обеци|earring/i, "EARRINGS"],
  [/сутиен|бралет|bra/i, "BRA"], [/бикини.*гор|bikini top/i, "BIKINI_TOP"], [/бикини.*дол|bikini bottom/i, "BIKINI_BOTTOM"],
  [/палто|coat/i, "COAT"], [/тренч|trench/i, "TRENCH_COAT"], [/парка|parka/i, "PARKA"], [/яке|jacket/i, "JACKET"],
  [/шапка|hat|cap/i, "HAT"], [/колан|belt/i, "BELT"], [/ръкавици|glove/i, "GLOVES"], [/шал|scarf/i, "SCARF"],
  [/ботуш|boot/i, "BOOTS"], [/боти|ankle boot/i, "ANKLE_BOOTS"], [/ток|heel/i, "HIGH_HEELS"], [/маратон|sneaker/i, "SNEAKERS"], [/обувк|shoe/i, "CASUAL_SHOES"],
  [/рокля|dress/i, "DRESS"], [/пола|skirt/i, "SKIRT"], [/дънки|jeans/i, "JEANS"], [/панталон|trouser|pants/i, "TROUSERS"], [/шорти|къси панталони|shorts/i, "SHORTS"],
  [/поло\s*тениск|polo\s*shirt/i, "POLO_SHIRT"], [/потник|tank\s*top|sleeveless\s*top/i, "TANK_TOP"], [/тениск|t-?shirt|tshirt/i, "TSHIRT"], [/блуз|blouse|long\s*sleeve\s*top/i, "BLOUSE"], [/риз|shirt/i, "SHIRT"], [/туник|tunic/i, "TUNIC"], [/поло\s*пуловер|turtleneck/i, "TURTLENECK"], [/пуловер|sweater/i, "SWEATER"], [/суич|sweatshirt/i, "SWEATSHIRT"], [/худи|hoodie/i, "HOODIE"], [/жилетк|cardigan/i, "CARDIGAN"],
  [/чанта|handbag/i, "HANDBAG"], [/раница|backpack/i, "BACKPACK"], [/портфейл|wallet/i, "WALLET"],
];

export function resolveSizeGuideType(value: string, context = "") {
  const normalized = String(value || "").toUpperCase();
  if (normalized && normalized !== "TSHIRT" && SIZE_GUIDE_TYPE_MAP[normalized]) return normalized;
  for (const [pattern, type] of LEGACY_TYPE_KEYWORDS) if (pattern.test(context)) return type;
  return SIZE_GUIDE_TYPE_MAP[normalized] ? normalized : "CUSTOM";
}
