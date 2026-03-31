/**
 * Analytics Module — Advanced charts, heatmap, top performers
 */
const Analytics = {
    charts: {},
    initialized: false,

    async init() {
        await Promise.all([
            this.loadMonthlyTrend(),
            this.loadDeptComparison(),
            this.loadAccuracyChart(),
            this.loadTopPerformers(),
            this.loadHeatmap()
        ]);
        this.initialized = true;
    },

    async loadMonthlyTrend() {
        const data = await App.fetchAPI('/api/dashboard/monthly-trend');
        if (!data) return;
        if (this.charts.monthly) this.charts.monthly.destroy();
        const ctx = document.getElementById('chart-monthly').getContext('2d');
        this.charts.monthly = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.map(d => d.day),
                datasets: [
                    {
                        label: 'Attendance Rate %', data: data.map(d => d.rate),
                        borderColor: '#00d4ff', backgroundColor: 'rgba(0,212,255,0.08)',
                        fill: true, tension: 0.4, borderWidth: 2, pointRadius: 2
                    },
                    {
                        label: 'Present', data: data.map(d => d.present),
                        borderColor: '#10b981', backgroundColor: 'transparent',
                        tension: 0.4, borderWidth: 1.5, pointRadius: 0, borderDash: [5, 3],
                        yAxisID: 'y1'
                    }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: {
                    x: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#8892a8', font: { size: 9 }, maxTicksLimit: 15 } },
                    y: { position: 'left', grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#00d4ff', font: { size: 10 } }, min: 0, max: 100, title: { display: true, text: 'Rate %', color: '#8892a8' } },
                    y1: { position: 'right', grid: { drawOnChartArea: false }, ticks: { color: '#10b981', font: { size: 10 } }, title: { display: true, text: 'Count', color: '#8892a8' } }
                },
                plugins: {
                    legend: { labels: { color: '#8892a8', font: { size: 11 }, usePointStyle: true } },
                    tooltip: { backgroundColor: 'rgba(10,15,26,0.95)', borderColor: 'rgba(0,212,255,0.15)', borderWidth: 1, cornerRadius: 8 }
                }
            }
        });
    },

    async loadDeptComparison() {
        const data = await App.fetchAPI('/api/analytics/departments');
        if (!data) return;
        if (this.charts.deptComp) this.charts.deptComp.destroy();
        const ctx = document.getElementById('chart-dept-comparison').getContext('2d');
        this.charts.deptComp = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.map(d => d.department_name),
                datasets: [
                    {
                        label: 'Today %', data: data.map(d => d.today_rate),
                        backgroundColor: data.map(d => d.color + '99'),
                        borderRadius: 6, borderSkipped: false
                    },
                    {
                        label: 'Weekly Avg %', data: data.map(d => d.weekly_avg_rate),
                        backgroundColor: data.map(d => d.color + '33'),
                        borderRadius: 6, borderSkipped: false
                    }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: {
                    x: { grid: { display: false }, ticks: { color: '#8892a8', font: { size: 9 } } },
                    y: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#8892a8' }, beginAtZero: true, max: 100 }
                },
                plugins: {
                    legend: { labels: { color: '#8892a8', font: { size: 11 }, usePointStyle: true } },
                    tooltip: { backgroundColor: 'rgba(10,15,26,0.95)', borderColor: 'rgba(0,212,255,0.15)', borderWidth: 1, cornerRadius: 8 }
                }
            }
        });
    },

    async loadAccuracyChart() {
        const data = await App.fetchAPI('/api/analytics/recognition');
        if (!data || !data.daily_breakdown) return;
        if (this.charts.accuracy) this.charts.accuracy.destroy();
        const ctx = document.getElementById('chart-accuracy').getContext('2d');
        const daily = data.daily_breakdown;
        this.charts.accuracy = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: daily.map(d => d.day?.substring(5) || '--'),
                datasets: [
                    {
                        label: 'Successful', data: daily.map(d => d.successful),
                        backgroundColor: 'rgba(16,185,129,0.6)', borderRadius: 4
                    },
                    {
                        label: 'Failed', data: daily.map(d => (d.total || 0) - (d.successful || 0)),
                        backgroundColor: 'rgba(239,68,68,0.4)', borderRadius: 4
                    }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: {
                    x: { stacked: true, grid: { display: false }, ticks: { color: '#8892a8', font: { size: 9 } } },
                    y: { stacked: true, grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#8892a8' }, beginAtZero: true }
                },
                plugins: {
                    legend: { labels: { color: '#8892a8', font: { size: 11 }, usePointStyle: true } },
                    tooltip: { backgroundColor: 'rgba(10,15,26,0.95)', borderColor: 'rgba(0,212,255,0.15)', borderWidth: 1 }
                }
            }
        });
    },

    async loadTopPerformers() {
        const data = await App.fetchAPI('/api/analytics/top-performers');
        if (!data) return;
        const list = document.getElementById('performers-list');
        list.innerHTML = data.map((p, i) => {
            const rankClass = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : 'normal';
            return `
                <div class="performer-item">
                    <div class="performer-rank ${rankClass}">${i + 1}</div>
                    <div class="performer-info">
                        <div class="performer-name">${p.name}</div>
                        <div class="performer-dept">${p.department || '--'}</div>
                    </div>
                    <div class="performer-days">${p.days_present || 0}d</div>
                </div>`;
        }).join('');
    },

    async loadHeatmap() {
        const data = await App.fetchAPI('/api/analytics/heatmap');
        if (!data) return;
        const container = document.getElementById('heatmap-container');
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const hours = [];
        for (let h = 6; h < 22; h++) hours.push(`${h}:00`);

        const maxCount = Math.max(...data.map(d => d.count), 1);

        let html = '<div style="display:grid;grid-template-columns:50px repeat(16, 1fr);gap:3px;">';
        // Header row
        html += '<div></div>';
        hours.forEach(h => { html += `<div class="heatmap-label">${h}</div>`; });

        // Data rows
        days.forEach((day, di) => {
            html += `<div class="heatmap-label" style="justify-content:flex-end;padding-right:8px;">${day}</div>`;
            hours.forEach((_, hi) => {
                const entry = data.find(d => d.day_index === di && d.hour === (hi + 6));
                const count = entry ? entry.count : 0;
                const intensity = count / maxCount;
                const r = Math.round(0 + intensity * 0);
                const g = Math.round(20 + intensity * 192);
                const b = Math.round(30 + intensity * 225);
                const bg = count > 0 ? `rgba(${r},${g},${b},${0.15 + intensity * 0.7})` : 'rgba(255,255,255,0.02)';
                html += `<div class="heatmap-cell" style="background:${bg}" title="${day} ${hours[hi]}: ${count}">${count}</div>`;
            });
        });
        html += '</div>';
        container.innerHTML = html;
    }
};
