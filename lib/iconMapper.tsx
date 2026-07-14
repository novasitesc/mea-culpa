import React from "react";
import { 
  Package, Shield, Swords, Coins, Crown, Flame, Zap, Droplet, Wind, Sparkles, 
  Sword, Axe, Wand, Gem, Scroll, Book, Store, Home, MapPin, Dices, Shirt, Leaf, 
  Wrench, Hammer 
} from "lucide-react";
import { 
  GiAnimalHide, GiBattleAxe, GiBeerStein, GiBeltArmor, GiBowArrow, GiBreastplate, 
  GiBroadsword, GiCape, GiCardboardBox, GiChainMail, GiChestArmor, GiCrossbow, 
  GiCrossedBones, GiCrossedSwords, GiCrown, GiCrystalBall, GiDiceTwentyFacesTwenty, 
  GiFangs, GiFeather, GiFlail, GiFlame, GiFlangedMace, GiGauntlet, GiGems, 
  GiGloves, GiHalberd, GiHealthPotion, GiHelmet, GiHorseHead, GiJetpack, 
  GiLeatherArmor, GiLeatherBoot, GiLeatherVest, GiMailShirt, GiMeat, GiMusicalNotes, 
  GiMusket, GiNecklace, GiPlainDagger, GiPocketBow, GiPointySword, GiQuiver, 
  GiRing, GiRobe, GiRuneStone, GiRuneSword, GiScrollQuill, GiShield, GiSickle, 
  GiSlicedBread, GiSpears, GiSpectacles, GiSpikedArmor, GiSpikedMace, GiSwapBag, 
  GiSwordBrandish, GiTribalMask, GiTrident, GiTwoCoins, GiUnstableOrb, GiWarPick, 
  GiWarhammer, GiWaterDrop, GiWhip, GiWizardStaff, GiWolfHead,
  GiElephant, GiMechanicalArm, GiEyeTarget, GiElephantHead, GiTrojanHorse, GiCamel, GiDonkey, GiCavalry, GiHound
} from "react-icons/gi";

// Reglas dinámicas por palabras clave (el orden importa, la primera coincidencia se aplica).
// Esto evita incluir la lista completa de objetos en el código cliente.
const KEYWORD_RULES: Array<[string[], React.ComponentType<{ className?: string }>]> = [
  // --- Específicos / Especiales ---
  [["jetpack"], GiJetpack],
  [["mosquete", "rifle"], GiMusket],
  [["ballesta", "balistita"], GiCrossbow],
  [["arco largo"], GiBowArrow],
  [["arco corto"], GiPocketBow],
  [["arco", "pies firmes"], GiBowArrow],
  [["tridente"], GiTrident],
  [["alabarda", "guja"], GiHalberd],
  [["espadon", "mandoble", "espadón"], GiBroadsword],
  [["espada", "cimitarra", "hoja", "filo"], GiCrossedSwords],
  [["daga", "espina", "dardo"], GiPlainDagger],
  [["hacha"], GiBattleAxe],
  [["maza", "clava", "mangual"], GiFlangedMace],
  [["martillo"], GiWarhammer],
  [["lanza", "jabalina", "pica"], GiSpears],
  [["hoz"], GiSickle],
  [["estoque"], GiSwordBrandish],
  [["flagelo"], GiFlail],
  [["lucero del alba"], GiSpikedMace],
  [["pico de guerra", "pico"], GiWarPick],
  [["baston", "bastón", "foco"], GiWizardStaff],
  [["látigo", "latigo"], GiWhip],
  [["garras", "nudillera", "boxer", "vendas", "knukles"], GiGauntlet],
  [["mea culpa"], GiFlame],
  [["arma marcial", "armas marcial"], GiCrossedSwords],
  [["arma sencilla", "armas sencilla", "arma brillante"], GiPointySword],

  // --- Armaduras ---
  [["armadura de placas", "armaduras de placas"], GiBreastplate],
  [["armadura de cuero tachonado", "cuero tachonado"], GiLeatherArmor],
  [["armadura de cuero"], GiLeatherArmor],
  [["armadura acolchada", "acolchada"], GiLeatherVest],
  [["armadura con pinchos", "armadura ignea"], GiSpikedArmor],
  [["armadura viva pesada", "armadura pesada"], GiBreastplate],
  [["armadura viva media", "armadura media", "media armadura"], GiChestArmor],
  [["armadura viva ligera", "armadura ligera", "ligeramente furtiva"], GiLeatherArmor],
  [["armadura viva tela", "armadura viva"], GiRobe],
  [["cota de escamas", "escamas"], GiMailShirt],
  [["cota de malla", "camisa de malla", "cota guarnecida", "armadura de bandas"], GiChainMail],
  [["coraza"], GiBreastplate],
  [["pieles"], GiAnimalHide],
  [["armadura"], GiChestArmor],

  // --- Escudos ---
  [["escudo"], GiShield],

  // --- Cascos y Cabeza ---
  [["yelmo", "casco", "diadema", "sombrero de copa", "mirilla", "capucha", "bandana"], GiHelmet],
  [["lentes", "ojo mecánico", "ojo", "revelación"], GiEyeTarget],
  [["corona"], GiCrown],

  // --- Botas ---
  [["botas", "sandalias"], GiLeatherBoot],

  // --- Guantes ---
  [["guante", "guantelete"], GiGloves],

  // --- Capas ---
  [["capa", "manto", "alas"], GiCape],

  // --- Cinturones ---
  [["cintur", "cordel", "banda"], GiBeltArmor],

  // --- Anillos ---
  [["anillo", "alianza"], GiRing],

  // --- Collares y Amuletos ---
  [["collar", "amuleto", "rosario", "broche"], GiNecklace],

  // --- Pergaminos ---
  [["pergamino", "tomo"], GiScrollQuill],

  // --- Gemas y Núcleos ---
  [["gema", "fragmento", "núcleo", "nucleo", "engaste"], GiGems],

  // --- Pociones ---
  [["pocion", "poción"], GiHealthPotion],

  // --- Comida y Bebida ---
  [["cerveza", "hidromiel", "trago"], GiBeerStein],
  [["guiso", "estofado", "festín", "festin", "comer"], GiMeat],
  [["racion", "ración"], GiSlicedBread],

  // --- Bolsas ---
  [["bolsa"], GiSwapBag],
  [["monedero", "monedas"], GiTwoCoins],

  // --- Monturas y Mascotas ---
  [["elefante"], GiElephant],
  [["camello"], GiCamel],
  [["mula"], GiDonkey],
  [["caballo de guerra"], GiCavalry],
  [["mastin", "mastín"], GiHound],
  [["caballo", "montura"], GiHorseHead],
  [["mejora de pet", "pet", "sabueso", "licántropo"], GiWolfHead],

  // --- Objetos Mecánicos y Varios ---
  [["brazo metálico", "brazo", "mecánico"], GiMechanicalArm],
  [["piedra luminosa"], GiUnstableOrb],
  [["tatuaje"], GiTribalMask],
  [["huesos"], GiCrossedBones],
  [["carne"], GiMeat],
  [["runa"], GiRuneStone],
  [["reliquia", "corazón encadenado"], GiCrystalBall],
  [["lágrima"], GiWaterDrop],
  [["pluma"], GiFeather],
  [["arpa", "uña de guitarra", "cuerdas", "batuta"], GiMusicalNotes],
  [["forro rúnico", "forro"], GiRuneSword],
  [["colmillo"], GiFangs],
  [["impuesto", "flechas", "virote"], GiQuiver],
  [["ruleta", "puntos"], GiDiceTwentyFacesTwenty],
];

export const getIconForString = (
  iconStr: string | null | undefined,
  className?: string,
  fallbackIconStr?: string
): React.ReactNode => {
  const defaultClass = className || "w-4 h-4 inline-block";
  if (!iconStr) return <Package className={defaultClass} />;
  
  const normalized = iconStr.trim();

  const emojiMap: Record<string, React.ReactNode> = {
    "📦": <Package className={defaultClass} />,
    "⚔": <Swords className={defaultClass} />,
    "🛡": <Shield className={defaultClass} />,
    "🪙": <Coins className={defaultClass} />,
    "🏹": <GiBowArrow className={defaultClass} />,
    "🗡": <GiPlainDagger className={defaultClass} />,
    "👢": <GiLeatherBoot className={defaultClass} />,
    "👞": <GiLeatherBoot className={defaultClass} />,
    "💍": <GiRing className={defaultClass} />,
    "📿": <GiNecklace className={defaultClass} />,
    "👕": <GiChestArmor className={defaultClass} />,
    "👔": <GiChestArmor className={defaultClass} />,
    "🧤": <GiGloves className={defaultClass} />,
    "⛑": <GiHelmet className={defaultClass} />,
    "🪖": <GiHelmet className={defaultClass} />,
    "🗡️": <GiPlainDagger className={defaultClass} />,
    "⚔️": <Swords className={defaultClass} />,
    "🛡️": <Shield className={defaultClass} />,
    "🔮": <Wand className={defaultClass} />,
    "🪄": <Wand className={defaultClass} />,
    "🪓": <Axe className={defaultClass} />,
    "🔨": <Hammer className={defaultClass} />,
    "🧪": <GiHealthPotion className={defaultClass} />,
    "💎": <Gem className={defaultClass} />,
    "📜": <Scroll className={defaultClass} />,
    "📖": <Book className={defaultClass} />,
    "👑": <Crown className={defaultClass} />,
    "🔥": <Flame className={defaultClass} />,
    "⚡": <Zap className={defaultClass} />,
    "💧": <Droplet className={defaultClass} />,
    "🌪": <Wind className={defaultClass} />,
    "✨": <Sparkles className={defaultClass} />,
    "🏪": <Store className={defaultClass} />,
    "🏠": <Home className={defaultClass} />,
    "📍": <MapPin className={defaultClass} />,
    "🎲": <Dices className={defaultClass} />,
    "⚜": <Sparkles className={defaultClass} />,
    "🧥": <GiCape className={defaultClass} />,
    "🥾": <GiLeatherBoot className={defaultClass} />,
    "🪢": <GiBeltArmor className={defaultClass} />,
    "💠": <Gem className={defaultClass} />,
    "🪶": <Leaf className={defaultClass} />,
    "🔩": <Wrench className={defaultClass} />,
    "🌿": <Leaf className={defaultClass} />,
    "🧷": <GiBeltArmor className={defaultClass} />,
    "🐘": <GiElephantHead className={defaultClass} />,
    "🫏": <GiTrojanHorse className={defaultClass} />,
    "🐪": <GiCamel className={defaultClass} />,
    "🐴": <GiHorseHead className={defaultClass} />,
  };

  if (emojiMap[normalized]) {
    return emojiMap[normalized];
  }

  // 2. Si es una string larga (nombre de objeto de la BD), buscar por keywords
  if (normalized.length > 3) {
    const lowerName = normalized.toLowerCase();
    for (const [keywords, IconComp] of KEYWORD_RULES) {
      if (keywords.some((kw) => lowerName.includes(kw))) {
        return <IconComp className={defaultClass} />;
      }
    }
    
    // Si hay fallback (ej. emoji del slot), usarlo
    if (fallbackIconStr && emojiMap[fallbackIconStr.trim()]) {
      return emojiMap[fallbackIconStr.trim()];
    }

    // Fallback genérico para objetos de BD sin keyword ni fallback de slot
    return <GiCardboardBox className={defaultClass} />;
  }

  // 3. Si es un emoji cortito que no está en el mapa, renderizarlo literal
  return <span className={className}>{normalized}</span>;
};
