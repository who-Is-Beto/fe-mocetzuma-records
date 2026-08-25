import { useSeo } from "../../app/hooks/useSeo";
export function ContactoPage() {
  useSeo({
    title: "Contacto",
    description:
      "Ubicación de Moctezuma Records: Av. África #51, Romero Rubio, Venustiano Carranza, CDMX. Horarios, teléfono, WhatsApp y redes para contactarnos por tus discos de vinilo."
  });
  return (
    <section className="space-y-6 rounded-[28px] border border-navy/10 bg-cream/80 p-6 shadow-panel backdrop-blur sm:p-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.18em] text-orange">
          Contacto
        </p>
        <h1 className="font-display text-3xl text-denim">
          Encuéntranos
        </h1>
        <p className="text-sm text-navy/70">
          Ven a visitarnos o escríbenos por Instagram. Estamos en la CDMX.
        </p>
      </header>

      <div className="grid gap-5 sm:grid-cols-2">
        {/* Address card */}
        <div className="space-y-3 rounded-2xl border border-navy/10 bg-white/60 p-5 shadow-inner">
          <div className="flex items-center gap-2">
            <span className="text-lg">📍</span>
            <p className="font-display text-base text-denim">Dirección</p>
          </div>
          <p className="text-sm leading-relaxed text-navy/80">
            Av. África #51, Romero Rubio,<br />
            Venustiano Carranza,<br />
            Ciudad de México
          </p>
          <a
            href="https://maps.app.goo.gl/dZ7vxKcwHnrjMECv5"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-orange underline underline-offset-2 transition hover:text-navy"
          >
            Abrir en Google Maps
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M7 17 17 7" />
              <path d="M7 7h10v10" />
            </svg>
          </a>
        </div>

        {/* Instagram card */}
        <div className="space-y-3 rounded-2xl border border-navy/10 bg-white/60 p-5 shadow-inner">
          <div className="flex items-center gap-2">
            <span className="text-lg">💬</span>
            <p className="font-display text-base text-denim">Instagram</p>
          </div>
          <p className="text-sm leading-relaxed text-navy/80">
            Nuestro canal principal de comunicación. Escríbenos para dudas,
            pedidos especiales o coordinar tu visita.
          </p>
          <a
            href="https://www.instagram.com/moctezuma_records/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-orange underline underline-offset-2 transition hover:text-navy"
          >
            @moctezuma_records
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M7 17 17 7" />
              <path d="M7 7h10v10" />
            </svg>
          </a>
        </div>
      </div>

      {/* Map embed */}
      <div className="overflow-hidden rounded-2xl border border-navy/10 shadow-card">
        <iframe
          title="Ubicación de Moctezuma Records"
          src="https://maps.google.com/maps?q=Av.%20%C3%81frica%2051%2C%20Romero%20Rubio%2C%20Venustiano%20Carranza%2C%20Ciudad%20de%20M%C3%A9xico&t=&z=16&ie=UTF8&iwloc=&output=embed"
          width="100%"
          height="300"
          style={{ border: 0 }}
          allowFullScreen
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className="w-full"
        />
      </div>

      <div className="space-y-2 rounded-2xl border border-navy/10 bg-white/60 p-5 text-center shadow-inner">
        <p className="font-display text-lg text-denim">Horario de tienda</p>
        <p className="text-sm font-semibold text-navy">
          Todos los días de 12:00 p.m. a 10:00 p.m.
        </p>
        <p className="text-xs text-navy/60">
          Los horarios pueden variar por eventos y bazares. Consulta Instagram
          para confirmar.
        </p>
      </div>
    </section>
  );
}

export default ContactoPage;
