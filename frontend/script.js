document.addEventListener('DOMContentLoaded', () => {
    // API endpoints
    const USERS_API_URL = 'http://192.168.1.49:8080/api/users';
    const DEPARTMENTS_API_URL = 'http://192.168.1.49:8080/api/departments';

    /**
     * Handles logic for the LOGIN PAGE (index.html)
     */
    const handleLoginPage = () => {
        const loginForm = document.getElementById('loginForm');
        const errorMessage = document.getElementById('errorMessage');

        if (!loginForm) return;

        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (errorMessage) errorMessage.textContent = '';

            const email = loginForm.email.value;
            const password = loginForm.password.value;

            try {
                const response = await fetch(USERS_API_URL);
                if (!response.ok) throw new Error('Network response was not ok.');
                const users = await response.json();
                const authenticatedUser = users.find(
                    (user) => user.email === email && user.password === password
                );

                if (authenticatedUser) {
                    sessionStorage.setItem('isLoggedIn', 'true');
                    window.location.href = 'userlist.html';
                } else {
                    if (errorMessage) errorMessage.textContent = 'Invalid email or password.';
                }
            } catch (error) {
                console.error('Login failed:', error);
                if (errorMessage) errorMessage.textContent = 'Login failed. Could not connect to the server.';
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

        // --- ELEMENT SELECTORS ---
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

        setupModalTabs(newUserModal);
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
            newUserModal.querySelector('.main-tab-button').click();
            newUserModal.querySelector('.sub-tab-button').click();
            newUserFormError.textContent = '';
            populateDepartmentsDropdown(document.getElementById('newDepartmentName'));
            newUserModal.classList.remove('hidden');
        });

        cancelNewUserBtn.addEventListener('click', () => newUserModal.classList.add('hidden'));

        newUserForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            newUserFormError.textContent = '';
            const newUser = {
                fullName: getValueOrNull(document.getElementById('newFullName')),
                email: getValueOrNull(document.getElementById('newEmail')),
                password: getValueOrNull(document.getElementById('newPassword')),
                departmentName: getValueOrNull(document.getElementById('newDepartmentName')),
                position: getValueOrNull(document.getElementById('newPosition')),
                mobileNumber: getValueOrNull(document.getElementById('newMobileNumber')),
                isActive: document.getElementById('newIsActive').checked,
                branchId: getValueOrNull(document.getElementById('newBranchId')),
                branchName: getValueOrNull(document.getElementById('newBranchName')),
                operationId: getValueOrNull(document.getElementById('newOperationId')),
                token: getValueOrNull(document.getElementById('newToken')),
            };
            try {
                const response = await fetch(USERS_API_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(newUser)
                });
                if (!response.ok) throw new Error((await response.json()).message || 'Failed to create user.');
                const createdUser = await response.json();
                allUsers.push(createdUser);
                renderTable();
                newUserModal.classList.add('hidden');
            } catch (error) {
                newUserFormError.textContent = error.message;
            }
        });

        cancelEditUserBtn.addEventListener('click', () => editUserModal.classList.add('hidden'));

        editUserForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            editUserFormError.textContent = '';
            const userId = editUserForm.editUserId.value;
            const updatedUser = {
                userId: parseInt(userId),
                fullName: getValueOrNull(editUserForm.editFullName),
                email: getValueOrNull(editUserForm.editEmail),
                departmentName: getValueOrNull(editUserForm.editDepartmentName),
                position: getValueOrNull(editUserForm.editPosition),
                mobileNumber: getValueOrNull(editUserForm.editMobileNumber),
                isActive: editUserForm.editIsActive.checked,
                branchId: getValueOrNull(editUserForm.editBranchId),
                branchName: getValueOrNull(editUserForm.editBranchName),
                operationId: getValueOrNull(editUserForm.editOperationId),
                token: getValueOrNull(editUserForm.editToken),
            };
            const password = editUserForm.editPassword.value;
            if (password) {
                updatedUser.password = password;
            }
            try {
                const response = await fetch(`${USERS_API_URL}/${userId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updatedUser)
                });
                if (!response.ok) throw new Error((await response.json()).message || 'Failed to update user.');
                const returnedUser = await response.json();
                const userIndex = allUsers.findIndex(u => u.userId == userId);
                if (userIndex !== -1) {
                    allUsers[userIndex] = returnedUser;
                }
                renderTable();
                editUserModal.classList.add('hidden');
            } catch (error) {
                console.error("Failed to update user:", error);
                editUserFormError.textContent = error.message;
            }
        });

        const initialize = async () => {
            try {
                const response = await fetch(USERS_API_URL);
                if (!response.ok) throw new Error("Failed to fetch users");
                allUsers = await response.json();
                renderTable();
            } catch (error) {
                console.error("Initialization failed:", error);
                usersTbody.innerHTML = `<tr><td colspan="4" class="text-center text-danger py-4">Error loading user data.</td></tr>`;
            }
        };

        initialize();
    };

    handleLoginPage();
    handleUserListPage();
});

