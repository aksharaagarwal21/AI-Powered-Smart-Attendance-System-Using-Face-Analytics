/**
 * Attendance Module — Attendance records table with filters
 */
const Attendance = {
    initialized: false,

    async init() {
        if (!this.initialized) {
            document.getElementById('att-filter-date').value = new Date().toISOString().split('T')[0];
            document.getElementById('btn-filter-attendance').addEventListener('click', () => this.loadAttendance());
            await this.loadEmployeeFilter();
            this.initialized = true;
        }
        await this.loadAttendance();
    },

    async loadEmployeeFilter() {
        const employees = await App.fetchAPI('/api/employees') || [];
        const sel = document.getElementById('att-filter-employee');
        sel.innerHTML = '<option value="">All Employees</option>' +
            employees.map(e => `<option value="${e.id}">${e.name} (${e.id})</option>`).join('');
    },

    async loadAttendance() {
        const date = document.getElementById('att-filter-date').value;
        const empId = document.getElementById('att-filter-employee').value;
        const status = document.getElementById('att-filter-status').value;

        let url = '/api/attendance?';
        if (date) url += `date=${date}&`;
        if (empId) url += `employee_id=${empId}&`;

        const data = await App.fetchAPI(url) || [];

        // Client-side status filter
        const filtered = status ? data.filter(d => d.status === status) : data;

        const tbody = document.getElementById('attendance-tbody');
        if (filtered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="table-loading">No attendance records found</td></tr>';
            return;
        }

        tbody.innerHTML = filtered.map(rec => {
            const checkIn = rec.check_in ? new Date(rec.check_in).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '--';
            const checkOut = rec.check_out ? new Date(rec.check_out).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '--';
            const duration = rec.duration_minutes ? `${Math.floor(rec.duration_minutes / 60)}h ${rec.duration_minutes % 60}m` : '--';
            const confPct = rec.confidence > 0 ? (rec.confidence * 100).toFixed(1) + '%' : '--';
            const confColor = rec.confidence > 0.9 ? 'var(--accent-green)' : rec.confidence > 0.8 ? 'var(--accent-cyan)' : 'var(--accent-amber)';

            return `<tr>
                <td><strong>${rec.employee_name || '--'}</strong></td>
                <td><span style="color:${rec.department_color || 'var(--text-secondary)'}">${rec.department_name || '--'}</span></td>
                <td style="font-family:'JetBrains Mono',monospace;font-size:0.8rem;">${rec.date}</td>
                <td style="color:var(--accent-green);">${checkIn}</td>
                <td style="color:var(--accent-amber);">${checkOut}</td>
                <td>${duration}</td>
                <td><span class="status-badge ${rec.status}">${rec.status}</span></td>
                <td>
                    <span style="color:${confColor};font-family:'JetBrains Mono',monospace;">${confPct}</span>
                    ${rec.confidence > 0 ? `<div class="confidence-bar"><div class="confidence-bar-fill" style="width:${rec.confidence * 100}%;background:${confColor}"></div></div>` : ''}
                </td>
            </tr>`;
        }).join('');
    }
};
