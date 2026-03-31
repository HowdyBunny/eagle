from datetime import datetime, timezone


def calculate_confidence_score(
    created_at: datetime,
    current_tenure_months: float | None = None,
) -> float:
    """
    信息置信度评分算法 (PRD 定义):
    - 基准分: 100
    - 时间衰减: 入库每超过1个月，扣5分
    - 任期30-40月 (接近期权兑现): 加20分 (异动可能性高)
    - 任期 < 12月 (刚入职): 扣30分 (难以被挖)
    - 最终分低于60分，系统标记 [⚠️ 信息可能过时 / 需激活]
    """
    score = 100.0

    # Time decay since ingestion
    now = datetime.now(tz=timezone.utc)
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)
    months_since_ingestion = (now - created_at).days / 30.0
    score -= months_since_ingestion * 5.0

    # Tenure signals
    if current_tenure_months is not None:
        if 30.0 <= current_tenure_months <= 40.0:
            score += 20.0  # High turnover probability (option vesting period)
        elif current_tenure_months < 12.0:
            score -= 30.0  # Recently joined, hard to poach

    return max(0.0, min(100.0, score))


def is_stale(confidence_score: float, threshold: float = 60.0) -> bool:
    return confidence_score < threshold


STALE_LABEL = "⚠️ 信息可能过时 / 需激活"
