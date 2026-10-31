#!/bin/sh
set -e

# A fresh database is created from database/schema.sql, which already matches
# the latest migration, so it only needs stamping. An existing one is upgraded.
if alembic current 2>/dev/null | grep -qE '^[0-9a-f]+'; then
    echo "Applying pending migrations..."
    alembic upgrade head
else
    echo "Fresh database, stamping migrations as up to date..."
    alembic stamp head
fi

# Optionally create the first admin account (skipped if the login already exists)
if [ -n "$ADMIN_PASSWORD" ]; then
    python - <<'EOF'
import os

from app.core.security import hash_password
from app.database import SessionLocal
from app.models.role import Role
from app.models.user import User

login_id = os.environ.get("ADMIN_LOGIN_ID", "admin")
db = SessionLocal()
try:
    if db.query(User).filter_by(login_id=login_id).first():
        print(f"Admin '{login_id}' already exists")
    else:
        role = db.query(Role).filter_by(name="school_admin").one()
        db.add(User(
            login_id=login_id,
            email=os.environ.get("ADMIN_EMAIL", "admin@example.com"),
            password_hash=hash_password(os.environ["ADMIN_PASSWORD"]),
            role_id=role.id,
        ))
        db.commit()
        print(f"Admin '{login_id}' created")
finally:
    db.close()
EOF
fi

exec "$@"
