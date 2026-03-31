/**
 * Camera Module — Webcam feed, face detection, recognition, and scan logging
 */
const Camera = {
    stream: null,
    video: null,
    canvas: null,
    ctx: null,
    scanning: false,
    lastRecognized: null,
    initialized: false,
    scanLogs: [],

    init() {
        this.video = document.getElementById('camera-video');
        this.canvas = document.getElementById('camera-canvas');
        this.ctx = this.canvas.getContext('2d');

        if (!this.initialized) {
            document.getElementById('btn-start-camera').addEventListener('click', () => this.startCamera());
            document.getElementById('btn-stop-camera').addEventListener('click', () => this.stopCamera());
            document.getElementById('btn-capture').addEventListener('click', () => this.captureAndRecognize());
            document.getElementById('btn-quick-checkin').addEventListener('click', () => this.markAction('check_in'));
            document.getElementById('btn-quick-checkout').addEventListener('click', () => this.markAction('check_out'));
            document.getElementById('btn-quick-register').addEventListener('click', () => this.registerFace());
            this.initialized = true;
        }
    },

    async startCamera() {
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: { width: 1280, height: 720, facingMode: 'user' }
            });
            this.video.srcObject = this.stream;
            document.getElementById('btn-start-camera').style.display = 'none';
            document.getElementById('btn-stop-camera').style.display = '';
            document.getElementById('btn-capture').disabled = false;
            document.getElementById('camera-overlay').style.display = 'none';
            document.getElementById('face-hud').style.display = 'flex';
            document.getElementById('scan-beam').style.display = 'block';
            App.toast('Camera started successfully', 'success');
        } catch (err) {
            App.toast('Camera access denied: ' + err.message, 'error');
        }
    },

    stopCamera() {
        if (this.stream) {
            this.stream.getTracks().forEach(t => t.stop());
            this.stream = null;
        }
        this.video.srcObject = null;
        document.getElementById('btn-start-camera').style.display = '';
        document.getElementById('btn-stop-camera').style.display = 'none';
        document.getElementById('btn-capture').disabled = true;
        document.getElementById('camera-overlay').style.display = 'flex';
        document.getElementById('face-hud').style.display = 'none';
        document.getElementById('camera-status').innerHTML = '<i class="fas fa-camera-retro"></i><span>Camera stopped</span>';
        this.lastRecognized = null;
        this.disableActions();
    },

    captureFrame() {
        if (!this.stream || !this.video.videoWidth) return null;
        this.canvas.width = this.video.videoWidth;
        this.canvas.height = this.video.videoHeight;
        this.ctx.drawImage(this.video, 0, 0);
        return this.canvas.toDataURL('image/jpeg', 0.8);
    },

    async captureAndRecognize() {
        const image = this.captureFrame();
        if (!image) { App.toast('No camera frame available', 'warning'); return; }

        this.scanning = true;
        document.getElementById('btn-capture').disabled = true;
        document.getElementById('btn-capture').innerHTML = '<i class="fas fa-spinner fa-spin"></i> Scanning...';

        const startTime = performance.now();
        const result = await App.fetchAPI('/api/face/recognize', {
            method: 'POST',
            body: JSON.stringify({ image })
        });
        const elapsed = (performance.now() - startTime).toFixed(0);

        document.getElementById('btn-capture').disabled = false;
        document.getElementById('btn-capture').innerHTML = '<i class="fas fa-crosshairs"></i> Scan';
        this.scanning = false;

        if (!result) return;

        // Update HUD
        document.getElementById('hud-face-count').textContent = result.count || 0;
        document.getElementById('hud-fps').textContent = elapsed + 'ms';

        if (!result.detected || result.count === 0) {
            App.toast('No face detected. Ensure face is visible.', 'warning');
            this.showNoMatch();
            this.addScanLog('No face detected', 'warning');
            return;
        }

        const face = result.faces[0];
        document.getElementById('hud-quality').textContent = ((face.quality?.overall_score || 0) * 100).toFixed(0) + '%';
        document.getElementById('hud-liveness').textContent = face.is_live ? '✓ Live' : '✗ Spoof';

        if (face.recognition?.match) {
            this.lastRecognized = face;
            this.showMatch(face);
            this.enableActions();
            this.addScanLog(`Recognized: ${face.recognition.name}`, 'success');
            App.toast(`Face recognized: ${face.recognition.name} (${(face.recognition.confidence * 100).toFixed(1)}%)`, 'success');
        } else {
            this.lastRecognized = null;
            this.showNoMatch(face);
            this.disableActions();
            document.getElementById('btn-quick-register').disabled = false;
            this.addScanLog('Face not recognized', 'info');
            App.toast('Face detected but not recognized', 'info');
        }
    },

    showMatch(face) {
        const r = face.recognition;
        const emp = face.employee || {};
        const confClass = r.confidence > 0.9 ? 'high' : r.confidence > 0.8 ? 'medium' : 'low';
        document.getElementById('result-body').innerHTML = `
            <div class="result-match">
                <div style="width:64px;height:64px;border-radius:50%;background:${App.getAvatarColor(r.name)};display:flex;align-items:center;justify-content:center;font-size:1.5rem;font-weight:800;color:#fff;margin:0 auto 12px;">
                    ${App.getInitials(r.name)}
                </div>
                <div class="match-name">${r.name}</div>
                <div class="match-id">${r.employee_id}</div>
                <div class="match-dept">${emp.department_name || '--'} • ${emp.designation || '--'}</div>
                <div class="match-confidence ${confClass}">${(r.confidence * 100).toFixed(1)}% Match</div>
                <div style="margin-top:12px;display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:0.75rem;">
                    <div style="padding:8px;background:rgba(255,255,255,0.03);border-radius:6px;">
                        <div style="color:var(--text-muted);">Quality</div>
                        <div style="font-weight:700;color:var(--accent-cyan);">${((face.quality?.overall_score || 0) * 100).toFixed(0)}%</div>
                    </div>
                    <div style="padding:8px;background:rgba(255,255,255,0.03);border-radius:6px;">
                        <div style="color:var(--text-muted);">Liveness</div>
                        <div style="font-weight:700;color:${face.is_live ? 'var(--accent-green)' : 'var(--accent-red)'};">${face.is_live ? 'Live' : 'Spoof'}</div>
                    </div>
                    <div style="padding:8px;background:rgba(255,255,255,0.03);border-radius:6px;">
                        <div style="color:var(--text-muted);">Eyes</div>
                        <div style="font-weight:700;">${face.eye_count} detected</div>
                    </div>
                    <div style="padding:8px;background:rgba(255,255,255,0.03);border-radius:6px;">
                        <div style="color:var(--text-muted);">Smile</div>
                        <div style="font-weight:700;">${face.smile_detected ? 'Yes 😊' : 'No'}</div>
                    </div>
                </div>
            </div>`;
    },

    showNoMatch(face) {
        const html = face ? `
            <div class="result-match">
                <div style="width:64px;height:64px;border-radius:50%;background:rgba(239,68,68,0.15);display:flex;align-items:center;justify-content:center;font-size:1.5rem;color:var(--accent-red);margin:0 auto 12px;">
                    <i class="fas fa-user-slash"></i>
                </div>
                <div class="match-name" style="color:var(--accent-red);">Not Recognized</div>
                <p style="color:var(--text-muted);font-size:0.8rem;margin-top:8px;">Face detected but not in database.</p>
                <div style="margin-top:8px;font-size:0.78rem;color:var(--text-secondary);">
                    Quality: ${((face.quality?.overall_score || 0) * 100).toFixed(0)}% |
                    Liveness: ${face.is_live ? 'Live' : 'Spoof'}
                </div>
            </div>` : `
            <div class="result-placeholder">
                <i class="fas fa-face-frown"></i>
                <p>No face detected in frame</p>
            </div>`;
        document.getElementById('result-body').innerHTML = html;
    },

    enableActions() {
        document.getElementById('btn-quick-checkin').disabled = false;
        document.getElementById('btn-quick-checkout').disabled = false;
        document.getElementById('btn-quick-register').disabled = false;
    },

    disableActions() {
        document.getElementById('btn-quick-checkin').disabled = true;
        document.getElementById('btn-quick-checkout').disabled = true;
        document.getElementById('btn-quick-register').disabled = true;
    },

    async markAction(action) {
        if (!this.lastRecognized?.recognition?.employee_id) {
            App.toast('No recognized employee', 'warning');
            return;
        }
        const result = await App.fetchAPI('/api/attendance/mark', {
            method: 'POST',
            body: JSON.stringify({
                employee_id: this.lastRecognized.recognition.employee_id,
                action: action,
                confidence: this.lastRecognized.recognition.confidence
            })
        });
        if (result) {
            if (result.status === 'success') {
                App.toast(`${action.replace('_', ' ')} marked for ${this.lastRecognized.recognition.name}`, 'success');
                this.addScanLog(`${action.replace('_', '-')}: ${this.lastRecognized.recognition.name}`, 'success');
            } else {
                App.toast(`${result.status.replace(/_/g, ' ')}`, 'warning');
                this.addScanLog(result.status.replace(/_/g, ' '), 'warning');
            }
        }
    },

    async registerFace() {
        const image = this.captureFrame();
        if (!image) return;
        // If recognized, register for that employee; otherwise prompt
        let empId = this.lastRecognized?.recognition?.employee_id;
        if (!empId) {
            empId = prompt('Enter Employee ID to register face for:');
            if (!empId) return;
        }
        const result = await App.fetchAPI('/api/face/register', {
            method: 'POST',
            body: JSON.stringify({ image, employee_id: empId })
        });
        if (result && !result.error) {
            App.toast('Face registered successfully!', 'success');
            this.addScanLog(`Registered face for ${empId}`, 'success');
        } else {
            App.toast(result?.error || 'Registration failed', 'error');
        }
    },

    addScanLog(message, type) {
        const now = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        this.scanLogs.unshift({ message, type, time: now });
        if (this.scanLogs.length > 20) this.scanLogs.pop();
        const list = document.getElementById('scan-log-list');
        list.innerHTML = this.scanLogs.map(log => `
            <div class="scan-log-item">
                <span class="log-action" style="color:${log.type === 'success' ? 'var(--accent-green)' : log.type === 'warning' ? 'var(--accent-amber)' : 'var(--accent-cyan)'}">${log.message}</span>
                <span class="log-time">${log.time}</span>
            </div>
        `).join('');
    }
};
