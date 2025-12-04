import express from 'express';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 5000;
const app = express();
const db = new Database('data.db', { verbose: console.log });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Get all cities
app.get('/api/cities', (req, res) => {
    try {
        const stmt = db.prepare('SELECT * FROM City');
        const cities = stmt.all();
        res.json(cities);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get specific city with metrics
app.get('/api/cities/:id', (req, res) => {
    try {
        const cityId = req.params.id;
        const cityStmt = db.prepare('SELECT * FROM City WHERE city_id = ?');
        const city = cityStmt.get(cityId);

        if (!city) {
            return res.status(404).json({ error: 'City not found' });
        }

        const metricsStmt = db.prepare(`
            SELECT m.metric_id, m.name, m.unit, cmv.value, cmv.year
            FROM CityMetricValue cmv
            JOIN Metric m ON cmv.metric_id = m.metric_id
            WHERE cmv.city_id = ?
        `);
        const metrics = metricsStmt.all(cityId);

        res.json({ ...city, metrics });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get rankings for a metric
app.get('/api/rankings/:metric_id', (req, res) => {
    try {
        const metricId = req.params.metric_id;
        const stmt = db.prepare(`
            SELECT c.name, c.state, cmv.value
            FROM CityMetricValue cmv
            JOIN City c ON cmv.city_id = c.city_id
            WHERE cmv.metric_id = ?
            ORDER BY cmv.value ASC
        `);

        const metricStmt = db.prepare('SELECT higher_is_better FROM Metric WHERE metric_id = ?');
        const metric = metricStmt.get(metricId);

        if (!metric) {
            return res.status(404).json({ error: 'Metric not found' });
        }

        const order = metric.higher_is_better ? 'DESC' : 'ASC';

        const rankingStmt = db.prepare(`
            SELECT c.name, c.state, cmv.value
            FROM CityMetricValue cmv
            JOIN City c ON cmv.city_id = c.city_id
            WHERE cmv.metric_id = ?
            ORDER BY cmv.value ${order}
        `);

        const rankings = rankingStmt.all(metricId);
        res.json(rankings);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get all metrics (helper)
app.get('/api/metrics', (req, res) => {
    try {
        const stmt = db.prepare('SELECT * FROM Metric');
        const metrics = stmt.all();
        res.json(metrics);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Add a new city
app.post('/api/cities', (req, res) => {
    try {
        const { name, state, metrics } = req.body;
        if (!name || !state || state.length !== 2) {
            return res.status(400).json({ error: 'Invalid input' });
        }

        const insertCity = db.transaction(() => {
            const stmt = db.prepare('INSERT INTO City (name, state) VALUES (?, ?)');
            const info = stmt.run(name, state);
            const cityId = info.lastInsertRowid;

            if (metrics && Array.isArray(metrics)) {
                const metricStmt = db.prepare('INSERT INTO CityMetricValue (city_id, metric_id, value, year) VALUES (?, ?, ?, ?)');
                for (const m of metrics) {
                    // Defaulting to year 2025 to match seed data
                    metricStmt.run(cityId, m.metric_id, m.value, 2025);
                }
            }
            return cityId;
        });

        const cityId = insertCity();
        res.json({ city_id: cityId, name, state });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update city info
app.put('/api/cities/:id', (req, res) => {
    try {
        const cityId = req.params.id;
        const { name, state, metrics } = req.body;

        if (!name || !state || state.length !== 2) {
            return res.status(400).json({ error: 'Invalid input' });
        }

        const updateCity = db.transaction(() => {
            const stmt = db.prepare('UPDATE City SET name = ?, state = ? WHERE city_id = ?');
            const info = stmt.run(name, state, cityId);

            if (info.changes === 0) {
                throw new Error('City not found');
            }

            if (metrics && Array.isArray(metrics)) {
                // Using INSERT OR REPLACE to handle both new and existing metric values for this year
                const metricStmt = db.prepare(`
                    INSERT OR REPLACE INTO CityMetricValue (city_id, metric_id, value, year) 
                    VALUES (?, ?, ?, 2025)
                `);
                for (const m of metrics) {
                    metricStmt.run(cityId, m.metric_id, m.value);
                }
            }
        });

        updateCity();
        res.json({ message: 'City updated successfully' });
    } catch (error) {
        if (error.message === 'City not found') {
            res.status(404).json({ error: 'City not found' });
        } else {
            res.status(500).json({ error: error.message });
        }
    }
});

app.listen(PORT, () => console.log(`Listening on PORT ${PORT}`));