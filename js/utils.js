/* =============================================
   LouageConnect — Shared Utilities (v2 FIXED)
   ============================================= */

// ---- Dynamic API Base ----
// Works regardless of folder name, port, or subfolder (admin/, driver/)
const API = {
    base: (function () {
        // Find this script's src to extract the root path
        const scripts = document.getElementsByTagName('script');
        for (let i = 0; i < scripts.length; i++) {
            const src = scripts[i].src || '';
            const m = src.match(/^(https?:\/\/.+?)\/js\/utils\.js(\?.*)?$/);
            if (m) return m[1];
        }
        // Fallback: current origin + path minus known subfolders and current page
        let p = window.location.pathname;
        p = p.replace(/\/[^\/]*$/, '');           // strip filename
        p = p.replace(/\/(admin|driver)\/?$/, ''); // strip subfolder
        return window.location.origin + p;
    })(),

    // Core fetch wrapper — verbose errors for debugging
    async call(url, opts) {
        opts = opts || {};
        try {
            const fetchOpts = { credentials: 'include' };
            if (opts.method) fetchOpts.method = opts.method;
            if (opts.body)   {
                fetchOpts.body = opts.body;
                fetchOpts.headers = { 'Content-Type': 'application/json' };
            }

            const res = await fetch(url, fetchOpts);
            const raw = await res.text();

            if (!raw || raw.trim() === '') {
                console.error('Empty response from:', url);
                return { error: 'Empty server response. Check PHP error logs.' };
            }

            // Strip any PHP warnings/notices before the JSON
            const jsonStart = raw.indexOf('{');
            const jsonEnd   = raw.lastIndexOf('}');
            if (jsonStart === -1 || jsonEnd === -1) {
                console.error('No JSON in response from:', url, '\nRaw:', raw);
                return { error: 'PHP error: ' + raw.substring(0, 200) };
            }

            const cleaned = raw.substring(jsonStart, jsonEnd + 1);
            try {
                return JSON.parse(cleaned);
            } catch (e) {
                console.error('JSON parse failed:', cleaned);
                return { error: 'Invalid JSON from server.' };
            }

        } catch (err) {
            console.error('Network error calling', url, err);
            return { error: 'Cannot reach server. Is EasyPHP/Apache running?' };
        }
    },

    getCars()        { return API.call(API.base + '/api/get_cars.php'); },
    myReservations() { return API.call(API.base + '/api/my_reservations.php'); },
    session()        { return API.call(API.base + '/php/session.php'); },

    reserve(carId, seats) {
        return API.call(API.base + '/api/reserve.php', {
            method: 'POST',
            body: JSON.stringify({ car_id: parseInt(carId), seats: parseInt(seats) })
        });
    },

    login(email, password) {
        return API.call(API.base + '/php/login.php', {
            method: 'POST',
            body: JSON.stringify({ email: email, password: password })
        });
    },

    register(name, email, password, role) {
        return API.call(API.base + '/php/register.php', {
            method: 'POST',
            body: JSON.stringify({ name: name, email: email, password: password, role: role })
        });
    },

    manage(action, data) {
        return API.call(API.base + '/api/manage.php', {
            method: 'POST',
            body: JSON.stringify(Object.assign({ action: action }, data || {}))
        });
    }
};

// ---- Toast ----
function showToast(message, type, duration) {
    type     = type || 'info';
    duration = duration || 3500;
    const icons = { success: '✓', error: '✕', info: 'ℹ' };

    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    toast.innerHTML = '<span style="font-size:1rem;font-weight:700">'
        + (icons[type] || '•') + '</span> ' + message;
    container.appendChild(toast);

    setTimeout(function () {
        toast.classList.add('hide');
        setTimeout(function () { if (toast.parentNode) toast.remove(); }, 350);
    }, duration);
}

// ---- Session ----
var currentUser = null;

async function checkSession() {
    const data = await API.session();
    if (data && data.loggedIn) {
        currentUser = data.user;
        updateNavForUser(data.user);
    }
    return data || { loggedIn: false };
}

function updateNavForUser(user) {
    const loginBtn   = document.getElementById('nav-login');
    const logoutBtn  = document.getElementById('nav-logout');
    const userName   = document.getElementById('nav-username');
    const adminLink  = document.getElementById('nav-admin');
    const driverLink = document.getElementById('nav-driver');

    if (loginBtn)  loginBtn.classList.add('hidden');
    if (logoutBtn) logoutBtn.classList.remove('hidden');
    if (userName)  { userName.textContent = user.name; userName.classList.remove('hidden'); }
    if (adminLink  && user.role === 'admin')                              adminLink.classList.remove('hidden');
    if (driverLink && (user.role === 'driver' || user.role === 'admin'))  driverLink.classList.remove('hidden');
}

// ---- Helpers ----
function statusBadge(status) {
    const map = {
        waiting: ['badge-waiting', 'Waiting'],
        full:    ['badge-full',    'Full'],
        moving:  ['badge-moving',  'Moving']
    };
    const s = map[status] || map['waiting'];
    return '<span class="badge ' + s[0] + ' badge-dot">' + s[1] + '</span>';
}

function formatETA(minutes) {
    minutes = parseInt(minutes) || 0;
    if (minutes <= 0) return 'En route';
    if (minutes < 60) return minutes + ' min';
    const h = Math.floor(minutes / 60), m = minutes % 60;
    return m > 0 ? h + 'h ' + m + 'min' : h + 'h';
}

function seatColor(available, total) {
    const r = available / (total || 1);
    return r > 0.5 ? 'green' : r > 0 ? 'amber' : 'red';
}

function formatDate(dateStr) {
    if (!dateStr) return '—';
    try {
        return new Date(dateStr).toLocaleString('fr-TN', {
            day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
        });
    } catch(e) { return dateStr; }
}
