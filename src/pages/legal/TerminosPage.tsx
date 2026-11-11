import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useSeo } from "../../app/hooks/useSeo";

export function TerminosPage() {
  const { hash } = useLocation();
  // Links like /terminos-y-condiciones#preventas land on that section.
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ block: "start" });
  }, [hash]);
  useSeo({
    title: "Términos y condiciones",
    description:
      "Términos y condiciones de compra en Moctezuma Records: precios, pagos, envíos, garantías y políticas de devolución de discos de vinilo."
  });
  return (
    <section className="space-y-5 rounded-[28px] border border-navy/10 bg-cream/80 p-6 shadow-panel backdrop-blur sm:p-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.18em] text-orange">
          Legal
        </p>
        <h1 className="font-display text-3xl text-denim">
          Términos y Condiciones
        </h1>
        <p className="text-sm text-navy/70">
          Última actualización: noviembre 2026
        </p>
      </header>

      <div className="space-y-6 text-sm leading-relaxed text-navy/80">
        <section className="space-y-2">
          <h2 className="font-display text-lg text-denim">1. Aceptación</h2>
          <p>
            Al acceder y utilizar el sitio de Moctezuma Records, aceptas estos
            términos y condiciones en su totalidad. Si no estás de acuerdo con
            alguno de estos términos, por favor no utilices nuestro servicio.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-lg text-denim">
            2. Descripción del servicio
          </h2>
          <p>
            Moctezuma Records es una tienda de vinilos que ofrece discos de
            segunda mano y nuevos. El catálogo, precios y disponibilidad están
            sujetos a cambios sin previo aviso.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-lg text-denim">
            3. Precios y pagos
          </h2>
          <p>
            Todos los precios están en pesos mexicanos (MXN) e incluyen los
            impuestos aplicables. Los pagos se procesan de forma segura a través
            de Stripe. Nos reservamos el derecho de modificar precios en
            cualquier momento.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-lg text-denim">
            4. Envíos y entregas
          </h2>
          <p>
            Ofrecemos opciones de recoger en tienda, envío a domicilio y recoger
            en bazar. Los tiempos de entrega varían según la zona geográfica.
            El costo de envío se calcula al momento del pago para envíos a
            domicilio.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-lg text-denim">
            5. Devoluciones
          </h2>
          <p>
            Solo aceptamos devoluciones cuando el disco llegó con un problema
            diferente al descrito en el catálogo. No se aceptan devoluciones
            por mal uso del producto. Para discos con detalles especiales
            (splatter records, pre-abiertos, etc.), el catálogo indica las
            condiciones específicas — puede haber menos splatter del esperado
            o el disco puede venir preabierto. La solicitud debe hacerse
            dentro de los primeros 7 días naturales después de la entrega.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-lg text-denim">
            6. Estado de los productos
          </h2>
          <p>
            Cada vinilo se clasifica según la guía estándar de grading: Mint,
            Near Mint, VG+, VG, Good, Fair, Poor. La condición indicada
            refleja el estado del disco y la carátula al momento de la venta.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-lg text-denim">
            7. Responsabilidad
          </h2>
          <p>
            Moctezuma Records no se hace responsable por daños ocasionados
            durante el envío por parte del servicio de paquetería. En caso de
            incidentes, contacta directamente al proveedor de envío con tu
            número de rastreo.
          </p>
        </section>

        <section id="preventas" className="scroll-mt-28 space-y-2">
          <h2 className="font-display text-lg text-denim">8. Preventas y apartados</h2>
          <p>
            Una preventa es un disco que todavía no llega a la tienda. Puedes apartar una copia pagando al
            menos el apartado mínimo que indica cada preventa, o pagarla completa.
          </p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <strong>Plazo para liquidar:</strong> tienes 120 días naturales desde el día en que apartas para pagar
              el resto. Si el disco llega tarde, el plazo nunca termina antes de 15 días después de que llegue a
              la tienda. Te avisamos por correo antes de que venza.
            </li>
            <li>
              <strong>Si no liquidas a tiempo, pierdes tu apartado:</strong> el dinero que pagaste no se devuelve y
              la copia vuelve a estar disponible. Al apartar aceptas esta condición de forma expresa.
            </li>
            <li>
              <strong>Descuento por pago completo:</strong> solo aplica cuando pagas el 100&nbsp;% al apartar. Si
              apartas y liquidas después, pagas el precio completo.
            </li>
            <li>
              <strong>Pagos:</strong> puedes liquidar en línea desde Mis órdenes o en la tienda en efectivo,
              tarjeta o transferencia. Cada pago queda registrado en tu preventa.
            </li>
            <li>
              <strong>Envío:</strong> si elegiste envío a domicilio, el costo se cotiza con la paquetería cuando el
              disco llega a la tienda y se paga junto con tu último pago. Si pagas completo al apartar, el envío se
              cobra en ese momento al precio cotizado y ya no cambia.
            </li>
            <li>
              <strong>Entrega:</strong> el disco se entrega únicamente al presentar tu código de preventa (por ejemplo
              PV-7K3Q) o su código QR, y solo cuando la preventa está pagada por completo.
            </li>
            <li>
              <strong>Una copia por orden:</strong> cada preventa que apartas es una copia; para más copias, aparta
              otra vez.
            </li>
            <li>
              <strong>Fechas de llegada:</strong> las fechas de llegada son estimadas y dependen del distribuidor. Si
              una preventa se cancela por causas de la tienda o del distribuidor, te devolvemos todo lo que
              pagaste.
            </li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-lg text-denim">
            9. Cambios en los términos
          </h2>
          <p>
            Nos reservamos el derecho de actualizar estos términos en cualquier
            momento. Te notificaremos de cambios significativos a través de
            nuestro sitio o por correo electrónico.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-lg text-denim">10. Contacto</h2>
          <p>
            Para dudas sobre estos términos, escríbenos a{" "}
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

export default TerminosPage;
