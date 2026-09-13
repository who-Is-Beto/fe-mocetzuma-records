import { usePageTitle } from "../../app/hooks/usePageTitle";
export function PrivacidadPage() {
  usePageTitle("Política de privacidad");
  return (
    <section className="space-y-5 rounded-[28px] border border-navy/10 bg-cream/80 p-6 shadow-panel backdrop-blur sm:p-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.18em] text-orange">
          Legal
        </p>
        <h1 className="font-display text-3xl text-denim">
          Política de Privacidad
        </h1>
        <p className="text-sm text-navy/70">
          Última actualización: julio 2025
        </p>
      </header>

      <div className="space-y-6 text-sm leading-relaxed text-navy/80">
        <section className="space-y-2">
          <h2 className="font-display text-lg text-denim">
            1. Información que recopilamos
          </h2>
          <p>
            Recopilamos la información que nos proporcionas directamente al
            crear una cuenta, realizar una compra o contactarnos: nombre,
            correo electrónico, dirección de envío y teléfono.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-lg text-denim">
            2. Uso de la información
          </h2>
          <p>Utilizamos tu información para:</p>
          <ul className="ml-4 list-inside list-disc space-y-1 text-navy/70">
            <li>Procesar y enviar tus pedidos.</li>
            <li>Enviar confirmaciones y actualizaciones de tu compra.</li>
            <li>Verificar tu cuenta y proteger contra fraudes.</li>
            <li>Mejorar nuestro servicio y catálogo.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-lg text-denim">
            3. Compartir información
          </h2>
          <p>
            No vendemos ni compartimos tu información personal con terceros,
            excepto cuando sea necesario para completar tu pedido (por ejemplo,
            el servicio de envío recibirán tu nombre y dirección de entrega).
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-lg text-denim">4. Seguridad</h2>
          <p>
            Los pagos se procesan a través de Stripe, que cumple con el
            estándar PCI DSS. No almacenamos datos de tarjetas de crédito en
            nuestros servidores.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-lg text-denim">
            5. Cookies y tecnologías similares
          </h2>
          <p>
            Utilizamos cookies esenciales para el funcionamiento del sitio
            (autenticación, carrito de compras). No utilizamos cookies de
            rastreo publicitario de terceros.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-lg text-denim">6. Tus derechos</h2>
          <p>
            Tienes derecho a acceder, corregir o eliminar tu información
            personal en cualquier momento. Para ejercer estos derechos,
            contáctanos a través de Instagram.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-lg text-denim">7. Contacto</h2>
          <p>
            Para preguntas sobre esta política, escríbenos a{" "}
            <a
              href="https://www.instagram.com/moctezuma_records/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-orange underline underline-offset-2 transition hover:text-navy"
            >
              @moctezuma_records
            </a>{" "}
            en Instagram.
          </p>
        </section>
      </div>
    </section>
  );
}

export default PrivacidadPage;
