/**
 * Settings Module — Load and save system settings
 */
const Settings = {
    initialized: false,

    async init() {
        await this.loadSettings();
        await this.loadSystemInfo();
        if (!this.initialized) {
            document.getElementById('set-threshold').addEventListener('input', (e) => {
                document.getElementById('set-threshold-val').textContent = e.target.value;
            });
            document.getElementById('btn-save-settings').addEventListener('click', () => this.saveSettings());
            this.initialized = true;
        }
    },

    async loadSettings() {
        const data = await App.fetchAPI('/api/settings');
        if (!data) return;
        if (data.recognition_threshold) {
            document.getElementById('set-threshold').value = data.recognition_threshold;
            document.getElementById('set-threshold-val').textContent = data.recognition_threshold;
        }
        if (data.anti_spoofing !== undefined) document.getElementById('set-anti-spoofing').checked = data.anti_spoofing === 'true';
        if (data.liveness_detection !== undefined) document.getElementById('set-liveness').checked = data.liveness_detection === 'true';
        if (data.multi_face_detection !== undefined) document.getElementById('set-multi-face').checked = data.multi_face_detection === 'true';
        if (data.working_hours_start) document.getElementById('set-work-start').value = data.working_hours_start;
        if (data.working_hours_end) document.getElementById('set-work-end').value = data.working_hours_end;
        if (data.late_threshold_minutes) document.getElementById('set-late-threshold').value = data.late_threshold_minutes;
        if (data.auto_checkout !== undefined) document.getElementById('set-auto-checkout').checked = data.auto_checkout === 'true';
    },

    async loadSystemInfo() {
        const data = await App.fetchAPI('/api/system/info');
        if (!data) return;
        const grid = document.getElementById('system-info-grid');
        grid.innerHTML = Object.entries(data).map(([key, value]) => `
            <div class="sys-info-item">
                <div class="sys-info-label">${key.replace(/_/g, ' ')}</div>
                <div class="sys-info-value">${value}</div>
            </div>
        `).join('');
    },

    async saveSettings() {
        const settings = {
            recognition_threshold: document.getElementById('set-threshold').value,
            anti_spoofing: document.getElementById('set-anti-spoofing').checked.toString(),
            liveness_detection: document.getElementById('set-liveness').checked.toString(),
            multi_face_detection: document.getElementById('set-multi-face').checked.toString(),
            working_hours_start: document.getElementById('set-work-start').value,
            working_hours_end: document.getElementById('set-work-end').value,
            late_threshold_minutes: document.getElementById('set-late-threshold').value,
            auto_checkout: document.getElementById('set-auto-checkout').checked.toString()
        };

        const result = await App.fetchAPI('/api/settings', {
            method: 'PUT',
            body: JSON.stringify(settings)
        });

        if (result) {
            App.toast('Settings saved successfully!', 'success');
        }
    }
};
