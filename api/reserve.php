<?php
/**
 * reserve.php — Seat reservation with queue enforcement
 * Rules:
 *  - Only queue_position=1 car on a route accepts reservations
 *  - Drivers cannot reserve (unless they have no car assigned)
 *  - Cannot exceed available_seats
 *  - When available_seats hits 0: set status='full', full_since=NOW()
 */
require_once dirname(__FILE__) . '/../php/config.php';
header('Content-Type: application/json');

if (!isLoggedIn()) {
    jsonOut(array('error' => 'Login required'));
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonOut(array('error' => 'POST required'));
}

$uid  = (int)$_SESSION['user_id'];
$role = $_SESSION['role'];
$data = getPostData();

$carId = isset($data['car_id']) ? (int)$data['car_id'] : 0;
$seats = isset($data['seats'])  ? (int)$data['seats']  : 1;

if ($carId < 1) jsonOut(array('error' => 'Invalid car'));
if ($seats < 1) jsonOut(array('error' => 'Select at least 1 seat'));
if ($seats > 8) jsonOut(array('error' => 'Max 8 seats'));

// Drivers with an assigned car cannot reserve passenger seats
if ($role === 'driver') {
    $db  = getDB();
    $chk = $db->prepare('SELECT id FROM cars WHERE driver_id = ? LIMIT 1');
    $chk->execute(array($uid));
    if ($chk->fetch()) {
        jsonOut(array('error' => 'Drivers with an assigned vehicle cannot book passenger seats'));
    }
}

$db = getDB();
$db->beginTransaction();

try {
    $stmt = $db->prepare('SELECT * FROM cars WHERE id = ? FOR UPDATE');
    $stmt->execute(array($carId));
    $car = $stmt->fetch();

    if (!$car) {
        $db->rollBack();
        jsonOut(array('error' => 'Louage not found'));
    }
    if ($car['status'] === 'moving' || $car['status'] === 'arrived') {
        $db->rollBack();
        jsonOut(array('error' => 'This louage has already departed'));
    }
    if ((int)$car['queue_position'] > 1) {
        $db->rollBack();
        jsonOut(array('error' => 'This louage is queued — book the first car in line instead'));
    }
    if ((int)$car['available_seats'] < $seats) {
        $db->rollBack();
        jsonOut(array('error' => 'Only ' . $car['available_seats'] . ' seat(s) left'));
    }

    // Create reservation
    $db->prepare('INSERT INTO reservations (user_id, car_id, seats_reserved) VALUES (?,?,?)')
       ->execute(array($uid, $carId, $seats));
    $resId = (int)$db->lastInsertId();

    $newAvail = (int)$car['available_seats'] - $seats;

    if ($newAvail <= 0) {
        // Car is now full → start 5-minute departure countdown
        $db->prepare(
            "UPDATE cars SET available_seats=0, status='full', full_since=NOW() WHERE id=?"
        )->execute(array($carId));
        $newStatus = 'full';
    } else {
        $db->prepare("UPDATE cars SET available_seats=? WHERE id=?")
           ->execute(array($newAvail, $carId));
        $newStatus = 'waiting';
    }

    $db->commit();

    $msg = 'Reserved ' . $seats . ' seat(s) on ' . $car['route'] . '!';
    if ($newStatus === 'full') {
        $msg .= ' Car is now FULL — departing in ~5 minutes.';
    }

    jsonOut(array(
        'success'         => true,
        'message'         => $msg,
        'reservation_id'  => $resId,
        'available_seats' => $newAvail,
        'status'          => $newStatus
    ));

} catch (Exception $e) {
    $db->rollBack();
    jsonOut(array('error' => 'Reservation failed: ' . $e->getMessage()));
}
?>
