/**
 * FaceGuard AI — Main Application Controller
 * Handles navigation, clock, loading, toast, and page management.
 */

const App = {
    currentPage: 'dashboard',

    init() {
        this.setupLoading();
        this.setupNav();
        this.setupClock();
        this.setupMenuToggle();
        this.setupDate();

        // Default load
        setTimeout(() => {
            Dashboard.init();
        }, 300);
    },

    setupLoading() {
        const statuses = [
            'Loading neural networks...',
            'Initializing face detection engine...',
            'Calibrating recognition models...',
            'Loading employee database...',
            'Starting analytics engine...',
            'System ready!'
        ];
        const statusEl = document.querySelector('.loading-status');
        let i = 0;
        const interval = setInterval(() => {
            if (i < statuses.length) {
                statusEl.textContent = statuses[i];
                i++;
            }
        }, 400);

        setTimeout(() => {
            clearInterval(interval);
            document.getElementById('loading-screen').classList.add('hidden');
            document.getElementById('app').style.display = 'flex';
        }, 2800);
    },

    setupNav() {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const page = item.dataset.page;
                if (page) this.navigateTo(page);
            });
        });
    },

    navigateTo(page) {
        if (this.currentPage === page) return;

        // Stop camera if leaving camera page
        if (this.currentPage === 'camera' && typeof Camera !== 'undefined') {
            Camera.stopCamera();
        }

        this.currentPage = page;

        // Update nav
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        const navEl = document.querySelector(`.nav-item[data-page="${page}"]`);
        if (navEl) navEl.classList.add('active');

        // Update pages
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        const pageEl = document.getElementById(`page-${page}`);
        if (pageEl) pageEl.classList.add('active');

        // Update breadcrumb
        const titles = {
            dashboard: ['Dashboard', 'Overview'],
            camera: ['Face Scanner', 'Live Detection'],
            attendance: ['Attendance', 'Records'],
            employees: ['Employees', 'Management'],
            analytics: ['Analytics', 'Insights'],
            logs: ['Recognition Logs', 'History'],
            settings: ['Settings', 'Configuration']
        };
        const [title, sub] = titles[page] || [page, ''];
        document.getElementById('page-title').textContent = title;
        document.getElementById('page-subtitle').textContent = sub;

        // Initialize page modules
        switch (page) {
            case 'dashboard': Dashboard.init(); break;
            case 'camera': Camera.init(); break;
            case 'attendance': Attendance.init(); break;
            case 'employees': Employees.init(); break;
            case 'analytics': Analytics.init(); break;
            case 'logs': Logs.init(); break;
            case 'settings': Settings.init(); break;
        }

        // Close sidebar on mobile
        document.getElementById('sidebar').classList.remove('open');
    },

    setupClock() {
        const update = () => {
            const now = new Date();
            document.getElementById('clock-time').textContent = now.toLocaleTimeString('en-IN', { hour12: false });
        };
        update();
        setInterval(update, 1000);
    },

    setupDate() {
        const now = new Date();
        document.getElementById('top-bar-date').textContent = now.toLocaleDateString('en-IN', {
            weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
        });
    },

    setupMenuToggle() {
        document.getElementById('menu-toggle').addEventListener('click', () => {
            document.getElementById('sidebar').classList.toggle('open');
            document.getElementById('sidebar').classList.toggle('collapsed');
        });
    },

    toast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const icons = { success: 'fa-check-circle', error: 'fa-times-circle', info: 'fa-info-circle', warning: 'fa-exclamation-triangle' };
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i><span class="toast-message">${message}</span>`;
        container.appendChild(toast);
        setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 4000);
    },

    async fetchAPI(url, options = {}) {
        try {
            const res = await fetch(url, {
                headers: { 'Content-Type': 'application/json' },
                ...options
            });
            return await res.json();
        } catch (err) {
            console.error('API Error:', err);
            this.toast('Connection error. Please check the server.', 'error');
            return null;
        }
    },

    getAvatarColor(name) {
        const colors = ['#00d4ff', '#a855f7', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#ec4899', '#6366f1', '#14b8a6'];
        let hash = 0;
        for (let c of (name || '')) hash = c.charCodeAt(0) + ((hash << 5) - hash);
        return colors[Math.abs(hash) % colors.length];
    },

    getInitials(name) {
        if (!name) return '?';
        return name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
    }
};

// Logs module (simple)
const Logs = {
    initialized: false,
    init() {
        this.loadLogs();
        if (!this.initialized) {
            document.getElementById('btn-refresh-logs')?.addEventListener('click', () => this.loadLogs());
            this.initialized = true;
        }
    },
    async loadLogs() {
        const data = await App.fetchAPI('/api/recognition-logs?limit=100');
        if (!data) return;
        const tbody = document.getElementById('logs-tbody');
        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="table-loading">No recognition logs found</td></tr>';
            return;
        }
        tbody.innerHTML = data.map(log => `
            <tr>
                <td style="font-family:'JetBrains Mono',monospace;font-size:0.78rem;color:var(--text-muted);">${log.timestamp || '--'}</td>
                <td>${log.employee_name || 'Unknown'}</td>
                <td><span style="color:var(--accent-cyan);font-weight:600;text-transform:capitalize;">${(log.action || '').replace('_', ' ')}</span></td>
                <td>
                    ${(log.confidence * 100).toFixed(1)}%
                    <div class="confidence-bar"><div class="confidence-bar-fill" style="width:${log.confidence * 100}%;background:${log.confidence > 0.8 ? 'var(--accent-green)' : 'var(--accent-amber)'}"></div></div>
                </td>
                <td><span class="status-badge ${log.success ? 'success' : 'failed'}">${log.success ? 'Success' : 'Failed'}</span></td>
                <td style="font-family:'JetBrains Mono',monospace;">${log.processing_time_ms?.toFixed(0) || '--'} ms</td>
            </tr>
        `).join('');
    }
};

// Start
document.addEventListener('DOMContentLoaded', () => App.init());
