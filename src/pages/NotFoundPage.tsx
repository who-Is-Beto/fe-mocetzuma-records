import { Link } from 'react-router-dom'
import { useSeo } from "../app/hooks/useSeo";
import { T } from '../app/i18n/strings'
import { LostPanel } from '../components/LostPanel'
import { primaryCta, secondaryCta } from '../components/cta'

export function NotFoundPage() {
  useSeo({ title: T.notFound.pageTitle, noindex: true });
  return (
    <LostPanel
      eyebrow="Página no encontrada"
      title="Esta página se nos rayó"
      text="El enlace está roto o la página cambió de lugar. Pero no te vayas con las manos vacías: hay mucho que escuchar por aquí."
      actions={
        <>
          <Link to="/catalogo" className={primaryCta}>
            Ver catálogo
            <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1">→</span>
          </Link>
          <Link to="/" className={secondaryCta}>
            {T.notFound.backHome}
          </Link>
        </>
      }
    />
  )
}

export default NotFoundPage
