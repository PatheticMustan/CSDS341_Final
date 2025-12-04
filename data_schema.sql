-- Enable foreign key constraints for SQLite3
PRAGMA foreign_keys = ON;

-- Drop in dependency order so we don't need CASCADE
DROP TABLE IF EXISTS PreferenceWeight;
DROP TABLE IF EXISTS CityIndustryStats;
DROP TABLE IF EXISTS CityMetricValue;
DROP TABLE IF EXISTS PreferenceProfile;
DROP TABLE IF EXISTS app_user;
DROP TABLE IF EXISTS Industry;
DROP TABLE IF EXISTS Metric;
DROP TABLE IF EXISTS City;

--------------------------------------------------
-- Core lookup tables
--------------------------------------------------

CREATE TABLE City (
    city_id  INTEGER PRIMARY KEY,
    name     TEXT NOT NULL,
    state    CHAR(2) NOT NULL,
    -- Prevent duplicate cities and enforce 2-letter state codes
    UNIQUE (name, state),
    CHECK (length(state) = 2)
);

CREATE TABLE Metric (
    metric_id         INTEGER PRIMARY KEY,
    name              TEXT NOT NULL UNIQUE,
    description       TEXT,         -- only optional field in the schema
    unit              TEXT NOT NULL,
    higher_is_better  INTEGER NOT NULL CHECK (higher_is_better IN (0, 1))
    -- SQLite3 doesn't have native BOOLEAN, using INTEGER with CHECK constraint
);

CREATE TABLE Industry (
    industry_id  INTEGER PRIMARY KEY,
    name         TEXT NOT NULL UNIQUE,
    description  TEXT NOT NULL
);

-- "User" is reserved in PostgreSQL, so use app_user instead
CREATE TABLE app_user (
    user_id     INTEGER PRIMARY KEY,
    first_name  TEXT NOT NULL,
    last_name   TEXT NOT NULL
);

--------------------------------------------------
-- User profiles
--------------------------------------------------

CREATE TABLE PreferenceProfile (
    profile_id    INTEGER PRIMARY KEY,
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

BEGIN;

--------------------------------------------------
-- 1. Clear all existing data
--------------------------------------------------

DELETE FROM PreferenceWeight;
DELETE FROM CityIndustryStats;
DELETE FROM CityMetricValue;
DELETE FROM PreferenceProfile;
DELETE FROM app_user;
DELETE FROM Industry;
DELETE FROM Metric;
DELETE FROM City;

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
     0),
    ('Fair Market Rent (2-Bedroom)',
     'Fair Market Rent for a standard 2-bedroom unit (40th percentile)',
     'USD',
     0),
    ('Average Commute Time',
     'Mean one-way commute time for workers age 16+',
     'minutes',
     0),
    ('Average Annual Temperature',
     '1991–2020 average annual temperature from NOAA Climate Normals',
     'F',
     0);

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

select * from PreferenceProfile;