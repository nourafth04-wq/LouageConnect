<?php
/**
 * LouageConnect - config.php
 * 100% PHP 5.3 compatible. No session_status(), no http_response_code().
 */

error_reporting(0);
ini_set('display_errors', 0);

// ---- Database ----
define('DB_HOST', 'localhost');
define('DB_USER', 'root');
define('DB_PASS', '');
define('DB_NAME', 'louageconnect');

// ---- CORS headers (same-origin EasyPHP) ----
if (isset($_SERVER['HTTP_ORIGIN'])) {
    header('Access-Control-Allow-Origin: ' . $_SERVER['HTTP_ORIGIN']);
} else {
    header('Access-Control-Allow-Origin: *');
}
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if (isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit();
}

// ---- Session: PHP 5.3 safe (no session_status()) ----
if (!isset($_SESSION)) {
    session_start();
}

// ---- password_hash / password_verify polyfill for PHP < 5.5 ----
if (!function_exists('password_hash')) {
    define('PASSWORD_DEFAULT', 1);
    define('PASSWORD_BCRYPT',  1);

    function password_hash($password, $algo, $options = array()) {
        $cost = isset($options['cost']) ? (int)$options['cost'] : 10;
        if ($cost < 4)  $cost = 4;
        if ($cost > 31) $cost = 31;
        $salt = '$2y$' . str_pad($cost, 2, '0', STR_PAD_LEFT) . '$';
        // Generate 22 chars of random salt
        $chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789./';
        $randSalt = '';
        for ($i = 0; $i < 22; $i++) {
            $randSalt .= $chars[mt_rand(0, 63)];
        }
        $salt .= $randSalt;
        $hash = crypt($password, $salt);
        if (!is_string($hash) || strlen($hash) < 13) {
            return false;
        }
        return $hash;
    }

    function password_verify($password, $hash) {
        if (!$hash || strlen($hash) < 13) return false;
        $check = crypt($password, $hash);
        if (strlen($check) !== strlen($hash)) return false;
        $diff = 0;
        for ($i = 0; $i < strlen($check); $i++) {
            $diff |= ord($check[$i]) ^ ord($hash[$i]);
        }
        return $diff === 0;
    }

    function password_needs_rehash($hash, $algo, $options = array()) {
        return false;
    }
}

// ---- PDO helper ----
function getDB() {
    static $pdo = null;
    if ($pdo === null) {
        try {
            $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8';
            $opts = array(
                PDO::ATTR_ERRMODE  => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            );
            $pdo = new PDO($dsn, DB_USER, DB_PASS, $opts);
        } catch (PDOException $e) {
            header('Content-Type: application/json');
            echo json_encode(array('error' => 'DB failed: ' . $e->getMessage()));
            exit();
        }
    }
    return $pdo;
}

// ---- Helpers ----
function isLoggedIn() {
    return isset($_SESSION['user_id']) && !empty($_SESSION['user_id']);
}

function getPostData() {
    $raw = file_get_contents('php://input');
    if ($raw && strlen($raw) > 0) {
        $decoded = json_decode($raw, true);
        if (is_array($decoded)) return $decoded;
    }
    return is_array($_POST) ? $_POST : array();
}

function jsonOut($data) {
    header('Content-Type: application/json');
    echo json_encode($data);
    exit();
}
?>
