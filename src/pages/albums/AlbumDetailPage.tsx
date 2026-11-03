import { Navigate, useParams } from 'react-router-dom'

/**
 * Legacy /albums/:albumId links (the route was a placeholder): records live
 * at /records/:slug, which shows the friendly "not found" when it's gone.
 */
export function AlbumDetailPage() {
  const { albumId } = useParams<{ albumId: string }>()
  return <Navigate to={albumId ? `/records/${albumId}` : '/catalogo'} replace />
}

export default AlbumDetailPage
