/**
 * Dashboard Module — Stats, charts, and recent activity
 */
const Dashboard = {
    charts: {},
    initialized: false,

    async init() {
        await this.loadStats();
        await this.loadCharts();
        await this.loadRecentActivity();
        if (!this.initialized) {
            document.getElementById('refresh-dashboard')?.addEventListener('click', () => this.init());
            document.querySelectorAll('.chart-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    document.querySelectorAll('.chart-btn').forEach(b => b.classList.remove('active'));
                    e.target.classList.add('active');
                    this.loadTrendChart(e.target.dataset.range);
                });
            });
            this.initialized = true;
        }
    },

    async loadStats() {
        const stats = await App.fetchAPI('/api/dashboard/stats');
        if (!stats) return;
        document.getElementById('stat-total-val').textContent = stats.total_employees;
        document.getElementById('stat-present-val').textContent = stats.present;
        document.getElementById('stat-late-val').textContent = stats.late;
        document.getElementById('stat-absent-val').textContent = stats.absent;
        document.getElementById('stat-rate').textContent = stats.attendance_rate;
        document.getElementById('stat-conf-val').textContent = (stats.avg_confidence * 100).toFixed(1) + '%';
    },

    async loadCharts() {
        await this.loadTrendChart('week');
        await this.loadDeptChart();
        await this.loadHourlyChart();
        await this.loadRecognitionChart();
    },

    async loadTrendChart(range) {
        const url = range === 'month' ? '/api/dashboard/monthly-trend' : '/api/dashboard/weekly-trend';
        const data = await App.fetchAPI(url);
        if (!data) return;
        if (this.charts.trend) this.charts.trend.destroy();
        const ctx = document.getElementById('chart-weekly').getContext('2d');
        this.charts.trend = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.map(d => d.day),
                datasets: [
                    {
                        label: 'Present', data: data.map(d => d.present),
                        borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.1)',
                        fill: true, tension: 0.4, borderWidth: 2, pointRadius: 3, pointBackgroundColor: '#10b981'
                    },
                    {
                        label: 'Absent', data: data.map(d => d.absent),
                        borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.05)',
                        fill: true, tension: 0.4, borderWidth: 2, pointRadius: 3, pointBackgroundColor: '#ef4444'
                    },
                ]
            },
            options: this.chartOptions('Attendance Trend')
        });
    },

    async loadDeptChart() {
        const data = await App.fetchAPI('/api/analytics/departments');
        if (!data) return;
        if (this.charts.dept) this.charts.dept.destroy();
        const ctx = document.getElementById('chart-departments').getContext('2d');
        this.charts.dept = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: data.map(d => d.department_name),
                datasets: [{
                    data: data.map(d => d.present_today),
                    backgroundColor: data.map(d => d.color),
                    borderWidth: 0, hoverOffset: 6
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                cutout: '65%',
                plugins: {
                    legend: { position: 'right', labels: { color: '#8892a8', font: { size: 11, family: 'Inter' }, padding: 12, usePointStyle: true, pointStyleWidth: 8 } }
                }
            }
        });
    },

    async loadHourlyChart() {
        const data = await App.fetchAPI('/api/analytics/hourly');
        if (!data) return;
        if (this.charts.hourly) this.charts.hourly.destroy();
        const ctx = document.getElementById('chart-hourly').getContext('2d');
        this.charts.hourly = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.map(d => d.hour),
                datasets: [{
                    label: 'Check-ins', data: data.map(d => d.count),
                    backgroundColor: data.map(d => {
                        const h = parseInt(d.hour);
                        if (h <= 9) return 'rgba(16,185,129,0.6)';
                        if (h <= 10) return 'rgba(245,158,11,0.6)';
                        return 'rgba(99,102,241,0.3)';
                    }),
                    borderRadius: 4, borderSkipped: false
                }]
            },
            options: this.chartOptions('Check-ins by Hour')
        });
    },

    async loadRecognitionChart() {
        const data = await App.fetchAPI('/api/analytics/recognition');
        if (!data) return;
        if (this.charts.recog) this.charts.recog.destroy();
        const ctx = document.getElementById('chart-recognition').getContext('2d');
        this.charts.recog = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Successful', 'Failed'],
                datasets: [{
                    data: [data.successful, data.failed],
                    backgroundColor: ['rgba(16,185,129,0.7)', 'rgba(239,68,68,0.5)'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false, cutout: '70%',
                plugins: {
                    legend: { position: 'bottom', labels: { color: '#8892a8', font: { size: 11 }, padding: 16, usePointStyle: true } },
                    title: { display: true, text: `${data.success_rate}% Success Rate`, color: '#00d4ff', font: { size: 20, weight: '800', family: 'JetBrains Mono' }, padding: { top: 10 } }
                }
            }
        });
    },

    async loadRecentActivity() {
        const stats = await App.fetchAPI('/api/dashboard/stats');
        if (!stats) return;
        const list = document.getElementById('recent-checkins-list');
        const checkins = stats.recent_checkins || [];
        if (checkins.length === 0) {
            list.innerHTML = '<div class="loading-placeholder">No check-ins yet today</div>';
            return;
        }
        list.innerHTML = checkins.map(c => {
            const color = App.getAvatarColor(c.employee_name);
            const time = c.check_in ? new Date(c.check_in).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '--';
            return `
                <div class="activity-item">
                    <div class="activity-avatar" style="background:${color}">${App.getInitials(c.employee_name)}</div>
                    <div class="activity-info">
                        <div class="activity-name">${c.employee_name}</div>
                        <div class="activity-dept">${c.department_name || '--'}</div>
                    </div>
                    <span class="activity-time">${time}</span>
                    <span class="activity-status ${c.status}">${c.status}</span>
                </div>`;
        }).join('');
    },

    chartOptions(title) {
        return {
            responsive: true, maintainAspectRatio: false,
            scales: {
                x: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#8892a8', font: { size: 10 } } },
                y: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#8892a8', font: { size: 10 } }, beginAtZero: true }
            },
            plugins: {
                legend: { display: true, labels: { color: '#8892a8', font: { size: 11, family: 'Inter' }, padding: 16, usePointStyle: true } },
                tooltip: { backgroundColor: 'rgba(10,15,26,0.95)', titleColor: '#e8edf5', bodyColor: '#8892a8', borderColor: 'rgba(0,212,255,0.15)', borderWidth: 1, cornerRadius: 8, padding: 10 }
            }
        };
    }
};
