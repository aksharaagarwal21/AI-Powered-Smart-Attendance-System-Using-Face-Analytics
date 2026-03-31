/**
 * Employees Module — Employee listing, search, add, edit, delete
 */
const Employees = {
    employees: [],
    departments: [],
    initialized: false,

    async init() {
        await this.loadDepartments();
        await this.loadEmployees();
        if (!this.initialized) {
            document.getElementById('btn-add-employee').addEventListener('click', () => this.openModal());
            document.getElementById('modal-close-employee').addEventListener('click', () => this.closeModal());
            document.getElementById('modal-cancel-employee').addEventListener('click', () => this.closeModal());
            document.getElementById('modal-save-employee').addEventListener('click', () => this.saveEmployee());
            document.getElementById('emp-search').addEventListener('input', (e) => this.filterEmployees(e.target.value));
            this.initialized = true;
        }
    },

    async loadDepartments() {
        this.departments = await App.fetchAPI('/api/departments') || [];
        const sel = document.getElementById('emp-department');
        sel.innerHTML = this.departments.map(d => `<option value="${d.id}">${d.name}</option>`).join('');
    },

    async loadEmployees() {
        this.employees = await App.fetchAPI('/api/employees') || [];
        this.renderEmployees(this.employees);
    },

    renderEmployees(list) {
        const grid = document.getElementById('employees-grid');
        if (list.length === 0) {
            grid.innerHTML = '<div class="loading-placeholder">No employees found</div>';
            return;
        }
        grid.innerHTML = list.map(emp => {
            const color = App.getAvatarColor(emp.name);
            return `
                <div class="employee-card" data-id="${emp.id}">
                    <span class="emp-status-badge ${emp.status}">${emp.status}</span>
                    <div class="emp-card-header">
                        <div class="emp-avatar" style="background:${color}">${App.getInitials(emp.name)}</div>
                        <div>
                            <div class="emp-name">${emp.name}</div>
                            <div class="emp-id">${emp.id}</div>
                        </div>
                    </div>
                    <div class="emp-card-body">
                        <div class="emp-detail"><i class="fas fa-building"></i> ${emp.department_name || '--'}</div>
                        <div class="emp-detail"><i class="fas fa-briefcase"></i> ${emp.designation || '--'}</div>
                        <div class="emp-detail"><i class="fas fa-envelope"></i> ${emp.email || '--'}</div>
                        <div class="emp-detail"><i class="fas fa-phone"></i> ${emp.phone || '--'}</div>
                    </div>
                    <div class="emp-card-footer">
                        <button class="emp-action-btn" onclick="Employees.viewAttendance('${emp.id}')">
                            <i class="fas fa-clipboard-list"></i> Attendance
                        </button>
                        <button class="emp-action-btn danger" onclick="Employees.deleteEmployee('${emp.id}')">
                            <i class="fas fa-trash"></i> Remove
                        </button>
                    </div>
                </div>`;
        }).join('');
    },

    filterEmployees(query) {
        const q = query.toLowerCase();
        const filtered = this.employees.filter(e =>
            e.name.toLowerCase().includes(q) ||
            e.id.toLowerCase().includes(q) ||
            (e.department_name || '').toLowerCase().includes(q) ||
            (e.email || '').toLowerCase().includes(q)
        );
        this.renderEmployees(filtered);
    },

    openModal() {
        document.getElementById('modal-emp-title').textContent = 'Add New Employee';
        document.getElementById('emp-name').value = '';
        document.getElementById('emp-email').value = '';
        document.getElementById('emp-designation').value = '';
        document.getElementById('emp-phone').value = '';
        document.getElementById('modal-add-employee').style.display = 'flex';
    },

    closeModal() {
        document.getElementById('modal-add-employee').style.display = 'none';
    },

    async saveEmployee() {
        const name = document.getElementById('emp-name').value.trim();
        if (!name) { App.toast('Name is required', 'warning'); return; }

        const data = {
            name,
            email: document.getElementById('emp-email').value.trim(),
            department_id: parseInt(document.getElementById('emp-department').value),
            designation: document.getElementById('emp-designation').value.trim(),
            phone: document.getElementById('emp-phone').value.trim()
        };

        const result = await App.fetchAPI('/api/employees', {
            method: 'POST',
            body: JSON.stringify(data)
        });

        if (result && result.id) {
            App.toast(`Employee ${name} added (${result.id})`, 'success');
            this.closeModal();
            await this.loadEmployees();
        } else {
            App.toast(result?.error || 'Failed to add employee', 'error');
        }
    },

    async deleteEmployee(id) {
        if (!confirm('Deactivate this employee?')) return;
        const result = await App.fetchAPI(`/api/employees/${id}`, { method: 'DELETE' });
        if (result) {
            App.toast('Employee deactivated', 'info');
            await this.loadEmployees();
        }
    },

    viewAttendance(id) {
        App.navigateTo('attendance');
        setTimeout(() => {
            document.getElementById('att-filter-employee').value = id;
            Attendance.loadAttendance();
        }, 200);
    }
};
