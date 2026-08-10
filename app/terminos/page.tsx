// Página estática: términos y condiciones.
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function TerminosDeServicio() {
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
            Condiciones de Servicio
          </h1>
          
          <div className="space-y-6 text-muted-foreground leading-relaxed">
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">1. Aceptación de los Términos</h2>
              <p>
                Al acceder y utilizar el juego en línea "MudHakar" (en adelante, la "Plataforma"), usted acepta estar sujeto a estas Condiciones de Servicio. 
                Si no está de acuerdo con alguno de los términos aquí expuestos, le rogamos que no utilice la Plataforma. 
                El desarrollo y mantenimiento de esta Plataforma está a cargo de <strong>NOVASITE</strong>.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">2. Descripción del Servicio</h2>
              <p>
                "MudHakar" es una experiencia de rol en línea que permite a los usuarios crear personajes, interactuar en partidas y participar en actividades comerciales dentro del juego. 
                NOVASITE se reserva el derecho de modificar, suspender o descontinuar la Plataforma en cualquier momento, con o sin previo aviso.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">3. Registro de Cuenta</h2>
              <p>
                Para acceder a las funciones de "MudHakar", deberá crear una cuenta proporcionando información veraz, actual y completa. 
                Usted es responsable de mantener la confidencialidad de sus credenciales (contraseña y/o métodos de autenticación de terceros como Google o Discord). 
                Toda actividad realizada bajo su cuenta es de su exclusiva responsabilidad.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">4. Conducta del Usuario</h2>
              <p>
                Usted acepta utilizar la Plataforma exclusivamente con fines lícitos y de acuerdo con el espíritu del juego. Está estrictamente prohibido:
              </p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>Utilizar software de terceros no autorizado, bots, scripts o cualquier método para obtener ventajas injustas.</li>
                <li>Acosar, amenazar, discriminar o abusar de otros jugadores.</li>
                <li>Vender, intercambiar o transferir cuentas o elementos virtuales por dinero real fuera de las opciones oficiales provistas por NOVASITE.</li>
                <li>Intentar vulnerar la seguridad, la base de datos o los sistemas de la Plataforma.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">5. Propiedad Intelectual</h2>
              <p>
                Todo el contenido, diseño gráfico, código, interfaces, personajes, historias, mecánicas y elementos asociados a "MudHakar" son propiedad de NOVASITE o de sus respectivos licenciantes. 
                El uso de la Plataforma no le otorga ningún derecho de propiedad sobre su contenido.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">6. Compras y Bienes Virtuales</h2>
              <p>
                La Plataforma puede ofrecer la adquisición de bienes virtuales (como oro, espacios de personaje, objetos) mediante dinero real o esfuerzo dentro del juego. 
                Todos los bienes virtuales carecen de valor monetario en el mundo real. Las compras realizadas son finales y no reembolsables, salvo disposición legal en contrario. 
                NOVASITE puede gestionar, regular, controlar, modificar o eliminar dichos bienes virtuales a su exclusivo criterio.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">7. Limitación de Responsabilidad</h2>
              <p>
                La Plataforma se proporciona "tal cual" y "según disponibilidad". NOVASITE no garantiza que el servicio sea ininterrumpido o esté libre de errores. 
                Bajo ninguna circunstancia NOVASITE será responsable por daños indirectos, incidentales, especiales, consecuentes o punitivos que resulten del uso o la incapacidad de usar la Plataforma.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">8. Modificaciones a las Condiciones</h2>
              <p>
                NOVASITE se reserva el derecho de actualizar o modificar estas Condiciones de Servicio en cualquier momento. 
                Se le notificará de cambios significativos mediante un aviso en la Plataforma. 
                El uso continuo de la Plataforma tras dichas modificaciones constituye su aceptación de los nuevos términos.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">9. Contacto</h2>
              <p>
                Si tiene alguna pregunta o inquietud respecto a estas Condiciones de Servicio, por favor contáctenos a través de los canales de soporte oficiales de la aplicación o a través de NOVASITE.
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
