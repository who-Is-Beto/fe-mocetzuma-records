import { usePageTitle } from "../../app/hooks/usePageTitle";
import { useState } from "react";

type FaqItem = {
  question: string;
  answer: string;
  description?: string;
};

const FAQ_ITEMS: FaqItem[] = [
  {
    question: "¿Cómo creo una cuenta?",
    answer:
      'Haz clic en "Crear cuenta" en la barra de navegación. Ingresa tu nombre de usuario, correo electrónico y contraseña. Recibirás un correo de bienvenida con un enlace de verificación — haz clic en él para activar tu cuenta y poder comprar.',
  },
  {
    question: "¿Cómo verifico mi correo electrónico?",
    answer:
      "Al registrarte, te enviamos un enlace de verificación a tu correo. Abre ese correo y haz clic en el enlace. Si no lo encuentras, revisa tu carpeta de spam o solicita un nuevo enlace desde tu perfil.",
  },
  {
    question: "¿Cómo agrego discos al carrito?",
    answer:
      'Explora el catálogo y haz clic en "Añadir al carrito" en cualquier disco. Puedes ajustar la cantidad desde el carrito. Recuerda que necesitas tener tu correo verificado para agregar artículos.',
  },
  {
    question: "¿Cómo realizo un pago?",
    answer:
      'Una vez en tu carrito, selecciona el método de entrega (recoger en tienda, envío a domicilio o recoger en bazar) y haz clic en "Proceder al pago". Serás redirigido a Stripe para completar el pago de forma segura con tarjeta de crédito o débito.',
  },
  {
    question: "¿Qué métodos de entrega hay?",
    answer:
      "Ofrecemos tres opciones: recoger en tienda (sin costo, en la CDMX), envío a domicilio (el costo se calcula al pagar) y recoger en bazar (coordina en el próximo evento).",
  },
  {
    question: "¿Cómo rastreo mi pedido?",
    answer:
      'Después de pagar, puedes ver el estado de tu orden en "Mis órdenes" desde tu perfil. El estado cambiará de Pendiente → Pagado → Enviado → Entregado.',
  },
  {
    question: "¿Puedo devolver un disco?",
    description:
      "Solo aceptamos devoluciones cuando el disco llegó con un problema diferente al descrito en el catálogo. No se aceptan devoluciones por mal uso del producto.",
    answer:
      "Si el producto llegó en diferente estado al descrito, puedes solicitar un reembolso dentro de los primeros 7 días naturales. No se aceptan devoluciones por mal uso. Para discos con detalles especiales (splatter records, pre-abiertos, etc.), el catálogo indica las condiciones específicas — por ejemplo, puede haber menos splatter del esperado o el disco puede venir preabierto. Revisa la descripción del producto antes de comprar. Contáctanos por Instagram para iniciar cualquier proceso de devolución.",
  },
  {
    question: "¿Cómo sé la condición de un vinilo?",
    description:
      "Usamos la guía estándar de grading. Cada disco en el catálogo indica su condición: Mint, Near Mint, VG+, VG, Good, Fair o Poor. Esto describe tanto el disco como la carátula.",
    answer:
      "Mint = nuevo/sellado. Near Mint = prácticamente nuevo. VG+ = muy bueno con mínimos signos de uso. VG = bueno, algunos rasguños. Good = escuchable, rasguños visibles. Fair/Poor = mucho desgaste pero aún reproducible.",
  },
  {
    question: "¿Tienen tienda física? ¿Dónde están ubicados?",
    answer:
      "Sí. Nuestra tienda está en Av. África #51, Romero Rubio, Venustiano Carranza, Ciudad de México. Puedes recoger tus pedidos aquí o encontrarnos en bazares y eventos. Consulta nuestro horario en Instagram antes de visitarnos. Encuéntranos en Google Maps: https://maps.app.goo.gl/dZ7vxKcwHnrjMECv5",
  },
  {
    question: "¿Cómo contacto a Moctezuma Records?",
    answer:
      "Escríbenos a @moctezuma_records en Instagram o visítanos en Av. África #51, Romero Rubio, Venustiano Carranza, CDMX. También puedes ver nuestra ubicación en Google Maps desde la página de Contacto.",
  },
];

function FaqAccordion({ item }: { item: FaqItem }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="overflow-hidden rounded-2xl border border-navy/10 bg-cream/80 shadow-card backdrop-blur">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 p-4 text-left transition hover:bg-cream focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange"
      >
        <p className="font-display text-base text-denim">{item.question}</p>
        <span
          aria-hidden="true"
          className={`shrink-0 text-navy/50 transition-transform duration-300 ${
            open ? "rotate-180" : ""
          }`}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </span>
      </button>

      <div
        className={`grid transition-all duration-300 ease-in-out ${
          open
            ? "grid-rows-[1fr] opacity-100"
            : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <div className="border-t border-navy/10 px-4 pb-4 pt-3 text-sm leading-relaxed text-navy/80">
            {item.description ? (
              <p className="mb-2 text-navy/60">{item.description}</p>
            ) : null}
            <p>{item.answer}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AyudaPage() {
  usePageTitle("Centro de ayuda");
  return (
    <section className="space-y-5 rounded-[28px] border border-navy/10 bg-cream/80 p-6 shadow-panel backdrop-blur sm:p-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.18em] text-orange">
          Centro de ayuda
        </p>
        <h1 className="font-display text-3xl text-denim">
          Preguntas frecuentes
        </h1>
        <p className="text-sm text-navy/70">
          Encuentra respuestas a las dudas más comunes sobre Moctezuma Records.
        </p>
      </header>

      <div className="space-y-3">
        {FAQ_ITEMS.map((item) => (
          <FaqAccordion key={item.question} item={item} />
        ))}
      </div>

      <div className="space-y-3 rounded-2xl border border-navy/10 bg-white/60 p-5 text-center shadow-inner">
        <p className="font-display text-lg text-denim">¿No encontraste tu respuesta?</p>
        <p className="text-sm text-navy/70">
          Escríbenos directamente y te ayudamos.
        </p>
        <a
          href="https://www.instagram.com/moctezuma_records/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block rounded-pill border border-orange/60 bg-orange px-5 py-2.5 text-sm font-semibold text-charcoal shadow-panel transition hover:-translate-y-0.5 hover:bg-amber"
        >
          Contáctame en Instagram
        </a>
      </div>
    </section>
  );
}

export default AyudaPage;
