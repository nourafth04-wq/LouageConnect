<?php
/**
 * reset_cars.php — Emergency reset
 * Stops all moving cars and parks them back at their departure stations.
 * Visit: http://localhost:8888/louageconnect/reset_cars.php
 * Delete after use!
 */
error_reporting(E_ALL);
ini_set('display_errors', 1);
if (!isset($_SESSION)) session_start();
?>
<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Reset Cars</title>
<style>body{font-family:Arial,sans-serif;background:#0B1225;color:#94A3B8;padding:30px;max-width:700px}
h1{color:#F1F5F9}.ok{color:#22C55E}.fail{color:#EF4444}
.btn{padding:12px 24px;background:#4F46E5;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:1rem;margin:8px 4px}
.btn-red{background:#EF4444}.card{background:#111827;border:1px solid #1E293B;border-radius:10px;padding:20px;margin:16px 0}
table{width:100%;border-collapse:collapse}td,th{padding:8px;border-bottom:1px solid #1E293B;font-size:.85rem}
th{color:#475569;font-size:.72rem;text-transform:uppercase}</style>
</head><body>
<h1>🔧 LouageConnect — Car Reset Tool</h1>
<?php
require_once 'php/config.php';
$db = getDB();

// Station coordinates — exact match with database.sql
$stations = array(
    'Tunis_south'  => array('lat' => 36.791667, 'lng' => 10.186810),
    'Tunis_north'  => array('lat' => 36.810368, 'lng' => 10.154295),
    'Sfax'         => array('lat' => 34.74056,  'lng' => 10.76028),
    'Sousse'       => array('lat' => 35.810225, 'lng' => 10.636630),
    'Bizerte'      => array('lat' => 37.269258, 'lng' =>  9.872214),
    'Nabeul'       => array('lat' => 36.451436, 'lng' => 10.729911),
    'Kairouan'     => array('lat' => 35.67810,  'lng' => 10.09633),
    'Monastir'     => array('lat' => 35.77799,  'lng' => 10.82617),
    'Gabes'        => array('lat' => 33.88146,  'lng' => 10.09820),
    'Medenine'     => array('lat' => 33.360770, 'lng' => 10.468749),
    'El Kef'       => array('lat' => 36.175500, 'lng' =>  8.707334),
);

function getStation($city, $destCity, $stations) {
    if ($city === 'Tunis') {
        // Bab Saadoun for Bizerte and El Kef routes
        if (in_array($destCity, array('Bizerte', 'El Kef'))) {
            return $stations['Tunis_north'];
        }
        return $stations['Tunis_south'];
    }
    return isset($stations[$city]) ? $stations[$city] : null;
}

if (isset($_POST['reset_all'])) {
    $all = $db->query("SELECT * FROM cars")->fetchAll();
    $fixed = 0;
    foreach ($all as $car) {
        $st = getStation($car['departure_city'], $car['destination_city'], $stations);
        if (!$st) continue;
        $db->prepare("UPDATE cars SET status='waiting', lat=?, lng=?, available_seats=total_seats, full_since=NULL WHERE id=?")
           ->execute(array($st['lat'], $st['lng'], $car['id']));
        $fixed++;
    }
    echo '<div class="card"><p class="ok">✅ Reset ' . $fixed . ' car(s) back to their stations.</p></div>';
}

if (isset($_POST['reset_moving'])) {
    $moving = $db->query("SELECT * FROM cars WHERE status='moving'")->fetchAll();
    $fixed = 0;
    foreach ($moving as $car) {
        $st = getStation($car['departure_city'], $car['destination_city'], $stations);
        if (!$st) { echo '<p class="fail">No station found for: ' . $car['departure_city'] . '</p>'; continue; }
        $db->prepare("UPDATE cars SET status='waiting', lat=?, lng=?, available_seats=total_seats, full_since=NULL WHERE id=?")
           ->execute(array($st['lat'], $st['lng'], $car['id']));
        $fixed++;
    }
    echo '<div class="card"><p class="ok">✅ Reset ' . $fixed . ' moving car(s) to their departure stations.</p></div>';
}

// Show current state
$cars = $db->query("SELECT id, route, status, ROUND(lat,4) as lat, ROUND(lng,4) as lng, available_seats, queue_position FROM cars ORDER BY departure_city, queue_position")->fetchAll();
echo '<div class="card"><h2 style="color:#F1F5F9;margin-bottom:12px">Current Car Positions</h2>';
echo '<table><tr><th>ID</th><th>Route</th><th>Status</th><th>Lat</th><th>Lng</th><th>Seats</th><th>Queue</th></tr>';
foreach ($cars as $car) {
    $statusColor = $car['status']==='moving' ? '#22C55E' : ($car['status']==='full' ? '#EF4444' : '#F59E0B');
    echo '<tr><td>' . $car['id'] . '</td><td>' . $car['route'] . '</td>';
    echo '<td style="color:' . $statusColor . ';font-weight:700">' . strtoupper($car['status']) . '</td>';
    echo '<td>' . $car['lat'] . '</td><td>' . $car['lng'] . '</td>';
    echo '<td>' . $car['available_seats'] . '/8</td><td>#' . $car['queue_position'] . '</td></tr>';
}
echo '</table></div>';
?>

<div class="card">
    <h2 style="color:#F1F5F9;margin-bottom:12px">Reset Actions</h2>
    <form method="POST" style="display:inline">
        <button type="submit" name="reset_moving" value="1" class="btn">🔄 Reset Moving Cars Only</button>
    </form>
    <form method="POST" style="display:inline">
        <button type="submit" name="reset_all" value="1" class="btn btn-red">⚠️ Reset ALL Cars to Stations</button>
    </form>
    <p style="margin-top:12px;font-size:.82rem;color:#64748B">
        "Reset Moving" fixes cars in the water. "Reset ALL" resets everything including seats and queue.
    </p>
</div>

<a href="map.html" style="color:#6366F1">← Back to Map</a> &nbsp;
<a href="dashboard.html" style="color:#6366F1">Dashboard</a>
</body></html>
