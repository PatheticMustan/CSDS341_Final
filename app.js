import express from 'express';
import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 5000;
const app = express();

// PostgreSQL connection pool
// Defaults based on new_data_schema.sql
const pool = new Pool({
    user: 'demo_user',
    host: 'localhost',
    database: 'postgres',
    password: 'demo',
    port: 5432,
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Get all cities
app.get('/api/cities', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM City');
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get specific city with metrics
app.get('/api/cities/:id', async (req, res) => {
    try {
        const cityId = req.params.id;
        const cityResult = await pool.query('SELECT * FROM City WHERE city_id = $1', [cityId]);
        const city = cityResult.rows[0];

        if (!city) {
            return res.status(404).json({ error: 'City not found' });
        }

        const metricsResult = await pool.query(`
            SELECT m.metric_id, m.name, m.unit, cmv.value, cmv.year
            FROM CityMetricValue cmv
            JOIN Metric m ON cmv.metric_id = m.metric_id
            WHERE cmv.city_id = $1
        `, [cityId]);

        res.json({ ...city, metrics: metricsResult.rows });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get rankings for a metric
app.get('/api/rankings/:metric_id', async (req, res) => {
    try {
        const metricId = req.params.metric_id;

        const metricResult = await pool.query('SELECT higher_is_better FROM Metric WHERE metric_id = $1', [metricId]);
        const metric = metricResult.rows[0];

        if (!metric) {
            return res.status(404).json({ error: 'Metric not found' });
        }

        const order = metric.higher_is_better ? 'DESC' : 'ASC';

        // Note: We can't use a parameter for the sort order (ASC/DESC), so we interpolate it safely.
        // We validated 'metric' exists, so we know higher_is_better is boolean.
        const query = `
            SELECT c.name, c.state, cmv.value
            FROM CityMetricValue cmv
            JOIN City c ON cmv.city_id = c.city_id
            WHERE cmv.metric_id = $1
            ORDER BY cmv.value ${order}
        `;

        const rankingsResult = await pool.query(query, [metricId]);
        res.json(rankingsResult.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get all metrics (helper)
app.get('/api/metrics', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM Metric');
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Add a new city
app.post('/api/cities', async (req, res) => {
    const client = await pool.connect();
    try {
        const { name, state, metrics } = req.body;
        if (!name || !state || state.length !== 2) {
            return res.status(400).json({ error: 'Invalid input' });
        }

        await client.query('BEGIN');

        const insertCityText = 'INSERT INTO City (name, state) VALUES ($1, $2) RETURNING city_id';
        const insertCityResult = await client.query(insertCityText, [name, state]);
        const cityId = insertCityResult.rows[0].city_id;

        if (metrics && Array.isArray(metrics)) {
            const insertMetricText = 'INSERT INTO CityMetricValue (city_id, metric_id, value, year) VALUES ($1, $2, $3, $4)';
            for (const m of metrics) {
                // Defaulting to year 2025 to match seed data
                await client.query(insertMetricText, [cityId, m.metric_id, m.value, 2025]);
            }
        }

        await client.query('COMMIT');
        res.json({ city_id: cityId, name, state });
    } catch (error) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});

// Update city info
app.put('/api/cities/:id', async (req, res) => {
    const client = await pool.connect();
    try {
        const cityId = req.params.id;
        const { name, state, metrics } = req.body;

        if (!name || !state || state.length !== 2) {
            return res.status(400).json({ error: 'Invalid input' });
        }

        await client.query('BEGIN');

        const updateCityText = 'UPDATE City SET name = $1, state = $2 WHERE city_id = $3';
        const updateCityResult = await client.query(updateCityText, [name, state, cityId]);

        if (updateCityResult.rowCount === 0) {
            throw new Error('City not found');
        }

        if (metrics && Array.isArray(metrics)) {
            // Using INSERT ... ON CONFLICT DO UPDATE
            const upsertMetricText = `
                INSERT INTO CityMetricValue (city_id, metric_id, value, year) 
                VALUES ($1, $2, $3, 2025)
                ON CONFLICT (city_id, metric_id, year)
                DO UPDATE SET value = EXCLUDED.value
            `;
            for (const m of metrics) {
                await client.query(upsertMetricText, [cityId, m.metric_id, m.value]);
            }
        }

        await client.query('COMMIT');
        res.json({ message: 'City updated successfully' });
    } catch (error) {
        await client.query('ROLLBACK');
        if (error.message === 'City not found') {
            res.status(404).json({ error: 'City not found' });
        } else {
            res.status(500).json({ error: error.message });
        }
    } finally {
        client.release();
    }
});

app.listen(PORT, () => console.log(`Listening on PORT ${PORT}`));