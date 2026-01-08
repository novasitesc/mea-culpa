"use client";

import { useState } from "react";
import {
  Skull,
  Swords,
  Shield,
  Heart,
  Flame,
  ScrollText,
  Calendar,
  Crown,
  MapPin,
  Users,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  Scroll,
  Menu,
  X,
  BookOpen,
  Map,
} from "lucide-react";

const navItems = [
  { label: "Campaigns", icon: BookOpen },
  { label: "Party", icon: Users },
  { label: "World Map", icon: Map },
  { label: "Combat", icon: Swords },
];

const featuredBoss = {
  name: "Strahd von Zarovich",
  title: "Lord of Barovia",
  cr: "15",
  type: "Undead",
  hp: 144,
  ac: 16,
  description:
    "El antiguo vampiro que gobierna Barovia con puño de hierro. Un maestro de la manipulación y la magia oscura, Strahd ha cazado a incontables aventureros que osaron entrar en sus dominios.",
  abilities: [
    "Regeneración",
    "Encanto Vampírico",
    "Forma de Niebla",
    "Invocación de Bestias",
  ],
  legendary: true,
};

const newsItems = [
  {
    id: 1,
    title: "El Grupo Derrota al Dragón Negro de las Ciénagas",
    category: "Victoria",
    date: "Hace 2 días",
    excerpt:
      "Tras una épica batalla de 4 horas, nuestros valientes aventureros lograron derrotar a Vorathrax, el terror de las ciénagas orientales.",
    icon: Crown,
    highlight: true,
  },
  {
    id: 2,
    title: "Nueva Amenaza Emerge en las Montañas del Norte",
    category: "Alerta",
    date: "Hace 3 días",
    excerpt:
      "Reportes de caravanas desaparecidas sugieren la presencia de una criatura desconocida acechando los pasos montañosos.",
    icon: Skull,
    highlight: false,
  },
  {
    id: 3,
    title: "Alianza Formada con el Reino de Eldergrove",
    category: "Diplomacia",
    date: "Hace 5 días",
    excerpt:
      "El éxito en la misión diplomática ha asegurado acceso a recursos élficos y entrenamiento arcano para el grupo.",
    icon: Users,
    highlight: false,
  },
  {
    id: 4,
    title: "Mapa Antiguo Descubierto en las Ruinas",
    category: "Descubrimiento",
    date: "Hace 1 semana",
    excerpt:
      "Un pergamino encontrado en las catacumbas revela la ubicación de una fortaleza olvidada llena de tesoros.",
    icon: MapPin,
    highlight: false,
  },
];

const bosses = [
  {
    id: 1,
    name: "Beholder Anciano",
    cr: "14",
    hp: 180,
    ac: 18,
    status: "active",
    defeated: false,
    legendary: true,
  },
  {
    id: 2,
    name: "Vorathrax",
    subtitle: "Dragón Negro",
    cr: "17",
    hp: 195,
    ac: 19,
    status: "defeated",
    defeated: true,
    legendary: true,
  },
  {
    id: 3,
    name: "El Lich de las Sombras",
    cr: "21",
    hp: 135,
    ac: 17,
    status: "unknown",
    defeated: false,
    legendary: true,
  },
  {
    id: 4,
    name: "Capitán Espectral",
    cr: "8",
    hp: 85,
    ac: 15,
    status: "defeated",
    defeated: true,
    legendary: false,
  },
  {
    id: 5,
    name: "Araña Matriarca",
    cr: "11",
    hp: 120,
    ac: 14,
    status: "active",
    defeated: false,
    legendary: false,
  },
];

export default function HomePage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [hoveredBoss, setHoveredBoss] = useState<number | null>(null);

  const defeatedCount = bosses.filter((b) => b.defeated).length;
  const totalBosses = bosses.length;
  const progressPercent = Math.round((defeatedCount / totalBosses) * 100);

  return (
    <div className="min-h-screen bg-background">
      {/* Ambient background effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-accent/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10">
        {/* Header */}
        <header className="border-b border-border/50 bg-card/80 backdrop-blur-sm sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded border-2 border-[#8B7355] flex items-center justify-center bg-secondary">
                  <Scroll className="w-5 h-5 text-[#D4AF37]" />
                </div>
                <div>
                  <h1 className="text-lg font-semibold tracking-wider text-[#D4AF37]">
                    Chronicles
                  </h1>
                  <p className="text-[10px] text-muted-foreground tracking-[0.2em] uppercase">
                    of the Realm
                  </p>
                </div>
              </div>

              <nav className="hidden md:flex items-center gap-1">
                {navItems.map((item) => (
                  <button
                    key={item.label}
                    className="flex items-center px-4 py-2 text-muted-foreground hover:text-[#D4AF37] hover:bg-secondary/50 rounded tracking-wide transition-colors"
                  >
                    <item.icon className="w-4 h-4 mr-2" />
                    {item.label}
                  </button>
                ))}
              </nav>

              <button
                className="md:hidden p-2 hover:bg-secondary/50 rounded"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? (
                  <X className="w-5 h-5 text-foreground" />
                ) : (
                  <Menu className="w-5 h-5 text-foreground" />
                )}
              </button>
            </div>

            {mobileMenuOpen && (
              <nav className="md:hidden py-4 border-t border-border/30">
                <div className="flex flex-col gap-2">
                  {navItems.map((item) => (
                    <button
                      key={item.label}
                      className="flex items-center px-4 py-2 text-muted-foreground hover:text-[#D4AF37] rounded"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <item.icon className="w-4 h-4 mr-3" />
                      {item.label}
                    </button>
                  ))}
                </div>
              </nav>
            )}
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 py-8">
          {/* Featured Boss */}
          <div
            className="rounded-lg border-2 border-[#8B7355] bg-card overflow-hidden shadow-[0_0_30px_rgba(212,175,55,0.1)]"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
              <div className="relative h-64 lg:h-auto lg:min-h-100 bg-linear-to-br from-background via-card to-[#8B0000]/20 overflow-hidden">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div
                    className={`transition-transform duration-700 ${
                      isHovered ? "scale-110" : "scale-100"
                    }`}
                  >
                    <Skull className="w-48 h-48 text-[#D4AF37]/30" />
                  </div>
                </div>
                <div className="absolute inset-0 bg-linear-to-t from-card via-transparent to-transparent" />
                <div className="absolute top-4 left-4">
                  <span className="inline-flex items-center px-3 py-1 rounded bg-[#D4AF37] text-background text-xs font-semibold tracking-wider">
                    <Flame className="w-3 h-3 mr-1" />
                    LEGENDARIO
                  </span>
                </div>
              </div>

              <div className="p-6 lg:p-8 flex flex-col justify-center">
                <div className="space-y-4">
                  <div>
                    <p className="text-[#B8860B] text-sm tracking-widest uppercase mb-1">
                      Jefe Destacado
                    </p>
                    <h2 className="text-3xl lg:text-4xl font-serif text-[#D4AF37] tracking-wide">
                      {featuredBoss.name}
                    </h2>
                    <p className="text-muted-foreground italic mt-1">
                      {featuredBoss.title}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <span className="inline-flex items-center px-2 py-1 rounded border border-[#B8860B] text-[#B8860B] text-xs">
                      <Skull className="w-3 h-3 mr-1" />
                      CR {featuredBoss.cr}
                    </span>
                    <span className="inline-flex items-center px-2 py-1 rounded border border-[#8B0000] text-red-400 text-xs">
                      {featuredBoss.type}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-4 py-4 border-y border-border/50">
                    <div className="text-center">
                      <Heart className="w-5 h-5 mx-auto text-red-500 mb-1" />
                      <p className="text-xl font-bold text-foreground">
                        {featuredBoss.hp}
                      </p>
                      <p className="text-xs text-muted-foreground">Vida</p>
                    </div>
                    <div className="text-center">
                      <Shield className="w-5 h-5 mx-auto text-blue-400 mb-1" />
                      <p className="text-xl font-bold text-foreground">
                        {featuredBoss.ac}
                      </p>
                      <p className="text-xs text-muted-foreground">CA</p>
                    </div>
                    <div className="text-center">
                      <Swords className="w-5 h-5 mx-auto text-[#D4AF37] mb-1" />
                      <p className="text-xl font-bold text-foreground">+9</p>
                      <p className="text-xs text-muted-foreground">Ataque</p>
                    </div>
                  </div>

                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {featuredBoss.description}
                  </p>

                  <div className="flex flex-wrap gap-2">
                    {featuredBoss.abilities.map((ability) => (
                      <span
                        key={ability}
                        className="px-2 py-1 rounded bg-secondary text-foreground text-xs"
                      >
                        {ability}
                      </span>
                    ))}
                  </div>

                  <button className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#8B0000] hover:bg-[#8B0000]/80 text-white border border-red-900 rounded transition-colors mt-4">
                    <Swords className="w-4 h-4" />
                    Ver Estadísticas Completas
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
            {/* News Section */}
            <div className="lg:col-span-2">
              <div className="rounded-lg border-2 border-[#8B7355] bg-card overflow-hidden">
                <div className="p-4 border-b border-border/50">
                  <h3 className="flex items-center gap-3 text-[#D4AF37] text-xl font-serif tracking-wider">
                    <ScrollText className="w-6 h-6" />
                    Crónicas del Reino
                  </h3>
                </div>
                <div className="divide-y divide-border/30">
                  {newsItems.map((item) => (
                    <article
                      key={item.id}
                      className={`p-4 hover:bg-secondary/30 transition-colors cursor-pointer ${
                        item.highlight
                          ? "bg-[#D4AF37]/5 border-l-2 border-[#D4AF37]"
                          : ""
                      }`}
                    >
                      <div className="flex gap-4">
                        <div
                          className={`shrink-0 w-12 h-12 rounded flex items-center justify-center ${
                            item.highlight ? "bg-[#D4AF37]/20" : "bg-secondary"
                          }`}
                        >
                          <item.icon
                            className={`w-6 h-6 ${
                              item.highlight
                                ? "text-[#D4AF37]"
                                : "text-muted-foreground"
                            }`}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-xs ${
                                item.highlight
                                  ? "bg-[#D4AF37] text-background"
                                  : "border border-[#B8860B]/50 text-[#B8860B]"
                              }`}
                            >
                              {item.category}
                            </span>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {item.date}
                            </span>
                          </div>
                          <h4
                            className={`font-semibold mb-1 ${
                              item.highlight
                                ? "text-[#D4AF37]"
                                : "text-foreground"
                            }`}
                          >
                            {item.title}
                          </h4>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {item.excerpt}
                          </p>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>

                <div className="p-4 border-t border-border/30 text-center">
                  <button className="text-[#B8860B] hover:text-[#D4AF37] transition-colors text-sm tracking-wider">
                    Ver Todas las Crónicas →
                  </button>
                </div>
              </div>
            </div>

            {/* Bosses Gallery */}
            <div>
              <div className="rounded-lg border-2 border-[#8B7355] bg-card overflow-hidden">
                <div className="p-4 border-b border-border/50 flex items-center justify-between">
                  <h3 className="flex items-center gap-3 text-[#D4AF37] text-xl font-serif tracking-wider">
                    <Skull className="w-6 h-6" />
                    Bestiario
                  </h3>
                  <span className="px-2 py-1 rounded border border-[#B8860B] text-[#B8860B] text-xs">
                    {defeatedCount}/{totalBosses}
                  </span>
                </div>

                <div className="p-4 border-b border-border/30">
                  <div className="flex justify-between text-xs text-muted-foreground mb-2">
                    <span>Progreso de Cacería</span>
                    <span>{progressPercent}%</span>
                  </div>
                  <div className="w-full h-2 bg-secondary rounded overflow-hidden">
                    <div
                      className="h-full bg-[#D4AF37] transition-all duration-500"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>

                <div className="divide-y divide-border/30">
                  {bosses.map((boss) => (
                    <div
                      key={boss.id}
                      className={`p-3 flex items-center gap-3 cursor-pointer transition-all duration-200 ${
                        hoveredBoss === boss.id ? "bg-secondary/50" : ""
                      } ${boss.defeated ? "opacity-60" : ""}`}
                      onMouseEnter={() => setHoveredBoss(boss.id)}
                      onMouseLeave={() => setHoveredBoss(null)}
                    >
                      <div
                        className={`shrink-0 w-10 h-10 rounded flex items-center justify-center relative ${
                          boss.defeated
                            ? "bg-green-900/30"
                            : boss.status === "active"
                            ? "bg-[#8B0000]/30"
                            : "bg-secondary"
                        }`}
                      >
                        <Skull
                          className={`w-5 h-5 ${
                            boss.defeated
                              ? "text-green-500"
                              : boss.status === "active"
                              ? "text-red-400"
                              : "text-muted-foreground"
                          }`}
                        />
                        {boss.legendary && (
                          <Flame className="w-3 h-3 text-[#D4AF37] absolute -top-1 -right-1" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4
                            className={`font-semibold text-sm truncate ${
                              boss.defeated
                                ? "line-through text-muted-foreground"
                                : "text-foreground"
                            }`}
                          >
                            {boss.name}
                          </h4>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                          <span className="flex items-center gap-1">
                            <Heart className="w-3 h-3 text-red-400" />
                            {boss.hp}
                          </span>
                          <span className="flex items-center gap-1">
                            <Shield className="w-3 h-3 text-blue-400" />
                            {boss.ac}
                          </span>
                          <span className="px-1.5 py-0 rounded border border-border text-[10px]">
                            CR {boss.cr}
                          </span>
                        </div>
                      </div>

                      <div className="shrink-0">
                        {boss.defeated ? (
                          <CheckCircle2 className="w-5 h-5 text-green-500" />
                        ) : boss.status === "active" ? (
                          <AlertTriangle className="w-5 h-5 text-red-400" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-4 border-t border-border/30 text-center">
                  <button className="text-[#B8860B] hover:text-[#D4AF37] transition-colors text-sm tracking-wider">
                    Ver Bestiario Completo →
                  </button>
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-border/50 mt-16 py-8">
          <div className="max-w-7xl mx-auto px-4 text-center">
            <p className="text-muted-foreground text-sm tracking-wider">
              Chronicles of the Realm
            </p>
            <p className="text-muted-foreground/60 text-xs mt-2">
              May your dice roll true, adventurer
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}
