"""Cross-course prioritisation - deliberately NOT agentic.

Ranking is multi-factor numeric comparison, which LLMs are unreliable at
and plain code does deterministically, explainably, and instantly. No LLM
call happens on this path at all - the "reason" sentence is templated from
the same numbers that drove the score, so what's shown always matches what
was computed (no risk of a model inventing a justification that doesn't
match its own ranking).
"""
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from typing import Optional

from models import CourseSignal, EvaluatedCourse, EvaluateResponse, PrevCourseState, RankedCourse


def _days_until(timestart: int | None) -> float:
    if timestart is None:
        return 999.0
    delta = timestart - datetime.now(timezone.utc).timestamp()
    return max(delta / 86400, 0.0)


def priority_score(
    grade_pct: float | None,
    weight_pct: float | None,
    days_until_due: float,
) -> float:
    urgency = max(0.1, 1 - (days_until_due / 21))  # saturates past ~3 weeks out
    risk = (100 - grade_pct) / 100 if grade_pct is not None else 0.5  # unknown grade = medium risk
    weight = (weight_pct or 0) / 100
    return round(urgency * 0.5 + risk * 0.3 + weight * 0.2, 4)


def user_tz(name: str | None):
    """The student's timezone, or the server's own when Moodle did not say (or named an unknown zone)."""
    try:
        return ZoneInfo(name) if name else None
    except Exception:  # noqa: BLE001 - an unknown zone must never break the plan
        return None


def calendar_days_until(ts: int, tz) -> int:
    """Calendar days from today to the due date, both in the student's timezone (0 = today, 1 = tomorrow)."""
    return (datetime.fromtimestamp(ts, tz).date() - datetime.now(tz).date()).days


def _reason(c: CourseSignal, days: float) -> str:
    grade_part = f"grade {c.grade_pct:.0f}%" if c.grade_pct is not None else "grade not yet released"
    if c.next_due_name is None:
        return f"{grade_part}, no upcoming deadline found."
    # Calendar days (same count the study guide shows), not rounded 24-hour blocks: "due Wed 14 Oct" is 6 days
    # from Thursday 8 Oct whatever the time of day.
    n = calendar_days_until(c.next_due_timestart, user_tz(c.timezone)) if c.next_due_timestart else int(round(days))
    when = "due today or overdue" if n <= 0 else ("due tomorrow" if n == 1 else f"due in {n} days")
    # A 0% weight means Moodle's gradebook does not count this item (or it is not set up yet): saying
    # "worth 0%" would read as "this does not matter", so only a real weight is shown.
    weight_part = f", worth {c.weight_pct:.0f}%" if c.weight_pct else ""
    return f"{grade_part}, \"{c.next_due_name}\" {when}{weight_part}."


def build_study_plan(courses: list[CourseSignal]) -> list[RankedCourse]:
    ranked = []
    for c in courses:
        days = _days_until(c.next_due_timestart)
        score = priority_score(c.grade_pct, c.weight_pct, days)
        ranked.append(RankedCourse(
            courseid=c.courseid, fullname=c.fullname, priority=score, reason=_reason(c, days),
        ))
    ranked.sort(key=lambda r: r.priority, reverse=True)
    return ranked


# ---------------------------------------------------------------------------
# Observe -> Decide -> Act: the DECIDE step.
#
# evaluate() is the deterministic policy engine. It never calls an LLM and is
# a pure function of (current signals, previous state): same input, same
# decision, and every cause it reports is derived from a diff of the data.
# Moodle (the OBSERVE side) supplies the signals and remembers the previous
# state; the ACT side (email, UI) lives in local_coursepilot.
# ---------------------------------------------------------------------------

# An urgency jump of this many points (on the 0-100 scale) interrupts the
# student. A grade falling 76% -> 38% moves urgency ~11 points; a deadline
# pulled in by one day moves it ~2.
INTERVENTION_DELTA = 10
# A smaller jump still interrupts if it makes a course the student's #1.
TOP_RANK_DELTA = 5


def _fmt_day(ts: int, tz=None) -> str:
    return datetime.fromtimestamp(ts, tz or timezone.utc).strftime("%d %b")


def _causes(c: CourseSignal, prev: Optional[PrevCourseState]) -> list[str]:
    if prev is None:
        return []
    out = []
    if c.grade_pct is not None and (prev.grade_pct is None or abs(c.grade_pct - prev.grade_pct) >= 0.5):
        before = f"{prev.grade_pct:.0f}%" if prev.grade_pct is not None else "no grade"
        out.append(f"Grade changed: {before} → {c.grade_pct:.0f}%")
    if c.next_due_timestart != prev.next_due_timestart:
        if c.next_due_timestart is None:
            out.append("No upcoming deadline any more")
        elif prev.next_due_timestart is None or c.next_due_name != prev.next_due_name:
            out.append(f"Next deadline is now \"{c.next_due_name}\" on {_fmt_day(c.next_due_timestart, user_tz(c.timezone))}")
        else:
            out.append(f"Deadline for \"{c.next_due_name}\" moved: {_fmt_day(prev.next_due_timestart, user_tz(c.timezone))} → {_fmt_day(c.next_due_timestart, user_tz(c.timezone))}")
    return out


def evaluate(courses: list[CourseSignal], previous: dict[str, PrevCourseState]) -> EvaluateResponse:
    scored = []
    for c in courses:
        days = _days_until(c.next_due_timestart)
        score = priority_score(c.grade_pct, c.weight_pct, days)
        scored.append((score, c, days))
    scored.sort(key=lambda t: t[0], reverse=True)

    evaluated, policy = [], []
    for rank, (score, c, days) in enumerate(scored, start=1):
        prev = previous.get(str(c.courseid))
        urgency = round(score * 100)
        prev_urgency = prev.urgency if prev else None
        prev_rank = prev.rank if prev else None
        delta = (urgency - prev_urgency) if prev_urgency is not None else None

        intervene = False
        if delta is not None:
            if delta >= INTERVENTION_DELTA:
                intervene = True
                policy.append(f"{c.fullname}: urgency {prev_urgency} → {urgency} (+{delta}) ≥ threshold {INTERVENTION_DELTA} → intervene")
            elif rank == 1 and prev_rank not in (None, 1) and delta >= TOP_RANK_DELTA:
                intervene = True
                policy.append(f"{c.fullname}: became #1 (was #{prev_rank}) with +{delta} ≥ {TOP_RANK_DELTA} → intervene")
            elif delta != 0 or (prev_rank is not None and prev_rank != rank):
                policy.append(f"{c.fullname}: urgency {prev_urgency} → {urgency} ({delta:+d}), rank #{prev_rank} → #{rank}; below threshold {INTERVENTION_DELTA} → update silently")

        evaluated.append(EvaluatedCourse(
            courseid=c.courseid, fullname=c.fullname, grade_pct=c.grade_pct,
            next_due_name=c.next_due_name, next_due_timestart=c.next_due_timestart,
            urgency=urgency, prev_urgency=prev_urgency, delta=delta,
            rank=rank, prev_rank=prev_rank, reason=_reason(c, days),
            causes=_causes(c, prev), intervene=intervene,
        ))

    return EvaluateResponse(courses=evaluated, intervention=any(e.intervene for e in evaluated), policy=policy)
