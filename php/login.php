<?php
require_once dirname(__FILE__) . '/config.php';
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonOut(array('error' => 'POST required'));
}

$data     = getPostData();
$email    = isset($data['email'])    ? trim($data['email'])    : '';
$password = isset($data['password']) ? $data['password']       : '';

if ($email === '' || $password === '') {
    jsonOut(array('error' => 'Email and password are required'));
}

$db   = getDB();
$stmt = $db->prepare('SELECT * FROM users WHERE email = ?');
$stmt->execute(array($email));
$user = $stmt->fetch();

if (!$user) {
    jsonOut(array('error' => 'Invalid email or password'));
}

if (!password_verify($password, $user['password'])) {
    jsonOut(array('error' => 'Invalid email or password'));
}

$_SESSION['user_id'] = $user['id'];
$_SESSION['name']    = $user['name'];
$_SESSION['email']   = $user['email'];
$_SESSION['role']    = $user['role'];

jsonOut(array(
    'success' => true,
    'user' => array(
        'id'   => (int)$user['id'],
        'name' => $user['name'],
        'role' => $user['role']
    )
));
?>
