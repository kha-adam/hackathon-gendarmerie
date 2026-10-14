// 1. Map Initialization
const map = L.map('map').setView([43.6045, 1.4440], 13);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

// 2. Application State
let targetAreaPoints = [];
let targetPolygon = null;
let markersGroup = L.layerGroup().addTo(map);
let isDrawingMode = false;

// 3. Map Click Event Listener
map.on('click', function(e) {
    if (!isDrawingMode) return; // Only add points if drawing mode is ON
    
    const lat = e.latlng.lat;
    const lng = e.latlng.lng;
    addPointToState(lat, lng);
});

// 4. Core Logic: Add a point
function addPointToState(lat, lng) {
    const newPoint = [lat, lng];
    targetAreaPoints.push(newPoint);

    // Add visual marker
    L.marker(newPoint).addTo(markersGroup);

    // Update the UI list
    const li = document.createElement('li');
    li.textContent = `[${lat.toFixed(4)}, ${lng.toFixed(4)}]`;
    document.getElementById('point-list').appendChild(li);

    // Redraw polygon
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

    // Shift input slightly for rapid manual entry
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
        mapDiv.classList.add('drawing-mode'); // Changes cursor to crosshair
    } else {
        btn.classList.remove('active');
        btn.innerText = "📍 Enable Map Click Drawing";
        mapDiv.classList.remove('drawing-mode'); // Changes cursor back
    }
    console.log("halloo")
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