# 🔐 Entra ID + FastAPI + Next.js (MSAL Python) — Step‑by‑step

> Cél: Microsoft Entra ID bejelentkezés **FastAPI** (BFF) + **Next.js 15** frontendtel. A böngésző **nem** kezel access tokent; a FastAPI állít be **HttpOnly** session sütit. MSAL Python (pip) az authhoz.

---

## 🧭 Áttekintés (BFF minta)

- **Next.js** csak a **FastAPI**‑t hívja (SSR-ben cookie forward, kliensen `credentials: 'include'`).
- **FastAPI** futtatja az **Authorization Code flow**‑t MSAL-lal.
- Siker után: **HttpOnly** süti → `app_session` (csak egy random session azonosító, **nem** token).

**Fő végpontok**

- `GET /auth/login` → Microsoft bejelentkezés ( `prompt="select_account"` )
- `GET /auth/callback` → kódcsere → session létrehozás → **redirect a frontra**
- `GET /me` → bejelentkezett user claimjei (session alapján)
- `POST /auth/logout` → session törlés + süti törlés

## 🤝 Mi az a BFF?

A **Backend‑for‑Frontend** minta egy kifejezetten a frontendhez írt vékony backend réteg. A mi esetünkben a **FastAPI** a BFF: helyettünk intézi az OIDC/MSAL authot, sessiont ad vissza HttpOnly sütiben, és szükség esetén más erőforrásokat (Graph, belső API-k) is meghív.

**Miért jó?**

- 🔒 **Biztonságosabb**: nincs access token a böngészőben.
- 🧹 **Egyszerűbb frontend**: a UI csak `/me`‑t és saját BFF végpontokat hív.
- 🔀 **Aggregálás**: több backend hívás egy helyen, egységes hibakezelés.

```
Browser (Next.js) ──► FastAPI (BFF) ──► Entra ID / Graph / saját API-k
          ▲              │
          └── HttpOnly cookie (sid) ───────┘
```

---

## ⚙️ Azure (Entra ID) beállítás — lépésről lépésre

### 1) App Registration

1. **App registrations → New registration**
   - **Name**: pl. `DemoAuth`
   - **Supported account types**: *Accounts in this organizational directory only* (Single‑tenant)
   - **Redirect URI (web)**: `http://localhost:8000/auth/callback`
2. **Certificates & secrets → New client secret** → jegyezd fel (később nem látszik)
3. **Authentication (Preview)**
   - Redirect URI-k: tartalmazza `http://localhost:8000/auth/callback`
   - **Front‑channel logout URL**: devben üresen (HTTPS kellene hozzá). Prod: `https://api.yourdomain.com/auth/logout-callback` (opcionális)
   - **Allow public client flows**: *Disabled*
4. **API permissions**
   - **Microsoft Graph → Delegated**: add hozzá `User.Read` (stabil, nem „reserved” scope)
   - (Az *OpenID* engedélyek — `openid`, `profile`, `offline_access` — MSAL által kezeltek, **nem kell** külön kérni a kódban.)
5. **Token configuration** (ajánlott)
   -  **Add optional claim → ID token → `email`** – az ID tokenbe bekerülhet az e‑mail (ha elérhető)
6. **Enterprise applications → [appod] → Properties**
   - **User assignment required?**
     - **Yes** → csak a hozzárendelt userek léphetnek be (vendégek kizárhatók). Free csomagon felhasználókat tudsz hozzárendelni.
     - **No** → minden tenant‑beli user (Guest is) beléphet; tiltás app-oldalon végezhető.

**📸 Tedd a repo `docs/screenshots/` mappájába**\*\*

- `authentication_redirects.png` – Authentication → Redirect URIs
- `certs_and_secrets.png` – Client secret létrehozás
- `api_permissions.png` – API permissions (User.Read)
- `token_configuration_email.png` – Token configuration → `email`
- `enterprise_app_properties.png` – Enterprise app → Properties (Assignment required?)
- `enterprise_app_users.png` – Enterprise app → Users and groups



## 🔒 MFA a Free csomaggal (Security defaults)

A Conditional Access (CA) **P1 licencet** igényel. Free csomagon a legjobb opció a **Security defaults**:

1. Entra ID → **Properties** → **Manage security defaults** → **Enabled** (recommended) ✔️
2. Ez tenant‑szintű MFA-t ad (Microsoft Authenticator), **nem** app‑specifikus és nem finomhangolható.
3. Teszt: InPrivate ablakban lépj be; első alkalommal regisztrációt kérhet, később push/number‑match ellenőrzést.

**Opcionális kódos finomhangolás** – kérj mindig friss interaktív bejelentkezést, hogy a Security defaults biztosan lefusson:

```py
# /auth/login
auth_url = cca.get_authorization_request_url(
    scopes=["User.Read"],
    redirect_uri=REDIRECT_URI,
    state=state,
    prompt="login",  # minden alkalommal új login (SSO helyett)
)
```

> App‑szintű MFA / Authenticator‑only enforce‑hoz **Conditional Access (P1)** kell: Grant → *Require authentication strength* (pl. *Password + Microsoft Authenticator*), Cloud apps → a te Enterprise application‑öd.

**📸 Javasolt kép**: `security_defaults_enabled.png` (Properties panel jobb oldali kártya)

### Hol találom a Conditional Access‑t?
- **Azure Portal**: *Microsoft Entra ID → Security → Conditional Access → Policies*.
- **Entra admin center**: *Microsoft Entra ID → Protect & secure → Conditional Access*.
> Új policy létrehozásához **Entra ID P1/P2** licenc kell. Free csomagban marad a **Security defaults**.

---

## 🧩 Környezeti változók

**FastAPI – `.env`**

```env
AZURE_TENANT_ID=<tenant GUID vagy "common">
AZURE_CLIENT_ID=<app (client) id>
AZURE_CLIENT_SECRET=<client secret>
AZURE_REDIRECT_URI=http://localhost:8000/auth/callback
FRONTEND_URL=http://localhost:3000
SESSION_SECRET=change-me-in-prod
```

**Next.js – `.env.local`**

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

> Tipp: devben mindig `localhost` legyen (ne `127.0.0.1`), így a süti same‑site marad.

---

## 🐍 FastAPI — MSAL + session süti (lényeg)

**CORS**

```py
app.add_middleware(CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["GET","POST","OPTIONS"],
    allow_headers=["*"],
)
```

**MSAL kliens & Login**

```py
cca = msal.ConfidentialClientApplication(
    client_id=CLIENT_ID,
    authority=f"https://login.microsoftonline.com/{TENANT}",
    client_credential=CLIENT_SECRET,
)

@app.get("/auth/login")
def login():
    state = secrets.token_urlsafe(16)
    STATE[state] = {"ts": time.time()}
    auth_url = cca.get_authorization_request_url(
        scopes=["User.Read"],               # nem "reserved" scope
        redirect_uri=REDIRECT_URI,
        state=state,
        prompt="select_account",           # kényszerített fiókválasztó
    )
    return RedirectResponse(auth_url)
```

**Callback → session létrehozás**

```py
@app.get("/auth/callback")
def callback(state: str, code: str | None = None, error: str | None = None):
    if error:
        return RedirectResponse(f"{FRONTEND_URL}?error=signin_failed")
    if state not in STATE:
        raise HTTPException(400, "Invalid state")
    STATE.pop(state, None)

    result = cca.acquire_token_by_authorization_code(code, ["User.Read"], redirect_uri=REDIRECT_URI)
    if "id_token_claims" not in result:
        raise HTTPException(401, f"Auth failed: {result.get('error_description')}")

    sid = secrets.token_urlsafe(24)
    TOKENS[sid] = {
        "id_claims": result["id_token_claims"],
        "access_token": result.get("access_token"),
        "refresh_token": result.get("refresh_token"),
        "expires_at": int(time.time()) + int(result.get("expires_in", 0)),
    }

    resp = RedirectResponse(FRONTEND_URL)
    resp.set_cookie(
        "app_session", signer.dumps(sid),
        httponly=True, secure=False, samesite="lax", max_age=60*60*8, path="/"
    )
    return resp
```

**/me és /auth/logout**

```py
@app.get("/me")
def me(user=Depends(require_user)):
    return {"user": user}

@app.post("/auth/logout")
def logout(request: Request):
    sid = get_session_id(request)
    if sid:
        TOKENS.pop(sid, None)
    resp = JSONResponse({"ok": True})
    resp.delete_cookie("app_session", path="/")
    return resp
```

> Prodban a sütit állítsd `Secure + SameSite=None`‑ra (külön site-os front+api esetén kötelező), és használj tartós session store‑t (Redis/SQL) — lásd *Roadmap*.

---

## ⚛️ Next.js 15 (JS/JSX, shadcn)

**SSR: böngésző cookie → API**

```js
// lib/auth.js
import { cookies } from "next/headers";
export async function getUser() {
  const api = process.env.NEXT_PUBLIC_API_URL;
  const cookieHeader = (await cookies())
    .getAll()
    .map((c) => `${c.name}=${encodeURIComponent(c.value)}`)
    .join("; ");
  const res = await fetch(`${api}/me`, { cache: "no-store", headers: { Cookie: cookieHeader } });
  if (!res.ok) return null;
  const data = await res.json();
  return data.user ?? null;
}
```

**Belépés/Kilépés (shadcn)**

```jsx
// components/UserMenu.jsx (részlet)
"use client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function UserMenu({ user }) {
  const api = process.env.NEXT_PUBLIC_API_URL;
  const router = useRouter();

  if (!user) {
    return (
      <Button asChild>
        <a href={`${api}/auth/login`}>Sign in with Microsoft</a>
      </Button>
    );
  }

  async function handleLogout() {
    await fetch(`${api}/auth/logout`, { method: "POST", credentials: "include" });
    router.push("/signin");
  }

  return (
    <Button variant="outline" onClick={handleLogout}>Sign out</Button>
  );
}
```

---

## 🛡️ Protected route-ok (egyszerű, ajánlott)

**Middleware** — ha nincs session süti → `/signin`; ha van és `/signin`‑re megy → `/`

```js
// middleware.js
import { NextResponse } from "next/server";

export function middleware(req) {
  const { pathname } = req.nextUrl;
  const hasSession = req.cookies.get("app_session");

  // már belépett user ne lássa a /signin‑t
  if (pathname === "/signin" && hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  const PUBLIC = ["/signin", "/_next", "/favicon.ico", "/assets", "/public"];
  const isPublic = PUBLIC.some((p) => pathname.startsWith(p));

  if (!hasSession && !isPublic) {
    const url = req.nextUrl.clone();
    url.pathname = "/signin";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next|favicon.ico|assets|public|api).*)"] };
```

**SSR guard a layoutban** — lejárt/hibás session kiszűrésére (dupla védelem)

```jsx
// app/(protected)/layout.jsx
import { getUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import UserMenu from "@/components/UserMenu";

export const dynamic = "force-dynamic";

export default async function ProtectedLayout({ children }) {
  const user = await getUser();
  if (!user) redirect("/signin");
  return (
    <main className="min-h-[calc(100vh-68px)] p-6 flex flex-col items-center gap-6">
      <header className="w-full max-w-3xl flex justify-end">
        <UserMenu user={user} />
      </header>
      {children}
    </main>
  );
}
```

**Sign‑in oldal**

```jsx
// app/(public)/signin/page.jsx
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function SignInPage() {
  const user = await getUser();
  if (user) redirect("/");
  const api = process.env.NEXT_PUBLIC_API_URL;
  return (
    <main className="min-h-screen grid place-items-center p-6">
      <div className="max-w-md w-full text-center space-y-4">
        <h1 className="text-3xl font-bold">Bejelentkezés</h1>
        <p className="text-muted-foreground">Lépj be Microsoft‑fiókkal.</p>
        <Button className="w-full" asChild>
          <a href={`${api}/auth/login`}>Sign in with Microsoft</a>
        </Button>
      </div>
    </main>
  );
}
```

---

## 🧪 Gyakori hibák (quick fix)

- **TENANT=None / invalid\_tenant** → a `.env` nincs betöltve vagy más kulcsnév van. Használj `find_dotenv()`‑et; indíts jó munkakönyvtárból.
- **Reserved scope** („You cannot use any scope value that is reserved”) → ne add meg `openid/profile/offline_access`‑t; használj pl. `User.Read`‑ot.
- **Swagger → Failed to fetch** a `/auth/login`‑ra → normális (302 más originre). Teszt: **top‑level navigáció**.
- **`/me` 401 SSR‑ben** → a Next nem viszi a cookie‑t. `next/headers`‑ből állítsd össze a `Cookie` headert (lásd fenti kód).
- **Guest bejut** single‑tenantnél is → Enterprise app **Assignment required = Yes**, és csak belső user(ek) hozzárendelése; vagy app‑oldali tiltás Graph `userType` alapján.

---

## 🚀 Roadmap / bővítés későbbre

- **Session store** Redis/SQL (valódi logout, skálázhatóság)
- **Refresh token** workflow (`offline_access`), csendes frissítés végpont
- Prod **HTTPS** + `Secure` süti, külön site esetén `SameSite=None`
- API védése saját **Expose an API** + audience ellenőrzéssel


