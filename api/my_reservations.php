<?php
require_once dirname(__FILE__) . '/../php/config.php';
header('Content-Type: application/json');

if (!isLoggedIn()) {
    jsonOut(array('error' => 'Login required'));
}

$db   = getDB();
$stmt = $db->prepare('
    SELECT r.id, r.seats_reserved, r.status, r.created_at,
           c.route, c.departure_city, c.destination_city,
           c.status AS car_status, c.vehicle_type, c.plate_number, c.estimated_departure
    FROM reservations r
    JOIN cars c ON r.car_id = c.id
    WHERE r.user_id = ?
    ORDER BY r.created_at DESC
');
$stmt->execute(array((int)$_SESSION['user_id']));
$rows = $stmt->fetchAll();

jsonOut(array('reservations' => $rows));
?>
