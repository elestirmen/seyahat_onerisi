#!/usr/bin/env bash
# POI API ortam değişkenlerini KALICI olarak ayarlar
set -euo pipefail

echo "👋  POI API için admin parolası hash'i ve gizli anahtar üreteceğiz."
# ----------------------------------------
# 1) bcrypt yoksa kur
pip show bcrypt >/dev/null 2>&1 || pip install -q bcrypt

# 2) Parolayı iki kez iste
read -rsp "Admin parolanızı girin: " PW1; echo
read -rsp "Parolayı tekrar girin     : " PW2; echo
[[ "$PW1" == "$PW2" ]] || { echo "❌  Parolalar uyuşmadı."; exit 1; }

# 3) bcrypt hash üret
HASH=$(python - "$PW1" <<'PY'
import bcrypt, sys
pw = sys.argv[1].encode()
print(bcrypt.hashpw(pw, bcrypt.gensalt()).decode())
PY)

# 4) 64‑hex gizli anahtar üret
SECRET=$(python - <<'PY'
import secrets; print(secrets.token_hex(32))
PY)

echo "✅  Hash ve secret key üretildi."

# 5) ~/.bashrc içine henüz yoksa ekle
BASHRC="$HOME/.bashrc"
grep -q "POI_ADMIN_PASSWORD_HASH" "$BASHRC" || cat >> "$BASHRC" <<EOF

# >>> POI API ortam değişkenleri >>>
export POI_ADMIN_PASSWORD_HASH='$HASH'
export POI_SESSION_SECRET_KEY=$SECRET
# <<< POI API ortam değişkenleri <<<
EOF
echo "✅  Değişkenler $BASHRC dosyasına eklendi."

echo -e "\n🎉  Tamam!  Yeni terminal açın **veya** 'source ~/.bashrc' deyin, sonra\n    \$ python poi_api.py\nkomutu hatasız çalışacaktır."
