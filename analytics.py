"""
Analytics Engine for Face Attendance System
Provides advanced attendance analytics, trends, and department-level insights.
"""

from database import get_db
from datetime import datetime, timedelta
import json


def get_weekly_trend():
    """Get attendance trend for the past 7 days."""
    conn = get_db()
    today = datetime.now()
    trend = []

    for i in range(6, -1, -1):
        date = today - timedelta(days=i)
        date_str = date.strftime('%Y-%m-%d')
        day_name = date.strftime('%a')

        total = conn.execute("SELECT COUNT(*) FROM employees WHERE status = 'active'").fetchone()[0]
        present = conn.execute(
            "SELECT COUNT(*) FROM attendance WHERE date = ? AND status IN ('present', 'late')",
            (date_str,)
        ).fetchone()[0]
        late = conn.execute(
            "SELECT COUNT(*) FROM attendance WHERE date = ? AND status = 'late'",
            (date_str,)
        ).fetchone()[0]

        trend.append({
            'date': date_str,
            'day': day_name,
            'present': present,
            'absent': total - present,
            'late': late,
            'on_time': present - late,
            'rate': round((present / total * 100) if total > 0 else 0, 1),
        })

    conn.close()
    return trend


def get_monthly_trend():
    """Get attendance trend for the past 30 days."""
    conn = get_db()
    today = datetime.now()
    trend = []

    for i in range(29, -1, -1):
        date = today - timedelta(days=i)
        date_str = date.strftime('%Y-%m-%d')

        if date.weekday() >= 5:
            continue

        total = conn.execute("SELECT COUNT(*) FROM employees WHERE status = 'active'").fetchone()[0]
        present = conn.execute(
            "SELECT COUNT(*) FROM attendance WHERE date = ? AND status IN ('present', 'late')",
            (date_str,)
        ).fetchone()[0]

        trend.append({
            'date': date_str,
            'day': date.strftime('%d %b'),
            'present': present,
            'absent': total - present,
            'rate': round((present / total * 100) if total > 0 else 0, 1),
        })

    conn.close()
    return trend


def get_department_analytics():
    """Get attendance analytics per department."""
    conn = get_db()
    today = datetime.now().strftime('%Y-%m-%d')
    seven_days_ago = (datetime.now() - timedelta(days=7)).strftime('%Y-%m-%d')

    departments = conn.execute("SELECT * FROM departments ORDER BY name").fetchall()
    results = []

    for dept in departments:
        total = conn.execute(
            "SELECT COUNT(*) FROM employees WHERE department_id = ? AND status = 'active'",
            (dept['id'],)
        ).fetchone()[0]

        if total == 0:
            continue

        present_today = conn.execute('''
            SELECT COUNT(*) FROM attendance a
            JOIN employees e ON a.employee_id = e.id
            WHERE e.department_id = ? AND a.date = ? AND a.status IN ('present', 'late')
        ''', (dept['id'], today)).fetchone()[0]

        # Weekly average
        week_records = conn.execute('''
            SELECT COUNT(DISTINCT a.employee_id) as cnt, a.date
            FROM attendance a
            JOIN employees e ON a.employee_id = e.id
            WHERE e.department_id = ? AND a.date >= ? AND a.status IN ('present', 'late')
            GROUP BY a.date
        ''', (dept['id'], seven_days_ago)).fetchall()

        weekly_avg = round(sum(r['cnt'] for r in week_records) / max(len(week_records), 1), 1)

        # Average check-in time
        avg_checkin = conn.execute('''
            SELECT AVG(CAST(strftime('%H', a.check_in) AS REAL) * 60 + CAST(strftime('%M', a.check_in) AS REAL)) as avg_min
            FROM attendance a
            JOIN employees e ON a.employee_id = e.id
            WHERE e.department_id = ? AND a.date >= ? AND a.check_in IS NOT NULL
        ''', (dept['id'], seven_days_ago)).fetchone()

        avg_min = avg_checkin['avg_min'] or 540  # default 9:00
        avg_hour = int(avg_min // 60)
        avg_minute = int(avg_min % 60)

        results.append({
            'department_id': dept['id'],
            'department_name': dept['name'],
            'color': dept['color'],
            'total_employees': total,
            'present_today': present_today,
            'today_rate': round((present_today / total * 100) if total > 0 else 0, 1),
            'weekly_avg_present': weekly_avg,
            'weekly_avg_rate': round((weekly_avg / total * 100) if total > 0 else 0, 1),
            'avg_checkin_time': f"{avg_hour:02d}:{avg_minute:02d}",
        })

    conn.close()
    return results


def get_hourly_distribution():
    """Get check-in distribution by hour for today."""
    conn = get_db()
    today = datetime.now().strftime('%Y-%m-%d')

    rows = conn.execute('''
        SELECT CAST(strftime('%H', check_in) AS INTEGER) as hour, COUNT(*) as count
        FROM attendance
        WHERE date = ? AND check_in IS NOT NULL
        GROUP BY hour
        ORDER BY hour
    ''', (today,)).fetchall()

    # Fill all hours
    distribution = {}
    for row in rows:
        distribution[row['hour']] = row['count']

    result = []
    for h in range(6, 22):
        result.append({
            'hour': f"{h:02d}:00",
            'count': distribution.get(h, 0),
        })

    conn.close()
    return result


def get_recognition_performance():
    """Get face recognition performance metrics."""
    conn = get_db()
    seven_days_ago = (datetime.now() - timedelta(days=7)).strftime('%Y-%m-%d %H:%M:%S')

    total = conn.execute(
        "SELECT COUNT(*) FROM recognition_logs WHERE timestamp >= ?", (seven_days_ago,)
    ).fetchone()[0]
    successful = conn.execute(
        "SELECT COUNT(*) FROM recognition_logs WHERE timestamp >= ? AND success = 1", (seven_days_ago,)
    ).fetchone()[0]
    avg_time = conn.execute(
        "SELECT AVG(processing_time_ms) FROM recognition_logs WHERE timestamp >= ?", (seven_days_ago,)
    ).fetchone()[0]
    avg_conf = conn.execute(
        "SELECT AVG(confidence) FROM recognition_logs WHERE timestamp >= ? AND success = 1", (seven_days_ago,)
    ).fetchone()[0]

    # Daily breakdown
    daily = conn.execute('''
        SELECT DATE(timestamp) as day, 
               COUNT(*) as total,
               SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful,
               AVG(processing_time_ms) as avg_time,
               AVG(confidence) as avg_conf
        FROM recognition_logs
        WHERE timestamp >= ?
        GROUP BY day
        ORDER BY day
    ''', (seven_days_ago,)).fetchall()

    conn.close()
    return {
        'total_recognitions': total,
        'successful': successful,
        'failed': total - successful,
        'success_rate': round((successful / total * 100) if total > 0 else 0, 1),
        'avg_processing_time_ms': round(avg_time or 0, 2),
        'avg_confidence': round(avg_conf or 0, 4),
        'daily_breakdown': [dict(r) for r in daily],
    }


def get_top_performers():
    """Get employees with best attendance records."""
    conn = get_db()
    thirty_days_ago = (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d')

    rows = conn.execute('''
        SELECT e.id, e.name, d.name as department,
               COUNT(CASE WHEN a.status IN ('present', 'late') THEN 1 END) as days_present,
               COUNT(CASE WHEN a.status = 'late' THEN 1 END) as days_late,
               AVG(a.duration_minutes) as avg_duration,
               AVG(a.confidence) as avg_confidence
        FROM employees e
        LEFT JOIN attendance a ON e.id = a.employee_id AND a.date >= ?
        LEFT JOIN departments d ON e.department_id = d.id
        WHERE e.status = 'active'
        GROUP BY e.id
        ORDER BY days_present DESC, days_late ASC
        LIMIT 10
    ''', (thirty_days_ago,)).fetchall()

    conn.close()
    return [dict(r) for r in rows]


def get_attendance_heatmap():
    """Get attendance heatmap data (day of week × hour)."""
    conn = get_db()
    thirty_days_ago = (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d')

    rows = conn.execute('''
        SELECT 
            CAST(strftime('%w', check_in) AS INTEGER) as day_of_week,
            CAST(strftime('%H', check_in) AS INTEGER) as hour,
            COUNT(*) as count
        FROM attendance
        WHERE date >= ? AND check_in IS NOT NULL
        GROUP BY day_of_week, hour
    ''', (thirty_days_ago,)).fetchall()

    conn.close()

    # Build heatmap grid
    heatmap = []
    days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    lookup = {}
    for row in rows:
        lookup[(row['day_of_week'], row['hour'])] = row['count']

    for d in range(7):
        for h in range(6, 22):
            heatmap.append({
                'day': days[d],
                'day_index': d,
                'hour': h,
                'count': lookup.get((d, h), 0),
            })

    return heatmap
