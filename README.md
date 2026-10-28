# 🚖 LouageConnect

**A modern platform for organizing and tracking Tunisian louage (shared taxi) transportation between cities.**

---

## 🚀 Quick Setup (EasyPHP 5.8)

### 1. Copy Files
Place the entire `louageconnect/` folder inside your EasyPHP `www` directory:
```
C:\EasyPHP\www\louageconnect\
```

### 2. Create Database
1. Open **phpMyAdmin** (EasyPHP dashboard → phpMyAdmin)
2. Click **"Import"** or open the SQL console
3. Run the contents of `database.sql`

This will:
- Create the `louageconnect` database
- Create all tables (`users`, `cars`, `reservations`)
- Insert 10 sample louage routes across Tunisia
- Insert demo accounts (see below)

### 3. Configure Database
Open `php/config.php` and update if needed:
```php
define('DB_HOST', 'localhost');
define('DB_USER', 'root');
define('DB_PASS', '');          // Change if you set a MySQL password
define('DB_NAME', 'louageconnect');
```

### 4. Open the App
Navigate to: `http://localhost/louageconnect/`

---

## 🔑 Demo Accounts

| Role   | Email                      | Password  |
|--------|----------------------------|-----------|
| Admin  | admin@louageconnect.tn     | (set in DB) |
| Driver | karim@louageconnect.tn     | (set in DB) |
| User   | user@louageconnect.tn      | (set in DB) |

> **Note:** The SQL file uses `password_hash()` placeholder values. To set real passwords, either:
> - Register new accounts via the UI, or
> - Run this SQL after importing: `UPDATE users SET password = '$2y$10$...' WHERE email = 'admin@...'`
> - Or simply register fresh accounts at `/louageconnect/register.html`

---

## 📁 File Structure

```
louageconnect/
├── index.html              ← Landing page
├── dashboard.html          ← Louage listing + reservations
├── map.html                ← Live map (Leaflet.js)
├── login.html              ← Login page
├── register.html           ← Registration page
├── database.sql            ← Full DB schema + sample data
│
├── css/
│   ├── main.css            ← Global styles (dark theme)
│   └── map.css             ← Map-specific styles
│
├── js/
│   ├── utils.js            ← Shared utilities, API calls, toasts
│   ├── dashboard.js        ← Dashboard logic, filtering, cards
│   └── map.js              ← Leaflet map, live simulation
│
├── php/
│   ├── config.php          ← DB connection, session helpers
│   ├── login.php           ← Login handler
│   ├── register.php        ← Registration handler
│   ├── logout.php          ← Logout + session destroy
│   └── session.php         ← Session check API
│
├── api/
│   ├── get_cars.php        ← Fetch all louages + simulate movement
│   ├── reserve.php         ← Seat reservation (with locking)
│   ├── my_reservations.php ← User's own reservations
│   └── manage.php          ← Admin/driver management API
│
├── admin/
│   └── index.html          ← Admin panel (cars, users, reservations)
│
└── driver/
    └── index.html          ← Driver dashboard
```

---

## ✨ Features

### For Passengers
- Browse all available louages by route
- Filter by city, status, search
- See available seats, vehicle info, ETA
- Reserve 1–6 seats with one click
- View your reservation history

### Live Map
- All active louages on an interactive Leaflet map
- Custom color-coded markers (waiting/full/moving)
- Live updates every 4 seconds via AJAX
- Animated marker movement toward destination
- Clickable popups with reserve button
- Sidebar list of all active louages

### For Drivers
- Update trip status (waiting / full / moving)
- Adjust available seat count
- Set GPS location manually
- Auto-simulation: car moves toward destination automatically

### For Admins
- Dashboard with live statistics
- Add new louage vehicles to the fleet
- Delete louages
- View all users and their roles
- View all reservations platform-wide

---

## 🛠️ Tech Stack

| Layer    | Technology                    |
|----------|-------------------------------|
| Frontend | HTML5, CSS3, Vanilla JS (ES6) |
| Backend  | PHP 5.6+ (PDO)               |
| Database | MySQL 5.x                     |
| Maps     | Leaflet.js + OpenStreetMap    |
| Fonts    | Google Fonts (Syne, DM Sans)  |

---

## 🗺️ Tunisia Routes Included

1. Tunis → Sfax
2. Tunis → Sousse
3. Sfax → Tunis
4. Sousse → Tunis
5. Tunis → Nabeul
6. Nabeul → Tunis
7. Tunis → Bizerte
8. Sfax → Sousse
9. Kairouan → Tunis
10. Tunis → Monastir

---

## ⚙️ How the Live Simulation Works

1. Every 4 seconds, the browser calls `api/get_cars.php`
2. The PHP script:
   - Finds all "moving" cars
   - Advances their lat/lng by a small step toward the destination
   - Saves the new position in the database
3. The browser receives new positions and smoothly animates markers on the map
4. When a car's available_seats reaches 0, its status automatically changes to "full"
5. When a driver clicks "Start Trip", status changes to "moving" and simulation begins

---

## 🎨 Design System

- **Background:** `#060C1A` deep navy
- **Cards:** `#111827` dark glass
- **Primary:** `#4F46E5` indigo
- **Success:** `#22C55E` green
- **Warning:** `#F59E0B` amber
- **Danger:** `#EF4444` red
- **Fonts:** Syne (headings) + DM Sans (body)
