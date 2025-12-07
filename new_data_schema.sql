-- Drop in dependency order so we don't need CASCADE
DROP TABLE IF EXISTS PreferenceWeight;
DROP TABLE IF EXISTS CityIndustryStats;
DROP TABLE IF EXISTS CityMetricValue;
DROP TABLE IF EXISTS PreferenceProfile;
DROP TABLE IF EXISTS app_user;
DROP TABLE IF EXISTS Industry;
DROP TABLE IF EXISTS Metric;
DROP TABLE IF EXISTS City;
DROP OWNED BY demo_user;
DROP USER IF EXISTS demo_user;

--------------------------------------------------
-- Core lookup tables
--------------------------------------------------

CREATE TABLE City (
    city_id  SERIAL PRIMARY KEY,
    name     TEXT NOT NULL,
    state    CHAR(2) NOT NULL,
    -- Prevent duplicate cities and enforce 2-letter state codes
    UNIQUE (name, state),
    CHECK (char_length(state) = 2)
);

CREATE TABLE Metric (
    metric_id         SERIAL PRIMARY KEY,
    name              TEXT NOT NULL UNIQUE,
    description       TEXT,         -- only optional field in the schema
    unit              TEXT NOT NULL,
    higher_is_better  BOOLEAN NOT NULL
    -- This is your "boolean flag" constraint in type form.
    -- If you REALLY want numeric 0/1, change to SMALLINT with a CHECK instead.
);

CREATE TABLE Industry (
    industry_id  SERIAL PRIMARY KEY,
    name         TEXT NOT NULL UNIQUE,
    description  TEXT NOT NULL
);

-- "User" is reserved in PostgreSQL, so use app_user instead
CREATE TABLE app_user (
    user_id     SERIAL PRIMARY KEY,
    first_name  TEXT NOT NULL,
    last_name   TEXT NOT NULL
);

--------------------------------------------------
-- User profiles
--------------------------------------------------

CREATE TABLE PreferenceProfile (
    profile_id    SERIAL PRIMARY KEY,
    user_id       INTEGER NOT NULL REFERENCES app_user(user_id),
    profile_name  TEXT NOT NULL,
    -- A user cannot have two profiles with the exact same name
    UNIQUE (user_id, profile_name)
);

--------------------------------------------------
-- City-level metric values over time
--------------------------------------------------

CREATE TABLE CityMetricValue (
    city_id   INTEGER NOT NULL REFERENCES City(city_id),
    metric_id INTEGER NOT NULL REFERENCES Metric(metric_id),
    value     NUMERIC NOT NULL,
    year      INTEGER NOT NULL,
    -- One value per (city, metric, year)
    PRIMARY KEY (city_id, metric_id, year),
    -- Domain checks
    CHECK (value >= 0),
    CHECK (year BETWEEN 1900 AND 2100)
);

--------------------------------------------------
-- City-industry statistics
--------------------------------------------------

CREATE TABLE CityIndustryStats (
    city_id              INTEGER NOT NULL REFERENCES City(city_id),
    industry_id          INTEGER NOT NULL REFERENCES Industry(industry_id),
    median_salary        NUMERIC NOT NULL,
    num_job_openings     INTEGER NOT NULL,
    growth_outlook_score INTEGER NOT NULL,
    -- One row per (city, industry)
    PRIMARY KEY (city_id, industry_id),
    -- Domain checks
    CHECK (median_salary >= 0),
    CHECK (num_job_openings >= 0),
    CHECK (growth_outlook_score BETWEEN 1 AND 10)
);

--------------------------------------------------
-- Preference weights for metrics in a profile
--------------------------------------------------

CREATE TABLE PreferenceWeight (
    profile_id  INTEGER NOT NULL REFERENCES PreferenceProfile(profile_id),
    metric_id   INTEGER NOT NULL REFERENCES Metric(metric_id),
    weight      NUMERIC NOT NULL,
    -- One weight per (profile, metric)
    PRIMARY KEY (profile_id, metric_id),
    -- Weight is a proportion
    CHECK (weight >= 0 AND weight <= 1)
);


--------------------------------------------------
-- CREATE DEMO USER
--------------------------------------------------

CREATE USER demo_user WITH PASSWORD 'demo';
GRANT INSERT, SELECT, UPDATE, DELETE ON TABLE
    app_user,
    city,
    cityindustrystats,
    citymetricvalue,
    industry,
    metric,
    preferenceprofile,
    preferenceweight
TO demo_user;

GRANT USAGE, SELECT, UPDATE
ON ALL SEQUENCES IN SCHEMA public
TO demo_user;


--------------------------------------------------
-- SEED DATA: CITY
--------------------------------------------------

INSERT INTO City (name, state) VALUES
('Cleveland',   'OH'),
('Pittsburgh',  'PA'),
('Columbus',    'OH'),
('Austin',      'TX'),
('Seattle',     'WA'),
('Denver',      'CO'),
('Atlanta',     'GA'),
('Minneapolis', 'MN');

--------------------------------------------------
-- SEED DATA: METRIC
-- metric_id mapping (by insert order):
-- 1: FMR Rent 1BR
-- 2: FMR Rent 2BR
-- 3: Violent Crime Rate
-- 4: Property Crime Rate
-- 5: School Quality Index
-- 6: Air Quality Index
-- 7: Average Commute
-- 8: Annual Temperature
--------------------------------------------------

INSERT INTO Metric (name, description, unit, higher_is_better) VALUES
('FMR Rent 1BR',
 'Fair Market Rent for a 1-bedroom unit',
 'USD',
 FALSE),
('FMR Rent 2BR',
 'Fair Market Rent for a 2-bedroom unit',
 'USD',
 FALSE),
('Violent Crime Rate',
 'Violent crimes per 100k residents',
 'per 100k',
 FALSE),
('Property Crime Rate',
 'Property crimes per 100k residents',
 'per 100k',
 FALSE),
('School Quality Index',
 'Composite school quality index (higher is better)',
 'index',
 TRUE),
('Air Quality Index',
 'Air quality score (lower is better)',
 'AQI',
 FALSE),
('Average Commute',
 'Average commute time in minutes',
 'minutes',
 FALSE),
('Annual Temperature',
 'Average annual temperature (Celsius)',
 'C',
 FALSE);

--------------------------------------------------
-- SEED DATA: INDUSTRY
-- industry_id mapping:
-- 1: Software Engineering
-- 2: Data Science / Analytics
-- 3: Machine Learning / AI
--------------------------------------------------

INSERT INTO Industry (name, description) VALUES
('Software Engineering',
 'Software development and engineering roles'),
('Data Science / Analytics',
 'Data analysis, predictive modeling, and analytics roles'),
('Machine Learning / AI',
 'Machine learning engineering and AI-focused roles');

--------------------------------------------------
-- SEED DATA: CITYMETRICVALUE  (YEAR = 2024)
-- Order: (city_id, metric_id, value, year)
--------------------------------------------------

-- 1 = Cleveland, OH
INSERT INTO CityMetricValue VALUES
(1, 1, 1050, 2024),
(1, 2, 1350, 2024),
(1, 3, 1350, 2024),
(1, 4, 4000, 2024),
(1, 5, 6.5,  2024),
(1, 6, 45,   2024),
(1, 7, 24,   2024),
(1, 8, 21.7, 2024);

-- 2 = Pittsburgh, PA
INSERT INTO CityMetricValue VALUES
(2, 1, 1150, 2024),
(2, 2, 1450, 2024),
(2, 3,  550, 2024),
(2, 4, 3200, 2024),
(2, 5, 7.0,  2024),
(2, 6, 40,   2024),
(2, 7, 25,   2024),
(2, 8, 20.5, 2024);

-- 3 = Columbus, OH
INSERT INTO CityMetricValue VALUES
(3, 1, 1200, 2024),
(3, 2, 1500, 2024),
(3, 3,  500, 2024),
(3, 4, 3500, 2024),
(3, 5, 6.8,  2024),
(3, 6, 42,   2024),
(3, 7, 23,   2024),
(3, 8, 21.0, 2024);

-- 4 = Austin, TX
INSERT INTO CityMetricValue VALUES
(4, 1, 1400, 2024),
(4, 2, 1850, 2024),
(4, 3,  430, 2024),
(4, 4, 3800, 2024),
(4, 5, 7.2,  2024),
(4, 6, 48,   2024),
(4, 7, 27,   2024),
(4, 8, 24.5, 2024);

-- 5 = Seattle, WA
INSERT INTO CityMetricValue VALUES
(5, 1, 1850, 2024),
(5, 2, 2400, 2024),
(5, 3,  640, 2024),
(5, 4, 4600, 2024),
(5, 5, 8.3,  2024),
(5, 6, 38,   2024),
(5, 7, 29,   2024),
(5, 8, 17.5, 2024);

-- 6 = Denver, CO
INSERT INTO CityMetricValue VALUES
(6, 1, 1600, 2024),
(6, 2, 2050, 2024),
(6, 3,  430, 2024),
(6, 4, 4100, 2024),
(6, 5, 7.5,  2024),
(6, 6, 35,   2024),
(6, 7, 26,   2024),
(6, 8, 16.0, 2024);

-- 7 = Atlanta, GA
INSERT INTO CityMetricValue VALUES
(7, 1, 1450, 2024),
(7, 2, 1900, 2024),
(7, 3,  750, 2024),
(7, 4, 4200, 2024),
(7, 5, 6.7,  2024),
(7, 6, 50,   2024),
(7, 7, 30,   2024),
(7, 8, 22.5, 2024);

-- 8 = Minneapolis, MN
INSERT INTO CityMetricValue VALUES
(8, 1, 1350, 2024),
(8, 2, 1750, 2024),
(8, 3,  520, 2024),
(8, 4, 3400, 2024),
(8, 5, 7.8,  2024),
(8, 6, 33,   2024),
(8, 7, 24,   2024),
(8, 8, 16.5, 2024);

--------------------------------------------------
-- SEED DATA: CITYINDUSTRYSTATS
-- (city_id, industry_id, median_salary, num_job_openings,
--  growth_outlook_score)
--------------------------------------------------

INSERT INTO CityIndustryStats VALUES
-- Cleveland
(1, 1,  95000, 1200, 6),
(1, 2, 105000,  700, 7),
(1, 3, 118000,  450, 8),

-- Pittsburgh
(2, 1, 100000, 1300, 7),
(2, 2, 112000,  800, 8),
(2, 3, 125000,  500, 9),

-- Columbus
(3, 1, 102000, 1100, 7),
(3, 2, 115000,  600, 8),
(3, 3, 128000,  420, 9),

-- Austin
(4, 1, 120000, 2100, 8),
(4, 2, 135000, 1200, 9),
(4, 3, 150000,  800, 10),

-- Seattle
(5, 1, 135000, 2500, 9),
(5, 2, 145000, 1400, 9),
(5, 3, 160000,  900, 10),

-- Denver
(6, 1, 115000, 1600, 8),
(6, 2, 130000,  900, 9),
(6, 3, 145000,  600, 9),

-- Atlanta
(7, 1, 110000, 1700, 7),
(7, 2, 122000,  950, 8),
(7, 3, 138000,  550, 9),

-- Minneapolis
(8, 1, 108000, 1400, 7),
(8, 2, 118000,  850, 8),
(8, 3, 130000,  500, 9);



BEGIN;

--------------------------------------------------
-- 1. Clear all existing data
--------------------------------------------------

TRUNCATE TABLE
    PreferenceWeight,
    CityIndustryStats,
    CityMetricValue,
    PreferenceProfile,
    app_user,
    Industry,
    Metric,
    City
RESTART IDENTITY CASCADE;

--------------------------------------------------
-- 2. Seed City table (from your city sheet)
--------------------------------------------------

INSERT INTO City (name, state) VALUES
    ( 'Cleveland',   'OH' ),
    ( 'Pittsburgh',  'PA' ),
    ( 'Columbus',    'OH' ),
    ( 'Austin',      'TX' ),
    ( 'Seattle',     'WA' ),
    ( 'Denver',      'CO' ),
    ( 'Atlanta',     'GA' ),
    ( 'Minneapolis', 'MN' );

--------------------------------------------------
-- 3. Seed Metric table
-- We’re using the four city-level metrics from your sheet.
-- metric_id mapping by insert order:
-- 1: Fair Market Rent (1-Bedroom)
-- 2: Fair Market Rent (2-Bedroom)
-- 3: Average Commute Time
-- 4: Average Annual Temperature
--------------------------------------------------

INSERT INTO Metric (name, description, unit, higher_is_better) VALUES
    ('Fair Market Rent (1-Bedroom)',
     'Fair Market Rent for a standard 1-bedroom unit (40th percentile)',
     'USD',
     FALSE),
    ('Fair Market Rent (2-Bedroom)',
     'Fair Market Rent for a standard 2-bedroom unit (40th percentile)',
     'USD',
     FALSE),
    ('Average Commute Time',
     'Mean one-way commute time for workers age 16+',
     'minutes',
     FALSE),
    ('Average Annual Temperature',
     '1991–2020 average annual temperature from NOAA Climate Normals',
     'F',
     FALSE);

--------------------------------------------------
-- 4. Seed Industry table (same mapping you used)
-- 1: Software Engineering
-- 2: Data Science / Analytics
-- 3: Machine Learning / AI
--------------------------------------------------

INSERT INTO Industry (name, description) VALUES
    ('Software Engineering',      'Software development and engineering roles'),
    ('Data Science / Analytics',  'Data analysis, statistics, and analytics roles'),
    ('Machine Learning / AI',     'Machine learning engineering and AI-focused roles');

--------------------------------------------------
-- 5. Seed CityMetricValue from your FMR/commute/temp sheet
-- One row per (city_id, metric_id, year)
-- Using year = 2025 to match FY 2025 FMR data.
--------------------------------------------------

-- Cleveland (city_id = 1)
INSERT INTO CityMetricValue (city_id, metric_id, value, year) VALUES
    (1, 1,  995,    2025),
    (1, 2, 1208,    2025),
    (1, 3, 21.7,    2025),
    (1, 4, 52.4,    2025);

-- Pittsburgh (city_id = 2)
INSERT INTO CityMetricValue (city_id, metric_id, value, year) VALUES
    (2, 1, 1068,    2025),
    (2, 2, 1280,    2025),
    (2, 3, 24.4,    2025),
    (2, 4, 52.36,   2025);

-- Columbus (city_id = 3)
INSERT INTO CityMetricValue (city_id, metric_id, value, year) VALUES
    (3, 1, 1194,    2025),
    (3, 2, 1445,    2025),
    (3, 3, 22.2,    2025),
    (3, 4, 53.4,    2025);

-- Austin (city_id = 4)
INSERT INTO CityMetricValue (city_id, metric_id, value, year) VALUES
    (4, 1, 1650,    2025),
    (4, 2, 1949,    2025),
    (4, 3, 24.2,    2025),
    (4, 4, 68.4,    2025);

-- Seattle (city_id = 5)
INSERT INTO CityMetricValue (city_id, metric_id, value, year) VALUES
    (5, 1, 2293,    2025),
    (5, 2, 2671,    2025),
    (5, 3, 25.9,    2025),
    (5, 4, 53.7,    2025);

-- Denver (city_id = 6)
INSERT INTO CityMetricValue (city_id, metric_id, value, year) VALUES
    (6, 1, 1789,    2025),
    (6, 2, 2140,    2025),
    (6, 3, 24.9,    2025),
    (6, 4, 51.2,    2025);

-- Atlanta (city_id = 7)
INSERT INTO CityMetricValue (city_id, metric_id, value, year) VALUES
    (7, 1, 1653,    2025),
    (7, 2, 1830,    2025),
    (7, 3, 26.5,    2025),
    (7, 4, 63.6,    2025);

-- Minneapolis (city_id = 8)
INSERT INTO CityMetricValue (city_id, metric_id, value, year) VALUES
    (8, 1, 1381,    2025),
    (8, 2, 1685,    2025),
    (8, 3, 22.8,    2025),
    (8, 4, 46.9,    2025);

--------------------------------------------------
-- 6. Seed CityIndustryStats from your industry sheet
-- NOTE: Salaries are stored as whole dollars, converting e.g. 114K -> 114000.
-- DOUBLE-CHECK the Seattle ML/AI salary (marked with a comment).
--------------------------------------------------

INSERT INTO CityIndustryStats (city_id, industry_id, median_salary, num_job_openings, growth_outlook_score) VALUES
    -- Cleveland (city_id = 1)
    (1, 1, 114000, 6747, 7),
    (1, 2, 138000,  501, 10),
    (1, 3, 141000,  311, 8),

    -- Pittsburgh (city_id = 2)
    (2, 1, 107000, 7048, 7),
    (2, 2, 150000,  515, 10),
    (2, 3, 145000,  327, 7),

    -- Columbus (city_id = 3)
    (3, 1, 113000, 6981, 7),
    (3, 2, 140000,  511, 10),
    (3, 3, 142000,  327, 8),

    -- Austin (city_id = 4)
    (4, 1, 117000, 8480, 10),
    (4, 2, 148000,  536, 10),
    (4, 3, 158000,  369, 10),

    -- Seattle (city_id = 5)
    (5, 1, 163000, 8863, 8),
    (5, 2, 201000,  554, 10),
    (5, 3, 201000,  503, 10), 

    -- Denver (city_id = 6)
    (6, 1, 120000, 7348, 10),
    (6, 2, 148000,  497, 10),
    (6, 3, 156000,  352, 10),

    -- Atlanta (city_id = 7)
    (7, 1, 119000, 7828, 8),
    (7, 2, 191000,  543, 10),
    (7, 3, 201000,  369, 7),

    -- Minneapolis (city_id = 8)
    (8, 1, 117000, 6914, 8),
    (8, 2, 138000,  486, 10),
    (8, 3, 141000,  324, 7);

	--------------------------------------------------
-- SEED DATA: app_user
--------------------------------------------------

INSERT INTO app_user (first_name, last_name) VALUES
    ('Alex',   'Rivera'),
    ('Jordan', 'Kim'),
    ('Taylor', 'Patel');
-- user_id will be 1, 2, 3 in this order after RESTART IDENTITY

--------------------------------------------------
-- SEED DATA: PreferenceProfile
-- One profile per user, showing that profiles are per-user.
--------------------------------------------------

INSERT INTO PreferenceProfile (user_id, profile_name) VALUES
    (1, 'Low Rent'),
    (2, 'Short Commute'),
    (3, 'Warm Weather');
-- profile_id will be 1, 2, 3 in this order

--------------------------------------------------
-- SEED DATA: PreferenceWeight
-- Weights are in [0,1] and sum to 1 per profile (nice but not required).
--------------------------------------------------

INSERT INTO PreferenceWeight (profile_id, metric_id, weight) VALUES
    -- Profile 1: "Low Rent" (focus on cheaper housing)
    (1, 1, 0.50),   -- FMR 1BR
    (1, 2, 0.30),   -- FMR 2BR
    (1, 3, 0.15),   -- Average Commute Time
    (1, 4, 0.05),   -- Average Annual Temperature

    -- Profile 2: "Short Commute" (heavier weight on commute time)
    (2, 1, 0.20),
    (2, 2, 0.20),
    (2, 3, 0.50),
    (2, 4, 0.10),

    -- Profile 3: "Warm Weather" (prioritizes higher temperatures)
    (3, 1, 0.10),
    (3, 2, 0.10),
    (3, 3, 0.20),
    (3, 4, 0.60);

COMMIT;