"use client";

import { useRef } from "react";
import { getSizeGuideType } from "@/lib/size-guide-types";
import styles from "./SizeGuideDiagram.module.css";

export type DiagramMeasurement = {
  key?: string;
  id?: string | number;
  marker: string;
  label?: string;
  startX?: number;
  startY?: number;
  endX?: number;
  endY?: number;
};

type Props = {
  garmentType: string;
  measurements: DiagramMeasurement[];
  editable?: boolean;
  selectedIndex?: number;
  onSelect?: (index: number) => void;
  onChange?: (index: number, patch: Partial<DiagramMeasurement>) => void;
};

const clamp = (value: number) => Math.max(2, Math.min(98, value));
const has = (type: string, ...parts: string[]) => parts.some((part) => type.includes(part));

function Artwork({ type }: { type: string }) {
  const t = type.toUpperCase();

  if (has(t, "SUIT", "TWO_PIECE_SET", "THREE_PIECE_SET", "TRACKSUIT", "PAJAMA_SET", "SKIRT_SET", "SHORTS_SET", "GENERIC_SET")) {
    const skirtBottom = has(t, "SKIRT_SET");
    const shortsBottom = has(t, "SHORTS_SET");
    const formalTop = has(t, "SUIT", "THREE_PIECE_SET");
    const hoodedTop = has(t, "TRACKSUIT");
    return <g>
      <text className={styles.pieceLabel} x="27" y="9">ГОРНИЩЕ</text>
      <text className={styles.pieceLabel} x="73" y="9">ДОЛНИЩЕ</text>
      <g className={styles.artwork} transform="translate(2 10) scale(.5 .78)">
        <path d="M34 17 L44 11 H56 L66 17 L84 30 L73 47 L65 41 L67 76 H33 L35 41 L27 47 L16 30 Z"/>
        <path className={styles.detail} d="M50 13 V76 M35 53 H65 M40 18 L50 30 L60 18"/>
        {hoodedTop&&<path className={styles.detail} d="M40 15 C42 3 58 3 60 15"/>}
        {formalTop&&<path className={styles.detail} d="M45 20 L50 33 L55 20 M42 57 H47"/>}
      </g>
      <g className={styles.artwork} transform="translate(49 10) scale(.5 .78)">
        {skirtBottom ? <><path d="M34 19 H66 L79 83 H21 Z"/><path className={styles.detail} d="M34 30 H66 M50 31 V79"/></> : shortsBottom ? <><path d="M27 24 H73 L68 72 H54 L50 48 L46 72 H32 Z"/><path className={styles.detail} d="M28 37 H72 M50 24 V48"/></> : <><path d="M31 15 H69 L65 84 H53 L50 43 L47 84 H35 Z"/><path className={styles.detail} d="M32 28 H68 M50 16 V43 M37 37 C43 40 47 40 50 38 C53 40 57 40 63 37"/></>}
      </g>
      <path className={styles.setDivider} d="M50 14 V89"/>
    </g>;
  }

  if (has(t, "RING")) return <g className={styles.artwork}><circle cx="50" cy="52" r="23"/><circle className={styles.cutout} cx="50" cy="52" r="14"/><path d="M42 31 L46 22 L54 22 L58 31 L54 36 L46 36 Z"/><path className={styles.detail} d="M43 29 H57 M46 23 L50 29 L54 23"/></g>;
  if (has(t, "BRACELET", "ANKLET")) return <g className={styles.artwork}><ellipse cx="50" cy="52" rx="31" ry="20"/><ellipse className={styles.cutout} cx="50" cy="52" rx="22" ry="12"/><circle className={styles.accent} cx="50" cy="31" r="5"/></g>;
  if (has(t, "NECKLACE", "PENDANT")) return <g className={styles.artwork}><path d="M22 24 C26 68 42 79 50 80 C58 79 74 68 78 24"/><path className={styles.cutoutStroke} d="M29 25 C33 60 44 70 50 71 C56 70 67 60 71 25"/><path d="M45 66 L50 58 L55 66 L50 76 Z"/></g>;
  if (has(t, "EARRING")) return <g className={styles.artwork}><path d="M36 24 C36 42 25 46 25 60 C25 74 36 82 46 73 C54 66 50 53 42 48"/><path d="M64 24 C64 42 75 46 75 60 C75 74 64 82 54 73 C46 66 50 53 58 48"/><circle className={styles.accent} cx="36" cy="22" r="4"/><circle className={styles.accent} cx="64" cy="22" r="4"/></g>;
  if (has(t, "BROOCH")) return <g className={styles.artwork}><path d="M50 20 L59 38 L80 35 L65 51 L75 72 L53 64 L36 81 L35 58 L14 49 L35 39 Z"/><circle className={styles.accent} cx="50" cy="50" r="8"/></g>;

  if (has(t, "BRA", "BIKINI_TOP")) return <g className={styles.artwork}><path d="M18 44 C25 30 39 29 49 44 C59 29 75 30 82 44 L76 66 C64 69 55 64 49 54 C43 64 34 69 22 66 Z"/><path className={styles.detail} d="M49 43 V66 M19 43 C18 30 20 21 27 16 M81 43 C82 30 80 21 73 16"/></g>;
  if (has(t, "PANTIES", "THONG", "BRIEFS", "BOXERS", "BIKINI_BOTTOM")) return <g className={styles.artwork}><path d="M23 28 H77 L68 72 C61 82 55 80 50 66 C45 80 39 82 32 72 Z"/><path className={styles.detail} d="M24 37 H76 M36 70 C41 62 45 58 50 58 C55 58 59 62 64 70"/></g>;
  if (has(t, "SWIMSUIT", "LINGERIE_BODYSUIT", "BODYSUIT")) return <g className={styles.artwork}><path d="M36 17 L45 13 H55 L64 17 L70 34 L61 42 L66 78 L55 84 L50 65 L45 84 L34 78 L39 42 L30 34 Z"/><path className={styles.detail} d="M39 43 C46 49 54 49 61 43 M42 19 L50 32 L58 19"/></g>;

  if (has(t, "HIGH_HEEL")) return <g className={styles.artwork}><path d="M15 58 C28 58 37 50 44 32 L59 38 C63 48 70 56 87 61 L86 71 H25 C15 71 11 65 15 58 Z"/><path d="M68 68 L73 84 H79 L78 68 Z"/><path className={styles.detail} d="M45 34 C54 46 61 55 84 61"/></g>;
  if (has(t, "BOOT")) return <g className={styles.artwork}><path d="M35 14 H65 L64 52 C69 59 75 63 88 67 L86 78 H24 C17 78 14 70 21 63 L35 51 Z"/><path className={styles.detail} d="M36 27 H63 M35 51 H64 M25 69 H86"/></g>;
  if (has(t, "SHOE", "SNEAKER", "SANDAL", "SLIPPER", "LOAFER", "ESPADRILLE", "FLAT", "CLEAT")) return <g className={styles.artwork}><path d="M14 56 C27 57 36 48 43 33 L60 39 C65 49 72 56 89 61 L87 75 H21 C13 75 9 64 14 56 Z"/><path className={styles.detail} d="M44 36 L62 53 M39 43 L56 58 M20 64 H86"/></g>;

  if (has(t, "HAT", "CAP", "BEANIE")) {
    if (has(t, "BEANIE")) return <g className={styles.artwork}><path d="M25 69 C25 36 34 18 50 18 C66 18 75 36 75 69 Z"/><path d="M21 63 H79 V76 H21 Z"/><circle className={styles.accent} cx="50" cy="14" r="6"/></g>;
    return <g className={styles.artwork}><path d="M24 58 C28 32 39 22 54 24 C68 26 76 39 75 58 Z"/><path d="M20 57 H75 C86 57 91 62 91 68 C73 70 59 68 47 65 C35 62 25 63 14 67 C13 62 15 59 20 57 Z"/><path className={styles.detail} d="M51 26 V57"/></g>;
  }
  if (has(t, "BELT")) return <g className={styles.artwork}><rect x="13" y="43" width="74" height="16" rx="6"/><rect className={styles.cutout} x="18" y="46" width="18" height="10" rx="2"/><circle className={styles.accent} cx="72" cy="51" r="2.4"/><circle className={styles.accent} cx="80" cy="51" r="2.4"/></g>;
  if (has(t, "GLOVE")) return <g className={styles.artwork}><path d="M32 80 L25 51 L28 24 C29 19 35 20 35 25 V42 L38 14 C39 9 46 10 46 15 V40 L49 11 C50 6 57 8 57 13 V41 L61 16 C62 11 69 13 68 18 L66 45 L74 33 C77 29 83 33 80 38 L70 57 L66 80 Z"/></g>;
  if (has(t, "SCARF")) return <g className={styles.artwork}><path d="M31 15 H48 L60 84 H43 Z"/><path d="M52 15 H69 L57 84 H40 Z"/><path className={styles.detail} d="M41 72 L37 88 M47 72 L45 89 M56 72 L57 89 M62 72 L66 88"/></g>;
  if (has(t, "TIE")) return <g className={styles.artwork}><path d="M43 14 H57 L61 27 L55 37 L65 76 L50 88 L35 76 L45 37 L39 27 Z"/><path className={styles.detail} d="M45 36 H55"/></g>;
  if (has(t, "SOCK")) return <g className={styles.artwork}><path d="M32 15 H60 V55 C62 61 73 63 82 65 C88 67 87 77 80 80 H46 C36 80 30 73 32 64 Z"/><path className={styles.detail} d="M33 29 H59 M33 59 C42 61 51 63 59 69"/></g>;
  if (has(t, "BAG", "BACKPACK", "WALLET")) {
    if (has(t, "BACKPACK")) return <g className={styles.artwork}><path d="M26 38 C26 23 37 16 50 16 C63 16 74 23 74 38 L80 81 H20 Z"/><path className={styles.detail} d="M34 39 V27 C34 17 66 17 66 27 V39 M29 57 H71 M38 58 V77 H62 V58"/></g>;
    if (has(t, "WALLET")) return <g className={styles.artwork}><rect x="18" y="32" width="64" height="40" rx="7"/><path className={styles.detail} d="M18 43 H82 M59 47 H78 V59 H59 Z"/><circle className={styles.accent} cx="67" cy="53" r="2"/></g>;
    return <g className={styles.artwork}><path d="M21 39 H79 L84 80 H16 Z"/><path className={styles.detail} d="M34 40 C34 17 66 17 66 40 M20 55 H80"/></g>;
  }

  // Точни схеми за горни дрехи. Използваме точния тип, за да не се
  // припознава например TSHIRT като SHIRT или BLOUSE като тениска.
  if (t === "TSHIRT") return <g className={styles.artwork}><path d="M35 20 L44 14 H56 L65 20 L79 29 L70 42 L64 38 L66 80 H34 L36 38 L30 42 L21 29 Z"/><path className={styles.detail} d="M43 15 C45 23 55 23 57 15 M35 51 H65"/></g>;
  if (t === "POLO_SHIRT") return <g className={styles.artwork}><path d="M35 20 L44 14 H56 L65 20 L79 29 L70 42 L64 38 L66 80 H34 L36 38 L30 42 L21 29 Z"/><path className={styles.detail} d="M43 15 L50 27 L57 15 M50 27 V42 M45 35 H55"/></g>;
  if (t === "BLOUSE" || t === "KIDS_BLOUSE") return <g className={styles.artwork}>
    {/* Блуза: ясно изразени дълги ръкави до китките, маншети и леко свободен силует. */}
    <path d="M38 18 L44 12 H56 L62 18 L72 24 L88 50 L79 57 L65 38 L66 82 H34 L35 38 L21 57 L12 50 L28 24 Z"/>
    <path className={styles.detail} d="M43 13 C45 22 55 22 57 13 M35 54 C43 58 57 58 65 54 M18 49 L24 55 M82 49 L76 55 M34 72 C44 76 56 76 66 72"/>
  </g>;
  if (t === "SHIRT") return <g className={styles.artwork}><path d="M34 17 L43 10 H57 L66 17 L84 30 L73 47 L65 40 L67 84 H33 L35 40 L27 47 L16 30 Z"/><path className={styles.detail} d="M42 12 L50 26 L58 12 M50 26 V84 M43 38 H57 M44 53 H48 M52 53 H56"/></g>;
  if (t === "TUNIC") return <g className={styles.artwork}><path d="M36 16 L44 11 H56 L64 16 L80 29 L70 45 L63 39 L72 87 H28 L37 39 L30 45 L20 29 Z"/><path className={styles.detail} d="M42 13 C44 22 56 22 58 13 M36 51 H64"/></g>;
  if (t === "CROP_TOP") return <g className={styles.artwork}><path d="M37 20 L44 14 H56 L63 20 L74 29 L66 41 L61 37 L63 59 H37 L39 37 L34 41 L26 29 Z"/><path className={styles.detail} d="M43 15 C45 23 55 23 57 15 M38 51 H62"/></g>;
  if (t === "TANK_TOP") return <g className={styles.artwork}>
    {/* Потник: без ръкави, с две презрамки, дълбоки извивки при мишниците и обло деколте. */}
    <path d="M40 14 H46 C46 24 43 28 38 34 L35 82 H65 L62 34 C57 28 54 24 54 14 H60 L66 34 C63 39 62 43 62 48 L64 82 H36 L38 48 C38 43 37 39 34 34 Z"/>
    <path className={styles.detail} d="M46 14 C46 25 54 25 54 14 M38 47 C45 51 55 51 62 47 M38 68 H62"/>
  </g>;
  if (t === "SWEATER" || t === "TURTLENECK") return <g className={styles.artwork}><path d="M34 18 L43 11 H57 L66 18 L84 31 L74 48 L65 41 L67 83 H33 L35 41 L26 48 L16 31 Z"/><path className={styles.detail} d="M35 54 H65 M39 74 H61"/>{t === "TURTLENECK" ? <path className={styles.detail} d="M43 12 H57 V25 H43 Z"/> : <path className={styles.detail} d="M42 13 C44 23 56 23 58 13"/>}</g>;
  if (t === "SWEATSHIRT") return <g className={styles.artwork}><path d="M34 18 L43 12 H57 L66 18 L83 31 L73 47 L65 41 L67 81 H33 L35 41 L27 47 L17 31 Z"/><path className={styles.detail} d="M42 13 C44 23 56 23 58 13 M34 65 H66 M38 75 H62"/></g>;
  if (t === "HOODIE") return <g className={styles.artwork}><path d="M34 19 L42 13 H58 L66 19 L83 31 L73 48 L65 41 L67 82 H33 L35 41 L27 48 L17 31 Z"/><path className={styles.detail} d="M39 17 C40 3 60 3 61 17 M50 23 V82 M35 61 H65 M43 52 C45 61 55 61 57 52"/></g>;
  if (t === "CARDIGAN") return <g className={styles.artwork}><path d="M34 18 L43 12 H57 L66 18 L83 31 L73 48 L65 41 L67 83 H33 L35 41 L27 48 L17 31 Z"/><path className={styles.detail} d="M50 13 V83 M37 52 H48 M52 52 H63 M42 26 L50 37 L58 26"/></g>;
  if (t === "VEST") return <g className={styles.artwork}><path d="M38 18 L44 11 H56 L62 18 L67 33 L61 40 L64 82 H36 L39 40 L33 33 Z"/><path className={styles.detail} d="M43 13 L50 27 L57 13 M50 27 V82 M38 52 H62"/></g>;
  if (t === "BLAZER" || t === "SUIT_JACKET") return <g className={styles.artwork}><path d="M34 17 L43 10 H57 L66 17 L84 30 L73 47 L65 40 L67 84 H33 L35 40 L27 47 L16 30 Z"/><path className={styles.detail} d="M42 12 L50 32 L58 12 M50 32 V84 M40 49 H48 M52 49 H60 M40 62 H47"/></g>;

  if (has(t, "PANT", "JEAN", "TROUSER", "CHINO", "JOGGER", "LEGGING", "TIGHTS")) return <g className={styles.artwork}><path d="M31 15 H69 L65 84 H53 L50 43 L47 84 H35 Z"/><path className={styles.detail} d="M32 28 H68 M50 16 V43 M37 37 C43 40 47 40 50 38 C53 40 57 40 63 37"/></g>;
  if (has(t, "SHORT", "BERMUDA")) return <g className={styles.artwork}><path d="M27 24 H73 L68 72 H54 L50 48 L46 72 H32 Z"/><path className={styles.detail} d="M28 37 H72 M50 24 V48"/></g>;
  if (has(t, "SKIRT")) return <g className={styles.artwork}><path d="M34 19 H66 L79 83 H21 Z"/><path className={styles.detail} d="M34 30 H66 M50 31 V79"/></g>;

  if (has(t, "JUMPSUIT", "PLAYSUIT", "OVERALL")) return <g className={styles.artwork}><path d="M37 15 H63 L69 34 L61 43 L66 84 H54 L50 51 L46 84 H34 L39 43 L31 34 Z"/><path className={styles.detail} d="M42 16 V35 H58 V16 M39 43 H61"/></g>;
  if (has(t, "DRESS", "GOWN", "NIGHTGOWN")) return <g className={styles.artwork}><path d="M38 14 H62 L68 31 L61 42 L80 85 H20 L39 42 L32 31 Z"/><path className={styles.detail} d="M39 42 H61 M42 16 L50 30 L58 16"/></g>;

  if (t === "CAPE") return <g className={styles.artwork}><path d="M42 12 H58 L64 21 L88 74 H12 L36 21 Z"/><path className={styles.detail} d="M43 13 C45 22 55 22 57 13 M36 31 H64 M50 22 V74"/></g>;
  if (t === "PONCHO") return <g className={styles.artwork}><path d="M43 12 H57 L91 69 L73 83 L50 64 L27 83 L9 69 Z"/><path className={styles.detail} d="M43 13 C45 23 55 23 57 13 M50 24 V64 M23 70 H77"/></g>;
  if (has(t, "COAT", "TRENCH", "RAINCOAT", "PARKA")) return <g className={styles.artwork}><path d="M35 14 L44 9 H56 L65 14 L82 29 L72 45 L64 39 L72 88 H28 L36 39 L28 45 L18 29 Z"/><path className={styles.detail} d="M50 11 V88 M35 48 H65 M36 63 H64 M40 16 L50 28 L60 16"/>{has(t,"PARKA")&&<path className={styles.detail} d="M39 13 C40 2 60 2 61 13"/>}</g>;
  if (has(t, "JACKET", "BOMBER", "PUFFER")) return <g className={styles.artwork}><path d="M34 17 L44 11 H56 L66 17 L84 30 L73 47 L65 41 L67 76 H33 L35 41 L27 47 L16 30 Z"/><path className={styles.detail} d="M50 13 V76 M35 53 H65 M40 18 L50 30 L60 18"/>{has(t,"HOODIE")&&<path className={styles.detail} d="M40 15 C42 3 58 3 60 15"/>}{has(t,"PUFFER")&&<path className={styles.detail} d="M34 34 H66 M34 46 H66 M34 58 H66"/>}</g>;

  if (has(t, "CORSET")) return <g className={styles.artwork}><path d="M37 18 L44 12 H56 L63 18 L68 34 L61 40 L64 78 H36 L39 40 L32 34 Z"/><path className={styles.detail} d="M43 14 V30 H57 V14 M37 50 H63"/></g>;
  if (t === "GENERIC_TOP") return <g className={styles.artwork}><path d="M34 18 L43 11 H57 L66 18 L83 30 L73 46 L65 40 L67 82 H33 L35 40 L27 46 L17 30 Z"/><path className={styles.detail} d="M43 13 L50 25 L57 13 M50 25 V82 M44 37 H56"/></g>;
  if (t === "KIDS_TSHIRT") return <g className={styles.artwork}><path d="M36 21 L44 15 H56 L64 21 L77 30 L69 42 L63 38 L65 76 H35 L37 38 L31 42 L23 30 Z"/><path className={styles.detail} d="M43 16 C45 24 55 24 57 16 M36 54 H64"/></g>;
  if (t === "KIDS_SHIRT") return <g className={styles.artwork}><path d="M35 19 L43 12 H57 L65 19 L80 31 L71 45 L64 40 L66 78 H34 L36 40 L29 45 L20 31 Z"/><path className={styles.detail} d="M42 14 L50 27 L58 14 M50 27 V78 M42 42 H58 M44 54 H48 M52 54 H56"/></g>;
  if (has(t, "BABY", "KIDS")) return <g className={styles.artwork}><path d="M36 18 L44 12 H56 L64 18 L78 29 L69 42 L62 37 L64 67 L57 84 L50 68 L43 84 L36 67 L38 37 L31 42 L22 29 Z"/><path className={styles.detail} d="M43 14 L50 25 L57 14"/></g>;

  return <g className={styles.artwork}><path d="M35 18 L45 12 H55 L65 18 L84 30 L72 47 L64 41 L66 84 H34 L36 41 L28 47 L16 30 Z"/><path className={styles.detail} d="M34 49 H66 M50 13 V84"/></g>;
}

export default function SizeGuideDiagram({ garmentType, measurements, editable=false, selectedIndex=0, onSelect, onChange }: Props) {
  const ref = useRef<SVGSVGElement>(null);
  const typeInfo = getSizeGuideType(garmentType);

  function startDrag(event: React.PointerEvent<SVGCircleElement>, index: number, end: "start"|"end") {
    if (!editable || !onChange) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    onSelect?.(index);
    const move = (moveEvent: PointerEvent) => {
      const svg = ref.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const x = clamp(((moveEvent.clientX - rect.left) / rect.width) * 100);
      const y = clamp(((moveEvent.clientY - rect.top) / rect.height) * 100);
      onChange(index, end === "start" ? { startX:x, startY:y } : { endX:x, endY:y });
    };
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop, { once:true });
  }

  return <div className={`${styles.wrap} ${editable ? styles.editable : ""}`}>
    <div className={styles.premiumHeader}><span>{typeInfo.icon}</span><div><strong>{typeInfo.label}</strong><small>{has(garmentType.toUpperCase(), "SUIT", "SET", "TRACKSUIT") ? "Две схеми: горнище и долнище" : "Професионална схема за измерване"}</small></div></div>
    <svg ref={ref} viewBox="0 0 100 100" role="img" aria-label={`Схема за измерване: ${typeInfo.label}`}>
      <defs>
        <linearGradient id="garmentFill" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f4e8ed"/><stop offset="1" stopColor="#dfc8d2"/></linearGradient>
        <filter id="softShadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity=".18"/></filter>
      </defs>
      <circle className={styles.halo} cx="50" cy="50" r="43"/>
      <Artwork type={garmentType}/>
      {measurements.map((measurement, index) => {
        const startX = measurement.startX ?? (index % 2 === 0 ? 24 : 38);
        const startY = measurement.startY ?? (24 + index * 8);
        const endX = measurement.endX ?? (index % 2 === 0 ? 76 : 62);
        const endY = measurement.endY ?? (24 + index * 8);
        const active = editable && selectedIndex === index;
        return <g key={String(measurement.id ?? measurement.key ?? index)} className={active ? styles.active : ""} onPointerDown={()=>onSelect?.(index)}>
          <line className={styles.measureLineBack} x1={startX} y1={startY} x2={endX} y2={endY}/>
          <line className={styles.measureLine} x1={startX} y1={startY} x2={endX} y2={endY}/>
          <circle className={styles.markerCircle} cx={startX} cy={startY} r="5"/>
          <text className={styles.markerText} x={startX} y={startY + 1.4}>{measurement.marker}</text>
          <circle className={styles.endDot} cx={endX} cy={endY} r="2.5"/>
          {editable && <>
            <circle className={styles.dragPoint} cx={startX} cy={startY} r="7" onPointerDown={(e)=>startDrag(e,index,"start")}/>
            <circle className={styles.dragPoint} cx={endX} cy={endY} r="7" onPointerDown={(e)=>startDrag(e,index,"end")}/>
          </>}
        </g>;
      })}
    </svg>
    {editable && <p className={styles.hint}>Избери измерване и премести началната и крайната точка.</p>}
  </div>;
}
