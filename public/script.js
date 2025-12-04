const API_URL = '/api';

// Navigation
function showSection(sectionId) {
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });
    document.getElementById(sectionId).classList.add('active');

    if (sectionId === 'list-section') {
        loadCities();
    } else if (sectionId === 'rankings-section') {
        loadMetrics();
    } else if (sectionId === 'add-city-section') {
        loadMetrics();
    }
}

async function loadCities() {
    try {
        const response = await fetch(`${API_URL}/cities`);
        const cities = await response.json();
        const list = document.getElementById('city-list');
        list.innerHTML = '';
        cities.forEach(city => {
            const li = document.createElement('li');
            li.textContent = `${city.name}, ${city.state}`;
            li.onclick = () => loadCityDetails(city.city_id);
            list.appendChild(li);
        });
    } catch (error) {
        console.error('Error loading cities:', error);
    }
}

async function loadCityDetails(cityId) {
    try {
        const response = await fetch(`${API_URL}/cities/${cityId}`);
        const city = await response.json();

        const detailsDiv = document.getElementById('city-details');
        let metricsHtml = '<h3>Metrics</h3>';

        if (city.metrics && city.metrics.length > 0) {
            metricsHtml += city.metrics.map(m => `
                <div class="metric-item">
                    <span>${m.name} (${m.year})</span>
                    <strong>${m.value} ${m.unit}</strong>
                </div>
            `).join('');
        } else {
            metricsHtml += '<p>No metrics available.</p>';
        }

        detailsDiv.innerHTML = `
            <h2>${city.name}, ${city.state}</h2>
            <button class="primary" onclick="openEditForm(${city.city_id}, '${city.name}', '${city.state}')">Edit City</button>
            <div style="margin-top: 1rem;">
                ${metricsHtml}
            </div>
        `;

        showSection('details-section');
    } catch (error) {
        console.error('Error loading city details:', error);
    }
}

async function loadMetrics() {
    try {
        const response = await fetch(`${API_URL}/metrics`);
        const metrics = await response.json();
        const select = document.getElementById('metric-select');

        // Populate rankings dropdown
        if (select.options.length === 0) {
            metrics.forEach(metric => {
                const option = document.createElement('option');
                option.value = metric.metric_id;
                option.textContent = metric.name;
                select.appendChild(option);
            });
        }

        // Populate Add/Edit forms
        generateMetricInputs(metrics, 'add-city-metrics');
        generateMetricInputs(metrics, 'edit-city-metrics');

        // Load rankings for the first metric if available
        if (metrics.length > 0) {
            loadRankings();
        }
    } catch (error) {
        console.error('Error loading metrics:', error);
    }
}

function generateMetricInputs(metrics, containerId) {
    const container = document.getElementById(containerId);
    // Only generate if metric inputs don't already exist
    if (container.querySelectorAll('input[type="number"]').length > 0) return;

    // Filter to only show the 4 city-level metrics (metric_id 1-4)
    // 1: Fair Market Rent (1-Bedroom)
    // 2: Fair Market Rent (2-Bedroom)
    // 3: Average Commute Time
    // 4: Average Annual Temperature
    const cityMetrics = metrics.filter(m => m.metric_id >= 1 && m.metric_id <= 4);

    container.innerHTML = '<h3>City Metrics (2025)</h3>';
    cityMetrics.forEach(metric => {
        const div = document.createElement('div');
        div.className = 'form-group';
        div.innerHTML = `
            <label for="${containerId}-${metric.metric_id}">${metric.name} (${metric.unit})</label>
            <input type="number" step="any" id="${containerId}-${metric.metric_id}" name="metric-${metric.metric_id}" required>
        `;
        container.appendChild(div);
    });
}

// Load Rankings
async function loadRankings() {
    const metricId = document.getElementById('metric-select').value;
    if (!metricId) return;

    try {
        const response = await fetch(`${API_URL}/rankings/${metricId}`);
        const rankings = await response.json();
        const list = document.getElementById('rankings-list');
        list.innerHTML = '';

        rankings.forEach((item, index) => {
            const li = document.createElement('li');
            li.className = 'ranking-item';
            li.innerHTML = `
                <span>${index + 1}. ${item.name}, ${item.state}</span>
                <span class="rank-value">${item.value}</span>
            `;
            list.appendChild(li);
        });
    } catch (error) {
        console.error('Error loading rankings:', error);
    }
}

// Add City
async function handleAddCity(event) {
    event.preventDefault();
    const name = document.getElementById('city-name').value;
    const state = document.getElementById('city-state').value.toUpperCase();

    // Collect metrics
    const metrics = [];
    const inputs = document.querySelectorAll('#add-city-metrics input');
    inputs.forEach(input => {
        if (input.value !== '') {
            const metricId = input.id.split('-').pop();
            metrics.push({
                metric_id: parseInt(metricId),
                value: parseFloat(input.value)
            });
        }
    });

    try {
        const response = await fetch(`${API_URL}/cities`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, state, metrics })
        });

        if (response.ok) {
            alert('City added successfully!');
            document.getElementById('add-city-form').reset();
            // Clear metric inputs manually since reset() might not catch them if dynamically added? 
            // Actually reset() works on form elements.
            showSection('list-section');
        } else {
            const data = await response.json();
            alert(`Error: ${data.error}`);
        }
    } catch (error) {
        console.error('Error adding city:', error);
        alert('Failed to add city.');
    }
}

// Open Edit Form
async function openEditForm(id, name, state) {
    document.getElementById('edit-city-id').value = id;
    document.getElementById('edit-city-name').value = name;
    document.getElementById('edit-city-state').value = state;

    // Ensure metrics are loaded so inputs exist
    await loadMetrics();

    // Fetch current metrics for this city to populate inputs
    try {
        const response = await fetch(`${API_URL}/cities/${id}`);
        const city = await response.json();

        // Reset all inputs first
        document.querySelectorAll('#edit-city-metrics input').forEach(input => input.value = '');

        if (city.metrics) {
            city.metrics.forEach(m => {
                // We need metric_id. If app.js doesn't return it, we have a problem.
                // Assuming app.js is fixed to return metric_id.
                if (m.metric_id) {
                    const input = document.getElementById(`edit-city-metrics-${m.metric_id}`);
                    if (input) {
                        input.value = m.value;
                    }
                }
            });
        }
    } catch (e) {
        console.error(e);
    }

    showSection('edit-city-section');
}

// Edit City
async function handleEditCity(event) {
    event.preventDefault();
    const id = document.getElementById('edit-city-id').value;
    const name = document.getElementById('edit-city-name').value;
    const state = document.getElementById('edit-city-state').value.toUpperCase();

    // Collect metrics
    const metrics = [];
    const inputs = document.querySelectorAll('#edit-city-metrics input');
    inputs.forEach(input => {
        const metricId = input.id.split('-').pop();
        if (input.value !== '') {
            metrics.push({
                metric_id: parseInt(metricId),
                value: parseFloat(input.value)
            });
        }
    });

    try {
        const response = await fetch(`${API_URL}/cities/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, state, metrics })
        });

        if (response.ok) {
            alert('City updated successfully!');
            loadCityDetails(id); // Reload details to show changes
        } else {
            const data = await response.json();
            alert(`Error: ${data.error}`);
        }
    } catch (error) {
        console.error('Error updating city:', error);
        alert('Failed to update city.');
    }
}

// Initial load
document.addEventListener('DOMContentLoaded', () => {
    loadCities();
});

