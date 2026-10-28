<?php
require_once dirname(__FILE__) . '/config.php';
session_destroy();
header('Location: ../index.html');
exit();
?>
