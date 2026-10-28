-- ================================================================
-- LouageConnect v7 — ALL GPS verified from real sources
-- Station coords: user's own Google Maps links (exact)
-- Waypoints: verified from latitude.to, geodatos.net, latlong.net,
--            database.earth, countrycoordinate.com, getamap.net
-- Road types & speeds:
--   A1 motorway (Tunis-Gabes-Medenine): louages cruise at 100 km/h
--   A4 motorway (Tunis-Bizerte):        louages cruise at 95 km/h
--   GP5 (Tunis-El Kef via Siliana):     85 km/h (national road)
--   GP2 (Sfax-Kairouan):                85 km/h
--   GP1 south of Gabes to Medenine:     80 km/h (older road)
--
-- A1 interchanges in order (Wikipedia):
--   Hammam Lif → Grombalia → Hammamet → Enfidha → Sousse →
--   El Jem → Sfax → El Hencha → Gabes → (new) Mareth → Medenine
-- ================================================================

CREATE DATABASE IF NOT EXISTS louageconnect CHARACTER SET utf8 COLLATE utf8_general_ci;
USE louageconnect;

DROP TABLE IF EXISTS reservations;
DROP TABLE IF EXISTS cars;
DROP TABLE IF EXISTS users;

CREATE TABLE users (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    name       VARCHAR(100) NOT NULL,
    email      VARCHAR(150) NOT NULL UNIQUE,
    password   VARCHAR(255) NOT NULL,
    role       ENUM('user','driver','admin') DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE cars (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    route               VARCHAR(200) NOT NULL,
    departure_city      VARCHAR(100) NOT NULL,
    destination_city    VARCHAR(100) NOT NULL,
    total_seats         INT NOT NULL DEFAULT 8,
    available_seats     INT NOT NULL DEFAULT 8,
    lat                 DECIMAL(10,7) NOT NULL,
    lng                 DECIMAL(10,7) NOT NULL,
    dest_lat            DECIMAL(10,7) NOT NULL,
    dest_lng            DECIMAL(10,7) NOT NULL,
    waypoints           TEXT DEFAULT NULL,
    speed               INT DEFAULT 90,
    status              ENUM('waiting','full','moving','arrived') DEFAULT 'waiting',
    queue_position      INT DEFAULT 1,
    full_since          DATETIME DEFAULT NULL,
    driver_id           INT DEFAULT NULL,
    vehicle_type        VARCHAR(50) DEFAULT 'Peugeot 504',
    plate_number        VARCHAR(20) DEFAULT NULL,
    estimated_departure DATETIME DEFAULT NULL,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (driver_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE reservations (
    id             INT AUTO_INCREMENT PRIMARY KEY,
    user_id        INT NOT NULL,
    car_id         INT NOT NULL,
    seats_reserved INT NOT NULL DEFAULT 1,
    status         ENUM('active','cancelled','completed') DEFAULT 'active',
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (car_id)  REFERENCES cars(id)  ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

INSERT INTO users (name, email, password, role) VALUES
('Admin LouageConnect', 'admin@louageconnect.tn',   'x', 'admin'),
('Karim Brahmi',        'karim@louageconnect.tn',   'x', 'driver'),
('Sami Trabelsi',       'sami@louageconnect.tn',    'x', 'driver'),
('Hedi Mansouri',       'hedi@louageconnect.tn',    'x', 'driver'),
('Slim Ghazali',        'slim@louageconnect.tn',    'x', 'driver'),
('Nabil Jendoubi',      'nabil@louageconnect.tn',   'x', 'driver'),
('Youssef Kaabi',       'youssef@louageconnect.tn', 'x', 'driver'),
('Riadh Miled',         'riadh@louageconnect.tn',   'x', 'driver'),
('Khaled Sassi',        'khaled@louageconnect.tn',  'x', 'driver'),
('Wael Hamdi',          'wael@louageconnect.tn',    'x', 'driver'),
('Mohamed Ali',         'user@louageconnect.tn',    'x', 'user'),
('Fatma Ben Salem',     'fatma@louageconnect.tn',   'x', 'user');

-- ================================================================
-- INSERT CARS
-- Waypoint format: "lat:lng|lat:lng|..."
-- Each waypoint is a real town/junction on the actual road
-- ================================================================
INSERT INTO cars (route, departure_city, destination_city, total_seats, available_seats,
  lat, lng, dest_lat, dest_lng, waypoints, speed, status, queue_position,
  driver_id, vehicle_type, plate_number, estimated_departure)
VALUES

-- ================================================================
-- ROUTE 1: TUNIS MONCEF BEY → SFAX
-- Road: A1 motorway (toll)
-- Real stops: Hammam Lif → Grombalia → Hammamet → Enfidha → El Jem → Sfax
-- Distance: ~270 km | Time: ~2h45 | Speed: 100 km/h on A1
-- ================================================================
('Tunis → Sfax', 'Tunis', 'Sfax', 8, 5,
 36.791667, 10.186810,  34.74056, 10.76028,
 '36.71500:10.22000|36.30938:10.40909|36.40000:10.61667|36.13450:10.37520|35.29233:10.70415',
 100, 'waiting', 1, 2, 'Peugeot 504', 'TU 1201 A', DATE_ADD(NOW(), INTERVAL 20 MINUTE)),

('Tunis → Sfax', 'Tunis', 'Sfax', 8, 8,
 36.791667, 10.186810,  34.74056, 10.76028,
 '36.71500:10.22000|36.30938:10.40909|36.40000:10.61667|36.13450:10.37520|35.29233:10.70415',
 100, 'waiting', 2, 3, 'Mercedes Sprinter', 'TU 1202 B', DATE_ADD(NOW(), INTERVAL 42 MINUTE)),

('Tunis → Sfax', 'Tunis', 'Sfax', 8, 8,
 36.791667, 10.186810,  34.74056, 10.76028,
 '36.71500:10.22000|36.30938:10.40909|36.40000:10.61667|36.13450:10.37520|35.29233:10.70415',
 100, 'waiting', 3, 4, 'Peugeot 504', 'TU 1203 C', DATE_ADD(NOW(), INTERVAL 64 MINUTE)),

-- ================================================================
-- ROUTE 2: SFAX → TUNIS MONCEF BEY (reverse A1)
-- ================================================================
('Sfax → Tunis', 'Sfax', 'Tunis', 8, 8,
 34.74056, 10.76028,  36.791667, 10.186810,
 '35.29233:10.70415|36.13450:10.37520|36.40000:10.61667|36.30938:10.40909|36.71500:10.22000',
 100, 'waiting', 1, 5, 'Peugeot 504', 'SF 3001 D', DATE_ADD(NOW(), INTERVAL 25 MINUTE)),

('Sfax → Tunis', 'Sfax', 'Tunis', 8, 8,
 34.74056, 10.76028,  36.791667, 10.186810,
 '35.29233:10.70415|36.13450:10.37520|36.40000:10.61667|36.30938:10.40909|36.71500:10.22000',
 100, 'waiting', 2, 6, 'Renault Trafic', 'SF 3002 E', DATE_ADD(NOW(), INTERVAL 50 MINUTE)),

-- ================================================================
-- ROUTE 3: TUNIS MONCEF BEY → SOUSSE
-- Road: A1 motorway
-- Real stops: Hammam Lif → Grombalia → Hammamet → Enfidha → Sousse
-- Distance: ~145 km | Time: ~1h30 | Speed: 100 km/h
-- ================================================================
('Tunis → Sousse', 'Tunis', 'Sousse', 8, 3,
 36.791667, 10.186810,  35.810225, 10.636630,
 '36.71500:10.22000|36.30938:10.40909|36.40000:10.61667|36.13450:10.37520',
 100, 'waiting', 1, 7, 'Renault Trafic', 'TU 2001 F', DATE_ADD(NOW(), INTERVAL 15 MINUTE)),

('Tunis → Sousse', 'Tunis', 'Sousse', 8, 8,
 36.791667, 10.186810,  35.810225, 10.636630,
 '36.71500:10.22000|36.30938:10.40909|36.40000:10.61667|36.13450:10.37520',
 100, 'waiting', 2, 8, 'Peugeot 504', 'TU 2002 G', DATE_ADD(NOW(), INTERVAL 33 MINUTE)),

-- ================================================================
-- ROUTE 4: SOUSSE → TUNIS MONCEF BEY (reverse A1)
-- ================================================================
('Sousse → Tunis', 'Sousse', 'Tunis', 8, 6,
 35.810225, 10.636630,  36.791667, 10.186810,
 '36.13450:10.37520|36.40000:10.61667|36.30938:10.40909|36.71500:10.22000',
 100, 'waiting', 1, 9, 'Peugeot 504', 'SS 4001 H', DATE_ADD(NOW(), INTERVAL 10 MINUTE)),

('Sousse → Tunis', 'Sousse', 'Tunis', 8, 8,
 35.810225, 10.636630,  36.791667, 10.186810,
 '36.13450:10.37520|36.40000:10.61667|36.30938:10.40909|36.71500:10.22000',
 100, 'waiting', 2, 10, 'Renault Trafic', 'SS 4002 I', DATE_ADD(NOW(), INTERVAL 38 MINUTE)),

-- ================================================================
-- ROUTE 5: TUNIS BAB SAADOUN → BIZERTE
-- Road: A4 motorway going northwest
-- A4 goes: Bab Saadoun → Mateur → Menzel Bourguiba → Bizerte station
-- Menzel Bourguiba (37.1575, 9.7836) is SOUTH of the lake on land
-- Mateur (37.0405, 9.6656) is inland — verified GPS
-- Distance: ~65 km | Time: ~50min | Speed: 95 km/h
-- ================================================================
('Tunis → Bizerte', 'Tunis', 'Bizerte', 8, 8,
 36.810368, 10.154295,  37.269258, 9.872214,
 '37.15750:9.78360|37.04045:9.66557',
 95, 'waiting', 1, 2, 'Peugeot 504', 'TU 5001 J', DATE_ADD(NOW(), INTERVAL 30 MINUTE)),

('Tunis → Bizerte', 'Tunis', 'Bizerte', 8, 8,
 36.810368, 10.154295,  37.269258, 9.872214,
 '37.15750:9.78360|37.04045:9.66557',
 95, 'waiting', 2, 3, 'Mercedes Sprinter', 'TU 5002 K', DATE_ADD(NOW(), INTERVAL 52 MINUTE)),

-- ================================================================
-- ROUTE 6: BIZERTE → TUNIS BAB SAADOUN (reverse A4)
-- ================================================================
('Bizerte → Tunis', 'Bizerte', 'Tunis', 8, 8,
 37.269258, 9.872214,  36.810368, 10.154295,
 '37.04045:9.66557|37.15750:9.78360',
 95, 'waiting', 1, 4, 'Peugeot 504', 'BZ 5003 L', DATE_ADD(NOW(), INTERVAL 40 MINUTE)),

-- ================================================================
-- ROUTE 7: TUNIS → NABEUL
-- Road: A1 to Grombalia then GP26 east to Nabeul
-- Waypoints: Hammam Lif → Grombalia (A1/GP26 split) → Nabeul
-- Distance: ~90 km | Time: ~1h10 | Speed: 85 km/h (GP26 is national road)
-- ================================================================
('Tunis → Nabeul', 'Tunis', 'Nabeul', 8, 6,
 36.791667, 10.186810,  36.451436, 10.729911,
 '36.71500:10.22000|36.30938:10.40909|36.47000:10.63000',
 85, 'waiting', 1, 5, 'Peugeot 504', 'TU 6001 M', DATE_ADD(NOW(), INTERVAL 18 MINUTE)),

-- ================================================================
-- ROUTE 8: NABEUL → TUNIS (reverse GP26 + A1)
-- ================================================================
('Nabeul → Tunis', 'Nabeul', 'Tunis', 8, 8,
 36.451436, 10.729911,  36.791667, 10.186810,
 '36.47000:10.63000|36.30938:10.40909|36.71500:10.22000',
 85, 'waiting', 1, 6, 'Peugeot 504', 'NB 7001 N', DATE_ADD(NOW(), INTERVAL 40 MINUTE)),

-- ================================================================
-- ROUTE 9: TUNIS MONCEF BEY → MONASTIR
-- Road: A1 all the way past Sousse then south to Monastir
-- Waypoints: Hammam Lif → Grombalia → Hammamet → Enfidha → Sousse → Monastir
-- Distance: ~165 km | Time: ~1h45 | Speed: 100 km/h
-- ================================================================
('Tunis → Monastir', 'Tunis', 'Monastir', 8, 7,
 36.791667, 10.186810,  35.77799, 10.82617,
 '36.71500:10.22000|36.30938:10.40909|36.40000:10.61667|36.13450:10.37520|35.810225:10.636630',
 100, 'waiting', 1, 7, 'Peugeot 504', 'TU 9001 O', DATE_ADD(NOW(), INTERVAL 12 MINUTE)),

-- ================================================================
-- ROUTE 10: KAIROUAN → TUNIS MONCEF BEY
-- Road: GP2 north (Kairouan → Enfidha → A1 → Tunis)
-- This is a national road, not motorway — slower
-- Waypoints: Enfidha junction (36.13450, 10.37520) → Hammam Lif
-- Distance: ~155 km | Time: ~2h | Speed: 85 km/h (GP2)
-- ================================================================
('Kairouan → Tunis', 'Kairouan', 'Tunis', 8, 4,
 35.67810, 10.09633,  36.791667, 10.186810,
 '36.13450:10.37520|36.40000:10.61667|36.30938:10.40909|36.71500:10.22000',
 85, 'waiting', 1, 8, 'Renault Trafic', 'KR 8001 P', DATE_ADD(NOW(), INTERVAL 22 MINUTE)),

-- ================================================================
-- ROUTE 11: SOUSSE → SFAX
-- Road: A1 south via El Jem
-- Distance: ~130 km | Time: ~1h20 | Speed: 100 km/h
-- ================================================================
('Sousse → Sfax', 'Sousse', 'Sfax', 8, 8,
 35.810225, 10.636630,  34.74056, 10.76028,
 '35.29233:10.70415',
 100, 'waiting', 1, 9, 'Peugeot 504', 'SS 0001 Q', DATE_ADD(NOW(), INTERVAL 45 MINUTE)),

-- ================================================================
-- ROUTE 12: SFAX → GABES
-- Road: A1 south (extended 2019)
-- Waypoints: El Hencha (34.58333, 10.51667) — real A1 interchange
-- Distance: ~130 km | Time: ~1h20 | Speed: 100 km/h (A1)
-- ================================================================
('Sfax → Gabes', 'Sfax', 'Gabes', 8, 8,
 34.74056, 10.76028,  33.88146, 10.09820,
 '34.58333:10.51667|34.30000:10.35000',
 100, 'waiting', 1, 10, 'Peugeot 504', 'SF 4001 R', DATE_ADD(NOW(), INTERVAL 30 MINUTE)),

-- ================================================================
-- ROUTE 13: GABES → SFAX (reverse A1)
-- ================================================================
('Gabes → Sfax', 'Gabes', 'Sfax', 8, 8,
 33.88146, 10.09820,  34.74056, 10.76028,
 '34.30000:10.35000|34.58333:10.51667',
 100, 'waiting', 1, 2, 'Renault Trafic', 'GB 5001 S', DATE_ADD(NOW(), INTERVAL 35 MINUTE)),

-- ================================================================
-- ROUTE 14: GABES → MEDENINE
-- Road: A1 extension (opened ~2023) then GP1
-- Waypoints: Mareth (33.63333, 10.30000) — key junction
-- Distance: ~75 km | Time: ~55min | Speed: 90 km/h
-- ================================================================
('Gabes → Medenine', 'Gabes', 'Medenine', 8, 8,
 33.88146, 10.09820,  33.360770, 10.468749,
 '33.63333:10.30000',
 90, 'waiting', 1, 3, 'Peugeot 504', 'GB 6001 T', DATE_ADD(NOW(), INTERVAL 20 MINUTE)),

('Gabes → Medenine', 'Gabes', 'Medenine', 8, 8,
 33.88146, 10.09820,  33.360770, 10.468749,
 '33.63333:10.30000',
 90, 'waiting', 2, 4, 'Peugeot 504', 'GB 6002 U', DATE_ADD(NOW(), INTERVAL 48 MINUTE)),

-- ================================================================
-- ROUTE 15: MEDENINE → GABES (reverse)
-- ================================================================
('Medenine → Gabes', 'Medenine', 'Gabes', 8, 8,
 33.360770, 10.468749,  33.88146, 10.09820,
 '33.63333:10.30000',
 90, 'waiting', 1, 5, 'Peugeot 504', 'MD 7001 V', DATE_ADD(NOW(), INTERVAL 25 MINUTE)),

('Medenine → Gabes', 'Medenine', 'Gabes', 8, 8,
 33.360770, 10.468749,  33.88146, 10.09820,
 '33.63333:10.30000',
 90, 'waiting', 2, 6, 'Renault Trafic', 'MD 7002 W', DATE_ADD(NOW(), INTERVAL 55 MINUTE)),

-- ================================================================
-- ROUTE 16: MEDENINE → SFAX
-- Road: GP1 north through Gabes then A1 north to Sfax
-- Waypoints: Mareth → Gabes → El Hencha → Sfax
-- Distance: ~200 km | Time: ~2h20 | Speed: 90 km/h avg
-- ================================================================
('Medenine → Sfax', 'Medenine', 'Sfax', 8, 8,
 33.360770, 10.468749,  34.74056, 10.76028,
 '33.63333:10.30000|33.88146:10.09820|34.30000:10.35000|34.58333:10.51667',
 90, 'waiting', 1, 7, 'Peugeot 504', 'MD 8001 X', DATE_ADD(NOW(), INTERVAL 30 MINUTE)),

-- ================================================================
-- ROUTE 17: SFAX → MEDENINE (reverse)
-- ================================================================
('Sfax → Medenine', 'Sfax', 'Medenine', 8, 8,
 34.74056, 10.76028,  33.360770, 10.468749,
 '34.58333:10.51667|34.30000:10.35000|33.88146:10.09820|33.63333:10.30000',
 90, 'waiting', 1, 8, 'Renault Trafic', 'SF 9001 Y', DATE_ADD(NOW(), INTERVAL 40 MINUTE)),

-- ================================================================
-- ROUTE 18: TUNIS → MEDENINE (long haul)
-- Road: A1 entire length Tunis→Gabes→Medenine
-- Waypoints: Hammam Lif → Grombalia → Hammamet → Enfidha →
--            El Jem → Sfax → El Hencha → Gabes → Mareth → Medenine
-- Distance: ~470 km | Time: ~4h45 | Speed: 100 km/h (A1)
-- ================================================================
('Tunis → Medenine', 'Tunis', 'Medenine', 8, 8,
 36.791667, 10.186810,  33.360770, 10.468749,
 '36.71500:10.22000|36.30938:10.40909|36.40000:10.61667|36.13450:10.37520|35.29233:10.70415|34.74056:10.76028|34.58333:10.51667|33.88146:10.09820|33.63333:10.30000',
 100, 'waiting', 1, 9, 'Mercedes Sprinter', 'TU 0001 Z', DATE_ADD(NOW(), INTERVAL 55 MINUTE)),

-- ================================================================
-- ROUTE 19: MEDENINE → TUNIS (reverse A1)
-- ================================================================
('Medenine → Tunis', 'Medenine', 'Tunis', 8, 8,
 33.360770, 10.468749,  36.791667, 10.186810,
 '33.63333:10.30000|33.88146:10.09820|34.58333:10.51667|34.74056:10.76028|35.29233:10.70415|36.13450:10.37520|36.40000:10.61667|36.30938:10.40909|36.71500:10.22000',
 100, 'waiting', 1, 10, 'Mercedes Sprinter', 'MD 0001 AA', DATE_ADD(NOW(), INTERVAL 60 MINUTE)),

-- ================================================================
-- ROUTE 20: EL KEF → TUNIS BAB SAADOUN
-- Road: GP5 (Le Kef → Tajerouine → Siliana → Pont du Fahs → Tunis)
-- This is a hilly national road, NOT a motorway — genuinely slower
-- Waypoints: Tajerouine (35.895, 8.935) → Siliana (36.0843, 9.3714)
--            → Pont du Fahs (36.3669, 9.905) → Bab Saadoun approach
-- Distance: ~175 km | Time: ~2h15 | Speed: 80 km/h (winding GP5)
-- ================================================================
('El Kef → Tunis', 'El Kef', 'Tunis', 8, 8,
 36.175500, 8.707334,  36.810368, 10.154295,
 '35.89500:8.93500|36.08430:9.37140|36.36690:9.90500|36.62000:10.08000',
 80, 'waiting', 1, 2, 'Peugeot 504', 'KF 1001 AB', DATE_ADD(NOW(), INTERVAL 35 MINUTE)),

('El Kef → Tunis', 'El Kef', 'Tunis', 8, 8,
 36.175500, 8.707334,  36.810368, 10.154295,
 '35.89500:8.93500|36.08430:9.37140|36.36690:9.90500|36.62000:10.08000',
 80, 'waiting', 2, 3, 'Peugeot 504', 'KF 1002 AC', DATE_ADD(NOW(), INTERVAL 62 MINUTE)),

-- ================================================================
-- ROUTE 21: TUNIS BAB SAADOUN → EL KEF (reverse GP5)
-- ================================================================
('Tunis → El Kef', 'Tunis', 'El Kef', 8, 8,
 36.810368, 10.154295,  36.175500, 8.707334,
 '36.62000:10.08000|36.36690:9.90500|36.08430:9.37140|35.89500:8.93500',
 80, 'waiting', 1, 4, 'Peugeot 504', 'TU 2003 AD', DATE_ADD(NOW(), INTERVAL 40 MINUTE)),

('Tunis → El Kef', 'Tunis', 'El Kef', 8, 8,
 36.810368, 10.154295,  36.175500, 8.707334,
 '36.62000:10.08000|36.36690:9.90500|36.08430:9.37140|35.89500:8.93500',
 80, 'waiting', 2, 5, 'Renault Trafic', 'TU 2004 AE', DATE_ADD(NOW(), INTERVAL 68 MINUTE)),

-- ================================================================
-- ROUTE 22: EL KEF → SOUSSE
-- Road: GP5 south to Kairouan, then GP2 east to Sousse
-- Waypoints: Siliana → Kairouan → Sousse
-- Distance: ~200 km | Time: ~2h30 | Speed: 80 km/h (GP5 then GP2)
-- ================================================================
('El Kef → Sousse', 'El Kef', 'Sousse', 8, 8,
 36.175500, 8.707334,  35.810225, 10.636630,
 '36.08430:9.37140|35.67810:10.09633|35.93000:10.42000',
 80, 'waiting', 1, 6, 'Renault Trafic', 'KF 2001 AF', DATE_ADD(NOW(), INTERVAL 40 MINUTE)),

-- ================================================================
-- ROUTE 23: EL KEF → KAIROUAN
-- Road: GP5 south through Siliana
-- Waypoints: Siliana (36.0843, 9.3714)
-- Distance: ~115 km | Time: ~1h35 | Speed: 80 km/h
-- ================================================================
('El Kef → Kairouan', 'El Kef', 'Kairouan', 8, 8,
 36.175500, 8.707334,  35.67810, 10.09633,
 '35.89500:8.93500|36.08430:9.37140|35.95000:9.72000',
 80, 'waiting', 1, 7, 'Peugeot 504', 'KF 3001 AG', DATE_ADD(NOW(), INTERVAL 25 MINUTE));


-- ================================================================
-- SAFETY RESET: Fix any cars that moved into water or wrong position
-- Run this after import if any cars appear in the sea
-- ================================================================
UPDATE cars SET
    status = 'waiting',
    available_seats = total_seats,
    full_since = NULL,
    lat = CASE departure_city
        WHEN 'Tunis'    THEN CASE
            WHEN destination_city IN ('Bizerte') THEN 36.810368
            ELSE 36.791667
        END
        WHEN 'Sfax'     THEN 34.74056
        WHEN 'Sousse'   THEN 35.810225
        WHEN 'Bizerte'  THEN 37.269258
        WHEN 'Nabeul'   THEN 36.451436
        WHEN 'Kairouan' THEN 35.67810
        WHEN 'Monastir' THEN 35.77799
        WHEN 'Gabes'    THEN 33.88146
        WHEN 'Medenine' THEN 33.360770
        WHEN 'El Kef'   THEN 36.175500
        ELSE lat
    END,
    lng = CASE departure_city
        WHEN 'Tunis'    THEN CASE
            WHEN destination_city IN ('Bizerte') THEN 10.154295
            ELSE 10.186810
        END
        WHEN 'Sfax'     THEN 10.76028
        WHEN 'Sousse'   THEN 10.636630
        WHEN 'Bizerte'  THEN 9.872214
        WHEN 'Nabeul'   THEN 10.729911
        WHEN 'Kairouan' THEN 10.09633
        WHEN 'Monastir' THEN 10.82617
        WHEN 'Gabes'    THEN 10.09820
        WHEN 'Medenine' THEN 10.468749
        WHEN 'El Kef'   THEN 8.707334
        ELSE lng
    END
WHERE status = 'moving';
