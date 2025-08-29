document.addEventListener('DOMContentLoaded', () => {
    // The API endpoint the application will use for login and user data.
    const API_URL = 'http://192.168.1.49:8080/api/users';

    // ======== SECURITY WARNING ========
    // This login method is for demonstration purposes only and is NOT SECURE.
    // ===================================

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
                const response = await fetch(API_URL);
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

        // Set initial state of checkboxes
        withEmailCheckbox.checked = true;
        withoutEmailCheckbox.checked = true;

        const renderTable = () => {
            // Combined filter logic for search and email checkboxes
            const filteredUsers = allUsers.filter(user => {
                const searchMatch = (
                    user.fullName?.toLowerCase().includes(searchTerm) ||
                    user.email?.toLowerCase().includes(searchTerm) ||
                    user.departmentName?.toLowerCase().includes(searchTerm)
                );

                const hasEmail = user.email && user.email.trim() !== '';
                let emailMatch = false;
                if (showWithEmail && showWithoutEmail) {
                    emailMatch = true; // Both checked, show everyone
                } else if (showWithEmail) {
                    emailMatch = hasEmail; // Only show users with an email
                } else if (showWithoutEmail) {
                    emailMatch = !hasEmail; // Only show users without an email
                }

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
                        <td>${user.fullName || 'N/A'}</td>
                        <td>${user.email || 'N/A'}</td>
                        <td>${user.departmentName || 'N/A'}</td>
                    `;
                    usersTbody.appendChild(row);
                });
            }

            pageIndicator.textContent = `${currentPage} / ${totalPages}`;
            resultInfo.textContent = `Showing ${start + 1} to ${start + paginatedUsers.length} of ${totalResults} results.`;
            prevBtn.disabled = currentPage === 1;
            nextBtn.disabled = currentPage === totalPages;
        };

        // --- EVENT LISTENERS ---
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
            const totalPages = Math.ceil(allUsers.filter(u => u.fullName?.toLowerCase().includes(searchTerm)).length / pageSize);
            if (currentPage < totalPages) {
                currentPage++;
                renderTable();
            }
        });

        logoutBtn.addEventListener('click', () => {
            sessionStorage.removeItem('isLoggedIn');
            window.location.href = 'index.html';
        });

        const initialize = async () => {
            try {
                const response = await fetch(API_URL);
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