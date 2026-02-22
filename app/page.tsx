"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import {
  User,
  MessageSquare,
  CreditCard,
  Users,
  ShoppingBag,
  Wallet,
  Calendar,
  Store,
  Lock,
  Scroll,
  Sparkles,
  LogIn,
  LogOut,
  UserCircle2,
} from "lucide-react"
import { useAuth } from "@/lib/useAuth"

// Datos de noticias del periódico
const newsArticles = [
  {
    id: 1,
    title: "POSIBILIDAD DE LA APERTURA DE UNA NUEVA TABERNA EN MEA CULPA!!!",
    content:
      "Buenas días Mea Culpa!! El día de hoy les traigo buenas noticias porque hoy se abre la taberna 'Última Hora'. Un lugar en el que podras reunirte y disfrutar un poco de un estadía en Mea Culpa. Item, esta esperamos al personaje que atienda este nuevo rincón, y es los hechos y razones económicas y humildes que se pasen a disfrutar cualquier cosa.",
  },
  {
    id: 2,
    title: "ENERGÍA MÁGICA DE LA MAZMORRA AUMENTA, ASI MISMO EL PELIGRO",
    content:
      "La energía mágica a aumentado dentro de la mazmorra y los enemigos grandes se han vuelto más fuertes Hemos estado que ahora no existe el rumor de solo dormidos. Y tener y aún que aumentó sus números a 60!",
  },
  {
    id: 3,
    title: "AVISO IMPORTANTE",
    content:
      "Para todos los gremios y aventureros de nuevos, los devaneos son bienvenidos mas y que esperemos ser buenas familias que van a ir más allá.",
  },
]

// Datos del periódico
const newspaperData = {
  title: "EL HERALDO DE MEA CULPA",
  subtitle: "Noticias Oficiales",
  reporter: "LIZA, REPORTERA",
  volume: "VOLUMEN #3",
  editor: "EDITOR: MALOG",
  mainContent:
    "En estas semanas, el duque del distrito sur, anuncio a las localidades con todos sus provenientes en una cerranza a otra ubicación de la ciudad. La guardia espera haber neutralizado trámites de esta decisión de traslado, entes ya publicar debido a la reciente actividad de una banda lacrón en la ciudad. Al duque últimamente les ocultaba lidiándose y restando/recogiendo asuntos extracontables, y por ello aún tiene estado.",
}

// Slots de personajes
const characterSlots = [
  { id: 1, name: "Human Sorcerer", level: 12, locked: false, active: true },
  { id: 2, name: "Elf Ranger", level: 8, locked: false, active: false },
  { id: 3, name: null, locked: true, active: false },
  { id: 4, name: null, locked: true, active: false },
  { id: 5, name: null, locked: true, active: false },
]

// Items del menú lateral
const sidebarItems = [
  { id: "tienda", label: "Tienda", icon: Store, hasIndicator: true },
  { id: "balance", label: "Balance", icon: Wallet, hasIndicator: false },
  { id: "eventos", label: "Eventos", icon: Calendar, hasIndicator: false },
  { id: "comercio", label: "Comercio", icon: ShoppingBag, hasIndicator: false, subtitle: "(compra y venta entre pj)" },
]

// Botones del header
const headerButtons = [
  { id: "cuenta", icon: User, label: "Cuenta", highlighted: true },
  { id: "chat", icon: MessageSquare, label: "Chat de Gremio" },
  { id: "paypal", icon: CreditCard, label: "Pagos" },
  { id: "amigos", icon: Users, label: "Amigos" },
]

export default function HomePage() {
  const router = useRouter()
  const { user, isAuthenticated, logout } = useAuth()
  const [activeSection, setActiveSection] = useState("tienda")
  const [activeSlot, setActiveSlot] = useState(1)

  const handleLogout = () => {
    logout()
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Background texture */}
      <div
        className="fixed inset-0 opacity-5 pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fillRule='evenodd'%3E%3Cg fill='%23ffffff' fillOpacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />

      <div className="relative z-10 max-w-7xl mx-auto p-4">
        {/* Header */}
        <header className="flex items-center justify-between mb-6 bg-card rounded-lg border border-border p-3 medieval-border">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="relative w-16 h-12 rounded-lg overflow-hidden flex items-center justify-center">
              <Image
                src="/imgs/mea-culpa-logo.jpeg"
                alt="Mea Culpa Logo"
                fill
                className="object-contain"
                priority
              />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gold tracking-wider font-sans">MEA CULPA</h1>
              <p className="text-xs text-muted-foreground">RPG Online</p>
            </div>
          </div>

          {/* Header Buttons */}
          <div className="flex items-center gap-2">
            {isAuthenticated && user ? (
              <>
                {headerButtons.map((button) => (
                  <button
                    key={button.id}
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                      button.highlighted
                        ? "bg-gold text-background ring-2 ring-gold/50"
                        : "bg-secondary text-muted-foreground hover:bg-muted hover:text-gold"
                    }`}
                    title={button.label}
                  >
                    <button.icon className="w-5 h-5" />
                  </button>
                ))}
                <div className="hidden sm:block text-right mx-2">
                  <p className="text-sm font-medium text-gold">{user.name}</p>
                  <p className="text-xs text-muted-foreground">Nivel {user.level}</p>
                </div>
                <button
                  onClick={() => router.push("/profile")}
                  className="w-10 h-10 rounded-full flex items-center justify-center bg-gold text-background ring-2 ring-gold/50 transition-all hover:bg-gold-dim"
                  title="Ver Perfil"
                >
                  <UserCircle2 className="w-5 h-5" />
                </button>
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 bg-secondary hover:bg-muted text-muted-foreground hover:text-destructive font-medium rounded-lg transition-all flex items-center gap-2"
                  title="Cerrar Sesión"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">Salir</span>
                </button>
              </>
            ) : (
              <>
                {headerButtons.slice(0, 2).map((button) => (
                  <button
                    key={button.id}
                    className="w-10 h-10 rounded-full flex items-center justify-center bg-secondary text-muted-foreground hover:bg-muted hover:text-gold transition-all"
                    title={button.label}
                  >
                    <button.icon className="w-5 h-5" />
                  </button>
                ))}
                <button
                  onClick={() => router.push("/login")}
                  className="px-4 py-2 bg-gold hover:bg-gold-dim text-background font-medium rounded-lg transition-all flex items-center gap-2 shadow-lg hover:shadow-xl"
                  title="Iniciar Sesión"
                >
                  <LogIn className="w-4 h-4" />
                  <span className="hidden sm:inline">Iniciar Sesión</span>
                </button>
              </>
            )}
          </div>
        </header>

        {/* Main Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr_280px] gap-4">
          {/* Left Sidebar */}
          <aside className="space-y-3">
            {sidebarItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`w-full rounded-lg border p-4 text-left transition-all ${
                  activeSection === item.id
                    ? "bg-card border-gold text-gold medieval-border"
                    : "bg-card border-border text-foreground hover:border-gold-dim"
                }`}
              >
                <div className="flex items-center gap-3">
                  <item.icon className="w-5 h-5" />
                  <span className="font-medium font-sans">{item.label}</span>
                  {item.hasIndicator && (
                    <span className="w-2 h-2 rounded-full bg-gold ml-auto" />
                  )}
                </div>
                {item.subtitle && (
                  <p className="text-xs text-muted-foreground mt-1 ml-8">{item.subtitle}</p>
                )}
              </button>
            ))}
          </aside>

          {/* Center - Newspaper */}
          <main className="bg-parchment rounded-lg overflow-hidden shadow-2xl border-4 border-gold-dim candle-glow">
            {/* Newspaper Header */}
            <div className="bg-card px-4 py-2 flex items-center justify-between border-b-2 border-gold-dim">
              <span className="text-gold font-bold text-sm tracking-widest font-sans">
                NOTI CARENSE
              </span>
              <span className="text-muted-foreground text-xs">{newspaperData.subtitle}</span>
            </div>

            {/* Newspaper Title */}
            <div className="text-center py-6 border-b-2 border-gold-dim">
              <h2 className="text-3xl md:text-4xl font-serif font-bold text-background tracking-wide">
                {newspaperData.title}
              </h2>
            </div>

            {/* Newspaper Content */}
            <div className="p-4 md:p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Column */}
                <div className="space-y-4">
                  <article className="border-b border-gold-dim/30 pb-4">
                    <h3 className="font-serif font-bold text-sm text-background mb-2 leading-tight">
                      {newsArticles[0].title}
                    </h3>
                    <p className="text-xs text-parchment-dark leading-relaxed text-justify">
                      {newsArticles[0].content}
                    </p>
                  </article>
                </div>

                {/* Right Column */}
                <div className="space-y-4">
                  <article className="border-b border-gold-dim/30 pb-4">
                    <h3 className="font-serif font-bold text-sm text-background mb-2 leading-tight">
                      {newsArticles[1].title}
                    </h3>
                    <p className="text-xs text-parchment-dark leading-relaxed text-justify">
                      {newsArticles[1].content}
                    </p>
                  </article>
                  <article>
                    <h3 className="font-serif font-bold text-sm text-background mb-2 leading-tight">
                      {newsArticles[2].title}
                    </h3>
                    <p className="text-xs text-parchment-dark leading-relaxed text-justify">
                      {newsArticles[2].content}
                    </p>
                  </article>
                </div>
              </div>

              {/* Featured Image Area */}
              <div className="mt-6 bg-parchment/80 rounded-lg p-4 border border-gold-dim/30">
                <div className="aspect-video bg-parchment/60 rounded flex items-center justify-center">
                  <Sparkles className="w-16 h-16 text-gold-dim/50" />
                </div>
              </div>

              {/* Main Article */}
              <div className="mt-6">
                <p className="text-xs text-parchment-dark leading-relaxed text-justify columns-2 gap-6">
                  {newspaperData.mainContent}
                </p>
              </div>
            </div>

            {/* Newspaper Footer */}
            <div className="bg-card px-4 py-2 flex items-center justify-center gap-4 text-xs text-gold border-t-2 border-gold-dim">
              <span className="font-sans">{newspaperData.reporter}</span>
              <span className="text-muted-foreground">*</span>
              <span className="font-sans">{newspaperData.volume}</span>
              <span className="text-muted-foreground">*</span>
              <span className="font-sans">{newspaperData.editor}</span>
            </div>
          </main>

          {/* Right Sidebar - Character Panel */}
          <aside className="space-y-4">
            {/* Active Character Card */}
            <div className="bg-card rounded-lg border border-gold-dim overflow-hidden medieval-border">
              <div className="bg-gradient-to-r from-gold-dim to-accent px-4 py-2">
                <span className="text-primary-foreground font-bold text-sm tracking-wider font-sans">HUMAN</span>
                <span className="text-gold font-bold text-sm tracking-wider ml-2 font-sans">
                  SORCERER
                </span>
              </div>
              <div className="p-4">
                <div className="aspect-square bg-background rounded-lg flex items-center justify-center mb-3 border border-border">
                  <User className="w-20 h-20 text-gold/30" />
                </div>
                <div className="text-center">
                  <p className="text-gold font-medium font-sans">Nivel 12</p>
                  <p className="text-xs text-muted-foreground">Mago de las Sombras</p>
                </div>
              </div>
            </div>

            {/* Character Slots */}
            <div className="space-y-2">
              {characterSlots.slice(1).map((slot) => (
                <button
                  key={slot.id}
                  onClick={() => !slot.locked && setActiveSlot(slot.id)}
                  disabled={slot.locked}
                  className={`w-full rounded-lg border p-3 flex items-center gap-3 transition-all ${
                    slot.locked
                      ? "bg-background border-secondary cursor-not-allowed"
                      : activeSlot === slot.id
                      ? "bg-card border-gold medieval-border"
                      : "bg-card border-border hover:border-gold-dim"
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded flex items-center justify-center ${
                      slot.locked ? "bg-secondary" : "bg-muted"
                    }`}
                  >
                    {slot.locked ? (
                      <Lock className="w-5 h-5 text-muted-foreground" />
                    ) : (
                      <User className="w-5 h-5 text-gold" />
                    )}
                  </div>
                  <div className="flex-1 text-left">
                    {slot.locked ? (
                      <p className="text-xs text-muted-foreground">Slot bloqueado</p>
                    ) : (
                      <>
                        <p className="text-sm text-foreground font-medium font-sans">{slot.name}</p>
                        <p className="text-xs text-muted-foreground">Nivel {slot.level}</p>
                      </>
                    )}
                  </div>
                </button>
              ))}
            </div>

            {/* Unlock Message */}
            <div className="bg-card rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground text-center">
                Slot de PJ bloqueados y que se desbloquean pagando
              </p>
              <button className="w-full mt-2 bg-gold hover:bg-gold-dim text-background font-medium text-sm py-2 rounded transition-colors font-sans">
                Desbloquear Slot
              </button>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
