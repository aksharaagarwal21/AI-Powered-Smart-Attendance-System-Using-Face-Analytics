# Smart Attendance System Using Face Analytics

A web-based attendance system that marks employee attendance by detecting and recognising faces from a webcam.

## Features

- Face detection with OpenCV Haar cascades (frontal, profile, eyes and smile)
- Face registration and recognition using histogram-based face encodings and cosine similarity
- Basic liveness check using texture analysis to catch photos and screens
- Employee and department management
- Attendance dashboard with weekly and monthly trends, hourly and department analytics, and a heatmap
- Recognition logs and adjustable settings

## Tech stack

Python · Flask · OpenCV · NumPy · SQLite · HTML, CSS and JavaScript

## Run locally

```bash
pip install -r requirements.txt
python app.py
```

Open http://localhost:5000 and allow camera access.

> Recognition uses simple histogram features rather than a deep-learning face model, so it is a prototype, not a production-grade identity check.
