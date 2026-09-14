(() => {
    const api = () => (window.APP_CONFIG && window.APP_CONFIG.ADMIN_API_BASE_URL) || window.ADMIN_API_BASE_URL;
    const state = {
        faculties: [],
        directory: {
            query: '',
            status: 'active',
            page: 1,
            pageSize: 5
        }
    };

    document.addEventListener('DOMContentLoaded', () => {
        initialise();
    });

    async function initialise() {
        const nav = document.getElementById('faculty-directory-nav');
        const admin = await getAdmin();
        if (!admin || String(admin.role || '').toLowerCase() !== 'admin') {
            nav?.remove();
            document.getElementById('faculties-section')?.remove();
            return;
        }

        document.getElementById('faculty-create-form')?.addEventListener('submit', async event => {
            event.preventDefault();
            const form = event.currentTarget;
            await submit({ action: 'faculty-create', name: form.elements.name.value }, 'Faculty added.');
            form.reset();
        });
        document.getElementById('department-create-form')?.addEventListener('submit', async event => {
            event.preventDefault();
            const form = event.currentTarget;
            await submit({ action: 'department-create', faculty_id: Number(form.elements.faculty_id.value), name: form.elements.name.value }, 'Department added.');
            form.reset();
        });
        document.getElementById('faculty-directory-list')?.addEventListener('submit', handleEditSubmit);
        document.getElementById('faculty-directory-list')?.addEventListener('click', handleDeleteClick);
        document.getElementById('faculty-directory-search')?.addEventListener('input', event => {
            state.directory.query = event.target.value || '';
            state.directory.page = 1;
            renderDirectory();
        });
        document.getElementById('faculty-directory-status-filter')?.addEventListener('change', event => {
            state.directory.status = event.target.value || 'all';
            state.directory.page = 1;
            renderDirectory();
        });
        document.getElementById('faculty-directory-pagination')?.addEventListener('click', event => {
            const button = event.target.closest('[data-directory-page]');
            if (!button || button.disabled) return;
            state.directory.page = Math.max(1, Number(button.dataset.directoryPage) || 1);
            renderDirectory();
        });
        loadDirectory();
    }

    async function loadDirectory() {
        const list = document.getElementById('faculty-directory-list');
        try {
            const response = await fetch(`${api()}?endpoint=faculty-departments-list`, { credentials: 'same-origin' });
            const data = await response.json();
            if (!response.ok || data.success === false) throw new Error(data.error || 'The academic directory could not be loaded.');
            state.faculties = Array.isArray(data.faculties) ? data.faculties : [];
            populateFacultyPicker();
            renderDirectory();
        } catch (error) {
            if (list) list.innerHTML = `<p class="faculty-directory-empty">${escapeHtml(error.message || 'The academic directory could not be loaded.')}</p>`;
        }
    }

    function populateFacultyPicker() {
        const select = document.getElementById('department-create-faculty');
        if (!select) return;
        const active = state.faculties.filter(faculty => faculty.is_active !== false);
        select.innerHTML = active.length
            ? `<option value="">Choose a faculty</option>${active.map(faculty => `<option value="${Number(faculty.id)}">${escapeHtml(faculty.name)}</option>`).join('')}`
            : '<option value="">Create a faculty first</option>';
        select.disabled = active.length === 0;
    }

    function renderDirectory() {
        const list = document.getElementById('faculty-directory-list');
        if (!list) return;
        const query = state.directory.query.trim().toLocaleLowerCase();
        const status = state.directory.status;
        const matchesStatus = item => status === 'all' || (status === 'active' ? item.is_active !== false : item.is_active === false);
        const matchingFaculties = state.faculties.filter(faculty => {
            if (!matchesStatus(faculty)) return false;
            if (!query) return true;
            const facultyMatches = String(faculty.name || '').toLocaleLowerCase().includes(query);
            const departmentMatches = (Array.isArray(faculty.departments) ? faculty.departments : [])
                .some(department => String(department.name || '').toLocaleLowerCase().includes(query));
            return facultyMatches || departmentMatches;
        });
        const pageCount = Math.max(1, Math.ceil(matchingFaculties.length / state.directory.pageSize));
        state.directory.page = Math.min(state.directory.page, pageCount);
        const start = (state.directory.page - 1) * state.directory.pageSize;
        const visibleFaculties = matchingFaculties.slice(start, start + state.directory.pageSize);
        const visibleDepartments = matchingFaculties.reduce((count, faculty) => {
            const facultyMatches = query && String(faculty.name || '').toLocaleLowerCase().includes(query);
            const departments = (Array.isArray(faculty.departments) ? faculty.departments : [])
                .filter(matchesStatus)
                .filter(department => !query || facultyMatches || String(department.name || '').toLocaleLowerCase().includes(query));
            return count + departments.length;
        }, 0);
        const count = document.getElementById('faculty-directory-count');
        if (count) count.textContent = `${matchingFaculties.length} ${matchingFaculties.length === 1 ? 'faculty' : 'faculties'} · ${visibleDepartments} ${visibleDepartments === 1 ? 'department' : 'departments'}`;
        if (!matchingFaculties.length) {
            list.innerHTML = `<p class="faculty-directory-empty">${query || status !== 'all' ? 'No directory entries match the current filters.' : 'No faculties have been configured yet.'}</p>`;
            renderPagination(0, 0);
            return;
        }
        list.innerHTML = visibleFaculties.map(faculty => {
            const facultyMatches = query && String(faculty.name || '').toLocaleLowerCase().includes(query);
            const departments = (Array.isArray(faculty.departments) ? faculty.departments : [])
                .filter(matchesStatus)
                .filter(department => !query || facultyMatches || String(department.name || '').toLocaleLowerCase().includes(query));
            return `<article class="faculty-directory-card ${faculty.is_active === false ? 'is-inactive' : ''}">
                <form class="faculty-directory-edit" data-directory-form="faculty" data-id="${Number(faculty.id)}">
                    <div class="faculty-directory-card-heading"><i class="fas fa-building-columns" aria-hidden="true"></i><div><span>Faculty</span><strong>${escapeHtml(faculty.name)}</strong></div></div>
                    <label>Name<input name="name" maxlength="180" value="${escapeAttribute(faculty.name)}" required></label>
                    <label class="faculty-directory-toggle"><input name="is_active" type="checkbox" ${faculty.is_active === false ? '' : 'checked'}><span>Available in profiles</span></label>
                    <div class="faculty-directory-actions"><button class="btn btn-secondary" type="submit"><i class="fas fa-save"></i> Save</button><button class="btn faculty-directory-danger" type="button" data-delete="faculty" data-id="${Number(faculty.id)}"><i class="fas fa-trash"></i> Delete</button></div>
                </form>
                <div class="faculty-department-list"><div class="faculty-department-heading"><h4>Departments</h4><span>${departments.length}</span></div>
                    ${departments.length ? departments.map(department => renderDepartment(department)).join('') : '<p class="faculty-directory-empty">No departments yet.</p>'}
                </div>
            </article>`;
        }).join('');
        renderPagination(matchingFaculties.length, pageCount);
    }

    function renderPagination(total, pageCount) {
        const pagination = document.getElementById('faculty-directory-pagination');
        if (!pagination || total === 0) {
            if (pagination) pagination.innerHTML = '';
            return;
        }
        const currentPage = state.directory.page;
        const pages = Array.from({ length: pageCount }, (_, index) => index + 1);
        pagination.innerHTML = `<button type="button" class="pagination-button" data-directory-page="${currentPage - 1}" ${currentPage === 1 ? 'disabled' : ''} aria-label="Previous page"><i class="fas fa-chevron-left" aria-hidden="true"></i></button>${pages.map(page => `<button type="button" class="pagination-button ${page === currentPage ? 'is-current' : ''}" data-directory-page="${page}" ${page === currentPage ? 'aria-current="page"' : ''}>${page}</button>`).join('')}<button type="button" class="pagination-button" data-directory-page="${currentPage + 1}" ${currentPage === pageCount ? 'disabled' : ''} aria-label="Next page"><i class="fas fa-chevron-right" aria-hidden="true"></i></button><span class="pagination-summary">Page ${currentPage} of ${pageCount}</span>`;
    }

    function renderDepartment(department) {
        return `<form class="faculty-department-row ${department.is_active === false ? 'is-inactive' : ''}" data-directory-form="department" data-id="${Number(department.id)}">
            <label class="faculty-department-name"><span>Department name</span><input name="name" aria-label="Department name" value="${escapeAttribute(department.name)}" maxlength="180" required></label>
            <input name="faculty_id" type="hidden" value="${Number(department.faculty_id)}">
            <div class="faculty-department-controls">
                <label class="faculty-directory-toggle"><input name="is_active" type="checkbox" ${department.is_active === false ? '' : 'checked'}><span>Active</span></label>
                <div class="faculty-department-actions">
                    <button class="btn btn-secondary" type="submit" title="Save department"><i class="fas fa-save"></i><span class="sr-only">Save department</span></button>
                    <button class="btn faculty-directory-danger" type="button" data-delete="department" data-id="${Number(department.id)}" title="Delete department"><i class="fas fa-trash"></i><span class="sr-only">Delete department</span></button>
                </div>
            </div>
        </form>`;
    }

    async function handleEditSubmit(event) {
        const form = event.target.closest('[data-directory-form]');
        if (!form) return;
        event.preventDefault();
        const type = form.dataset.directoryForm;
        const payload = {
            action: type === 'faculty' ? 'faculty-update' : 'department-update',
            id: Number(form.dataset.id),
            name: form.elements.name.value,
            is_active: Boolean(form.elements.is_active.checked)
        };
        if (type === 'department') payload.faculty_id = Number(form.elements.faculty_id.value);
        await submit(payload, type === 'faculty' ? 'Faculty updated.' : 'Department updated.');
    }

    async function handleDeleteClick(event) {
        const button = event.target.closest('[data-delete]');
        if (!button) return;
        const type = button.dataset.delete;
        const label = type === 'faculty' ? 'faculty' : 'department';
        if (!window.confirm(`Delete this ${label}? This is only possible when it is not assigned to any account.`)) return;
        await submit({ action: type === 'faculty' ? 'faculty-delete' : 'department-delete', id: Number(button.dataset.id) }, `${label[0].toUpperCase()}${label.slice(1)} deleted.`);
    }

    async function submit(payload, successMessage) {
        setFeedback('Saving…', '');
        try {
            const response = await fetch(api(), {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await response.json();
            if (!response.ok || data.success === false) throw new Error(data.error || 'The directory could not be updated.');
            setFeedback(successMessage, 'success');
            await loadDirectory();
        } catch (error) {
            setFeedback(error.message || 'The directory could not be updated.', 'error');
        }
    }

    function setFeedback(message, stateName) {
        const feedback = document.getElementById('faculty-directory-feedback');
        if (!feedback) return;
        feedback.textContent = message;
        feedback.className = stateName ? `faculty-directory-feedback ${stateName}` : 'faculty-directory-feedback';
    }

    async function getAdmin() {
        try {
            const response = await fetch('/auth/session', { credentials: 'same-origin' });
            if (!response.ok) return null;
            const data = await response.json();
            if (!data.session?.is_super_admin || !data.admin) return null;
            localStorage.setItem('adminSession', JSON.stringify(data.admin));
            return data.admin;
        } catch {
            return null;
        }
    }

    function escapeHtml(value) {
        return String(value || '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' })[character]);
    }

    function escapeAttribute(value) { return escapeHtml(value); }
})();
