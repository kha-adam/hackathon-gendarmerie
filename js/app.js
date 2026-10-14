// 1. Map Initialization
const map = L.map('map').setView([43.6045, 1.4440], 13);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

// Recalculer la taille de la carte pour éviter le bug d'affichage gris
setTimeout(() => {
    map.invalidateSize();
}, 200);

// 2. Application State
let targetAreaPoints = [];
let targetPolygon = null;
let markersGroup = L.layerGroup().addTo(map);
let isDrawingMode = false;

// 3. Map Click Event Listener
map.on('click', function(e) {
    if (!isDrawingMode) return;
    
    const lat = e.latlng.lat;
    const lng = e.latlng.lng;
    addPointToState(lat, lng);
});

// 4. Core Logic: Add a point
function addPointToState(lat, lng) {
    const newPoint = [lat, lng];
    targetAreaPoints.push(newPoint);

    L.marker(newPoint).addTo(markersGroup);

    const li = document.createElement('li');
    li.textContent = `[${lat.toFixed(4)}, ${lng.toFixed(4)}]`;
    document.getElementById('point-list').appendChild(li);

    updatePolygon();
}

// 5. Input Form Handler
function addPointFromInput() {
    const latInput = document.getElementById('lat');
    const lngInput = document.getElementById('lng');
    const lat = parseFloat(latInput.value);
    const lng = parseFloat(lngInput.value);

    if (isNaN(lat) || isNaN(lng)) {
        alert("Please enter valid coordinates.");
        return;
    }

    addPointToState(lat, lng);

    latInput.value = (lat + 0.005).toFixed(4);
    lngInput.value = (lng + 0.005).toFixed(4);
}

// 6. Polygon Rendering
function updatePolygon() {
    if (targetAreaPoints.length < 2) return;

    if (targetPolygon) {
        targetPolygon.setLatLngs(targetAreaPoints);
    } else {
        targetPolygon = L.polygon(targetAreaPoints, {
            color: '#28a745',
            fillColor: '#28a745',
            fillOpacity: 0.2
        }).addTo(map);
    }
}

// 7. Toggle Drawing Mode
function toggleDrawingMode() {
    isDrawingMode = !isDrawingMode;
    const btn = document.getElementById('draw-toggle-btn');
    const mapDiv = document.getElementById('map');
    
    if (isDrawingMode) {
        btn.classList.add('active');
        btn.innerText = "🛑 Stop Map Click Drawing";
        mapDiv.classList.add('drawing-mode');
    } else {
        btn.classList.remove('active');
        btn.innerText = "📍 Enable Map Click Drawing";
        mapDiv.classList.remove('drawing-mode');
    }
}

// 8. Reset
function clearPolygon() {
    targetAreaPoints = [];
    document.getElementById('point-list').innerHTML = '';
    markersGroup.clearLayers();
    
    if (targetPolygon) {
        map.removeLayer(targetPolygon);
        targetPolygon = null;
    }
}

// 9. Search Location & Zoom (Geocoding via Nominatim)
async function searchLocation() {
    const inputEl = document.getElementById('search-input');
    const statusEl = document.getElementById('search-status');
    const query = inputEl.value.trim();

    if (!query) {
        statusEl.textContent = "⚠️ Saisissez une ville ou une région.";
        statusEl.style.color = "#dc3545";
        return;
    }

    statusEl.textContent = "⏳ Recherche de la zone...";
    statusEl.style.color = "#007bff";

    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
        const data = await response.json();

        if (data && data.length > 0) {
            const result = data[0];

            if (result.boundingbox) {
                const south = parseFloat(result.boundingbox[0]);
                const north = parseFloat(result.boundingbox[1]);
                const west = parseFloat(result.boundingbox[2]);
                const east = parseFloat(result.boundingbox[3]);
                
                map.fitBounds([[south, west], [north, east]]);
            } else {
                const lat = parseFloat(result.lat);
                const lon = parseFloat(result.lon);
                map.flyTo([lat, lon], 12);
            }

            statusEl.textContent = `✅ Zoom sur : ${result.display_name.split(',')[0]}`;
            statusEl.style.color = "#28a745";
        } else {
            statusEl.textContent = "❌ Aucun résultat trouvé.";
            statusEl.style.color = "#dc3545";
        }
    } catch (error) {
        console.error("Erreur Geocoding :", error);
        statusEl.textContent = "❌ Erreur réseau lors de la recherche.";
        statusEl.style.color = "#dc3545";
    }
}