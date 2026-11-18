// Password gate for the whole site (Vercel Routing Middleware, works for plain static sites).
// Users live in the Vercel environment variable MAP_USERS as "login:password,login2:password2".
// To revoke someone: delete their pair in Vercel -> Settings -> Environment Variables, then Redeploy.
export const config = { matcher: "/:path*" };

export default function middleware(request) {
  const url=new URL(request.url);
  if(["/assets/share.css","/assets/share.js"].includes(url.pathname) || url.pathname.startsWith("/assets/leaflet/") || url.pathname==="/share.html" || (url.pathname==="/api/registry" && url.searchParams.get("action")==="view")) return;
  if(request.method==="POST" && url.pathname==="/api/topnlab" && url.searchParams.get("action")==="step" && url.searchParams.get("job")===process.env.SYNC_RUN_JOB && process.env.SYNC_RUN_TOKEN && request.headers.get("x-sync-runner")===process.env.SYNC_RUN_TOKEN) return;
  const users = (process.env.MAP_USERS || "").split(",").map(s => s.trim()).filter(Boolean);
  const header = request.headers.get("authorization") || "";
  if (users.length && header.startsWith("Basic ")) {
    let pair = "";
    try { pair = new TextDecoder().decode(Uint8Array.from(atob(header.slice(6)), c => c.charCodeAt(0))); } catch (e) {}
    if (users.includes(pair)) return; // allowed: continue to the static file
  }
  return new Response("Нужен логин и пароль от карты.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Karta uchastkov", charset="UTF-8"', "Content-Type": "text/plain; charset=utf-8" }
  });
}
