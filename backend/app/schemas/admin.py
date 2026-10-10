from datetime import datetime, time
from typing import Any, Optional

from pydantic import BaseModel


class SettingsOut(BaseModel):
    cutoff_time: time
    updated_at: datetime

    class Config:
        from_attributes = True


class SettingsUpdate(BaseModel):
    cutoff_time: time


class AuditLogOut(BaseModel):
    id: int
    user_id: int
    action: str
    timestamp: datetime
    metadata_json: Optional[dict[str, Any]]

    class Config:
        from_attributes = True


class PopularItemOut(BaseModel):
    menu_item_name: str
    reservation_count: int


class AnalyticsOut(BaseModel):
    total_reservations: int
    total_cancelled: int
    popular_items: list[PopularItemOut]
    waste_avoided: int
