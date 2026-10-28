<?php
require_once dirname(__FILE__) . '/../php/config.php';
header('Content-Type: application/json');

if (!isLoggedIn()) jsonOut(array('error' => 'Not authenticated'));
$role = $_SESSION['role'];
if ($role !== 'admin' && $role !== 'driver') jsonOut(array('error' => 'Unauthorized'));

$db     = getDB();
$data   = getPostData();
$action = isset($data['action']) ? $data['action'] : (isset($_GET['action']) ? $_GET['action'] : '');

switch ($action) {

    case 'get_users':
        if ($role !== 'admin') jsonOut(array('error' => 'Admin only'));
        $rows = $db->query('SELECT id, name, email, role, created_at FROM users ORDER BY id ASC')->fetchAll();
        jsonOut(array('users' => $rows));
        break;

    case 'get_reservations':
        if ($role !== 'admin') jsonOut(array('error' => 'Admin only'));
        $rows = $db->query('
            SELECT r.id, r.seats_reserved, r.status, r.created_at,
                   u.name AS user_name, u.email, c.route
            FROM reservations r
            JOIN users u ON r.user_id = u.id
            JOIN cars c ON r.car_id = c.id
            ORDER BY r.created_at DESC
        ')->fetchAll();
        jsonOut(array('reservations' => $rows));
        break;

    case 'add_car':
        if ($role !== 'admin') jsonOut(array('error' => 'Admin only'));
        $from  = isset($data['departure_city'])   ? trim($data['departure_city'])   : '';
        $to    = isset($data['destination_city'])  ? trim($data['destination_city']) : '';
        $lat   = isset($data['lat'])      ? (float)$data['lat']      : null;
        $lng   = isset($data['lng'])      ? (float)$data['lng']      : null;
        $dlat  = isset($data['dest_lat']) ? (float)$data['dest_lat'] : null;
        $dlng  = isset($data['dest_lng']) ? (float)$data['dest_lng'] : null;
        if (!$from || !$to || $lat === null || $lng === null) jsonOut(array('error' => 'Missing fields'));

        $seats = isset($data['total_seats']) ? (int)$data['total_seats'] : 8;
        $speed = isset($data['speed'])       ? (int)$data['speed']       : 90;
        $vtype = isset($data['vehicle_type'])? $data['vehicle_type']     : 'Peugeot 504';
        $plate = isset($data['plate_number'])? $data['plate_number']     : null;
        $drvId = isset($data['driver_id']) && $data['driver_id'] ? (int)$data['driver_id'] : null;
        $depTime = isset($data['estimated_departure']) && $data['estimated_departure'] ? $data['estimated_departure'] : null;
        $wps   = isset($data['waypoints'])   ? $data['waypoints']        : null;

        // Queue position = max on this route + 1
        $qS = $db->prepare("SELECT MAX(queue_position) AS mq FROM cars WHERE departure_city=? AND destination_city=? AND status != 'moving'");
        $qS->execute(array($from, $to));
        $qR = $qS->fetch();
        $qPos = $qR && isset($qR['mq']) && $qR['mq'] ? (int)$qR['mq'] + 1 : 1;

        $route = $from . ' -> ' . $to;
        
        // Ensure dest_lat/dest_lng are set (fallback to departure coords if not provided)
        $finalDLat = isset($data['dest_lat']) ? (float)$data['dest_lat'] : $lat;
        $finalDLng = isset($data['dest_lng']) ? (float)$data['dest_lng'] : $lng;
        
        $db->prepare('
            INSERT INTO cars (route, departure_city, destination_city, total_seats, available_seats,
                              lat, lng, dest_lat, dest_lng, waypoints, speed, queue_position,
                              driver_id, vehicle_type, plate_number, estimated_departure)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ')->execute(array(
            $route, $from, $to, $seats, $seats,
            $lat, $lng, $finalDLat, $finalDLng,
            $wps, $speed, $qPos, $drvId, $vtype, $plate, $depTime
        ));
        jsonOut(array('success' => true, 'id' => (int)$db->lastInsertId(), 'queue_position' => $qPos));
        break;

    case 'delete_car':
        if ($role !== 'admin') jsonOut(array('error' => 'Admin only'));
        $id = isset($data['id']) ? (int)$data['id'] : 0;
        if (!$id) jsonOut(array('error' => 'Invalid ID'));
        // Get the car to fix queue
        $s = $db->prepare('SELECT * FROM cars WHERE id=?'); $s->execute(array($id)); $c = $s->fetch();
        $db->prepare('DELETE FROM reservations WHERE car_id=?')->execute(array($id));
        $db->prepare('DELETE FROM cars WHERE id=?')->execute(array($id));
        if ($c) {
            $db->prepare("UPDATE cars SET queue_position=queue_position-1 WHERE departure_city=? AND destination_city=? AND queue_position > ? AND status != 'moving'")
               ->execute(array($c['departure_city'], $c['destination_city'], $c['queue_position']));
        }
        jsonOut(array('success' => true));
        break;

    case 'force_depart':
        // Driver forces departure regardless of seat count
        $id = isset($data['id']) ? (int)$data['id'] : 0;
        if (!$id) jsonOut(array('error' => 'Invalid ID'));
        $s = $db->prepare('SELECT * FROM cars WHERE id=?'); $s->execute(array($id)); $c = $s->fetch();
        if (!$c) jsonOut(array('error' => 'Car not found'));
        if ($role !== 'admin' && (int)$c['driver_id'] !== (int)$_SESSION['user_id']) jsonOut(array('error' => 'Not your car'));
        $db->prepare("UPDATE cars SET status='moving', full_since=NOW() WHERE id=?")->execute(array($id));
        // Promote queue
        $db->prepare("UPDATE cars SET queue_position=queue_position-1 WHERE departure_city=? AND destination_city=? AND queue_position > 1 AND status='waiting'")
           ->execute(array($c['departure_city'], $c['destination_city']));
        jsonOut(array('success' => true, 'message' => 'Trip started!'));
        break;

    case 'update_location':
        $id  = isset($data['id'])  ? (int)$data['id']    : 0;
        $lat = isset($data['lat']) ? (float)$data['lat'] : 0;
        $lng = isset($data['lng']) ? (float)$data['lng'] : 0;
        if (!$id) jsonOut(array('error' => 'Invalid ID'));
        if ($role === 'admin') {
            $db->prepare('UPDATE cars SET lat=?,lng=? WHERE id=?')->execute(array($lat,$lng,$id));
        } else {
            $db->prepare('UPDATE cars SET lat=?,lng=? WHERE id=? AND driver_id=?')->execute(array($lat,$lng,$id,(int)$_SESSION['user_id']));
        }
        jsonOut(array('success' => true));
        break;

    case 'update_status':
        $id     = isset($data['id'])     ? (int)$data['id'] : 0;
        $status = isset($data['status']) ? $data['status']  : '';
        $ok     = array('waiting','full','moving');
        if (!$id || !in_array($status, $ok)) jsonOut(array('error' => 'Invalid data'));
        
        if ($status === 'full') {
            $extra = ', full_since=NOW()';
        } elseif ($status === 'moving') {
            $extra = ', full_since=NOW()';
        } else {
            $extra = ', full_since=NULL';
        }
        
        if ($role === 'admin') {
            $db->prepare("UPDATE cars SET status=? $extra WHERE id=?")->execute(array($status,$id));
        } else {
            $db->prepare("UPDATE cars SET status=? $extra WHERE id=? AND driver_id=?")->execute(array($status,$id,(int)$_SESSION['user_id']));
        }
        jsonOut(array('success' => true));
        break;

    case 'update_seats':
        $id    = isset($data['id'])              ? (int)$data['id']              : 0;
        $seats = isset($data['available_seats']) ? (int)$data['available_seats'] : -1;
        if (!$id || $seats < 0) jsonOut(array('error' => 'Invalid data'));
        if ($role === 'admin') {
            $db->prepare('UPDATE cars SET available_seats=? WHERE id=?')->execute(array($seats,$id));
        } else {
            $db->prepare('UPDATE cars SET available_seats=? WHERE id=? AND driver_id=?')->execute(array($seats,$id,(int)$_SESSION['user_id']));
        }
        jsonOut(array('success' => true));
        break;

    case 'get_my_car':
        $s = $db->prepare('SELECT * FROM cars WHERE driver_id=? LIMIT 1');
        $s->execute(array((int)$_SESSION['user_id']));
        $car = $s->fetch();
        jsonOut(array('car' => $car ? $car : null));
        break;

    case 'get_drivers':
        $drivers = $db->query("SELECT id, name, email FROM users WHERE role='driver' ORDER BY name")->fetchAll();
        jsonOut(array('drivers' => $drivers));
        break;

    default:
        jsonOut(array('error' => 'Unknown action: ' . $action));
}
?>