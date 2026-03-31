"""
AI-Powered Smart Attendance System - Main Flask Application
Full REST API for face analytics, attendance management, and real-time dashboard.
"""

from flask import Flask, request, jsonify, render_template, send_from_directory
from flask_cors import CORS
import json
import os
from datetime import datetime

from database import (
    init_db, get_all_employees, get_employee, add_employee, update_employee,
    delete_employee, get_departments, get_attendance, mark_attendance,
    get_today_stats, get_recognition_logs, get_settings, update_setting,
    get_face_encodings
)
from face_engine import face_engine
from analytics import (
    get_weekly_trend, get_monthly_trend, get_department_analytics,
    get_hourly_distribution, get_recognition_performance,
    get_top_performers, get_attendance_heatmap
)

app = Flask(__name__, static_folder='static', template_folder='templates')
CORS(app)

# Initialize database on startup
init_db()

# Load face encodings into engine
face_engine.load_known_faces(get_face_encodings())


# ─── Page Routes ────────────────────────────────────────────────────────────────

@app.route('/')
def index():
    return render_template('index.html')


# ─── Dashboard API ──────────────────────────────────────────────────────────────

@app.route('/api/dashboard/stats')
def api_dashboard_stats():
    """Get today's attendance statistics."""
    stats = get_today_stats()
    return jsonify(stats)


@app.route('/api/dashboard/weekly-trend')
def api_weekly_trend():
    return jsonify(get_weekly_trend())


@app.route('/api/dashboard/monthly-trend')
def api_monthly_trend():
    return jsonify(get_monthly_trend())


# ─── Employee API ───────────────────────────────────────────────────────────────

@app.route('/api/employees', methods=['GET'])
def api_get_employees():
    employees = get_all_employees()
    # Remove encoding from response (large data)
    for emp in employees:
        emp.pop('face_encoding', None)
    return jsonify(employees)


@app.route('/api/employees/<emp_id>', methods=['GET'])
def api_get_employee(emp_id):
    emp = get_employee(emp_id)
    if emp:
        emp.pop('face_encoding', None)
        return jsonify(emp)
    return jsonify({'error': 'Employee not found'}), 404


@app.route('/api/employees', methods=['POST'])
def api_add_employee():
    data = request.json
    if not data or not data.get('name'):
        return jsonify({'error': 'Name is required'}), 400
    try:
        emp_id = add_employee(data)
        # Reload face encodings
        face_engine.load_known_faces(get_face_encodings())
        return jsonify({'id': emp_id, 'message': 'Employee registered successfully'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/employees/<emp_id>', methods=['PUT'])
def api_update_employee(emp_id):
    data = request.json
    update_employee(emp_id, data)
    face_engine.load_known_faces(get_face_encodings())
    return jsonify({'message': 'Employee updated successfully'})


@app.route('/api/employees/<emp_id>', methods=['DELETE'])
def api_delete_employee(emp_id):
    delete_employee(emp_id)
    face_engine.load_known_faces(get_face_encodings())
    return jsonify({'message': 'Employee deactivated successfully'})


@app.route('/api/departments', methods=['GET'])
def api_get_departments():
    return jsonify(get_departments())


# ─── Attendance API ─────────────────────────────────────────────────────────────

@app.route('/api/attendance', methods=['GET'])
def api_get_attendance():
    date = request.args.get('date')
    employee_id = request.args.get('employee_id')
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    records = get_attendance(date, employee_id, start_date, end_date)
    return jsonify(records)


@app.route('/api/attendance/mark', methods=['POST'])
def api_mark_attendance():
    data = request.json
    if not data or not data.get('employee_id'):
        return jsonify({'error': 'employee_id is required'}), 400

    action = data.get('action', 'check_in')
    confidence = data.get('confidence', 0.95)
    result = mark_attendance(data['employee_id'], action, confidence)
    return jsonify(result)


# ─── Face Detection & Recognition API ──────────────────────────────────────────

@app.route('/api/face/detect', methods=['POST'])
def api_detect_faces():
    """Detect faces in an uploaded image."""
    data = request.json
    if not data or not data.get('image'):
        return jsonify({'error': 'Image data is required'}), 400

    result = face_engine.detect_faces(data['image'])
    return jsonify(result)


@app.route('/api/face/recognize', methods=['POST'])
def api_recognize_face():
    """Detect and recognize faces in an image."""
    data = request.json
    if not data or not data.get('image'):
        return jsonify({'error': 'Image data is required'}), 400

    # Step 1: Detect faces
    detection = face_engine.detect_faces(data['image'])
    if detection.get('error'):
        return jsonify(detection)

    if detection['count'] == 0:
        return jsonify({
            'detected': False,
            'faces': [],
            'message': 'No faces detected in the image'
        })

    # Step 2: Recognize each detected face
    known_faces = get_face_encodings()
    results = []

    for face in detection['faces']:
        recognition = face_engine.recognize_face(face['encoding'], known_faces)
        face_result = {**face, 'recognition': recognition}

        # If recognized, include employee info
        if recognition['match']:
            emp = get_employee(recognition['employee_id'])
            if emp:
                emp.pop('face_encoding', None)
                face_result['employee'] = emp

        results.append(face_result)

    return jsonify({
        'detected': True,
        'count': detection['count'],
        'faces': results,
        'processing_time_ms': detection['processing_time_ms'],
    })


@app.route('/api/face/register', methods=['POST'])
def api_register_face():
    """Register a face for an employee from an image."""
    data = request.json
    if not data or not data.get('image') or not data.get('employee_id'):
        return jsonify({'error': 'Image and employee_id are required'}), 400

    detection = face_engine.detect_faces(data['image'])
    if detection['count'] == 0:
        return jsonify({'error': 'No face detected in image'}), 400
    if detection['count'] > 1:
        return jsonify({'error': 'Multiple faces detected. Please ensure only one face is visible.'}), 400

    face = detection['faces'][0]
    if not face.get('is_live', True):
        return jsonify({'error': 'Liveness check failed. Please use a real face.'}), 400

    encoding = json.dumps(face['encoding'])
    update_employee(data['employee_id'], {'face_encoding': encoding})
    face_engine.load_known_faces(get_face_encodings())

    return jsonify({
        'message': 'Face registered successfully',
        'quality': face['quality'],
        'liveness_score': face['liveness_score'],
    })


# ─── Analytics API ──────────────────────────────────────────────────────────────

@app.route('/api/analytics/departments')
def api_dept_analytics():
    return jsonify(get_department_analytics())


@app.route('/api/analytics/hourly')
def api_hourly():
    return jsonify(get_hourly_distribution())


@app.route('/api/analytics/recognition')
def api_recognition_perf():
    return jsonify(get_recognition_performance())


@app.route('/api/analytics/top-performers')
def api_top_performers():
    return jsonify(get_top_performers())


@app.route('/api/analytics/heatmap')
def api_heatmap():
    return jsonify(get_attendance_heatmap())


@app.route('/api/recognition-logs')
def api_rec_logs():
    limit = request.args.get('limit', 50, type=int)
    return jsonify(get_recognition_logs(limit))


# ─── Settings API ───────────────────────────────────────────────────────────────

@app.route('/api/settings', methods=['GET'])
def api_get_settings():
    return jsonify(get_settings())


@app.route('/api/settings', methods=['PUT'])
def api_update_settings():
    data = request.json
    if data:
        for key, value in data.items():
            update_setting(key, str(value))
        # Update engine threshold if changed
        if 'recognition_threshold' in data:
            face_engine.recognition_threshold = float(data['recognition_threshold'])
    return jsonify({'message': 'Settings updated successfully'})


# ─── System Info ────────────────────────────────────────────────────────────────

@app.route('/api/system/info')
def api_system_info():
    import cv2
    import numpy as np
    return jsonify({
        'opencv_version': cv2.__version__,
        'numpy_version': np.__version__,
        'face_detection_model': 'Haar Cascade Classifier',
        'encoding_dimensions': 128,
        'recognition_method': 'Cosine Similarity',
        'anti_spoofing': 'Texture + Color Analysis',
        'liveness_detection': 'Eye Detection + Gradient Analysis',
        'database': 'SQLite3',
        'server_time': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
    })


if __name__ == '__main__':
    print("\n" + "="*60)
    print("  🧠 AI-Powered Face Analytics Attendance System")
    print("  📡 Starting server at http://localhost:5000")
    print("="*60 + "\n")
    app.run(debug=True, host='0.0.0.0', port=5000)
