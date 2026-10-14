import * as L from 'leaflet';
import * as turf from '@turf/turf';
import { CoverageOptimizer } from './algo_remplissage.ts';

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
}

export class ZoneManager {
    private savedZones: CoverageZone[] = [];

    constructor() {
        // Au démarrage de l'application, on tente de lire le fichier JSON
        this.loadFromFile();
    }

    private async loadFromFile() {
        try {
            const response = await fetch('/data/zones.json');
            if (!response.ok) return;
            
            const data = await response.json();
            
            this.savedZones = data.features.map((feature: any) => {
                const coords = feature.geometry.coordinates[0];
                // Retirer le dernier point (fermeture) et repasser en [Lat, Lng]
                const points = coords.slice(0, -1).map((p: number[]) => [p[1], p[0]] as [number, number]);
                
                const zone = new CoverageZone(feature.properties.name, points);
                zone.id = feature.properties.id;
                return zone;
            });
            
            renderSavedZonesUI();
        } catch (error) {
            console.log("Info: Le fichier zones.json n'existe pas encore ou est vide.");
        }
    }

    public async saveZone(name: string, points: [number, number][]) {
        const newZone = new CoverageZone(name, points);
        this.savedZones.push(newZone);
        
        const geoJsonData = {
            type: "FeatureCollection",
            features: this.savedZones.map(z => z.toGeoJSON())
        };

        // Envoi au mini-backend Vite configuré dans vite.config.ts
        try {
            await fetch('/api/save-zones', {
                method: 'POST',
                body: JSON.stringify(geoJsonData, null, 2)
            });
        } catch (err) {
            console.error("Erreur lors de la sauvegarde du fichier JSON", err);
        }

        renderSavedZonesUI();
    }

    public getZones(): CoverageZone[] { return this.savedZones; }
    
    public getZoneById(id: string): CoverageZone | undefined {
        return this.savedZones.find(z => z.id === id);
    }

    public async clearAll() {
        this.savedZones = [];
        try {
            await fetch('/api/save-zones', {
                method: 'POST',
                body: JSON.stringify({ type: "FeatureCollection", features: [] })
            });
        } catch(err) {}
        renderSavedZonesUI();
    }
}

// ==========================================
// 2. INITIALISATION CARTE & ÉTAT GLOBAL
// ==========================================

const map = L.map('map').setView([43.6045, 1.4440], 13); // Toulouse
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

// Groupes de calques pour organiser les affichages
let markersGroup = L.layerGroup().addTo(map);
let solutionLayerGroup = L.layerGroup().addTo(map);

const zoneManager = new ZoneManager();
let currentPoints: [number, number][] = [];
let targetPolygon: L.Polygon | null = null;
let isDrawingMode = false;

// Hack pour corriger l'affichage des marqueurs par défaut avec Leaflet & Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});


// ==========================================
// 3. LOGIQUE DESSIN & ZONES
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
            color: '#0A1E3F',       // Bleu Marine
            fillColor: '#3A6EA5',   // Bleu Acier clair
            fillOpacity: 0.15
        }).addTo(map);
    }
}

function clearPolygon() {
    currentPoints = [];
    const list = document.getElementById('point-list');
    if (list) list.innerHTML = '';
    
    markersGroup.clearLayers();
    solutionLayerGroup.clearLayers();
    
    if (targetPolygon) {
        map.removeLayer(targetPolygon);
        targetPolygon = null;
    }
    
    const coverageText = document.getElementById('coverage-result');
    if (coverageText) coverageText.innerText = "0%";
}

function toggleDrawingMode() {
    isDrawingMode = !isDrawingMode;
    const btn = document.getElementById('draw-toggle-btn');
    const mapDiv = document.getElementById('map');
    
    if (isDrawingMode) {
        if (btn) { btn.classList.add('active'); btn.innerText = "Stop Map Click Drawing"; }
        if (mapDiv) mapDiv.classList.add('drawing-mode');
    } else {
        if (btn) { btn.classList.remove('active'); btn.innerText = "Enable Map Click Drawing"; }
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


// ==========================================
// 4. RECHERCHE NOMINATIM
// ==========================================

async function performSearch() {
    const input = document.getElementById('search-input') as HTMLInputElement;
    const status = document.getElementById('search-status');
    const query = input?.value.trim();

    if (!query) return;

    if (status) status.innerText = "Recherche en cours...";
    
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`);
        const data = await response.json();

        if (data && data.length > 0) {
            const lat = parseFloat(data[0].lat);
            const lon = parseFloat(data[0].lon);
            
            map.setView([lat, lon], 12);
            if (status) status.innerText = `Trouvé : ${data[0].display_name}`;
        } else {
            if (status) status.innerText = "Aucun résultat trouvé.";
        }
    } catch (err) {
        if (status) status.innerText = "Erreur de connexion.";
    }
}


// ==========================================
// 5. ALGORITHME D'OPTIMISATION
// ==========================================

function runOptimization() {
    if (currentPoints.length < 3) {
        alert("Veuillez d'abord tracer une zone fermée (au moins 3 points).");
        return;
    }

    // 1. Récupération des paramètres
    const nbT1 = parseInt((document.getElementById('slider-t1') as HTMLInputElement).value) || 0;
    const nbT2 = parseInt((document.getElementById('slider-t2') as HTMLInputElement).value) || 0;

    // 2. Conversion en polygone Turf
    const geoJsonCoords = currentPoints.map(p => [p[1], p[0]]);
    geoJsonCoords.push([...geoJsonCoords[0]]);
    const turfPolygon = turf.polygon([geoJsonCoords]);

    // 3. Création de la grille de points (Attention: CellSize trop petit = Crash)
    const bbox = turf.bbox(turfPolygon);
    const gridCellSizeKm = 0.5; // Résolution de la grille en km
    const pointGrid = turf.pointGrid(bbox, gridCellSizeKm, { mask: turfPolygon });

    if (pointGrid.features.length === 0) {
        alert("La zone est trop petite pour la résolution de la grille (2km).");
        return;
    }

    // 4. Initialisation de l'optimiseur
    const radiusT1 = 1; // km
    const radiusT2 = 2; // km

    const optimizer = new CoverageOptimizer(
        turfPolygon,
        pointGrid.features,
        { radius: radiusT1, area: 0 },
        { radius: radiusT2, area: 0 },
        [nbT1, nbT2]
    );
    console.log(nbT1)
    console.log(nbT2)
    const coverageText = document.getElementById('coverage-result');
    if (coverageText) coverageText.innerText = "Calcul en cours...";
    
    // Délai pour laisser le DOM s'actualiser avant le calcul intensif
    setTimeout(() => {
        const solution = optimizer.optimize();
        renderSolution(solution);
    }, 50);
}

function renderSolution(solution: any) {
    solutionLayerGroup.clearLayers();

    solution.centers.forEach((centerFeature: any, index: number) => {
        const radiusKm = solution.radii[index];
        const [lng, lat] = centerFeature.geometry.coordinates;
        
        const isLevel1 = radiusKm < 3;
        // Niveau 1 = Bleu clair, Niveau 2 = Bleu très foncé
        const color = isLevel1 ? '#3A6EA5' : '#0A1E3F';

        // Centre (Téléopérateur)
        L.circleMarker([lat, lng], {
            radius: 4,
            color: 'white',      // Bordure blanche pour le contraste
            fillColor: color,
            fillOpacity: 1,
            weight: 2
        }).addTo(solutionLayerGroup);

        // Zone de couverture du drone
        L.circle([lat, lng], {
            radius: radiusKm * 1000, 
            color: color,
            fillColor: color,
            fillOpacity: 0.15,   // Très subtil
            weight: 1
        }).addTo(solutionLayerGroup);
    });

    const coverageText = document.getElementById('coverage-result');
    if (coverageText) coverageText.innerText = `${solution.coveragePercentage.toFixed(2)}%`;
}


// ==========================================
// 6. ATTACHEMENT DES ÉVÉNEMENTS
// ==========================================

map.on('click', (e: L.LeafletMouseEvent) => {
    if (isDrawingMode) addPointToState(e.latlng.lat, e.latlng.lng);
});

document.getElementById('draw-toggle-btn')?.addEventListener('click', toggleDrawingMode);

document.getElementById('btn-add-point')?.addEventListener('click', () => {
    const latInput = document.getElementById('lat') as HTMLInputElement;
    const lngInput = document.getElementById('lng') as HTMLInputElement;
    const lat = parseFloat(latInput.value);
    const lng = parseFloat(lngInput.value);

    if (!isNaN(lat) && !isNaN(lng)) {
        addPointToState(lat, lng);
        latInput.value = (lat + 0.005).toFixed(4);
        lngInput.value = (lng + 0.005).toFixed(4);
    }
});

document.getElementById('btn-clear-area')?.addEventListener('click', clearPolygon);

document.getElementById('btn-save-zone')?.addEventListener('click', () => {
    if (currentPoints.length < 3) {
        alert("Un polygone a besoin d'au moins 3 points.");
        return;
    }
    zoneManager.saveZone(`Zone ${new Date().toLocaleTimeString()}`, currentPoints);
    clearPolygon();
});

document.getElementById('btn-clear-zones')?.addEventListener('click', () => {
    if(confirm("Voulez-vous vraiment supprimer toutes les zones sauvegardées ?")) {
        zoneManager.clearAll();
    }
});

document.getElementById('btn-search')?.addEventListener('click', performSearch);
document.getElementById('search-input')?.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter') performSearch();
});

document.getElementById('btn-optimize')?.addEventListener('click', runOptimization);