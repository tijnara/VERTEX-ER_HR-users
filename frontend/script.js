document.addEventListener('DOMContentLoaded', () => {
    // If opened via WebStorm static server (63342), redirect to backend origin (3002) to avoid CORS and allow cookies
    if (window.location.port === '63342') {
        const file = window.location.pathname.split('/').pop() || 'index.html';
        window.location.href = `http://localhost:3002/${file}`;
        return;
    }
    // API endpoints: pick same-origin by default, but if served from file://, target backend at localhost:3002
    const isFileProtocol = window.location.protocol === 'file:';
    const API_BASE = isFileProtocol ? 'http://localhost:3002' : '';
    const USERS_API_URL = `${API_BASE}/api/users`;
    const DEPARTMENTS_API_URL = `${API_BASE}/api/departments`;
    const LOGIN_URL = `${API_BASE}/api/login`;
    const AUTH_CURRENT_URL = `${API_BASE}/api/auth/current-login`;

    // --- Expose helpers needed by JavaFX WebView injector ---
    const attemptLogin = async (email, password) => {
        try {
            console.log('[SPA] Attempting login to', LOGIN_URL);
            const r = await fetch(LOGIN_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ email, password })
            });
            const data = await r.json().catch(() => ({}));
            console.log('[SPA] /api/login status', r.status, data);
            if (r.ok && (data?.ok === true || data?.user)) {
                sessionStorage.setItem('isLoggedIn', 'true');
                window.location.href = 'userlist.html';
                return true;
            }
            return false;
        } catch (e) {
            console.error('[SPA] Login error', e);
            return false;
        }
    };

    const fetchCurrentLogin = async (force = false) => {
        try {
            const r = await fetch(AUTH_CURRENT_URL, { credentials: 'include' });
            const data = await r.json().catch(() => ({}));
            console.log('[SPA] current-login status', r.status, data);
            if (r.ok && (data?.ok === true || data?.user)) {
                sessionStorage.setItem('isLoggedIn', 'true');
                if (document.getElementById('loginForm')) {
                    window.location.href = 'userlist.html';
                }
                return data;
            }
        } catch (e) {
            console.warn('[SPA] current-login failed', e);
        }
        return null;
    };

    window.fetchCurrentLogin = fetchCurrentLogin;
    window.autoLogin = (email, password) => attemptLogin(email, password);

    window.addEventListener('VOS_FETCH_CURRENT_LOGIN', () => fetchCurrentLogin(true));
    window.addEventListener('VOS_CREDENTIALS', (e) => {
        try {
            const detail = e?.detail || {};
            const email = detail.email || detail.username || detail.user_email;
            const password = detail.password || detail.user_password;
            const form = document.getElementById('loginForm');
            if (form) {
                if (email) form.email.value = email;
                if (password) form.password.value = password;
            }
            if (email && password) attemptLogin(email, password);
        } catch (_) {}
    });

    /**
     * Handles logic for the LOGIN PAGE (index.html)
     */
    const handleLoginPage = () => {
        const loginForm = document.getElementById('loginForm');
        const errorMessage = document.getElementById('errorMessage');

        if (!loginForm) return;

        fetchCurrentLogin(true);

        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (errorMessage) errorMessage.textContent = '';
            const email = loginForm.email.value;
            const password = loginForm.password.value;
            const ok = await attemptLogin(email, password);
            if (!ok) {
                if (errorMessage) errorMessage.textContent = 'Invalid email or password.';
            }
        });
    };

    /**
     * Handles logic for the USER LIST PAGE (userlist.html)
     */
    const handleUserListPage = () => {
        const usersTbody = document.getElementById('usersTbody');
        if (!usersTbody) return;

        if (sessionStorage.getItem('isLoggedIn') !== 'true') {
            window.location.href = 'index.html';
            return;
        }

        let allUsers = [];
        let searchTerm = '';
        let currentPage = 1;
        let pageSize = 10;
        let showWithEmail = true;
        let showWithoutEmail = true;

        const searchBox = document.getElementById('searchBox');
        const pageSizeSelect = document.getElementById('pageSize');
        const prevBtn = document.getElementById('prevBtn');
        const nextBtn = document.getElementById('nextBtn');
        const pageIndicator = document.getElementById('pageIndicator');
        const resultInfo = document.getElementById('resultInfo');
        const logoutBtn = document.getElementById('logoutBtn');
        const withEmailCheckbox = document.getElementById('withEmailCheckbox');
        const withoutEmailCheckbox = document.getElementById('withoutEmailCheckbox');
        const newUserModal = document.getElementById('newUserModal');
        const newUserForm = document.getElementById('newUserForm');
        const cancelNewUserBtn = document.getElementById('cancelNewUserBtn');
        const newUserFormError = document.getElementById('newUserFormError');
        const editUserModal = document.getElementById('editUserModal');
        const editUserForm = document.getElementById('editUserForm');
        const cancelEditUserBtn = document.getElementById('cancelEditUserBtn');
        const editUserFormError = document.getElementById('editUserFormError');
        const newUserBtn = document.getElementById('newUserBtn');

        withEmailCheckbox.checked = true;
        withoutEmailCheckbox.checked = true;


        const renderTable = () => {
            const filteredUsers = allUsers.filter(user => {
                const searchMatch = (
                    user.fullName?.toLowerCase().includes(searchTerm) ||
                    user.email?.toLowerCase().includes(searchTerm) ||
                    user.departmentName?.toLowerCase().includes(searchTerm)
                );
                const hasEmail = user.email && user.email.trim() !== '';
                let emailMatch = false;
                if (showWithEmail && showWithoutEmail) emailMatch = true;
                else if (showWithEmail) emailMatch = hasEmail;
                else if (showWithoutEmail) emailMatch = !hasEmail;
                return searchMatch && emailMatch;
            });

            const totalResults = filteredUsers.length;
            const totalPages = Math.ceil(totalResults / pageSize) || 1;
            const start = (currentPage - 1) * pageSize;
            const end = start + pageSize;
            const paginatedUsers = filteredUsers.slice(start, end);

            usersTbody.innerHTML = '';
            if (paginatedUsers.length === 0) {
                usersTbody.innerHTML = `<tr><td colspan="4" class="text-center text-slate-500 py-4">No users found.</td></tr>`;
            } else {
                paginatedUsers.forEach((user, index) => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${start + index + 1}</td>
                        <td class="fullname-cell cursor-pointer text-blue-600 hover:underline">${user.fullName || 'N/A'}</td>
                        <td>${user.email || 'N/A'}</td>
                        <td>${user.departmentName || 'N/A'}</td>
                    `;
                    const fullnameCell = row.querySelector('.fullname-cell');
                    if (fullnameCell) {
                        fullnameCell.addEventListener('click', () => openEditModal(user));
                    }
                    usersTbody.appendChild(row);
                });
            }

            pageIndicator.textContent = `${currentPage} / ${totalPages}`;
            resultInfo.textContent = `Showing ${start + 1} to ${start + paginatedUsers.length} of ${totalResults} results.`;
            prevBtn.disabled = currentPage === 1;
            nextBtn.disabled = currentPage === totalPages;
        };

        const populateDepartmentsDropdown = async (selectElement) => {
            try {
                const response = await fetch(DEPARTMENTS_API_URL);
                if (!response.ok) throw new Error('Could not fetch departments.');
                const responseData = await response.json();
                let departments = [];
                if (Array.isArray(responseData)) departments = responseData;
                else if (responseData && Array.isArray(responseData.data)) departments = responseData.data;
                else if (responseData && Array.isArray(responseData.content)) departments = responseData.content;
                else throw new Error('Department data is not in a recognizable format.');
                selectElement.innerHTML = '<option value="">Select a Department</option>';
                departments.forEach(dept => {
                    const option = document.createElement('option');
                    const deptName = dept.departmentName || dept.name;
                    option.value = deptName;
                    option.textContent = deptName;
                    selectElement.appendChild(option);
                });
            } catch (error) {
                console.error("Failed to populate departments:", error);
                selectElement.innerHTML = '<option value="">Error loading departments</option>';
            }
        };

        const setupModalTabs = (modalElement) => {
            const mainTabs = modalElement.querySelectorAll('.main-tab-button');
            const mainContents = modalElement.querySelectorAll('.main-tab-content');
            const subTabs = modalElement.querySelectorAll('.sub-tab-button');
            const subContents = modalElement.querySelectorAll('.sub-tab-content');

            mainTabs.forEach(tab => {
                tab.addEventListener('click', () => {
                    mainTabs.forEach(t => t.classList.remove('active'));
                    tab.classList.add('active');
                    const target = modalElement.querySelector(tab.dataset.tabTarget);
                    mainContents.forEach(c => c.classList.add('hidden'));
                    if(target) target.classList.remove('hidden');
                });
            });

            subTabs.forEach(tab => {
                tab.addEventListener('click', () => {
                    subTabs.forEach(t => t.classList.remove('active'));
                    tab.classList.add('active');
                    const target = modalElement.querySelector(tab.dataset.subtabTarget);
                    subContents.forEach(c => c.classList.add('hidden'));
                    if(target) target.classList.remove('hidden');
                });
            });
        };

        setupModalTabs(editUserModal);

        const openEditModal = (user) => {
            editUserForm.reset();
            editUserFormError.textContent = '';
            editUserForm.editUserId.value = user.userId;
            editUserForm.editFullName.value = user.fullName || '';
            editUserForm.editEmail.value = user.email || '';
            editUserForm.editMobileNumber.value = user.mobileNumber || '';
            editUserForm.editPosition.value = user.position || '';
            editUserForm.editBranchId.value = user.branchId || '';
            editUserForm.editBranchName.value = user.branchName || '';
            editUserForm.editOperationId.value = user.operationId || '';
            editUserForm.editToken.value = user.token || '';
            editUserForm.editIsActive.checked = user.isActive;
            const departmentDropdown = document.getElementById('editDepartmentName');
            populateDepartmentsDropdown(departmentDropdown).then(() => {
                departmentDropdown.value = user.departmentName || '';
            });
            editUserModal.querySelector('.main-tab-button').click();
            editUserModal.querySelector('.sub-tab-button').click();
            editUserModal.classList.remove('hidden');
        };

        const getValueOrNull = (element) => {
            const value = element.value.trim();
            return value === '' ? null : value;
        };

        const getValueAsIntOrNull = (element) => {
            const value = element.value.trim();
            if (value === '') return null;
            const parsed = parseInt(value, 10);
            return isNaN(parsed) ? null : parsed;
        };

        searchBox.addEventListener('input', (e) => {
            searchTerm = e.target.value.toLowerCase();
            currentPage = 1;
            renderTable();
        });

        pageSizeSelect.addEventListener('change', (e) => {
            pageSize = parseInt(e.target.value, 10);
            currentPage = 1;
            renderTable();
        });

        withEmailCheckbox.addEventListener('change', () => {
            showWithEmail = withEmailCheckbox.checked;
            currentPage = 1;
            renderTable();
        });

        withoutEmailCheckbox.addEventListener('change', () => {
            showWithoutEmail = withoutEmailCheckbox.checked;
            currentPage = 1;
            renderTable();
        });

        prevBtn.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                renderTable();
            }
        });

        nextBtn.addEventListener('click', () => {
            const totalPages = Math.ceil(allUsers.length / pageSize);
            if (currentPage < totalPages) {
                currentPage++;
                renderTable();
            }
        });

        logoutBtn.addEventListener('click', () => {
            sessionStorage.removeItem('isLoggedIn');
            window.location.href = 'index.html';
        });

        newUserBtn.addEventListener('click', () => {
            newUserForm.reset();
            newUserFormError.textContent = '';
            // Manually trigger change to reset city/barangay dropdowns
            document.getElementById('newProvince').dispatchEvent(new Event('change'));
            populateDepartmentsDropdown(document.getElementById('newDepartmentName'));
            newUserModal.classList.remove('hidden');
        });

        cancelNewUserBtn.addEventListener('click', () => newUserModal.classList.add('hidden'));

        newUserForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            newUserFormError.textContent = '';
            const newUser = {
                // NOTE: The backend will need to be updated to handle these new fields
            };
            // Logic for gathering new form fields would go here...
            console.log('Form submitted with new address fields.');
        });

        cancelEditUserBtn.addEventListener('click', () => editUserModal.classList.add('hidden'));

        editUserForm.addEventListener('submit', async (e) => {
            // ... (existing edit form logic)
        });

        const initializeUserTable = async () => {
            try {
                const response = await fetch(USERS_API_URL);
                if (!response.ok) throw new Error("Failed to fetch users");
                const responseData = await response.json();
                let usersList = responseData.data || responseData.content || responseData;
                if (!Array.isArray(usersList)) throw new Error('User data from API is not a valid array.');
                allUsers = usersList;
                renderTable();
            } catch (error) {
                console.error("Initialization failed:", error);
                usersTbody.innerHTML = `<tr><td colspan="4" class="text-center text-danger py-4">Error loading user data.</td></tr>`;
            }
        };

        // --- ADDRESS DROPDOWN LOGIC (normalized to expected keys) ---
        const initializeAddressDropdowns = () => {
            const provinceSelect = document.getElementById('newProvince');
            const citySelect = document.getElementById('newCity');
            const barangaySelect = document.getElementById('newBarangay');
            if (!provinceSelect || !citySelect || !barangaySelect) return;

            const ADDRESS_API_URLS = {
                provinces: `${API_BASE}/api/provinces`,
                cities: `${API_BASE}/api/cities`,
                barangays: `${API_BASE}/api/barangays`
            };

            let allProvinces = [];
            let allCities = [];
            let allBarangays = [];

            async function fetchAllData() {
                try {
                    provinceSelect.innerHTML = '<option>Loading addresses...</option>';
                    provinceSelect.disabled = true;
                    citySelect.innerHTML = '<option value="">Select a province first</option>';
                    citySelect.disabled = true;
                    barangaySelect.innerHTML = '<option value="">Select a city first</option>';
                    barangaySelect.disabled = true;

                    const [provRes, cityRes, bgyRes] = await Promise.all([
                        fetch(ADDRESS_API_URLS.provinces, { credentials: 'include' }),
                        fetch(ADDRESS_API_URLS.cities, { credentials: 'include' }),
                        fetch(ADDRESS_API_URLS.barangays, { credentials: 'include' })
                    ]);
                    if (!provRes.ok || !cityRes.ok || !bgyRes.ok) {
                        throw new Error('Failed to fetch address data from server.');
                    }

                    // Raw payloads
                    let rawProvinces = await provRes.json();
                    let rawCities = await cityRes.json();
                    let rawBarangays = await bgyRes.json();

                    // 🔧 Normalize to what the UI expects
                    allProvinces = rawProvinces.map(p => ({
                        prov_code: p.prov_code || p.province_code,
                        prov_desc: p.prov_desc || p.province_name,
                        region_code: p.region_code || p.reg_code || p.region_code
                    }));

                    allCities = rawCities.map(c => ({
                        city_code: c.city_code,
                        city_desc: c.city_desc || c.city_name,
                        prov_code: c.prov_code || c.province_code
                    }));

                    allBarangays = rawBarangays.map(b => ({
                        brgy_code: b.brgy_code,
                        brgy_desc: b.brgy_desc || b.brgy_name,
                        city_code: b.city_code,
                        prov_code: b.prov_code || b.province_code
                    }));

                    // Safe sorts
                    allProvinces.sort((a, b) => (a.prov_desc || '').localeCompare(b.prov_desc || ''));
                    allCities.sort((a, b) => (a.city_desc || '').localeCompare(b.city_desc || ''));
                    allBarangays.sort((a, b) => (a.brgy_desc || '').localeCompare(b.brgy_desc || ''));

                    populateProvinces();

                    // Wire changes
                    provinceSelect.removeEventListener('change', handleProvinceChange);
                    citySelect.removeEventListener('change', handleCityChange);
                    provinceSelect.addEventListener('change', handleProvinceChange);
                    citySelect.addEventListener('change', handleCityChange);
                } catch (err) {
                    console.error('Address Initialization Error:', err);
                    provinceSelect.innerHTML = `<option value="">Error loading addresses</option>`;
                }
            }

            function populateProvinces() {
                provinceSelect.innerHTML = '<option value="">Select a Province</option>';
                for (const p of allProvinces) {
                    const opt = document.createElement('option');
                    opt.value = p.prov_code;
                    opt.textContent = p.prov_desc;
                    provinceSelect.appendChild(opt);
                }
                provinceSelect.disabled = false;

                citySelect.innerHTML = '<option value="">Select a province first</option>';
                citySelect.disabled = true;
                barangaySelect.innerHTML = '<option value="">Select a city first</option>';
                barangaySelect.disabled = true;
            }

            function handleProvinceChange() {
                const provinceCode = provinceSelect.value;
                citySelect.innerHTML = '<option value="">Select a City / Municipality</option>';
                barangaySelect.innerHTML = '<option value="">Select a city first</option>';
                citySelect.disabled = true;
                barangaySelect.disabled = true;
                if (!provinceCode) return;

                const citiesInProvince = allCities.filter(c => c.prov_code === provinceCode);
                for (const c of citiesInProvince) {
                    const opt = document.createElement('option');
                    opt.value = c.city_code;
                    opt.textContent = c.city_desc;
                    citySelect.appendChild(opt);
                }
                citySelect.disabled = false;
            }

            function handleCityChange() {
                const cityCode = citySelect.value;
                barangaySelect.innerHTML = '<option value="">Select a Barangay</option>';
                barangaySelect.disabled = true;
                if (!cityCode) return;

                const barangaysInCity = allBarangays.filter(b => b.city_code === cityCode);
                for (const b of barangaysInCity) {
                    const opt = document.createElement('option');
                    opt.value = b.brgy_code;
                    opt.textContent = b.brgy_desc;
                    barangaySelect.appendChild(opt);
                }
                barangaySelect.disabled = false;
            }

            fetchAllData();
        };
// --- END ADDRESS LOGIC ---


        // Initialize all functionalities for the page
        initializeUserTable();
        initializeAddressDropdowns();
    };

    handleLoginPage();
    handleUserListPage();
});