/* ================================================================
   LouageConnect — Map v4
   Real road routing via OSRM public API
   Cars follow actual road geometry, not straight lines
   ================================================================ */

var map, markers = {}, polylines = {}, routeGeometry = {}, carData = [];
var updateInterval = null, sidebarOpen = true;
var OSRM = 'https://router.project-osrm.org/route/v1/driving/';

function initMap() {
    map = L.map('map', {
        center: [34.5, 9.2],
        zoom: 7,
        minZoom: 6,
        maxZoom: 16,
        zoomControl: true
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap', maxZoom: 18
    }).addTo(map);

    // Fit to Tunisia after data loads
    loadAndUpdate();
    updateInterval = setInterval(loadAndUpdate, 4000);
    setTimeout(function() {
        map.fitBounds([[30.0, 7.5], [37.8, 11.8]], { padding: [20, 20] });
    }, 1500);
}

// ----------------------------------------------------------------
// OSRM: fetch real road polyline between two points
// Returns array of [lat,lng] points following actual roads
// ----------------------------------------------------------------
var routeCache = {}; // cache by "fromLat,fromLng->toLat,toLng"

async function getOSRMRoute(fromLat, fromLng, toLat, toLng) {
    var key = fromLat.toFixed(4) + ',' + fromLng.toFixed(4) + '->' + toLat.toFixed(4) + ',' + toLng.toFixed(4);
    if (routeCache[key]) return routeCache[key];

    try {
        // OSRM expects lng,lat order
        var url = OSRM + fromLng + ',' + fromLat + ';' + toLng + ',' + toLat
            + '?overview=full&geometries=geojson';
        var res  = await fetch(url);
        var data = await res.json();
        if (data.code !== 'Ok' || !data.routes || !data.routes[0]) return null;

        // GeoJSON coords are [lng, lat] — flip to [lat, lng] for Leaflet
        var coords = data.routes[0].geometry.coordinates.map(function(c) {
            return [c[1], c[0]];
        });
        routeCache[key] = coords;
        return coords;
    } catch(e) {
        console.warn('OSRM route failed:', e);
        return null;
    }
}

// ----------------------------------------------------------------
// For each car we store its full road path and current position index
// ----------------------------------------------------------------
var carPaths = {};    // carId -> full [lat,lng] array from OSRM
var carPathIdx = {};  // carId -> current index along path

async function buildCarPath(car) {
    var id  = car.id;
    var key = car.departure_city + '->' + car.destination_city;

    // Already have path for this route
    if (routeCache[key]) {
        carPaths[id]   = routeCache[key];
        carPathIdx[id] = carPathIdx[id] || 0;
        return;
    }

    var coords = await getOSRMRoute(
        parseFloat(car.lat), parseFloat(car.lng),
        parseFloat(car.dest_lat), parseFloat(car.dest_lng)
    );
    if (coords && coords.length > 1) {
        routeCache[key] = coords;
        carPaths[id]    = coords;
        carPathIdx[id]  = 0;
    }
}

// ----------------------------------------------------------------
// Main update loop
// ----------------------------------------------------------------
async function loadAndUpdate() {
    var data = await API.getCars();
    if (!data || !data.cars) return;
    carData = data.cars;
    renderSidebar(carData);
    updateLiveCount(carData);

    for (var i = 0; i < carData.length; i++) {
        var car = carData[i];
        await processCar(car);
    }

    // Remove stale markers
    Object.keys(markers).forEach(function(id) {
        if (!carData.find(function(c) { return c.id == id; })) {
            map.removeLayer(markers[id]);
            if (polylines[id]) map.removeLayer(polylines[id]);
            delete markers[id];
            delete polylines[id];
            delete carPaths[id];
            delete carPathIdx[id];
        }
    });
}

async function processCar(car) {
    var id = car.id;

    if (car.status === 'moving') {
        // Build/fetch OSRM road path if we don't have it yet
        if (!carPaths[id]) {
            await buildCarPath(car);
        }
        // Draw dotted route line on map
        drawRouteLine(car);
        // Animate marker along road path
        animateAlongPath(car);
    } else {
        // Waiting or full — show at station, clear path
        delete carPaths[id];
        delete carPathIdx[id];
        if (polylines[id]) {
            map.removeLayer(polylines[id]);
            delete polylines[id];
        }
    }

    // Create or update marker
    if (markers[id]) {
        markers[id].setIcon(buildIcon(car));
        if (markers[id].isPopupOpen()) {
            markers[id].getPopup().setContent(buildPopup(car));
        }
        // For non-moving cars, snap to DB coords
        if (car.status !== 'moving') {
            markers[id].setLatLng([car.lat, car.lng]);
        }
    } else {
        markers[id] = createMarker(car);
    }
}

// ----------------------------------------------------------------
// Animate car along OSRM road path
// ----------------------------------------------------------------
function animateAlongPath(car) {
    var id    = car.id;
    var path  = carPaths[id];
    if (!path || path.length < 2) {
        // Fallback: use DB position
        if (markers[id]) markers[id].setLatLng([car.lat, car.lng]);
        return;
    }

    // Find closest point on path to car's current DB lat/lng
    var dbLat = parseFloat(car.lat);
    var dbLng = parseFloat(car.lng);
    var closestIdx = 0, minDist = Infinity;
    for (var i = 0; i < path.length; i++) {
        var dl = path[i][0] - dbLat, dg = path[i][1] - dbLng;
        var d  = dl * dl + dg * dg;
        if (d < minDist) { minDist = d; closestIdx = i; }
    }
    carPathIdx[id] = closestIdx;

    // Smoothly move to next point on path
    var nextIdx = Math.min(closestIdx + 1, path.length - 1);
    if (markers[id]) {
        smoothMoveTo(markers[id], path[nextIdx][0], path[nextIdx][1]);
    }
}

function smoothMoveTo(marker, tlat, tlng) {
    var s = marker.getLatLng();
    var dl = tlat - s.lat, dg = tlng - s.lng;
    if (Math.sqrt(dl * dl + dg * dg) < 0.00005) return;
    var steps = 20, step = 0;
    var iv = setInterval(function() {
        step++;
        var t = step / steps;
        marker.setLatLng([s.lat + dl * t, s.lng + dg * t]);
        if (step >= steps) clearInterval(iv);
    }, 180);
}

// ----------------------------------------------------------------
// Draw faint dotted route line
// ----------------------------------------------------------------
function drawRouteLine(car) {
    var id   = car.id;
    var path = carPaths[id];
    if (!path || path.length < 2) return;

    if (polylines[id]) map.removeLayer(polylines[id]);
    polylines[id] = L.polyline(path, {
        color: '#4F46E5',
        weight: 2,
        opacity: 0.35,
        dashArray: '6, 8'
    }).addTo(map);
}

// ----------------------------------------------------------------
// Marker builder
// ----------------------------------------------------------------
function createMarker(car) {
    var m = L.marker([car.lat, car.lng], { icon: buildIcon(car) }).addTo(map);
    m.bindPopup(buildPopup(car), { maxWidth: 270, closeButton: true });
    m.on('click', function() { map.flyTo([car.lat, car.lng], 12, { animate: true, duration: 0.8 }); });
    return m;
}

function buildVanSVG(stripeColor, glowColor, animated) {
    // SVG louage van inspired by the white VW Transporter with red stripe (Tunisian louage style)
    // stripeColor: the status-based stripe/accent color
    // glowColor: subtle glow ring color
    var animAttr = animated ? ' class="van-drive"' : '';
    return [
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 38" width="64" height="38"' + animAttr + '>',
        '  <defs>',
        '    <filter id="vshadow" x="-20%" y="-20%" width="140%" height="160%">',
        '      <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="rgba(0,0,0,0.55)"/>',
        '    </filter>',
        '    <linearGradient id="bodyGrad" x1="0" y1="0" x2="0" y2="1">',
        '      <stop offset="0%" stop-color="#f5f5f5"/>',
        '      <stop offset="100%" stop-color="#d8d8d8"/>',
        '    </linearGradient>',
        '    <linearGradient id="roofGrad" x1="0" y1="0" x2="0" y2="1">',
        '      <stop offset="0%" stop-color="#e8e8e8"/>',
        '      <stop offset="100%" stop-color="#c8c8c8"/>',
        '    </linearGradient>',
        '  </defs>',
        // Shadow on ground
        '  <ellipse cx="32" cy="36.5" rx="26" ry="2.5" fill="rgba(0,0,0,0.25)" filter="url(#vshadow)"/>',
        // Main body
        '  <rect x="4" y="12" width="56" height="20" rx="3" ry="3" fill="url(#bodyGrad)" stroke="#bbb" stroke-width="0.5"/>',
        // Roof (slightly narrower, rounded)
        '  <rect x="12" y="5" width="40" height="10" rx="4" ry="4" fill="url(#roofGrad)" stroke="#bbb" stroke-width="0.5"/>',
        // Status stripe (horizontal band across mid-body — the iconic louage stripe)
        '  <rect x="4" y="19" width="56" height="6" rx="1" fill="' + stripeColor + '" opacity="0.92"/>',
        // Windshield (front, left side)
        '  <rect x="13" y="7" width="13" height="8" rx="2" fill="#7ec8e3" opacity="0.85" stroke="#aaa" stroke-width="0.4"/>',
        // Rear window
        '  <rect x="44" y="7" width="7" height="7" rx="1.5" fill="#7ec8e3" opacity="0.7" stroke="#aaa" stroke-width="0.4"/>',
        // Side windows (passenger section)
        '  <rect x="28" y="7" width="7" height="7" rx="1.5" fill="#7ec8e3" opacity="0.7" stroke="#aaa" stroke-width="0.4"/>',
        '  <rect x="37" y="7" width="6" height="7" rx="1.5" fill="#7ec8e3" opacity="0.7" stroke="#aaa" stroke-width="0.4"/>',
        // Front bumper
        '  <rect x="2" y="26" width="6" height="5" rx="1.5" fill="#aaa" stroke="#999" stroke-width="0.4"/>',
        // Rear bumper
        '  <rect x="56" y="26" width="6" height="5" rx="1.5" fill="#aaa" stroke="#999" stroke-width="0.4"/>',
        // Headlights
        '  <rect x="3" y="14" width="4" height="3" rx="1" fill="#fffde0" stroke="#ccc" stroke-width="0.3"/>',
        '  <rect x="3" y="18" width="4" height="2" rx="0.5" fill="' + stripeColor + '" opacity="0.7"/>',
        // Tail lights
        '  <rect x="57" y="14" width="4" height="3" rx="1" fill="#ff6b6b" opacity="0.9"/>',
        '  <rect x="57" y="18" width="4" height="2" rx="0.5" fill="#ff2222" opacity="0.7"/>',
        // VW-style front grille badge (small circle)
        '  <circle cx="7" cy="24" r="2" fill="#ddd" stroke="#aaa" stroke-width="0.5"/>',
        '  <circle cx="7" cy="24" r="1" fill="#bbb"/>',
        // Wheels (4 wheels visible in side view)
        '  <circle cx="16" cy="33" r="5" fill="#333" stroke="#222" stroke-width="0.5"/>',
        '  <circle cx="16" cy="33" r="2.5" fill="#666"/>',
        '  <circle cx="16" cy="33" r="1.2" fill="#aaa"/>',
        '  <circle cx="48" cy="33" r="5" fill="#333" stroke="#222" stroke-width="0.5"/>',
        '  <circle cx="48" cy="33" r="2.5" fill="#666"/>',
        '  <circle cx="48" cy="33" r="1.2" fill="#aaa"/>',
        // Taxi sign on roof
        '  <rect x="22" y="2" width="20" height="5" rx="1.5" fill="#fff" stroke="#ccc" stroke-width="0.5"/>',
        '  <text x="32" y="6.2" text-anchor="middle" font-family="Arial,sans-serif" font-size="3.5" font-weight="800" fill="#111" letter-spacing="0.5">LOUAGE</text>',
        '</svg>'
    ].join('');
}

function buildIcon(car) {
    // Status-based stripe color matching the louage brand style
    var stripeMap = {
        waiting: '#F59E0B',   // amber — waiting at station
        full:    '#EF4444',   // red   — full, about to depart
        moving:  '#22C55E',   // green — en route
        arrived: '#94A3B8'    // grey  — arrived / done
    };
    var glowMap = {
        waiting: '#F59E0B44',
        full:    '#EF444444',
        moving:  '#22C55E44',
        arrived: '#94A3B844'
    };
    var col      = stripeMap[car.status] || stripeMap.waiting;
    var glowCol  = glowMap[car.status]   || glowMap.waiting;
    var animated = car.status === 'moving';

    // Pulse ring for active states
    var pulse = (car.status === 'moving' || car.status === 'full')
        ? '<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:72px;height:40px;border-radius:8px;background:' + glowCol + ';animation:mpulse 1.8s ease-out infinite;pointer-events:none"></div>' : '';

    // Countdown badge for full-about-to-depart
    var badge = '';
    if (car.status === 'full' && car.seconds_until_depart > 0) {
        var m2 = Math.floor(car.seconds_until_depart / 60), s2 = car.seconds_until_depart % 60;
        badge = '<div style="position:absolute;top:-18px;left:50%;transform:translateX(-50%);background:#F59E0B;color:#000;font-size:8px;font-weight:800;padding:2px 6px;border-radius:4px;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,.4)">' + m2 + ':' + (s2 < 10 ? '0' : '') + s2 + '</div>';
    }

    // Status dot indicator
    var dot = '<div style="position:absolute;top:-6px;right:-2px;width:10px;height:10px;border-radius:50%;background:' + col + ';border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.5)"></div>';

    // Seats label below van
    var seatsLabel = '<div style="position:absolute;bottom:-14px;left:50%;transform:translateX(-50%);background:rgba(10,10,20,.88);color:#fff;font-size:8px;font-weight:700;padding:1px 5px;border-radius:3px;white-space:nowrap;letter-spacing:.03em">' +
        car.available_seats + '/' + car.total_seats + ' · #' + car.queue_position + '</div>';

    var vanHtml = buildVanSVG(col, glowCol, animated);

    return L.divIcon({
        className: '',
        html: '<div style="position:relative;display:inline-block">' +
              pulse + badge + dot +
              '<div style="filter:drop-shadow(0 3px 6px rgba(0,0,0,.6));line-height:0">' + vanHtml + '</div>' +
              seatsLabel +
              '</div>',
        iconSize:    [64, 60],
        iconAnchor:  [32, 52],
        popupAnchor: [0,  -56]
    });
}

// ----------------------------------------------------------------
// Popup
// ----------------------------------------------------------------
function buildPopup(car) {
    var canR   = car.status !== 'moving' && car.status !== 'arrived' && car.available_seats > 0 && car.queue_position === 1;
    var qLine  = car.queue_position === 1
        ? '<span style="color:#22C55E;font-weight:700">🟢 Next to depart</span>'
        : '<span style="color:#94A3B8">Queue #' + car.queue_position + '</span>';
    var cdLine = (car.status === 'full' && car.seconds_until_depart > 0)
        ? '<div style="color:#F59E0B;font-weight:700;font-size:.78rem;margin:4px 0">🕐 Departs in ' + car.seconds_until_depart + 's</div>' : '';
    var btnTxt = car.status === 'moving' || car.status === 'arrived' ? '🚕 Already departed'
        : car.available_seats === 0 ? '🔴 Full — departing soon'
        : car.queue_position > 1 ? '⏳ Not first in queue' : '🎟️ Reserve Seat';

    return '<div style="padding:13px 15px;min-width:215px;font-family:\'DM Sans\',sans-serif">' +
        '<div style="font-family:\'Syne\',sans-serif;font-size:.95rem;font-weight:700;color:#F1F5F9;margin-bottom:8px">🗺️ ' + car.departure_city + ' → ' + car.destination_city + '</div>' +
        cdLine +
        pRow('Status', statusBadge(car.status)) +
        pRow('Queue',  qLine) +
        pRow('Seats',  '<strong style="color:' + (car.available_seats > 0 ? '#22C55E' : '#EF4444') + '">' + car.available_seats + ' / ' + car.total_seats + '</strong>') +
        pRow('Vehicle', car.vehicle_type) +
        pRow('Driver',  car.driver_name || '—') +
        pRow('ETA',     formatETA(car.eta_minutes)) +
        '<button onclick="mapReserve(' + car.id + ')" style="width:100%;margin-top:10px;padding:8px;border:none;border-radius:8px;font-size:.82rem;font-weight:600;background:' +
        (canR ? '#4F46E5' : '#374151') + ';color:' + (canR ? '#fff' : '#6B7280') + ';cursor:' + (canR ? 'pointer' : 'not-allowed') + '"' +
        (canR ? '' : ' disabled') + '>' + btnTxt + '</button></div>';
}
function pRow(l, v) {
    return '<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid rgba(255,255,255,.05);font-size:.79rem"><span style="color:#94A3B8">' + l + '</span><span>' + v + '</span></div>';
}

// ----------------------------------------------------------------
// Reserve from map
// ----------------------------------------------------------------
async function mapReserve(carId) {
    var sess = await API.session();
    if (!sess || !sess.loggedIn) {
        showToast('Login required', 'error');
        setTimeout(function() { window.location.href = API.base + '/login.html'; }, 1500);
        return;
    }
    var car = carData.find(function(c) { return c.id === carId; });
    if (!car) return;
    var max   = Math.min(car.available_seats, 8);
    var input = window.prompt('How many seats? (1–' + max + ')');
    if (input === null) return;
    var seats = parseInt(input);
    if (isNaN(seats) || seats < 1 || seats > max) { showToast('Invalid seat count', 'error'); return; }
    var res = await API.reserve(carId, seats);
    if (res && res.success) { showToast(res.message, 'success'); loadAndUpdate(); }
    else showToast((res && res.error) || 'Failed', 'error');
}

// ----------------------------------------------------------------
// Sidebar
// ----------------------------------------------------------------
function renderSidebar(cars) {
    var list = document.getElementById('sidebar-list');
    if (!list) return;
    var routes = {};
    cars.forEach(function(c) {
        var key = c.departure_city + '→' + c.destination_city;
        if (!routes[key]) routes[key] = [];
        routes[key].push(c);
    });
    var html = '';
    Object.keys(routes).forEach(function(k) {
        var group = routes[k].sort(function(a, b) { return a.queue_position - b.queue_position; });
        html += '<div style="margin-bottom:12px"><div style="font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--text-muted);margin-bottom:5px">' +
            group[0].departure_city + ' → ' + group[0].destination_city + ' (' + group.length + ' car' + (group.length > 1 ? 's' : '') + ')</div>';
        group.forEach(function(car) {
            html += '<div class="sidebar-car-item" onclick="focusCar(' + car.id + ')">' +
                '<div style="display:flex;align-items:center;justify-content:space-between">' +
                '<span style="font-size:.82rem;font-weight:600;color:var(--text-primary)">#' + car.queue_position + ' ' + car.vehicle_type + '</span>' +
                statusBadge(car.status) + '</div>' +
                '<div style="display:flex;gap:6px;margin-top:4px">' +
                '<span style="font-size:.72rem;color:var(--text-muted)">💺 ' + car.available_seats + '/' + car.total_seats + '</span>' +
                (car.queue_position === 1 ? '<span style="font-size:.72rem;color:var(--green)">🟢 Next</span>' : '') +
                (car.status === 'full' && car.seconds_until_depart > 0 ? '<span style="font-size:.72rem;color:var(--amber)">⏱ ' + car.seconds_until_depart + 's</span>' : '') +
                '</div></div>';
        });
        html += '</div>';
    });
    list.innerHTML = html || '<p style="color:var(--text-muted);font-size:.82rem;padding:10px">No louages loaded</p>';
}

function focusCar(id) {
    var m = markers[id];
    if (!m) return;
    var ll = m.getLatLng();
    map.flyTo([ll.lat, ll.lng], 12, { animate: true, duration: 1 });
    setTimeout(function() { m.openPopup(); }, 900);
}

function updateLiveCount(cars) {
    var el = document.getElementById('live-count');
    if (el) el.textContent = cars.length + ' louages';
}
function toggleSidebar() {
    var s = document.getElementById('map-sidebar');
    if (!s) return;
    sidebarOpen = !sidebarOpen;
    s.classList.toggle('collapsed', !sidebarOpen);
}

// Inject animation keyframe
(function() {
    var s = document.createElement('style');
    s.textContent = '@keyframes mpulse{0%{transform:translate(-50%,-50%) scale(.4);opacity:.9}100%{transform:translate(-50%,-50%) scale(2.2);opacity:0}}';
    document.head.appendChild(s);
})();

document.addEventListener('DOMContentLoaded', function() { checkSession(); initMap(); });
window.addEventListener('beforeunload', function() { if (updateInterval) clearInterval(updateInterval); });
