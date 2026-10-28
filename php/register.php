<?php
require_once dirname(__FILE__) . '/config.php';
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonOut(array('error' => 'POST required'));
}

$data     = getPostData();
$name     = isset($data['name'])     ? trim($data['name'])     : '';
$email    = isset($data['email'])    ? trim($data['email'])    : '';
$password = isset($data['password']) ? $data['password']       : '';
$role     = isset($data['role'])     ? $data['role']           : 'user';

if ($name === '')     jsonOut(array('error' => 'Name is required'));
if ($email === '')    jsonOut(array('error' => 'Email is required'));
if ($password === '') jsonOut(array('error' => 'Password is required'));

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    jsonOut(array('error' => 'Invalid email address'));
}
if (strlen($password) < 6) {
    jsonOut(array('error' => 'Password must be at least 6 characters'));
}
if ($role !== 'driver') $role = 'user';

$db   = getDB();
$chk  = $db->prepare('SELECT id FROM users WHERE email = ?');
$chk->execute(array($email));
if ($chk->fetch()) {
    jsonOut(array('error' => 'Email already registered'));
}

$hash = password_hash($password, PASSWORD_DEFAULT);
$ins  = $db->prepare('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)');
$ins->execute(array($name, $email, $hash, $role));
$uid  = (int)$db->lastInsertId();

$_SESSION['user_id'] = $uid;
$_SESSION['name']    = $name;
$_SESSION['email']   = $email;
$_SESSION['role']    = $role;

jsonOut(array(
    'success' => true,
    'message' => 'Account created!',
    'user' => array('id' => $uid, 'name' => $name, 'role' => $role)
));
?>
