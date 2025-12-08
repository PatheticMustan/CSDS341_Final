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

// Get specific city with metrics and industry stats
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

        const industryResult = await pool.query(`
            SELECT i.industry_id, i.name, cis.median_salary, cis.num_job_openings, cis.growth_outlook_score
            FROM CityIndustryStats cis
            JOIN Industry i ON cis.industry_id = i.industry_id
            WHERE cis.city_id = $1
        `, [cityId]);

        res.json({
            ...city,
            metrics: metricsResult.rows,
            industries: industryResult.rows
        });
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

        // Not exactly what the CLI does, but close enough

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

// Get all users
app.get('/api/users', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM app_user ORDER BY user_id');
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create a new user
app.post('/api/users', async (req, res) => {
    try {
        const { first_name, last_name } = req.body;
        const result = await pool.query(
            'INSERT INTO app_user (first_name, last_name) VALUES ($1, $2) RETURNING *',
            [first_name, last_name]
        );
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get profiles for a user with their weights
app.get('/api/users/:userId/profiles', async (req, res) => {
    try {
        const { userId } = req.params;
        const query = `
            SELECT pp.profile_id, pp.profile_name, pp.user_id,
                   json_agg(
                       json_build_object('metric_id', pw.metric_id, 'name', m.name, 'weight', pw.weight)
                   ) as weights
            FROM PreferenceProfile pp
            LEFT JOIN PreferenceWeight pw ON pp.profile_id = pw.profile_id
            LEFT JOIN Metric m ON pw.metric_id = m.metric_id
            WHERE pp.user_id = $1
            GROUP BY pp.profile_id
            ORDER BY pp.profile_id
        `;
        const result = await pool.query(query, [userId]);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update a profile
app.put('/api/profiles/:profileId', async (req, res) => {
    const client = await pool.connect();
    try {
        const { profileId } = req.params;
        const { profile_name, weights } = req.body;

        await client.query('BEGIN');

        // Update name
        await client.query(
            'UPDATE PreferenceProfile SET profile_name = $1 WHERE profile_id = $2',
            [profile_name, profileId]
        );

        // Update weights (Delete all and recreate)
        if (weights && Array.isArray(weights)) {
            await client.query('DELETE FROM PreferenceWeight WHERE profile_id = $1', [profileId]);

            const insertWeightQuery = 'INSERT INTO PreferenceWeight (profile_id, metric_id, weight) VALUES ($1, $2, $3)';
            for (const w of weights) {
                await client.query(insertWeightQuery, [profileId, w.metric_id, w.weight]);
            }
        }

        await client.query('COMMIT');
        res.json({ message: 'Profile updated' });
    } catch (error) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});

// Delete a profile
app.delete('/api/profiles/:profileId', async (req, res) => {
    const client = await pool.connect();
    try {
        const { profileId } = req.params;

        await client.query('BEGIN');

        // Manual Cascade Delete
        await client.query('DELETE FROM PreferenceWeight WHERE profile_id = $1', [profileId]);
        await client.query('DELETE FROM PreferenceProfile WHERE profile_id = $1', [profileId]);

        await client.query('COMMIT');
        res.json({ message: 'Profile deleted' });
    } catch (error) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});

// Create a profile with weights
app.post('/api/profiles', async (req, res) => {
    const client = await pool.connect();
    try {
        const { user_id, profile_name, weights } = req.body;
        // weights expected to be array of structure { metric_id, weight }

        await client.query('BEGIN');

        const profileResult = await client.query(
            'INSERT INTO PreferenceProfile (user_id, profile_name) VALUES ($1, $2) RETURNING profile_id',
            [user_id, profile_name]
        );
        const profileId = profileResult.rows[0].profile_id;

        if (weights && Array.isArray(weights)) {
            const insertWeightQuery = 'INSERT INTO PreferenceWeight (profile_id, metric_id, weight) VALUES ($1, $2, $3)';
            for (const w of weights) {
                await client.query(insertWeightQuery, [profileId, w.metric_id, w.weight]);
            }
        }

        await client.query('COMMIT');
        res.json({ profile_id: profileId, user_id, profile_name, weights });
    } catch (error) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});

// Get Weighted Rankings for a Profile
// Implements the logic from DatabaseCLI.java getUserRanking
app.get('/api/weighted-rankings/:profileId', async (req, res) => {
    try {
        const { profileId } = req.params;

        // SQL Query directly adapted from DatabaseCLI.java lines 258-27
        const query = `
            WITH q AS (
                SELECT c.name, c.state, 
                    rank() OVER (PARTITION BY m.metric_id ORDER BY cmv.value ASC) * pw.weight as weighted_rank
                FROM metric m, city c, citymetricvalue cmv, preferenceweight pw
                WHERE (cmv.city_id = c.city_id) 
                  AND (cmv.metric_id = m.metric_id)
                  AND (m.metric_id = pw.metric_id) 
                  AND (pw.profile_id = $1)
            )
            SELECT q.name, q.state, SUM(q.weighted_rank) as score
            FROM q
            GROUP BY q.name, q.state
            ORDER BY score ASC;
        `;

        const result = await pool.query(query, [profileId]);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => console.log(`Listening on PORT ${PORT}`));