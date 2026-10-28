<?php
/**
 * LouageConnect - Setup Wizard
 * PHP 5.3+ compatible. No session_status(), no http_response_code().
 * Visit: http://localhost:8888/louageconnect/setup_passwords.php
 * DELETE after setup!
 */
error_reporting(E_ALL);
ini_set('display_errors', '1');

// Start session manually (PHP 5.3 safe)
if (!isset($_SESSION)) {
    session_start();
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>LouageConnect Setup</title>
<style>
  body { font-family: Arial, sans-serif; background: #0B1225; color: #94A3B8; padding: 30px; max-width: 800px; margin: 0 auto; }
  h1   { color: #F1F5F9; font-size: 1.6rem; margin-bottom: 6px; }
  h2   { color: #F1F5F9; font-size: 1.1rem; margin: 20px 0 10px; border-bottom: 1px solid #1E293B; padding-bottom: 8px; }
  .card { background: #111827; border: 1px solid #1E293B; border-radius: 10px; padding: 18px 22px; margin: 14px 0; }
  .ok   { color: #22C55E; font-weight: bold; }
  .fail { color: #EF4444; font-weight: bold; }
  .warn { color: #F59E0B; font-weight: bold; }
  table { border-collapse: collapse; width: 100%; margin-top: 10px; }
  th,td { padding: 8px 12px; border-bottom: 1px solid #1E293B; font-size: 0.875rem; text-align: left; }
  th    { color: #475569; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 1px; }
  code  { background: #1E293B; padding: 2px 6px; border-radius: 4px; color: #6366F1; font-size: 0.85rem; }
  .btn  { display: inline-block; padding: 10px 22px; background: #4F46E5; color: #fff; border: none; border-radius: 8px; cursor: pointer; font-size: 0.9rem; margin: 4px 2px; text-decoration: none; }
  .btn-green { background: #22C55E; color: #000; }
  .btn-red   { background: #EF4444; }
  input[type=text], input[type=password] { background: #1E293B; border: 1px solid #334155; color: #F1F5F9; padding: 8px 12px; border-radius: 6px; font-size: 0.9rem; width: 220px; }
  pre { background: #0F172A; padding: 12px; border-radius: 6px; font-size: 0.78rem; color: #64748B; overflow-x: auto; white-space: pre-wrap; }
</style>
</head>
<body>

<h1>&#x1F6D1; LouageConnect — Setup Wizard</h1>
<p style="color:#64748B;margin-bottom:20px">PHP Version: <strong style="color:#F1F5F9"><?php echo phpversion(); ?></strong></p>

<?php

// ===================================================
// STEP 0: Check PHP version
// ===================================================
echo '<div class="card">';
echo '<h2>PHP Compatibility Check</h2>';
$phpver = phpversion();
echo '<p>Running PHP <strong style="color:#F1F5F9">' . $phpver . '</strong> — ';

if (version_compare($phpver, '5.3.0', '<')) {
    echo '<span class="fail">Too old! Need PHP 5.3+</span></p>';
} else {
    echo '<span class="ok">OK</span></p>';
}

// Check PDO
echo '<p>PDO: ';
echo extension_loaded('pdo_mysql') ? '<span class="ok">&#x2713; MySQL PDO available</span>' : '<span class="fail">&#x2717; PDO MySQL not loaded - enable in php.ini</span>';
echo '</p>';

// Check bcrypt / crypt
$testHash = crypt('test', '$2y$10$abcdefghijklmnopqrstuO');
echo '<p>bcrypt (crypt): ';
echo (substr($testHash, 0, 7) === '$2y$10$') ? '<span class="ok">&#x2713; Working</span>' : '<span class="fail">&#x2717; Not working</span>';
echo '</p>';

// Check password_hash (built-in PHP 5.5, or our polyfill)
if (!function_exists('password_hash')) {
    // Inline the polyfill here since config.php not loaded yet
    function password_hash($pw, $algo, $opts = array()) {
        $cost = 10;
        $chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789./';
        $salt = '$2y$10$';
        for ($i = 0; $i < 22; $i++) $salt .= $chars[mt_rand(0,63)];
        return crypt($pw, $salt);
    }
    function password_verify($pw, $hash) {
        if (!$hash || strlen($hash) < 13) return false;
        $c = crypt($pw, $hash);
        return strlen($c) === strlen($hash) && $c === $hash;
    }
}
echo '<p>password_hash: <span class="ok">&#x2713; Available';
echo version_compare($phpver, '5.5.0', '>=') ? ' (native)' : ' (polyfill)';
echo '</span></p>';
echo '</div>';

// ===================================================
// STEP 1: Database connection
// ===================================================
echo '<div class="card">';
echo '<h2>Step 1 — Database Connection</h2>';

// Read config values (inline, no require yet)
$DB_HOST = 'localhost';
$DB_USER = 'root';
$DB_PASS = '';
$DB_NAME = 'louageconnect';

// Let user override
if (isset($_POST['db_host'])) { $DB_HOST = $_POST['db_host']; $DB_USER = $_POST['db_user']; $DB_PASS = $_POST['db_pass']; $DB_NAME = $_POST['db_name']; }

$pdo = null;
$dbError = '';
try {
    $pdo = new PDO(
        'mysql:host=' . $DB_HOST . ';dbname=' . $DB_NAME . ';charset=utf8',
        $DB_USER, $DB_PASS,
        array(PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC)
    );
    echo '<p class="ok">&#x2713; Connected to MySQL: <code>' . $DB_NAME . '</code> on <code>' . $DB_HOST . '</code></p>';

    // Check tables
    $tables = $pdo->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN);
    if (count($tables) === 0) {
        echo '<p class="fail">&#x2717; No tables found! Import <code>database.sql</code> in phpMyAdmin first.</p>';
    } else {
        echo '<p>Tables: <strong style="color:#F1F5F9">' . implode(', ', $tables) . '</strong></p>';
        if (in_array('users', $tables) && in_array('cars', $tables)) {
            $uc = $pdo->query('SELECT COUNT(*) FROM users')->fetchColumn();
            $cc = $pdo->query('SELECT COUNT(*) FROM cars')->fetchColumn();
            echo '<p>Users: <strong style="color:#F1F5F9">' . $uc . '</strong> &nbsp;|&nbsp; Louages: <strong style="color:#F1F5F9">' . $cc . '</strong></p>';
            if ((int)$cc === 0) {
                echo '<p class="warn">&#x26A0; No louages in DB. Import <code>database.sql</code> again.</p>';
            }
        } else {
            echo '<p class="fail">&#x2717; Missing <code>users</code> or <code>cars</code> table. Import <code>database.sql</code>.</p>';
        }
    }
} catch (PDOException $e) {
    $dbError = $e->getMessage();
    echo '<p class="fail">&#x2717; Connection failed: ' . htmlspecialchars($dbError) . '</p>';
    echo '<p style="margin-top:8px">Edit <code>php/config.php</code> and this file\'s DB settings at the top.</p>';
}

// Show DB config form
echo '<details style="margin-top:14px"><summary style="cursor:pointer;color:#64748B;font-size:0.85rem">&#x2699; Change DB settings</summary>';
echo '<form method="POST" style="margin-top:12px">';
echo '<input type="hidden" name="action" value="test_db">';
foreach (array('db_host'=>$DB_HOST,'db_user'=>$DB_USER,'db_pass'=>$DB_PASS,'db_name'=>$DB_NAME) as $k=>$v) {
    echo '<div style="margin-bottom:8px"><label style="display:inline-block;width:80px;font-size:0.82rem;color:#64748B">' . strtoupper(str_replace('db_','DB ',$k)) . '</label>';
    echo '<input type="text" name="' . $k . '" value="' . htmlspecialchars($v) . '"></div>';
}
echo '<button type="submit" class="btn" style="margin-top:6px">Test Connection</button>';
echo '</form></details>';
echo '</div>';

// Only continue if DB connected
if (!$pdo) {
    echo '</body></html>';
    exit();
}

// ===================================================
// STEP 2: Set Passwords
// ===================================================
$accounts = array(
    array('admin@louageconnect.tn',  'admin123',  'admin'),
    array('karim@louageconnect.tn',  'driver123', 'driver'),
    array('sami@louageconnect.tn',   'driver123', 'driver'),
    array('hedi@louageconnect.tn',   'driver123', 'driver'),
    array('slim@louageconnect.tn',   'driver123', 'driver'),
    array('nabil@louageconnect.tn',  'driver123', 'driver'),
    array('user@louageconnect.tn',   'user123',   'user'),
);

echo '<div class="card">';
echo '<h2>Step 2 — Set Demo Passwords</h2>';

if (isset($_POST['set_passwords'])) {
    $updated = 0;
    $skipped = 0;
    foreach ($accounts as $acc) {
        $hash = password_hash($acc[1], 1);
        $s = $pdo->prepare('UPDATE users SET password = ? WHERE email = ?');
        $s->execute(array($hash, $acc[0]));
        if ($s->rowCount() > 0) $updated++;
        else $skipped++;
    }
    echo '<p class="ok" style="margin-bottom:12px">&#x2713; Updated ' . $updated . ' account(s). Skipped ' . $skipped . ' (not found in DB).</p>';
    if ($skipped > 0) {
        echo '<p class="warn">&#x26A0; Some accounts missing — make sure you imported <code>database.sql</code>.</p>';
    }
}

// Also handle custom user creation
if (isset($_POST['create_user'])) {
    $cEmail = trim($_POST['cu_email']);
    $cPass  = $_POST['cu_pass'];
    $cName  = trim($_POST['cu_name']);
    $cRole  = $_POST['cu_role'];
    if ($cEmail && $cPass && $cName) {
        // Check if exists
        $chk = $pdo->prepare('SELECT id FROM users WHERE email = ?');
        $chk->execute(array($cEmail));
        if ($chk->fetch()) {
            // Update password
            $hash = password_hash($cPass, 1);
            $pdo->prepare('UPDATE users SET password=?, name=?, role=? WHERE email=?')->execute(array($hash, $cName, $cRole, $cEmail));
            echo '<p class="ok">&#x2713; Updated existing account: <code>' . htmlspecialchars($cEmail) . '</code></p>';
        } else {
            $hash = password_hash($cPass, 1);
            $pdo->prepare('INSERT INTO users (name, email, password, role) VALUES (?,?,?,?)')->execute(array($cName, $cEmail, $hash, $cRole));
            echo '<p class="ok">&#x2713; Created account: <code>' . htmlspecialchars($cEmail) . '</code> with password <code>' . htmlspecialchars($cPass) . '</code></p>';
        }
    }
}

// Show current status table
echo '<table><tr><th>Email</th><th>Default Password</th><th>Role</th><th>Hash Status</th></tr>';
foreach ($accounts as $acc) {
    $s = $pdo->prepare('SELECT password FROM users WHERE email = ?');
    $s->execute(array($acc[0]));
    $row = $s->fetch();
    if (!$row) {
        $status = '<span class="fail">Account missing from DB</span>';
    } elseif (strlen($row['password']) < 20) {
        $status = '<span class="fail">Not hashed yet</span>';
    } elseif (password_verify($acc[1], $row['password'])) {
        $status = '<span class="ok">&#x2713; Ready</span>';
    } else {
        $status = '<span class="warn">Hash mismatch</span>';
    }
    echo '<tr><td><code>' . $acc[0] . '</code></td><td><code>' . $acc[1] . '</code></td><td>' . $acc[2] . '</td><td>' . $status . '</td></tr>';
}
echo '</table>';

echo '<form method="POST" style="margin-top:16px">
<button type="submit" name="set_passwords" value="1" class="btn btn-green">&#x1F511; Set All Passwords</button>
</form>';
echo '</div>';

// ===================================================
// STEP 3: Test Login
// ===================================================
echo '<div class="card">';
echo '<h2>Step 3 — Test Login</h2>';

if (isset($_POST['test_login'])) {
    $testEmail = isset($_POST['tl_email']) ? $_POST['tl_email'] : 'admin@louageconnect.tn';
    $testPass  = isset($_POST['tl_pass'])  ? $_POST['tl_pass']  : 'admin123';
    $s = $pdo->prepare('SELECT password, name, role FROM users WHERE email = ?');
    $s->execute(array($testEmail));
    $row = $s->fetch();
    if (!$row) {
        echo '<p class="fail">&#x2717; Account not found: ' . htmlspecialchars($testEmail) . '</p>';
    } elseif (strlen($row['password']) < 20) {
        echo '<p class="warn">&#x26A0; Password not hashed — run Step 2 first.</p>';
    } elseif (password_verify($testPass, $row['password'])) {
        echo '<p class="ok">&#x2713; Login works! <strong>' . htmlspecialchars($row['name']) . '</strong> (' . $row['role'] . ')</p>';
    } else {
        echo '<p class="fail">&#x2717; Wrong password. Run Step 2, then try again.</p>';
    }
}

echo '<form method="POST" style="margin-top:10px">
<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end">
    <div><label style="display:block;font-size:0.78rem;color:#64748B;margin-bottom:4px">EMAIL</label>
         <input type="text" name="tl_email" value="admin@louageconnect.tn"></div>
    <div><label style="display:block;font-size:0.78rem;color:#64748B;margin-bottom:4px">PASSWORD</label>
         <input type="text" name="tl_pass" value="admin123"></div>
    <button type="submit" name="test_login" value="1" class="btn">&#x1F9EA; Test Login</button>
</div>
</form>';
echo '</div>';

// ===================================================
// STEP 4: Create/update any account manually
// ===================================================
echo '<div class="card">';
echo '<h2>Step 4 — Create or Update Any Account</h2>';
echo '<form method="POST" style="margin-top:10px">
<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end">
    <div><label style="display:block;font-size:0.78rem;color:#64748B;margin-bottom:4px">NAME</label>
         <input type="text" name="cu_name" value="My Admin" placeholder="Full name"></div>
    <div><label style="display:block;font-size:0.78rem;color:#64748B;margin-bottom:4px">EMAIL</label>
         <input type="text" name="cu_email" value="" placeholder="you@example.com"></div>
    <div><label style="display:block;font-size:0.78rem;color:#64748B;margin-bottom:4px">PASSWORD</label>
         <input type="text" name="cu_pass" value="" placeholder="yourpassword"></div>
    <div><label style="display:block;font-size:0.78rem;color:#64748B;margin-bottom:4px">ROLE</label>
         <select name="cu_role" style="background:#1E293B;border:1px solid #334155;color:#F1F5F9;padding:8px;border-radius:6px">
             <option value="user">User</option>
             <option value="driver">Driver</option>
             <option value="admin">Admin</option>
         </select>
    </div>
    <button type="submit" name="create_user" value="1" class="btn btn-green">&#x2795; Create / Update</button>
</div>
</form>';
echo '</div>';

// ===================================================
// Done
// ===================================================
echo '<div class="card">';
echo '<h2>&#x2705; Ready to Go</h2>';
echo '<p style="margin-bottom:16px;color:#94A3B8">Once all passwords show <span class="ok">Ready</span> above:</p>';
echo '<a href="index.html" class="btn">&#x1F3E0; Home</a> ';
echo '<a href="login.html" class="btn">&#x1F511; Login</a> ';
echo '<a href="test.html" class="btn">&#x1F527; API Test</a> ';
echo '<a href="dashboard.html" class="btn">&#x1F697; Dashboard</a>';
echo '<p class="warn" style="margin-top:16px;font-size:0.82rem">&#x26A0; Delete this file after setup: <code>setup_passwords.php</code></p>';
echo '</div>';
?>

</body>
</html>
