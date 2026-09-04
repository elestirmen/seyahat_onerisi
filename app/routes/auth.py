"""
Authentication routes (admin token).

No sessions/cookies are used. Admin clients authenticate by sending `X-Admin-Token`
or `Authorization: Bearer ...` headers.
"""

from __future__ import annotations

from flask import Blueprint, jsonify, redirect, request

from auth_config import auth_config
from auth_middleware import auth_middleware


auth_bp = Blueprint("auth", __name__, url_prefix="/auth")


@auth_bp.route("/login", methods=["GET", "POST", "OPTIONS"])
def login():
    if request.method == "OPTIONS":
        response = jsonify({"status": "ok"})
        response.headers.add("Access-Control-Allow-Origin", "*")
        response.headers.add("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Admin-Token")
        response.headers.add("Access-Control-Allow-Methods", "POST, OPTIONS")
        return response

    if request.method == "POST":
        client_ip = auth_middleware.get_client_ip()
        allowed, _, _, retry_after = auth_middleware.check_rate_limit(client_ip)
        if not allowed:
            response = jsonify(
                {"success": False, "error": "Too many failed login attempts"}
            )
            response.status_code = 429
            response.headers["Retry-After"] = str(retry_after)
            return response

        data = request.get_json(silent=True) if request.is_json else request.form
        try:
            token = (data.get("token") or data.get("password") or "").strip()
        except Exception:
            token = ""

        if not auth_config.is_admin_token_configured():
            return jsonify({"success": False, "error": "Admin token not configured"}), 503

        if not auth_config.validate_admin_token(token):
            auth_middleware.record_failed_attempt(
                client_ip, request.headers.get("User-Agent")
            )
            return jsonify({"success": False, "error": "Invalid token"}), 401

        auth_middleware.clear_failed_attempts(client_ip)
        return jsonify({"success": True, "message": "Login successful"}), 200

    # GET
    if auth_middleware.is_authenticated():
        next_url = request.args.get("next") or "/"
        if isinstance(next_url, str) and next_url.startswith("/") and "://" not in next_url and "\\" not in next_url:
            return redirect(next_url)
        return redirect("/")

    return (
        """
<!DOCTYPE html>
<html lang="tr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Admin Girişi</title>
    <style>
      body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; margin: 0; min-height: 100vh; display: grid; place-items: center; background: #0b1220; color: #e5e7eb; }
      .card { width: 100%; max-width: 520px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); border-radius: 14px; padding: 24px; box-shadow: 0 18px 40px rgba(0,0,0,0.35); }
      h1 { font-size: 18px; margin: 0 0 6px; }
      p { margin: 0 0 14px; opacity: 0.85; line-height: 1.4; }
      label { display:block; font-size: 13px; margin: 14px 0 6px; opacity: 0.95; }
      input { width: 100%; padding: 12px 12px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.15); background: rgba(0,0,0,0.2); color: #fff; }
      button { margin-top: 16px; width: 100%; padding: 12px; border-radius: 10px; border: 0; background: #4f46e5; color: #fff; font-weight: 600; cursor: pointer; }
      button[disabled] { opacity: 0.6; cursor: not-allowed; }
      .msg { margin-top: 12px; font-size: 13px; }
      .msg.err { color: #fecaca; }
      .msg.ok { color: #bbf7d0; }
      code { background: rgba(0,0,0,0.25); padding: 2px 6px; border-radius: 6px; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Admin Token</h1>
      <p>Devam etmek için <code>POI_ADMIN_TOKEN</code> değerini girin.</p>
      <form id="loginForm">
        <label for="token">Token</label>
        <input id="token" type="password" autocomplete="off" required />
        <button id="submitBtn" type="submit">Giriş Yap</button>
        <div id="msg" class="msg"></div>
      </form>
    </div>
    <script>
      const form = document.getElementById('loginForm');
      const msg = document.getElementById('msg');
      const btn = document.getElementById('submitBtn');
      const tokenInput = document.getElementById('token');

      function setLoading(loading) {
        btn.disabled = loading;
        btn.textContent = loading ? 'Kontrol ediliyor...' : 'Giriş Yap';
      }

      function show(text, ok) {
        msg.textContent = text;
        msg.className = 'msg ' + (ok ? 'ok' : 'err');
      }

      function getNext() {
        const params = new URLSearchParams(window.location.search);
        const next = params.get('next') || '/';
        if (next.startsWith('/') && !next.includes('://') && !next.includes('\\\\')) return next;
        return '/';
      }

      function getStoredToken() {
        try {
          const sessionToken = (sessionStorage.getItem('poi_admin_token') || '').trim();
          if (sessionToken) return sessionToken;
        } catch (_) {}

        try {
          const legacyToken = (localStorage.getItem('poi_admin_token') || '').trim();
          if (legacyToken) return legacyToken;
        } catch (_) {}

        return '';
      }

      function clearStoredToken() {
        try { sessionStorage.removeItem('poi_admin_token'); } catch (_) {}
        try { localStorage.removeItem('poi_admin_token'); } catch (_) {}
      }

      function storeToken(token) {
        const value = (token || '').trim();
        if (!value) return;
        try { sessionStorage.setItem('poi_admin_token', value); } catch (_) {}
        try { localStorage.removeItem('poi_admin_token'); } catch (_) {}
      }

      async function validateSession(candidate) {
        const headers = { 'Accept': 'application/json' };
        if (candidate) headers['X-Admin-Token'] = candidate;
        const res = await fetch('/auth/status', {
          headers
        });
        const data = await res.json().catch(() => ({}));
        return Boolean(data && data.authenticated);
      }

      async function performLogin(candidate) {
        const res = await fetch('/auth/login', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ token: candidate })
        });
        const data = await res.json().catch(() => ({}));
        return { ok: Boolean(res.ok && data && data.success), data };
      }

      async function autoLoginIfPresent() {
        try {
          const existing = getStoredToken();
          const alreadyAuthenticated = await validateSession(existing);
          if (alreadyAuthenticated) {
            window.location.href = getNext();
            return;
          }

          if (!existing) return;

          setLoading(true);
          const result = await performLogin(existing);
          if (result.ok) {
            storeToken(existing);
            window.location.href = getNext();
          } else {
            clearStoredToken();
          }
        } finally {
          setLoading(false);
        }
      }

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const token = (tokenInput.value || '').trim();
        if (!token) return;
        setLoading(true);
        show('', true);
        try {
          const result = await performLogin(token);
          if (result.ok) {
            storeToken(token);
            show('✅ Token doğrulandı', true);
            setTimeout(() => window.location.href = getNext(), 200);
          } else {
            clearStoredToken();
            show('❌ Token geçersiz veya sunucu yapılandırılmadı', false);
            tokenInput.value = '';
            tokenInput.focus();
          }
        } catch (_) {
          show('❌ Bağlantı hatası', false);
        } finally {
          setLoading(false);
        }
      });

      tokenInput.focus();
      autoLoginIfPresent();
    </script>
  </body>
</html>
""",
        200,
        {"Content-Type": "text/html; charset=utf-8"},
    )


@auth_bp.route("/logout", methods=["POST"])
def logout():
    auth_middleware.destroy_session()
    return jsonify({"success": True, "message": "Logout successful"}), 200


@auth_bp.route("/status", methods=["GET"])
def status():
    authenticated = auth_middleware.is_authenticated()
    return (
        jsonify(
            {
                "authenticated": authenticated,
                "session_info": {"authenticated": authenticated, "expires_at": None},
                "csrf_token": "",
            }
        ),
        200,
    )


@auth_bp.route("/csrf-token", methods=["GET"])
def csrf_token():
    # Compatibility for legacy frontends that expect this endpoint.
    return jsonify({"csrf_token": ""}), 200


@auth_bp.route("/change-password", methods=["POST"])
@auth_middleware.require_auth
def change_password():
    return (
        jsonify(
            {
                "success": False,
                "error": "Password auth is disabled. Rotate by changing POI_ADMIN_TOKEN.",
            }
        ),
        501,
    )


__all__ = ["auth_bp"]
