import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PoliticaDePrivacidad() {
  return (
    <div className="min-h-screen bg-background p-4 md:p-8 lg:p-12 relative">
      <div className="max-w-4xl mx-auto relative z-10">
        <Link href="/login">
          <Button variant="ghost" className="mb-6 hover:bg-gold/10 hover:text-gold text-muted-foreground transition-colors">
            <ChevronLeft className="w-4 h-4 mr-2" />
            Volver al Inicio
          </Button>
        </Link>
        
        <div className="bg-card border-2 border-[#8B4513] shadow-[inset_0_0_20px_rgba(0,0,0,0.5),0_0_10px_rgba(139,69,19,0.2)] rounded-lg p-6 md:p-10">
          <h1 className="text-3xl md:text-4xl font-serif text-gold mb-8 text-center border-b border-gold/20 pb-6">
            Política de Privacidad
          </h1>
          
          <div className="space-y-6 text-muted-foreground leading-relaxed">
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">1. Información General</h2>
              <p>
                Esta Política de Privacidad describe cómo <strong>NOVASITE</strong>, empresa responsable del desarrollo y mantenimiento de "Mea Culpa" (en adelante, la "Plataforma"), recopila, utiliza, almacena y comparte su información personal al utilizar nuestros servicios. Su privacidad es fundamental para nosotros, y nos comprometemos a proteger sus datos.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">2. Información que Recopilamos</h2>
              <p>
                Recopilamos la siguiente información para brindarle la mejor experiencia posible:
              </p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li><strong>Información de Cuenta:</strong> Dirección de correo electrónico, nombre de usuario y contraseñas cifradas.</li>
                <li><strong>Autenticación de Terceros:</strong> Si decide iniciar sesión mediante Google o Discord, recibiremos la información pública de su perfil que dichos servicios nos proporcionen (como su correo electrónico y nombre).</li>
                <li><strong>Datos de Juego:</strong> Información sobre sus personajes, historial de partidas, inventario, interacciones con otros usuarios y compras realizadas dentro del juego.</li>
                <li><strong>Datos Técnicos:</strong> Dirección IP, tipo de navegador, sistema operativo y otra información de uso recopilada a través de cookies y tecnologías similares.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">3. Uso de la Información</h2>
              <p>
                Utilizamos su información personal para los siguientes fines:
              </p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>Crear y mantener su cuenta en la Plataforma.</li>
                <li>Proveer, personalizar y mejorar las mecánicas de juego y el servicio en general.</li>
                <li>Procesar transacciones y compras de bienes virtuales (procesadas mediante pasarelas seguras como PayPal/MercadoPago, donde no almacenamos datos completos de tarjetas).</li>
                <li>Comunicarnos con usted respecto a actualizaciones, seguridad y soporte técnico.</li>
                <li>Prevenir fraudes, abusos o violaciones a nuestras Condiciones de Servicio.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">4. Compartir y Divulgar Información</h2>
              <p>
                NOVASITE no vende ni alquila su información personal a terceros. Podemos compartir su información únicamente en las siguientes circunstancias:
              </p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li><strong>Proveedores de Servicios:</strong> Utilizamos herramientas de terceros (como Supabase para el alojamiento de bases de datos y autenticación) que procesan la información en nuestro nombre bajo estrictos acuerdos de confidencialidad.</li>
                <li><strong>Cumplimiento Legal:</strong> Cuando sea requerido por ley, orden judicial, o para proteger los derechos, la propiedad y seguridad de NOVASITE, nuestros usuarios o el público.</li>
                <li><strong>Dentro del Juego:</strong> Cierta información (como su nombre de usuario, nivel y atributos de personaje) es pública para otros jugadores dentro del entorno del juego.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">5. Seguridad de sus Datos</h2>
              <p>
                Implementamos medidas de seguridad técnicas y organizativas (incluyendo cifrado de extremo a extremo y políticas de acceso a nivel de fila - RLS) para proteger su información contra acceso no autorizado, alteración, divulgación o destrucción. No obstante, ningún método de transmisión por Internet o almacenamiento electrónico es 100% seguro.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">6. Sus Derechos</h2>
              <p>
                Usted tiene derecho a acceder, corregir, actualizar o solicitar la eliminación de su información personal. Puede gestionar muchos de estos datos directamente desde el panel de configuración de su perfil en la Plataforma. Para solicitudes específicas de eliminación completa de cuenta, póngase en contacto con nuestro equipo de soporte.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">7. Modificaciones a esta Política</h2>
              <p>
                NOVASITE puede actualizar esta Política de Privacidad ocasionalmente para reflejar cambios en nuestras prácticas o servicios. Le notificaremos sobre cambios significativos publicando un aviso en la Plataforma. Le recomendamos revisar esta página periódicamente.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">8. Contacto</h2>
              <p>
                Si tiene alguna pregunta, inquietud o reclamo respecto a esta Política de Privacidad o el tratamiento de sus datos, por favor contáctenos a través de los canales de atención al usuario de NOVASITE provistos en la aplicación.
              </p>
            </section>
            
            <p className="text-sm mt-8 pt-6 border-t border-border">
              Última actualización: {new Date().toLocaleDateString('es-ES')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
