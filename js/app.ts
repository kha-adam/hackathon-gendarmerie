import * as L from 'leaflet';

// ==========================================
// 1. CLASSES DU MODÈLE (GeoJSON & Stockage)
// ==========================================

export class CoverageZone {
    public id: string;
    public name: string;
    public points: [number, number][]; // [Lat, Lng]
    public createdAt: number;

    constructor(name: string, points: [number, number][] = []) {
        this.id = crypto.randomUUID();
        this.name = name;
        this.points = points;
        this.createdAt = Date.now();
    }

    public toGeoJSON() {
        if (this.points.length < 3) throw new Error("La zone doit avoir au moins 3 points.");
        
        // Leaflet [Lat, Lng] -> GeoJSON [Lng, Lat]
        const geoJsonCoords = this.points.map(p => [p[1], p[0]]);
        geoJsonCoords.push([...geoJsonCoords[0]]); // GeoJSON nécessite une boucle fermée

        return {
            type: "Feature",
            properties: { id: this.id, name: this.name, createdAt: this.createdAt },
            geometry: {
                type: "Polygon",
                coordinates: [geoJsonCoords]
            }
        };
    }

    public static fromJSON(data: any): CoverageZone {
        const zone = new CoverageZone(data.name, data.points);
        zone.id = data.id;
        zone.createdAt = data.createdAt;
        return zone;
    }
}

export class ZoneManager {
    private savedZones: CoverageZone[] = [];

    constructor() {
        // Au démarrage de l'application, on lit le fichier JSON
        this.loadFromFile();
    }

    private async loadFromFile() {
        try {
            // 1. Demande le fichier JSON interne
            const response = await fetch('/data/zones.json');
            const data = await response.json();
            
            // 2. Convertit le GeoJSON en objets CoverageZone utilisables par la carte
            this.savedZones = data.features.map((feature: any) => {
                const coords = feature.geometry.coordinates[0];
                // Retirer le dernier point (fermeture GeoJSON) et inverser [Lng, Lat] vers [Lat, Lng]
                const points = coords.slice(0, -1).map((p: number[]) => [p[1], p[0]] as [number, number]);
                
                const zone = new CoverageZone(feature.properties.name, points);
                zone.id = feature.properties.id;
                return zone;
            });
            
            // 3. Affiche la liste des zones sur le menu de gauche
            renderSavedZonesUI();
            
        } catch (error) {
            console.log("Aucune zone existante ou erreur de lecture.");
        }
    }

    public async saveZone(name: string, points: [number, number][]) {
        // 1. Ajouter la nouvelle zone en mémoire
        const newZone = new CoverageZone(name, points);
        this.savedZones.push(newZone);
        
        // 2. Préparer tout le fichier GeoJSON
        const geoJsonData = {
            type: "FeatureCollection",
            features: this.savedZones.map(z => z.toGeoJSON())
        };

        // 3. Envoyer silencieusement au mini-backend Vite pour écrire sur le disque
        await fetch('/api/save-zones', {
            method: 'POST',
            body: JSON.stringify(geoJsonData, null, 2)
        });

        // 4. Mettre à jour l'interface
        renderSavedZonesUI();
    }

    public getZones(): CoverageZone[] { return this.savedZones; }
    
    public getZoneById(id: string): CoverageZone | undefined {
        return this.savedZones.find(z => z.id === id);
    }

    public async clearAll() {
        this.savedZones = [];
        // On écrase le fichier avec un JSON vide
        await fetch('/api/save-zones', {
            method: 'POST',
            body: JSON.stringify({ type: "FeatureCollection", features: [] })
        });
        renderSavedZonesUI();
    }
}

// ==========================================
// 2. INITIALISATION CARTE & ÉTAT GLOBAL
// ==========================================

const map = L.map('map').setView([43.6045, 1.4440], 13); // Centré sur Toulouse
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

const zoneManager = new ZoneManager();
let currentPoints: [number, number][] = [];
let targetPolygon: L.Polygon | null = null;
let markersGroup = L.layerGroup().addTo(map);
let isDrawingMode = false;

// Correction d'un bug d'icônes par défaut avec Leaflet & Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});


// ==========================================
// 3. LOGIQUE MÉTIER & UI
// ==========================================

function addPointToState(lat: number, lng: number) {
    const newPoint: [number, number] = [lat, lng];
    currentPoints.push(newPoint);

    L.marker(newPoint).addTo(markersGroup);

    const li = document.createElement('li');
    li.textContent = `[${lat.toFixed(4)}, ${lng.toFixed(4)}]`;
    document.getElementById('point-list')?.appendChild(li);

    updatePolygon();
}

function updatePolygon() {
    if (currentPoints.length < 2) return;

    if (targetPolygon) {
        targetPolygon.setLatLngs(currentPoints);
    } else {
        targetPolygon = L.polygon(currentPoints, {
            color: '#28a745',
            fillColor: '#28a745',
            fillOpacity: 0.2
        }).addTo(map);
    }
}

function clearPolygon() {
    currentPoints = [];
    const list = document.getElementById('point-list');
    if (list) list.innerHTML = '';
    
    markersGroup.clearLayers();
    if (targetPolygon) {
        map.removeLayer(targetPolygon);
        targetPolygon = null;
    }
}

function toggleDrawingMode() {
    isDrawingMode = !isDrawingMode;
    const btn = document.getElementById('draw-toggle-btn');
    const mapDiv = document.getElementById('map');
    
    if (isDrawingMode) {
        if (btn) { btn.classList.add('active'); btn.innerText = "🛑 Stop Map Click Drawing"; }
        if (mapDiv) mapDiv.classList.add('drawing-mode');
    } else {
        if (btn) { btn.classList.remove('active'); btn.innerText = "📍 Enable Map Click Drawing"; }
        if (mapDiv) mapDiv.classList.remove('drawing-mode');
    }
}

function renderSavedZonesUI() {
    const list = document.getElementById('saved-zones-list');
    if (!list) return;
    
    list.innerHTML = '';
    const zones = zoneManager.getZones();

    zones.forEach(zone => {
        const li = document.createElement('li');
        li.style.marginBottom = "8px";
        
        const loadBtn = document.createElement('button');
        loadBtn.innerText = `Charger ${zone.name}`;
        loadBtn.onclick = () => loadZoneToMap(zone.id);
        
        li.appendChild(loadBtn);
        list.appendChild(li);
    });
}

function loadZoneToMap(zoneId: string) {
    const zone = zoneManager.getZoneById(zoneId);
    if (!zone) return;

    clearPolygon();
    zone.points.forEach(p => addPointToState(p[0], p[1]));
    if (targetPolygon) {
        map.fitBounds(targetPolygon.getBounds(), { padding: [50, 50] });
    }
}

async function performSearch() {
    const input = document.getElementById('search-input') as HTMLInputElement;
    const status = document.getElementById('search-status');
    const query = input?.value.trim();

    if (!query) return;

    if (status) status.innerText = "Recherche en cours...";
    
    try {
        // API Nominatim OpenStreetMap (Gratuite et sans clé requise)
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`);
        const data = await response.json();

        if (data && data.length > 0) {
            const lat = parseFloat(data[0].lat);
            const lon = parseFloat(data[0].lon);
            
            map.setView([lat, lon], 12); // Déplace la carte sur le résultat
            if (status) status.innerText = `Trouvé : ${data[0].display_name}`;
        } else {
            if (status) status.innerText = "Aucun résultat trouvé.";
        }
    } catch (err) {
        if (status) status.innerText = "Erreur de connexion.";
    }
}


// ==========================================
// 4. LIAISON DES ÉVÉNEMENTS DU DOM
// ==========================================

// Afficher la liste initiale
renderSavedZonesUI();

// Clic sur la carte
map.on('click', (e: L.LeafletMouseEvent) => {
    if (isDrawingMode) addPointToState(e.latlng.lat, e.latlng.lng);
});

// Bouton Activer/Désactiver le mode dessin
document.getElementById('draw-toggle-btn')?.addEventListener('click', toggleDrawingMode);

// Bouton Ajouter Point (Manuel)
document.getElementById('btn-add-point')?.addEventListener('click', () => {
    const latInput = document.getElementById('lat') as HTMLInputElement;
    const lngInput = document.getElementById('lng') as HTMLInputElement;
    const lat = parseFloat(latInput.value);
    const lng = parseFloat(lngInput.value);

    if (isNaN(lat) || isNaN(lng)) {
        alert("Veuillez entrer des coordonnées valides.");
        return;
    }
    
    addPointToState(lat, lng);
    latInput.value = (lat + 0.005).toFixed(4);
    lngInput.value = (lng + 0.005).toFixed(4);
});

// Bouton Effacer la zone courante
document.getElementById('btn-clear-area')?.addEventListener('click', clearPolygon);

// Bouton Sauvegarder la zone
document.getElementById('btn-save-zone')?.addEventListener('click', () => {
    if (currentPoints.length < 3) {
        alert("Un polygone a besoin d'au moins 3 points.");
        return;
    }
    zoneManager.saveZone(`Zone ${new Date().toLocaleTimeString()}`, currentPoints);
    clearPolygon();
    renderSavedZonesUI();
});

// Bouton Effacer toutes les zones
document.getElementById('btn-clear-zones')?.addEventListener('click', () => {
    if(confirm("Voulez-vous vraiment supprimer toutes les zones sauvegardées ?")) {
        zoneManager.clearAll();
        renderSavedZonesUI();
    }
});

// Recherche de lieu
document.getElementById('btn-search')?.addEventListener('click', performSearch);
document.getElementById('search-input')?.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter') performSearch();
});