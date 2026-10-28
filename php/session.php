<?php
require_once dirname(__FILE__) . '/config.php';
header('Content-Type: application/json');

if (isLoggedIn()) {
    echo json_encode(array(
        'loggedIn' => true,
        'user' => array(
            'id'   => (int)$_SESSION['user_id'],
            'name' => $_SESSION['name'],
            'role' => $_SESSION['role']
        )
    ));
} else {
    echo json_encode(array('loggedIn' => false));
}
?>
