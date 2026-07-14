from dataclasses import dataclass, field

from investor_encoder import normalize_stage

"""
The startup being matched isn't in our database -- it's a direct-contact input staff
type in (name, sector tags, stage, target raise, description). This used to bulk-fetch
SEC Form D leads via data_puller.fetch_raw_startup_data(); that no longer applies, since
we're matching one ad hoc startup at a time, not scoring a bulk table.
"""


@dataclass
class StartupInput:
    name: str
    verticals: list[str] = field(default_factory=list)
    stage: str | None = None
    target_raise: float | None = None
    description: str = ""
    location: str | None = None

    @property
    def normalized_stage(self) -> str | None:
        return normalize_stage(self.stage)
