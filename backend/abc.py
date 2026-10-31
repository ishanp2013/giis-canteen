from app.database import SessionLocal
from app.models.user import User
from app.models.role import Role
from app.core.security import hash_password

db = SessionLocal()
role = db.query(Role).filter_by(name='school_admin').one()
db.add(User(login_id='admin', email='admin@example.com',
            password_hash=hash_password('ChangeMe123!'), role_id=role.id))
db.commit()