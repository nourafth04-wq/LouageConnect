<?php
/**
 * get_cars.php v4 — OSRM-aware simulation
 * Moving cars advance along stored road_path (JSON array of lat/lng points).
 * If no road_path yet, falls back to straight-line until JS fetches real path.
 * The map.js OSRM integration handles visual road-following on the client side.
 */
require_once dirname(__FILE__) . '/../php/config.php';
header('Content-Type: application/json');

$db = getDB();

// ---- Auto-depart cars full for 5+ minutes ----
$db->exec("UPDATE cars SET status='moving' WHERE status='full' AND full_since IS NOT NULL AND full_since <= DATE_SUB(NOW(), INTERVAL 5 MINUTE)");

// ---- Advance moving cars ----
$stmt = $db->query("SELECT * FROM cars WHERE status='moving'");
$moving = $stmt->fetchAll();

foreach ($moving as $car) {
    $lat  = (float)$car['lat'];
    $lng  = (float)$car['lng'];
    $dlat = (float)$car['dest_lat'] - $lat;
    $dlng = (float)$car['dest_lng'] - $lng;
    $dist = sqrt($dlat * $dlat + $dlng * $dlng);

    // Check waypoints for road-following
    $nextLat     = (float)$car['dest_lat'];
    $nextLng     = (float)$car['dest_lng'];
    $isFinalDest = true;

    if (!empty($car['waypoints'])) {
        $wps = array();
        foreach (explode('|', $car['waypoints']) as $wp) {
            $parts = explode(':', $wp);
            if (count($parts) === 2) {
                $wps[] = array('lat' => (float)$parts[0], 'lng' => (float)$parts[1]);
            }
        }
        // Find next waypoint that's still ahead of us (closer to dest than to us)
        $destDist = sqrt($dlat * $dlat + $dlng * $dlng);
        foreach ($wps as $wp) {
            $wdlat = $wp['lat'] - $lat;
            $wdlng = $wp['lng'] - $lng;
            $wdist = sqrt($wdlat * $wdlat + $wdlng * $wdlng);
            if ($wdist > 0.015 && $wdist < $destDist) {
                $nextLat     = $wp['lat'];
                $nextLng     = $wp['lng'];
                $isFinalDest = false;
                break;
            }
        }
    }

    $tdlat = $nextLat - $lat;
    $tdlng = $nextLng - $lng;
    $tdist = sqrt($tdlat * $tdlat + $tdlng * $tdlng);

    if ($tdist < 0.010 && $isFinalDest) {
        // --- ARRIVED ---
        $depLat = (float)$car['dest_lat'];
        $depLng = (float)$car['dest_lng'];

        // Max queue position on reverse route
        $qS = $db->prepare("SELECT MAX(queue_position) AS mq FROM cars WHERE departure_city=? AND destination_city=? AND status!='moving'");
        $qS->execute(array($car['destination_city'], $car['departure_city']));
        $qR       = $qS->fetch();
        $newQueue = ($qR && isset($qR['mq']) && $qR['mq']) ? (int)$qR['mq'] + 1 : 1;

        $newRoute = $car['destination_city'] . ' -> ' . $car['departure_city'];
        $revWp    = reverseWaypoints($car['waypoints']);

        $db->prepare("UPDATE cars SET status='waiting', lat=?, lng=?, available_seats=total_seats, full_since=NULL, queue_position=?, route=?, departure_city=?, destination_city=?, dest_lat=?, dest_lng=?, waypoints=? WHERE id=?")
           ->execute(array($depLat, $depLng, $newQueue, $newRoute, $car['destination_city'], $car['departure_city'], $car['lat'], $car['lng'], $revWp, $car['id']));

        // Promote queue on old route
        $db->prepare("UPDATE cars SET queue_position=queue_position-1 WHERE departure_city=? AND destination_city=? AND status='waiting' AND queue_position>1")
           ->execute(array($car['departure_city'], $car['destination_city']));

    } elseif ($tdist > 0.005) {
        // Move toward next waypoint/destination
        // Speed: step size in degrees. ~0.003 degrees per tick at 4s interval ≈ 0.33 km/tick = ~300m
        // At 100 km/h: 100/3600 * 4 = 0.111 km per 4s tick = ~0.001 degrees
        // We scale by car speed: base step at 100km/h = 0.001 deg
        $speedFactor = max(0.5, (float)$car['speed'] / 100.0);
        $step        = 0.0011 * $speedFactor;
        $newLat      = $lat + ($tdlat / $tdist) * $step;
        $newLng      = $lng + ($tdlng / $tdist) * $step;
        $db->prepare("UPDATE cars SET lat=?, lng=? WHERE id=?")->execute(array($newLat, $newLng, $car['id']));
    }
}

// ---- Fetch all cars ----
$rows = $db->query("
    SELECT c.*,
           u.name AS driver_name,
           ROUND(111.0 * SQRT(POW(c.dest_lat-c.lat,2) + POW((c.dest_lng-c.lng)*COS(RADIANS(c.lat)),2)) / GREATEST(c.speed/60.0,0.1), 0) AS eta_minutes,
           TIMESTAMPDIFF(SECOND, c.full_since, NOW()) AS seconds_full
    FROM cars c
    LEFT JOIN users u ON c.driver_id = u.id
    ORDER BY c.departure_city ASC, c.queue_position ASC
")->fetchAll();

$out = array();
foreach ($rows as $r) {
    $secsFull = 0;
    if ($r['status'] === 'full' && isset($r['seconds_full']) && $r['seconds_full'] !== null) {
        $secsFull = (int)$r['seconds_full'];
    }
    $secsLeft = $secsFull > 0 ? max(0, 300 - $secsFull) : 0;
    $out[] = array(
        'id'               => (int)$r['id'],
        'route'            => $r['route'],
        'departure_city'   => $r['departure_city'],
        'destination_city' => $r['destination_city'],
        'total_seats'      => (int)$r['total_seats'],
        'available_seats'  => (int)$r['available_seats'],
        'lat'              => (float)$r['lat'],
        'lng'              => (float)$r['lng'],
        'dest_lat'         => (float)$r['dest_lat'],
        'dest_lng'         => (float)$r['dest_lng'],
        'speed'            => (int)$r['speed'],
        'status'           => $r['status'],
        'queue_position'   => (int)$r['queue_position'],
        'seconds_until_depart' => $secsLeft,
        'driver_name'      => isset($r['driver_name']) && $r['driver_name'] ? $r['driver_name'] : 'Unknown',
        'vehicle_type'     => $r['vehicle_type'],
        'plate_number'     => isset($r['plate_number']) && $r['plate_number'] ? $r['plate_number'] : '',
        'eta_minutes'      => (int)$r['eta_minutes'],
        'estimated_departure' => $r['estimated_departure'],
        'full_since'       => $r['full_since'],
    );
}

echo json_encode(array('cars' => $out, 'count' => count($out), 'ts' => time()));

function reverseWaypoints($wps) {
    if (!$wps) return null;
    return implode('|', array_reverse(explode('|', $wps)));
}
?>
