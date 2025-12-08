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
    } else if (sectionId === 'users-section') {
        loadUsers();
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

        // Append Industries if available
        if (city.industries && city.industries.length > 0) {
            let industryHtml = '<h3>Industry Statistics</h3><ul>';
            city.industries.forEach(ind => {
                industryHtml += `
                    <li style="margin-bottom: 0.5rem;">
                        <strong>${ind.name}</strong><br>
                        Median Salary: $${Number(ind.median_salary).toLocaleString()}<br>
                        Job Openings: ${Number(ind.num_job_openings).toLocaleString()}<br>
                        Growth Score: ${ind.growth_outlook_score}/10
                    </li>
                `;
            });
            industryHtml += '</ul>';
            detailsDiv.innerHTML += `<div style="margin-top: 1rem;">${industryHtml}</div>`;
        }

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

    // Since our seed data only has the 4 city-level metrics, just limit to those 4 for now
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

// --- User & Profile Functions ---

let currentSelectedUserId = null;

async function loadUsers() {
    try {
        const response = await fetch(`${API_URL}/users`);
        const users = await response.json();
        const list = document.getElementById('users-list');
        list.innerHTML = '';

        if (users.length === 0) {
            list.innerHTML = '<p>No users found.</p>';
        }

        users.forEach(user => {
            const div = document.createElement('div');
            div.className = 'user-card';
            div.id = `user-card-${user.user_id}`;
            div.innerHTML = `<span><strong>${user.first_name} ${user.last_name}</strong></span> <span style="color:#777; font-size:0.8rem;">ID: ${user.user_id}</span>`;
            div.onclick = () => selectUser(user.user_id, user.first_name, user.last_name);
            list.appendChild(div);
        });

        // unique ID handling for safety
        if (!currentSelectedUserId) {
            document.getElementById('profiles-container').style.display = 'none';
        }
    } catch (error) {
        console.error('Error loading users:', error);
    }
}

async function selectUser(userId, fname, lname) {
    currentSelectedUserId = userId;
    document.getElementById('selected-user-name').textContent = `Profiles for ${fname} ${lname}`;
    document.getElementById('profiles-container').style.display = 'block';
    document.getElementById('profile-user-id').value = userId;

    // Highlight selected using class
    const list = document.getElementById('users-list');
    Array.from(list.children).forEach(child => {
        if (child.id === `user-card-${userId}`) {
            child.classList.add('selected');
        } else {
            child.classList.remove('selected');
        }
    });

    loadProfiles(userId);
}

async function handleAddUser(event) {
    event.preventDefault();
    const first_name = document.getElementById('user-first-name').value;
    const last_name = document.getElementById('user-last-name').value;

    try {
        const response = await fetch(`${API_URL}/users`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ first_name, last_name })
        });

        if (response.ok) {
            alert('User created!');
            document.getElementById('add-user-form').reset();
            showSection('users-section'); // Reloads users
        } else {
            alert('Error creating user');
        }
    } catch (error) {
        console.error(error);
    }
}

async function loadProfiles(userId) {
    const list = document.getElementById('profiles-list');
    list.innerHTML = 'Loading...';
    try {
        const response = await fetch(`${API_URL}/users/${userId}/profiles`);
        const profiles = await response.json();
        list.innerHTML = '';

        if (profiles.length === 0) {
            list.innerHTML = '<p>No profiles found.</p>';
            return;
        }

        profiles.forEach(profile => {
            const li = document.createElement('li');
            li.className = 'profile-card';

            // Format weights display
            let weightsHtml = '';
            if (profile.weights && profile.weights.length) {
                const weightStr = profile.weights
                    .filter(w => w.weight !== null && w.name)
                    .map(w => `<span style="display:inline-block; margin-right:10px; font-size:0.9rem; color:#555;">${w.name}: <strong>${w.weight}</strong></span>`)
                    .join('');
                weightsHtml = `<div class="profile-weights">${weightStr}</div>`;
            }

            const weightsSafe = encodeURIComponent(JSON.stringify(profile.weights || []));

            li.innerHTML = `
                <div class="profile-header">
                    <span class="profile-title">${profile.profile_name}</span>
                </div>
                ${weightsHtml}
                <div class="profile-actions">
                    <button onclick="viewWeightedRankings(${profile.profile_id}, '${profile.profile_name}')" class="primary btn-sm">View Recommendations</button>
                    <button onclick="editProfile(${profile.profile_id}, '${profile.profile_name}', '${weightsSafe}')" class="warning btn-sm">Edit</button>
                    <button onclick="deleteProfile(${profile.profile_id})" class="danger btn-sm">Delete</button>
                </div>
            `;
            list.appendChild(li);
        });
    } catch (error) {
        list.textContent = 'Error loading profiles.';
        console.error(error);
    }
}

// Show Add Profile Form
async function showAddProfileForm() {
    if (!currentSelectedUserId) {
        alert('Please select a user first');
        return;
    }

    // Reset form state for "Add"
    document.getElementById('profile-id').value = '';
    document.getElementById('profile-name').value = '';

    const formTitle = document.getElementById('form-title');
    if (formTitle) formTitle.textContent = 'Create Preference Profile';

    const saveBtn = document.getElementById('save-profile-btn');
    if (saveBtn) saveBtn.textContent = 'Save Profile';

    await generateWeightInputs();
    showSection('add-profile-section');
}

// Helper to generate inputs
async function generateWeightInputs(existingWeights = []) {
    try {
        const response = await fetch(`${API_URL}/metrics`);
        const metrics = await response.json();
        const cityMetrics = metrics.filter(m => m.metric_id >= 1 && m.metric_id <= 4);

        const container = document.getElementById('profile-weights');
        container.innerHTML = '';

        cityMetrics.forEach(m => {
            // Find existing weight if editing
            let val = 0.25;
            if (existingWeights.length > 0) {
                const found = existingWeights.find(w => w.metric_id === m.metric_id);
                if (found) val = found.weight;
            }

            const div = document.createElement('div');
            div.className = 'form-group';
            div.innerHTML = `
                <label for="weight-${m.metric_id}">${m.name} Weight</label>
                <input type="number" step="0.01" min="0" max="1" id="weight-${m.metric_id}" required value="${val}">
            `;
            container.appendChild(div);
        });
    } catch (error) {
        console.error('Error fetching metrics for profile form', error);
    }
}

// Edit Profile Setup
async function editProfile(profileId, profileName, weightsEncoded) {
    const weights = JSON.parse(decodeURIComponent(weightsEncoded));

    document.getElementById('profile-id').value = profileId;
    document.getElementById('profile-name').value = profileName;

    const formTitle = document.getElementById('form-title');
    if (formTitle) formTitle.textContent = 'Edit Preference Profile';

    const saveBtn = document.getElementById('save-profile-btn');
    if (saveBtn) saveBtn.textContent = 'Update Profile';

    await generateWeightInputs(weights);
    showSection('add-profile-section');
}

// Delete Profile
async function deleteProfile(profileId) {
    if (!confirm('Are you sure you want to delete this profile?')) return;

    try {
        const response = await fetch(`${API_URL}/profiles/${profileId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            loadProfiles(currentSelectedUserId);
        } else {
            alert('Failed to delete profile');
        }
    } catch (error) {
        console.error(error);
        alert('Error deleting profile');
    }
}

// Add/Edit Profile Handler
async function handleAddProfile(event) {
    event.preventDefault();
    const userId = document.getElementById('profile-user-id').value;
    const profileId = document.getElementById('profile-id').value; // if present, it's an edit
    const profileName = document.getElementById('profile-name').value;

    // Collect weights
    const weights = [];
    [1, 2, 3, 4].forEach(id => {
        const el = document.getElementById(`weight-${id}`);
        if (el) {
            weights.push({ metric_id: id, weight: parseFloat(el.value) });
        }
    });

    try {
        let response;
        if (profileId) {
            // Update
            response = await fetch(`${API_URL}/profiles/${profileId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ profile_name: profileName, weights })
            });
        } else {
            // Create
            response = await fetch(`${API_URL}/profiles`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userId, profile_name: profileName, weights })
            });
        }

        if (response.ok) {
            alert(profileId ? 'Profile updated!' : 'Profile added!');
            document.getElementById('add-profile-form').reset();
            showSection('users-section');
            loadProfiles(userId);
        } else {
            alert('Error saving profile');
        }
    } catch (error) {
        console.error(error);
    }
}

// View Weighted Rankings
async function viewWeightedRankings(profileId, profileName) {
    document.getElementById('weighted-rankings-title').textContent = `Recommended Cities for "${profileName}"`;
    const list = document.getElementById('weighted-rankings-list');
    list.innerHTML = 'Loading...';

    showSection('weighted-rankings-section');

    try {
        const response = await fetch(`${API_URL}/weighted-rankings/${profileId}`);
        const rankings = await response.json();

        list.innerHTML = '';
        if (rankings.length === 0) {
            list.innerHTML = '<p>No data found.</p>';
            return;
        }

        rankings.forEach((item, index) => {
            const li = document.createElement('li');
            li.className = 'ranking-item';
            // Rank 1 is best, so index + 1
            li.innerHTML = `
                <span style="font-size: 1.2rem;">#${index + 1} <strong>${item.name}, ${item.state}</strong></span>
                <span class="rank-value">Score: ${parseFloat(item.score).toFixed(2)} (Lower is better)</span>
            `;
            list.appendChild(li);
        });
    } catch (error) {
        console.error(error);
        list.innerHTML = 'Error loading rankings.';
    }
}

// Initial load
document.addEventListener('DOMContentLoaded', () => {
    loadCities();
});


