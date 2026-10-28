/* LouageConnect — Dashboard v4
   Fixes: no full-DOM rebuild on refresh (only update changed values),
   seat max enforced, queue display, departure countdown,
   car icon replaced with download.png */

var allCars      = [];
var updateTimer  = null;
var lastCarHash  = '';   // detect actual changes before re-rendering

// City station coordinates (departure coordinates auto-fill)
var STATIONS = {
    'Tunis (Moncef Bey)':  { lat: 36.8097, lng: 10.1703 },
    'Tunis (Bab Saadoun)': { lat: 36.8240, lng: 10.1559 },
    'Tunis (Bab Alioua)':  { lat: 36.7978, lng: 10.1795 },
    'Sfax':      { lat: 34.7406, lng: 10.7504 },
    'Sousse':    { lat: 35.8283, lng: 10.6378 },
    'Bizerte':   { lat: 37.2744, lng: 9.8742  },
    'Nabeul':    { lat: 36.4548, lng: 10.7307 },
    'Kairouan':  { lat: 35.6758, lng: 10.0963 },
    'Monastir':  { lat: 35.7648, lng: 10.8212 },
    'Gabes':     { lat: 33.8815, lng: 10.0982 },
    'Medenine':  { lat: 33.3549, lng: 10.5055 },
    'El Kef':    { lat: 36.1742, lng: 8.7049  },
    'Hammamet':  { lat: 36.3997, lng: 10.6221 },
    'Mahdia':    { lat: 35.5047, lng: 11.0622 },
    'Gafsa':     { lat: 34.4250, lng: 8.7842  }
};

document.addEventListener('DOMContentLoaded', function() {
    checkSession().then(function(sess) {
        if (sess && sess.loggedIn) {
            document.getElementById('reservations-section').classList.remove('hidden');
            loadReservations();
        }
    });
    loadCars();
    updateTimer = setInterval(liveUpdate, 5000);

    document.getElementById('filter-from')   && document.getElementById('filter-from').addEventListener('change',   applyFilters);
    document.getElementById('filter-to')     && document.getElementById('filter-to').addEventListener('change',     applyFilters);
    document.getElementById('filter-status') && document.getElementById('filter-status').addEventListener('change', applyFilters);
    document.getElementById('filter-search') && document.getElementById('filter-search').addEventListener('input',  applyFilters);
});

// ---- Initial full load ----
async function loadCars() {
    var data = await API.getCars();
    if (!data || !data.cars) {
        document.getElementById('cars-grid').innerHTML =
            '<div class="empty-state" style="grid-column:1/-1">' +
            '<div class="empty-icon">⚠️</div>' +
            '<div class="empty-title">Could not load louages</div>' +
            '<p class="text-sm text-muted">Check PHP server & DB. Visit <a href="test.html">test.html</a></p>' +
            '</div>';
        return;
    }
    allCars = data.cars;
    populateFilters(allCars);
    applyFilters();
    updateStats(allCars);
}

// ---- Live update: only re-render cards whose data changed ----
async function liveUpdate() {
    var data = await API.getCars();
    if (!data || !data.cars) return;

    var newHash = JSON.stringify(data.cars.map(function(c) {
        return c.id + '|' + c.available_seats + '|' + c.status + '|' + c.queue_position + '|' + c.seconds_until_depart;
    }));
    if (newHash === lastCarHash) return; // nothing changed, no DOM work
    lastCarHash = newHash;

    allCars = data.cars;
    updateStats(allCars);

    // Update each card in-place instead of rebuilding grid
    var grid = document.getElementById('cars-grid');
    if (!grid) return;
    var existingCards = {};
    grid.querySelectorAll('.louage-card[data-id]').forEach(function(el) {
        existingCards[el.dataset.id] = el;
    });

    var filtered = getFiltered();
    // If set of visible cars changed, do a full re-render
    var filteredIds = filtered.map(function(c){ return c.id; }).join(',');
    var existingIds = Object.keys(existingCards).join(',');
    if (filteredIds !== existingIds) {
        renderCars(filtered);
        return;
    }

    // Otherwise patch individual cards
    filtered.forEach(function(car) {
        var card = existingCards[car.id];
        if (!card) return;
        // Update seats display
        var seatsEl = card.querySelector('.seats-val');
        if (seatsEl) seatsEl.textContent = car.available_seats;
        // Update status badge
        var badgeEl = card.querySelector('.status-badge-wrap');
        if (badgeEl) badgeEl.innerHTML = statusBadge(car.status);
        // Update queue
        var queueEl = card.querySelector('.queue-display');
        if (queueEl) queueEl.innerHTML = queueHTML(car);
        // Update countdown
        var cdEl = card.querySelector('.depart-countdown');
        if (cdEl) cdEl.innerHTML = countdownHTML(car);
        // Update progress bar
        var prog = card.querySelector('.progress-fill');
        if (prog) {
            var pct = Math.round(((car.total_seats - car.available_seats) / car.total_seats) * 100);
            prog.style.width = pct + '%';
            prog.className   = 'progress-fill ' + seatColor(car.available_seats, car.total_seats);
        }
        // Update seat dots
        var dotsEl = card.querySelector('.seat-dots-row');
        if (dotsEl) dotsEl.innerHTML = seatDotsHTML(car);
        // Update reserve button
        var btnEl = card.querySelector('.reserve-btn');
        if (btnEl) {
            var canR = car.status !== 'moving' && car.status !== 'arrived' && car.available_seats > 0 && car.queue_position === 1;
            btnEl.disabled = !canR;
            btnEl.textContent = reserveBtnLabel(car);
        }
    });
}

function getFiltered() {
    var from   = (document.getElementById('filter-from')   && document.getElementById('filter-from').value)   || '';
    var to     = (document.getElementById('filter-to')     && document.getElementById('filter-to').value)     || '';
    var status = (document.getElementById('filter-status') && document.getElementById('filter-status').value) || '';
    var search = ((document.getElementById('filter-search')&& document.getElementById('filter-search').value) || '').toLowerCase();
    return allCars.filter(function(c) {
        if (from   && c.departure_city   !== from)   return false;
        if (to     && c.destination_city !== to)     return false;
        if (status && c.status           !== status) return false;
        if (search && c.route.toLowerCase().indexOf(search) === -1) return false;
        return true;
    });
}

function populateFilters(cars) {
    var fromSel = document.getElementById('filter-from');
    var toSel   = document.getElementById('filter-to');
    if (!fromSel || fromSel.dataset.populated) return;
    fromSel.dataset.populated = '1';
    toSel.dataset.populated   = '1';
    var cities = [];
    cars.forEach(function(c) {
        if (cities.indexOf(c.departure_city)   === -1) cities.push(c.departure_city);
        if (cities.indexOf(c.destination_city) === -1) cities.push(c.destination_city);
    });
    cities.sort().forEach(function(city) {
        fromSel.add(new Option(city, city));
        toSel.add(new Option(city, city));
    });
}

function applyFilters() {
    lastCarHash = ''; // force full render on filter change
    renderCars(getFiltered());
}

// ---- Full render ----
function renderCars(cars) {
    var grid = document.getElementById('cars-grid');
    if (!grid) return;
    if (!cars.length) {
        grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">🚖</div><div class="empty-title">No louages found</div><p class="text-sm text-muted">Try adjusting your filters</p></div>';
        return;
    }
    grid.innerHTML = cars.map(carCardHTML).join('');
    grid.querySelectorAll('.louage-card').forEach(function(el, i) {
        el.style.opacity = '0'; el.style.transform = 'translateY(10px)';
        setTimeout(function() {
            el.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
            el.style.opacity = '1'; el.style.transform = 'translateY(0)';
        }, i * 40);
    });
}

// ---- Car image (uses download.png) ----
function getCarImage() {
    return '<img src="download.png" alt="Louage" style="width:auto;height:50px;object-fit:contain;display:block;border-radius:8px;">';
}

function seatDotsHTML(car) {
    var t = car.total_seats, a = car.available_seats, o = t - a, h = '';
    for (var i = 0; i < t; i++) h += '<span class="seat-dot ' + (i < o ? 'occupied' : 'available') + '"></span>';
    return h;
}

function queueHTML(car) {
    if (car.queue_position === 1) return '<span style="font-size:.72rem;color:var(--green);font-weight:700">🟢 NEXT UP</span>';
    return '<span style="font-size:.72rem;color:var(--text-muted)">Queue #' + car.queue_position + '</span>';
}

function countdownHTML(car) {
    if (car.status === 'full' && car.seconds_until_depart > 0) {
        var m = Math.floor(car.seconds_until_depart / 60);
        var s = car.seconds_until_depart % 60;
        return '<span style="font-size:.72rem;color:var(--amber);font-weight:700;animation:blink 1s infinite">🕐 Departs in ' + m + ':' + (s < 10 ? '0' : '') + s + '</span>';
    }
    if (car.status === 'moving') return '<span style="font-size:.72rem;color:var(--green)">🚕 On the road</span>';
    return '';
}

function reserveBtnLabel(car) {
    if (car.status === 'moving' || car.status === 'arrived') return '🚕 Departed';
    if (car.available_seats === 0)  return '🔴 Full';
    if (car.queue_position > 1)     return '⏳ Queued';
    return '🎟 Reserve';
}

var STATUS_COLORS = {
    waiting: { bg: 'rgba(245,158,11,.07)', border: 'rgba(245,158,11,.2)' },
    full:    { bg: 'rgba(239,68,68,.07)',  border: 'rgba(239,68,68,.2)'  },
    moving:  { bg: 'rgba(34,197,94,.07)',  border: 'rgba(34,197,94,.2)'  },
    arrived: { bg: 'rgba(148,163,184,.05)',border: 'rgba(148,163,184,.1)'}
};

function carCardHTML(car) {
    var total   = car.total_seats || 8;
    var avail   = car.available_seats || 0;
    var occ     = total - avail;
    var pct     = Math.round((occ / total) * 100);
    var sc      = STATUS_COLORS[car.status] || STATUS_COLORS.waiting;
    var canR    = car.status !== 'moving' && car.status !== 'arrived' && avail > 0 && car.queue_position === 1;

    return '<div class="louage-card" data-id="' + car.id + '" onclick="openCarModal(' + car.id + ')" style="border-color:' + sc.border + '">' +
        // Header
        '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:12px">' +
        '  <div>' +
        '    <div class="louage-route"><span>' + car.departure_city + '</span>' +
        '      <span class="route-arrow"><svg width="18" height="9" viewBox="0 0 20 10" fill="none"><path d="M0 5h17M13 1l4 4-4 4" stroke="#6366F1" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span>' +
        '      <span>' + car.destination_city + '</span>' +
        '    </div>' +
        '    <div style="display:flex;gap:6px;align-items:center;margin-top:4px">' +
        '      <span class="queue-display">' + queueHTML(car) + '</span>' +
        '      <span class="depart-countdown">' + countdownHTML(car) + '</span>' +
        '    </div>' +
        '  </div>' +
        '  <div class="status-badge-wrap">' + statusBadge(car.status) + '</div>' +
        '</div>' +
        // Car image + seat count
        '<div style="background:' + sc.bg + ';border:1px solid ' + sc.border + ';border-radius:10px;padding:10px 14px;margin-bottom:12px;display:flex;align-items:center;justify-content:space-between">' +
        '  <div>' + getCarImage() + '</div>' +
        '  <div style="text-align:right">' +
        '    <div style="font-family:var(--font-display);font-size:1.5rem;font-weight:800;color:' + (avail > 0 ? 'var(--green)' : 'var(--red)') + ';line-height:1" class="seats-val">' + avail + '</div>' +
        '    <div style="font-size:.68rem;color:var(--text-muted)">of ' + total + ' seats</div>' +
        '  </div>' +
        '</div>' +
        // Seat dots
        '<div class="seat-dots-row" style="display:flex;gap:3px;margin-bottom:10px;flex-wrap:wrap">' + seatDotsHTML(car) + '</div>' +
        // Progress bar
        '<div class="progress-bar" style="margin-bottom:12px"><div class="progress-fill ' + seatColor(avail, total) + '" style="width:' + pct + '%"></div></div>' +
        // Meta chips
        '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:12px">' +
        '  <div class="meta-chip"><div class="meta-chip-val">' + formatETA(car.eta_minutes) + '</div><div class="meta-chip-lbl">ETA</div></div>' +
        '  <div class="meta-chip"><div class="meta-chip-val">' + car.speed + '<span style="font-size:.6rem"> km/h</span></div><div class="meta-chip-lbl">Speed</div></div>' +
        '  <div class="meta-chip"><div class="meta-chip-val" style="font-size:.72rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + car.driver_name.split(' ')[0] + '</div><div class="meta-chip-lbl">Driver</div></div>' +
        '</div>' +
        // Footer
        '<div style="display:flex;align-items:center;justify-content:space-between;padding-top:10px;border-top:1px solid var(--border)">' +
        '  <div style="font-size:.75rem;color:var(--text-muted)">' + car.vehicle_type + ' · ' + (car.plate_number || '—') + '</div>' +
        '  <button class="btn btn-sm reserve-btn ' + (canR ? 'btn-primary' : 'btn-ghost') + '" ' +
        '    onclick="event.stopPropagation();openCarModal(' + car.id + ')" ' +
        (canR ? '' : 'disabled style="opacity:.4;cursor:not-allowed"') + '>' +
        reserveBtnLabel(car) +
        '  </button>' +
        '</div>' +
        '</div>';
}

function updateStats(cars) {
    var avail   = cars.filter(function(c){ return c.status === 'waiting' || c.status === 'full'; }).length;
    var moving  = cars.filter(function(c){ return c.status === 'moving'; }).length;
    var seats   = cars.reduce(function(s,c){ return s + (parseInt(c.available_seats)||0); }, 0);
    var el      = function(id){ return document.getElementById(id); };
    if (el('stat-total'))     el('stat-total').textContent     = cars.length;
    if (el('stat-available')) el('stat-available').textContent = avail;
    if (el('stat-moving'))    el('stat-moving').textContent    = moving;
    if (el('stat-seats'))     el('stat-seats').textContent     = seats;
}

// ---- Car Detail Modal ----
async function openCarModal(carId) {
    var car = allCars.find(function(c){ return c.id === carId; });
    if (!car) return;
    var sess     = await API.session();
    var loggedIn = sess && sess.loggedIn;
    var total    = car.total_seats || 8;
    var avail    = car.available_seats || 0;
    var occ      = total - avail;
    var canR     = loggedIn && car.status !== 'moving' && car.status !== 'arrived' && avail > 0 && car.queue_position === 1;

    // Full seat grid
    var seatGrid = '';
    for (var i = 0; i < total; i++) {
        seatGrid += '<div class="seat ' + (i < occ ? 'occupied' : 'available') + '" title="Seat ' + (i+1) + '"></div>';
    }

    var sc = STATUS_COLORS[car.status] || STATUS_COLORS.waiting;
    document.getElementById('modal-title').textContent = car.departure_city + ' → ' + car.destination_city;

    var queueMsg = car.queue_position === 1 ? '🟢 This is the <strong>next car to depart</strong>' :
        '⏳ Queue position <strong>#' + car.queue_position + '</strong> — waiting for cars ahead';

    document.getElementById('modal-body').innerHTML =
        '<div style="display:flex;gap:8px;align-items:center;margin-bottom:6px">' + statusBadge(car.status) +
        '<span class="text-sm text-muted">' + car.vehicle_type + ' · ' + (car.plate_number || '—') + '</span></div>' +
        '<div style="font-size:.82rem;padding:8px 12px;background:' + sc.bg + ';border:1px solid ' + sc.border + ';border-radius:8px;margin-bottom:14px">' + queueMsg + '</div>' +
        (car.status === 'full' && car.seconds_until_depart > 0 ?
         '<div style="text-align:center;padding:8px;background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.3);border-radius:8px;margin-bottom:14px;color:var(--amber);font-weight:700;animation:blink 1s infinite">🕐 Full! Departing in ' + car.seconds_until_depart + 's</div>' : '') +
        '<div style="background:' + sc.bg + ';border:1px solid ' + sc.border + ';border-radius:10px;padding:12px 16px;margin-bottom:14px;display:flex;align-items:center;justify-content:space-between">' +
        getCarImage() +
        '<div style="text-align:right"><div style="font-family:var(--font-display);font-size:2rem;font-weight:800;color:' + (avail > 0 ? 'var(--green)' : 'var(--red)') + '">' + avail + '</div><div style="font-size:.72rem;color:var(--text-muted)">of ' + total + ' seats free</div></div></div>' +
        '<div class="form-label">Seat Map (8 passenger seats)</div>' +
        '<div class="seat-grid" style="grid-template-columns:repeat(8,1fr);gap:4px;margin-bottom:14px">' + seatGrid + '</div>' +
        '<div style="background:var(--bg-card2);border-radius:var(--radius-md);padding:12px;margin-bottom:14px;font-size:.85rem">' +
        ['Driver:' + car.driver_name, 'Speed:' + car.speed + ' km/h', 'ETA:' + formatETA(car.eta_minutes), 'Est. Departure:' + formatDate(car.estimated_departure)].map(function(row) {
            var p = row.split(':'); return '<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border)"><span class="text-muted">' + p[0] + '</span><span style="font-weight:600">' + p.slice(1).join(':') + '</span></div>';
        }).join('') + '</div>' +
        (canR ?
         '<div class="form-group"><label class="form-label">Seats to reserve (max ' + Math.min(avail,8) + ')</label>' +
         '<div style="display:flex;align-items:center;gap:10px">' +
         '<div class="seat-counter"><button onclick="adjSeats(-1)">−</button><span id="m-seats">1</span><button onclick="adjSeats(1)">+</button></div>' +
         '<span class="text-xs text-muted">of ' + avail + ' available</span></div></div>' +
         '<button class="btn btn-primary w-full btn-lg" style="justify-content:center;margin-top:8px" onclick="doReserve(' + car.id + ',' + Math.min(avail,8) + ')">🎟️ Confirm Reservation</button>'
         : loggedIn ?
         '<div style="text-align:center;padding:14px;background:var(--bg-card2);border-radius:var(--radius-md);color:var(--text-muted)">' +
         (car.status==='moving'||car.status==='arrived' ? '🚕 Already departed' : car.available_seats===0 ? '🔴 Car is full — departing soon' : car.queue_position > 1 ? '⏳ Queued behind ' + (car.queue_position-1) + ' other car(s) — book the car at position #1' : '') + '</div>'
         :
         '<a href="login.html" class="btn btn-primary w-full btn-lg" style="justify-content:center">🔑 Login to Reserve</a>');

    document.getElementById('car-modal').classList.remove('hidden');
    window._modalMaxSeats = Math.min(avail, 8);
}

function adjSeats(d) {
    var el = document.getElementById('m-seats');
    if (!el) return;
    var v = Math.max(1, Math.min(window._modalMaxSeats || 8, parseInt(el.textContent) + d));
    el.textContent = v;
}

async function doReserve(carId, maxSeats) {
    var el    = document.getElementById('m-seats');
    var seats = el ? parseInt(el.textContent) : 1;
    if (seats < 1 || seats > maxSeats) { showToast('Invalid seat count', 'error'); return; }
    var res = await API.reserve(carId, seats);
    if (res && res.success) {
        showToast(res.message, 'success');
        closeModal();
        lastCarHash = '';
        await loadCars();
    } else {
        showToast((res && res.error) || 'Reservation failed', 'error');
    }
}

function closeModal() { var m = document.getElementById('car-modal'); if(m) m.classList.add('hidden'); }

function resetFilters() {
    ['filter-from','filter-to','filter-status','filter-search'].forEach(function(id){ var e=document.getElementById(id); if(e) e.value=''; });
    applyFilters();
}

// Blink keyframe injection
(function(){ var s=document.createElement('style'); s.textContent='@keyframes blink{0%,100%{opacity:1}50%{opacity:.5}}'; document.head.appendChild(s); })();

window.addEventListener('beforeunload', function(){ if(updateTimer) clearInterval(updateTimer); });

// ---- Reservations ----
async function loadReservations() {
    var data = await API.myReservations();
    var tbody = document.getElementById('reservations-tbody');
    if (!tbody) return;
    if (!data || !data.reservations || !data.reservations.length) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:24px">No reservations yet</td></tr>';
        return;
    }
    tbody.innerHTML = data.reservations.map(function(r, i) {
        return '<tr><td class="text-muted">' + (i+1) + '</td><td style="font-weight:600">' + r.route +
            '</td><td><span class="badge" style="background:rgba(79,70,229,.15);color:var(--indigo-lt);border:1px solid rgba(79,70,229,.2)">💺 ' + r.seats_reserved +
            '</span></td><td>' + statusBadge(r.car_status) + '</td><td class="text-muted">' + r.vehicle_type +
            '</td><td class="text-muted">' + formatDate(r.created_at) + '</td></tr>';
    }).join('');
}