// Vercel Routing Middleware: a browser login prompt for the staging site.
// Only active where STAGE_PASSWORD is set (Vercel → Preview env, branch `stage`);
// production never sets it, so this is a no-op there. User name: STAGE_USER or "moctezuma".
export default function middleware(request: Request) {
  const password = process.env.STAGE_PASSWORD;
  if (!password) return;
  const expected = `Basic ${btoa(`${process.env.STAGE_USER || "moctezuma"}:${password}`)}`;
  if (request.headers.get("authorization") === expected) return;
  return new Response("Acceso solo para pruebas.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Moctezuma Records stage", charset="UTF-8"' }
  });
}
