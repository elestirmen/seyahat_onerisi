"""
Authentication routes for POI Travel Recommendation API.
"""

from flask import Blueprint, jsonify, redirect, request, session

from auth_middleware import auth_middleware
from app.middleware.error_handler import APIError

import secrets


auth_bp = Blueprint("auth", __name__, url_prefix="/auth")


@auth_bp.route("/login", methods=["GET", "POST", "OPTIONS"])
def login():
    """
    GET: Serve login page.
    POST: Authenticate and create session.
    """
    if request.method == "OPTIONS":
        response = jsonify({"status": "ok"})
        response.headers.add("Access-Control-Allow-Origin", "*")
        response.headers.add("Access-Control-Allow-Headers", "Content-Type")
        response.headers.add("Access-Control-Allow-Methods", "POST, OPTIONS")
        return response

    if request.method == "GET":
        if auth_middleware.is_authenticated():
            next_url = request.args.get("next")
            if isinstance(next_url, str) and next_url.startswith("/") and "://" not in next_url and "\\" not in next_url:
                return redirect(next_url)
            return redirect("/")

        # Minimal embedded login page (keeps legacy middleware redirect working).
        return """
<!DOCTYPE html>
<html lang="tr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Giriş</title>
    <style>
      body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; margin: 0; min-height: 100vh; display: grid; place-items: center; background: #0b1220; color: #e5e7eb; }
      .card { width: 100%; max-width: 420px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); border-radius: 14px; padding: 24px; box-shadow: 0 18px 40px rgba(0,0,0,0.35); }
      h1 { font-size: 18px; margin: 0 0 8px; }
      p { margin: 0 0 16px; opacity: 0.8; }
      label { display:block; font-size: 13px; margin: 14px 0 6px; opacity: 0.9; }
      input { width: 100%; padding: 12px 12px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.15); background: rgba(0,0,0,0.2); color: #fff; }
      button { margin-top: 16px; width: 100%; padding: 12px; border-radius: 10px; border: 0; background: #4f46e5; color: #fff; font-weight: 600; cursor: pointer; }
      button[disabled] { opacity: 0.6; cursor: not-allowed; }
      .msg { margin-top: 12px; font-size: 13px; }
      .msg.err { color: #fecaca; }
      .msg.ok { color: #bbf7d0; }
      .row { display:flex; align-items:center; gap:10px; margin-top: 10px; font-size: 13px; opacity:0.9; }
      .row input { width: auto; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Admin Girişi</h1>
      <p>Devam etmek için şifrenizi girin.</p>
      <form id="loginForm">
        <label for="password">Şifre</label>
        <input id="password" type="password" autocomplete="current-password" required />
        <div class="row">
          <input id="remember" type="checkbox" />
          <label for="remember" style="margin:0;">Beni hatırla</label>
        </div>
        <button id="submitBtn" type="submit">Giriş Yap</button>
        <div id="msg" class="msg"></div>
      </form>
    </div>
    <script>
      const form = document.getElementById('loginForm');
      const msg = document.getElementById('msg');
      const btn = document.getElementById('submitBtn');
      const password = document.getElementById('password');
      const remember = document.getElementById('remember');

      async function getCsrfToken() {
        try {
          const res = await fetch('/auth/csrf-token');
          const data = await res.json();
          return data && data.csrf_token;
        } catch (_) {
          return null;
        }
      }

      function setLoading(loading) {
        btn.disabled = loading;
        btn.textContent = loading ? 'Giriş yapılıyor...' : 'Giriş Yap';
      }

      function show(text, ok) {
        msg.textContent = text;
        msg.className = 'msg ' + (ok ? 'ok' : 'err');
      }

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        setLoading(true);
        show('', true);
        try {
          const csrf = await getCsrfToken();
          const res = await fetch('/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              password: password.value,
              remember_me: remember.checked,
              csrf_token: csrf
            })
          });
          const data = await res.json().catch(() => ({}));
          if (res.ok && data && data.success) {
            show('✅ Giriş başarılı', true);
            setTimeout(() => window.location.href = '/', 300);
          } else {
            show('❌ ' + (data.error || 'Giriş başarısız'), false);
            password.value = '';
            password.focus();
          }
        } catch (err) {
          show('❌ Bağlantı hatası', false);
        } finally {
          setLoading(false);
        }
      });

      password.focus();
    </script>
  </body>
</html>
"""

    # POST (login)
    try:
        client_ip = request.environ.get("HTTP_X_FORWARDED_FOR", request.remote_addr)
        data = request.get_json() if request.is_json else request.form
        password = (data.get("password") or "").strip()
        remember_me = bool(data.get("remember_me", False))
        csrf_token = (data.get("csrf_token") or "").strip()

        if not password:
            return jsonify({"success": False, "error": "Password is required"}), 400

        # If a CSRF token exists in session, validate it.
        if session.get("csrf_token") and csrf_token and not auth_middleware.validate_csrf_token(csrf_token):
            return jsonify({"success": False, "error": "Invalid CSRF token"}), 403

        if not auth_middleware.validate_password(password):
            user_agent = request.headers.get("User-Agent", "Unknown")
            auth_middleware.record_failed_attempt(client_ip, user_agent)
            _, remaining_attempts, _, _ = auth_middleware.check_rate_limit(client_ip)
            return jsonify({"success": False, "error": "Invalid password", "remaining_attempts": remaining_attempts}), 401

        auth_middleware.clear_failed_attempts(client_ip)

        if not auth_middleware.create_session(remember_me):
            return jsonify({"success": False, "error": "Failed to create session"}), 500

        return (
            jsonify(
                {
                    "success": True,
                    "message": "Login successful",
                    "csrf_token": auth_middleware.get_csrf_token(),
                    "session_info": auth_middleware.get_session_info(),
                }
            ),
            200,
        )

    except APIError as e:
        return jsonify({"success": False, "error": str(e)}), 500
    except Exception:
        return jsonify({"success": False, "error": "Internal server error"}), 500


@auth_bp.route("/logout", methods=["POST"])
def logout():
    try:
        data = request.get_json() if request.is_json else request.form
        csrf_token = (data.get("csrf_token") or "").strip() if isinstance(data, dict) else ""

        if session.get("csrf_token") and not auth_middleware.validate_csrf_token(csrf_token):
            return jsonify({"success": False, "error": "Invalid CSRF token"}), 403

        auth_middleware.destroy_session()
        return jsonify({"success": True, "message": "Logout successful"}), 200
    except Exception:
        return jsonify({"success": False, "error": "Internal server error"}), 500


@auth_bp.route("/status", methods=["GET"])
def status():
    try:
        if auth_middleware.is_authenticated():
            return jsonify(
                {
                    "authenticated": True,
                    "session_info": auth_middleware.get_session_info(),
                    "csrf_token": auth_middleware.get_csrf_token(),
                }
            ), 200
        return jsonify({"authenticated": False, "csrf_token": None}), 200
    except Exception:
        return jsonify({"authenticated": False, "error": "Internal server error"}), 500


@auth_bp.route("/csrf-token", methods=["GET"])
def csrf_token():
    try:
        if not session.get("csrf_token"):
            session["csrf_token"] = secrets.token_hex(16)
        return jsonify({"csrf_token": session.get("csrf_token")}), 200
    except Exception:
        return jsonify({"error": "Internal server error"}), 500


__all__ = ["auth_bp"]

