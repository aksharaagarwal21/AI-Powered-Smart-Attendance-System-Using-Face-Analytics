"""
Database Manager for Face Analytics Attendance System
Handles all SQLite operations for employees, attendance, and face encodings.
"""

import sqlite3
import json
import os
from datetime import datetime, timedelta
import random
import uuid


DB_PATH = os.path.join(os.path.dirname(__file__), 'attendance.db')


def get_db():
    """Get database connection with row factory."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    """Initialize database tables and seed demo data."""
    conn = get_db()
    cursor = conn.cursor()

    # Create tables
    cursor.executescript('''
        CREATE TABLE IF NOT EXISTS departments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            color TEXT DEFAULT '#00d4ff',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS employees (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT UNIQUE,
            department_id INTEGER,
            designation TEXT,
            phone TEXT,
            face_encoding TEXT,
            face_image_path TEXT,
            status TEXT DEFAULT 'active',
            registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (department_id) REFERENCES departments(id)
        );

        CREATE TABLE IF NOT EXISTS attendance (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            employee_id TEXT NOT NULL,
            date TEXT NOT NULL,
            check_in TIMESTAMP,
            check_out TIMESTAMP,
            status TEXT DEFAULT 'present',
            confidence REAL DEFAULT 0.0,
            method TEXT DEFAULT 'face_recognition',
            duration_minutes INTEGER DEFAULT 0,
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (employee_id) REFERENCES employees(id)
        );

        CREATE TABLE IF NOT EXISTS recognition_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            employee_id TEXT,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            confidence REAL,
            action TEXT,
            success INTEGER DEFAULT 1,
            face_count INTEGER DEFAULT 1,
            processing_time_ms REAL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);
        CREATE INDEX IF NOT EXISTS idx_attendance_employee ON attendance(employee_id);
        CREATE INDEX IF NOT EXISTS idx_recognition_timestamp ON recognition_logs(timestamp);
    ''')

    # Seed departments if empty
    cursor.execute("SELECT COUNT(*) FROM departments")
    if cursor.fetchone()[0] == 0:
        departments = [
            ('Engineering', '#00d4ff'),
            ('Design', '#a855f7'),
            ('Marketing', '#f59e0b'),
            ('Human Resources', '#10b981'),
            ('Finance', '#ef4444'),
            ('Operations', '#6366f1'),
            ('Sales', '#ec4899'),
            ('Research', '#14b8a6'),
        ]
        cursor.executemany("INSERT INTO departments (name, color) VALUES (?, ?)", departments)

    # Seed employees if empty
    cursor.execute("SELECT COUNT(*) FROM employees")
    if cursor.fetchone()[0] == 0:
        employees = [
            ('EMP001', 'Aarav Sharma', 'aarav.sharma@company.com', 1, 'Senior Developer', '+91-9876543210'),
            ('EMP002', 'Priya Patel', 'priya.patel@company.com', 1, 'Tech Lead', '+91-9876543211'),
            ('EMP003', 'Rahul Kumar', 'rahul.kumar@company.com', 2, 'UI/UX Designer', '+91-9876543212'),
            ('EMP004', 'Sneha Gupta', 'sneha.gupta@company.com', 3, 'Marketing Manager', '+91-9876543213'),
            ('EMP005', 'Vikram Singh', 'vikram.singh@company.com', 4, 'HR Director', '+91-9876543214'),
            ('EMP006', 'Ananya Reddy', 'ananya.reddy@company.com', 5, 'Financial Analyst', '+91-9876543215'),
            ('EMP007', 'Karthik Nair', 'karthik.nair@company.com', 6, 'Operations Lead', '+91-9876543216'),
            ('EMP008', 'Meera Iyer', 'meera.iyer@company.com', 1, 'DevOps Engineer', '+91-9876543217'),
            ('EMP009', 'Arjun Menon', 'arjun.menon@company.com', 7, 'Sales Executive', '+91-9876543218'),
            ('EMP010', 'Divya Joshi', 'divya.joshi@company.com', 8, 'Research Scientist', '+91-9876543219'),
            ('EMP011', 'Rohan Verma', 'rohan.verma@company.com', 1, 'Backend Developer', '+91-9876543220'),
            ('EMP012', 'Kavya Krishnan', 'kavya.krishnan@company.com', 2, 'Graphic Designer', '+91-9876543221'),
            ('EMP013', 'Siddharth Rao', 'siddharth.rao@company.com', 3, 'Content Strategist', '+91-9876543222'),
            ('EMP014', 'Nisha Agarwal', 'nisha.agarwal@company.com', 4, 'HR Manager', '+91-9876543223'),
            ('EMP015', 'Aditya Bhatt', 'aditya.bhatt@company.com', 6, 'Project Manager', '+91-9876543224'),
        ]
        for emp in employees:
            # Generate a fake face encoding (128-dimensional vector)
            encoding = json.dumps([round(random.uniform(-1, 1), 6) for _ in range(128)])
            cursor.execute(
                "INSERT INTO employees (id, name, email, department_id, designation, phone, face_encoding, status) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, 'active')",
                (*emp, encoding)
            )

    # Seed attendance data for the last 30 days
    cursor.execute("SELECT COUNT(*) FROM attendance")
    if cursor.fetchone()[0] == 0:
        cursor.execute("SELECT id FROM employees")
        emp_ids = [row['id'] for row in cursor.fetchall()]

        today = datetime.now()
        for day_offset in range(30):
            date = today - timedelta(days=day_offset)
            if date.weekday() >= 5:  # Skip weekends
                continue
            date_str = date.strftime('%Y-%m-%d')

            for emp_id in emp_ids:
                # 85% chance of being present
                if random.random() < 0.85:
                    hour_in = random.randint(8, 10)
                    min_in = random.randint(0, 59)
                    hour_out = random.randint(17, 20)
                    min_out = random.randint(0, 59)

                    check_in = f"{date_str} {hour_in:02d}:{min_in:02d}:00"
                    check_out = f"{date_str} {hour_out:02d}:{min_out:02d}:00"
                    duration = (hour_out - hour_in) * 60 + (min_out - min_in)
                    confidence = round(random.uniform(0.85, 0.99), 4)

                    status = 'present'
                    if hour_in > 9:
                        status = 'late'

                    cursor.execute(
                        "INSERT INTO attendance (employee_id, date, check_in, check_out, status, confidence, duration_minutes) "
                        "VALUES (?, ?, ?, ?, ?, ?, ?)",
                        (emp_id, date_str, check_in, check_out, status, confidence, duration)
                    )
                elif random.random() < 0.5:
                    # Mark as absent explicitly
                    cursor.execute(
                        "INSERT INTO attendance (employee_id, date, status, confidence) VALUES (?, ?, 'absent', 0)",
                        (emp_id, date_str)
                    )

    # Seed recognition logs
    cursor.execute("SELECT COUNT(*) FROM recognition_logs")
    if cursor.fetchone()[0] == 0:
        cursor.execute("SELECT id FROM employees")
        emp_ids = [row['id'] for row in cursor.fetchall()]
        now = datetime.now()
        for i in range(200):
            ts = now - timedelta(hours=random.randint(0, 720))
            emp_id = random.choice(emp_ids)
            conf = round(random.uniform(0.75, 0.99), 4)
            action = random.choice(['check_in', 'check_out', 'verification'])
            success = 1 if conf > 0.80 else 0
            proc_time = round(random.uniform(50, 300), 2)
            cursor.execute(
                "INSERT INTO recognition_logs (employee_id, timestamp, confidence, action, success, processing_time_ms) "
                "VALUES (?, ?, ?, ?, ?, ?)",
                (emp_id, ts.strftime('%Y-%m-%d %H:%M:%S'), conf, action, success, proc_time)
            )

    # Seed default settings
    cursor.execute("SELECT COUNT(*) FROM settings")
    if cursor.fetchone()[0] == 0:
        settings = [
            ('recognition_threshold', '0.80'),
            ('camera_resolution', '1280x720'),
            ('auto_checkout', 'true'),
            ('auto_checkout_time', '20:00'),
            ('working_hours_start', '09:00'),
            ('working_hours_end', '18:00'),
            ('late_threshold_minutes', '15'),
            ('notification_enabled', 'true'),
            ('anti_spoofing', 'true'),
            ('liveness_detection', 'true'),
            ('multi_face_detection', 'true'),
            ('face_detection_model', 'haar_cascade'),
            ('organization_name', 'TechCorp Industries'),
        ]
        cursor.executemany("INSERT INTO settings (key, value) VALUES (?, ?)", settings)

    conn.commit()
    conn.close()


def get_all_employees():
    """Get all employees with department info."""
    conn = get_db()
    rows = conn.execute('''
        SELECT e.*, d.name as department_name, d.color as department_color
        FROM employees e
        LEFT JOIN departments d ON e.department_id = d.id
        ORDER BY e.name
    ''').fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_employee(emp_id):
    """Get single employee by ID."""
    conn = get_db()
    row = conn.execute('''
        SELECT e.*, d.name as department_name, d.color as department_color
        FROM employees e
        LEFT JOIN departments d ON e.department_id = d.id
        WHERE e.id = ?
    ''', (emp_id,)).fetchone()
    conn.close()
    return dict(row) if row else None


def add_employee(data):
    """Add a new employee."""
    conn = get_db()
    emp_id = f"EMP{random.randint(100, 999)}"
    encoding = data.get('face_encoding', json.dumps([round(random.uniform(-1, 1), 6) for _ in range(128)]))
    try:
        conn.execute(
            "INSERT INTO employees (id, name, email, department_id, designation, phone, face_encoding, status) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, 'active')",
            (emp_id, data['name'], data.get('email', ''), data.get('department_id', 1),
             data.get('designation', ''), data.get('phone', ''), encoding)
        )
        conn.commit()
        conn.close()
        return emp_id
    except Exception as e:
        conn.close()
        raise e


def update_employee(emp_id, data):
    """Update employee details."""
    conn = get_db()
    fields = []
    values = []
    for key in ['name', 'email', 'department_id', 'designation', 'phone', 'status', 'face_encoding']:
        if key in data:
            fields.append(f"{key} = ?")
            values.append(data[key])
    if fields:
        values.append(emp_id)
        conn.execute(f"UPDATE employees SET {', '.join(fields)} WHERE id = ?", values)
        conn.commit()
    conn.close()


def delete_employee(emp_id):
    """Soft delete (deactivate) an employee."""
    conn = get_db()
    conn.execute("UPDATE employees SET status = 'inactive' WHERE id = ?", (emp_id,))
    conn.commit()
    conn.close()


def get_departments():
    """Get all departments."""
    conn = get_db()
    rows = conn.execute("SELECT * FROM departments ORDER BY name").fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_attendance(date=None, employee_id=None, start_date=None, end_date=None):
    """Get attendance records with optional filters."""
    conn = get_db()
    query = '''
        SELECT a.*, e.name as employee_name, d.name as department_name, d.color as department_color
        FROM attendance a
        JOIN employees e ON a.employee_id = e.id
        LEFT JOIN departments d ON e.department_id = d.id
        WHERE 1=1
    '''
    params = []

    if date:
        query += " AND a.date = ?"
        params.append(date)
    if employee_id:
        query += " AND a.employee_id = ?"
        params.append(employee_id)
    if start_date:
        query += " AND a.date >= ?"
        params.append(start_date)
    if end_date:
        query += " AND a.date <= ?"
        params.append(end_date)

    query += " ORDER BY a.date DESC, a.check_in DESC"
    rows = conn.execute(query, params).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def mark_attendance(employee_id, action='check_in', confidence=0.95):
    """Mark attendance for an employee."""
    conn = get_db()
    today = datetime.now().strftime('%Y-%m-%d')
    now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

    # Check if already checked in today
    existing = conn.execute(
        "SELECT * FROM attendance WHERE employee_id = ? AND date = ?",
        (employee_id, today)
    ).fetchone()

    if action == 'check_in':
        if existing:
            conn.close()
            return {'status': 'already_checked_in', 'record': dict(existing)}

        hour = datetime.now().hour
        status = 'late' if hour >= 9 else 'present'

        conn.execute(
            "INSERT INTO attendance (employee_id, date, check_in, status, confidence) VALUES (?, ?, ?, ?, ?)",
            (employee_id, today, now, status, confidence)
        )
    elif action == 'check_out':
        if not existing:
            conn.close()
            return {'status': 'not_checked_in'}

        if existing['check_out']:
            conn.close()
            return {'status': 'already_checked_out', 'record': dict(existing)}

        # Calculate duration
        check_in_time = datetime.strptime(existing['check_in'], '%Y-%m-%d %H:%M:%S')
        duration = int((datetime.now() - check_in_time).total_seconds() / 60)

        conn.execute(
            "UPDATE attendance SET check_out = ?, duration_minutes = ? WHERE id = ?",
            (now, duration, existing['id'])
        )

    # Log recognition event
    conn.execute(
        "INSERT INTO recognition_logs (employee_id, confidence, action, success, processing_time_ms) "
        "VALUES (?, ?, ?, 1, ?)",
        (employee_id, confidence, action, round(random.uniform(80, 250), 2))
    )

    conn.commit()
    conn.close()
    return {'status': 'success', 'action': action}


def get_today_stats():
    """Get today's attendance statistics."""
    conn = get_db()
    today = datetime.now().strftime('%Y-%m-%d')

    total_employees = conn.execute("SELECT COUNT(*) FROM employees WHERE status = 'active'").fetchone()[0]
    present = conn.execute("SELECT COUNT(*) FROM attendance WHERE date = ? AND status IN ('present', 'late')", (today,)).fetchone()[0]
    late = conn.execute("SELECT COUNT(*) FROM attendance WHERE date = ? AND status = 'late'", (today,)).fetchone()[0]
    on_time = present - late
    absent = total_employees - present

    # Average confidence today
    avg_conf = conn.execute("SELECT AVG(confidence) FROM attendance WHERE date = ? AND confidence > 0", (today,)).fetchone()[0]

    # Recent check-ins
    recent = conn.execute('''
        SELECT a.*, e.name as employee_name, d.name as department_name
        FROM attendance a
        JOIN employees e ON a.employee_id = e.id
        LEFT JOIN departments d ON e.department_id = d.id
        WHERE a.date = ?
        ORDER BY a.check_in DESC
        LIMIT 10
    ''', (today,)).fetchall()

    conn.close()
    return {
        'total_employees': total_employees,
        'present': present,
        'absent': absent,
        'late': late,
        'on_time': on_time,
        'attendance_rate': round((present / total_employees * 100) if total_employees > 0 else 0, 1),
        'avg_confidence': round(avg_conf or 0, 4),
        'recent_checkins': [dict(r) for r in recent],
        'date': today
    }


def get_recognition_logs(limit=50):
    """Get recent recognition logs."""
    conn = get_db()
    rows = conn.execute('''
        SELECT r.*, e.name as employee_name
        FROM recognition_logs r
        LEFT JOIN employees e ON r.employee_id = e.id
        ORDER BY r.timestamp DESC
        LIMIT ?
    ''', (limit,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_settings():
    """Get all settings as a dictionary."""
    conn = get_db()
    rows = conn.execute("SELECT key, value FROM settings").fetchall()
    conn.close()
    return {row['key']: row['value'] for row in rows}


def update_setting(key, value):
    """Update a setting."""
    conn = get_db()
    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)",
        (key, value, datetime.now().strftime('%Y-%m-%d %H:%M:%S'))
    )
    conn.commit()
    conn.close()


def get_face_encodings():
    """Get all face encodings for recognition."""
    conn = get_db()
    rows = conn.execute(
        "SELECT id, name, face_encoding FROM employees WHERE status = 'active' AND face_encoding IS NOT NULL"
    ).fetchall()
    conn.close()
    result = []
    for row in rows:
        try:
            encoding = json.loads(row['face_encoding'])
            result.append({'id': row['id'], 'name': row['name'], 'encoding': encoding})
        except:
            pass
    return result
