/**
 * Professional Ambulance Tracker Logic
 * Real-time road snapping, hidden route lines, and nearby units support.
 */

const state = {
    map: null,
    userMarker: null,
    ambulanceMarker: null,
    nearbyMarkers: [],
    routeGeometry: [],
    destination: [12.9716, 77.5946], // Bangalore Center
    startPos: [12.9850, 77.6100],
    isTracking: false
};

// --- Step 1: Professional SVG Icon ---
const AMBULANCE_SVG = (color = "#EF4444") => `
    <div class="amb-marker-wrap">
        <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
            <filter id="shadow" x="0" y="0" width="100%" height="100%">
                <feDropShadow dx="0" dy="4" stdDeviation="4" flood-opacity="0.3"/>
            </filter>
            <g filter="url(#shadow)">
                <rect x="12" y="16" width="40" height="32" rx="6" fill="white" stroke="#1E293B" stroke-width="2"/>
                <path d="M12 26H52V20C52 17.7909 50.2091 16 48 16H16C13.7909 16 12 17.7909 12 20V26Z" fill="#1E293B"/>
                <rect x="25" y="30" width="14" height="14" rx="2" fill="${color}"/>
                <path d="M28 37H36M32 33V41" stroke="white" stroke-width="3" stroke-linecap="round"/>
                <!-- Wheels -->
                <circle cx="20" cy="48" r="4" fill="#1E293B"/>
                <circle cx="44" cy="48" r="4" fill="#1E293B"/>
                <!-- Emergency Light -->
                <rect x="24" y="12" width="16" height="4" rx="2" fill="${color}">
                    <animate attributeName="opacity" values="1;0.3;1" dur="0.6s" repeatCount="indefinite" />
                </rect>
            </g>
        </svg>
    </div>
`;

function initMap() {
    state.map = L.map('map', {
        zoomControl: false,
        attributionControl: false
    }).setView(state.destination, 15);

    // Clean Map Tiles
    L.tileLayer('https://{s}.tile.osm.org/{z}/{x}/{y}.png', {
        maxZoom: 19
    }).addTo(state.map);

    // User Location
    const userIcon = L.divIcon({
        className: 'user-marker',
        html: '<div style="width:20px; height:20px; background:#3B82F6; border:4px solid white; border-radius:50%; box-shadow:0 0 15px rgba(59,130,246,0.6);"></div>',
        iconSize: [20, 20]
    });
    state.userMarker = L.marker(state.destination, { icon: userIcon }).addTo(state.map);

    // Initial Assigned Ambulance (Invisible until fetch)
    const ambIcon = L.divIcon({
        className: 'main-amb',
        html: AMBULANCE_SVG("#3B82F6"), // Blue for assigned
        iconSize: [64, 64],
        iconAnchor: [32, 32]
    });
    state.ambulanceMarker = L.marker(state.startPos, { icon: ambIcon, opacity: 0 }).addTo(state.map);

    log("Satellite link established. Locating nearby units...");
    spawnNearbyUnits();
    fetchRouteAndTrack();
}

// --- Step 2: Show Nearby Units ---
function spawnNearbyUnits() {
    const nearbyCoords = [
        [12.9750, 77.6000],
        [12.9680, 77.5850],
        [12.9800, 77.6150],
        [12.9600, 77.6000]
    ];

    nearbyCoords.forEach((coord, i) => {
        const icon = L.divIcon({
            className: 'near-amb',
            html: AMBULANCE_SVG("#94A3B8"), // Muted gray for others
            iconSize: [48, 48],
            iconAnchor: [24, 24]
        });
        const marker = L.marker(coord, { icon: icon }).addTo(state.map);
        marker.bindPopup(`<b>Unit #${100 + i}</b><br>Status: Available`);
        state.nearbyMarkers.push(marker);
    });
}

// --- Step 3: Fetch Route & Track along Roads ---
async function fetchRouteAndTrack() {
    const start = [state.startPos[1], state.startPos[0]];
    const end = [state.destination[1], state.destination[0]];

    try {
        const url = `https://router.project-osrm.org/route/v1/driving/${start[0]},${start[1]};${end[0]},${end[1]}?overview=full&geometries=geojson`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.routes && data.routes.length > 0) {
            state.routeGeometry = data.routes[0].geometry.coordinates.map(c => ({ lat: c[1], lng: c[0] }));

            // NOTE: We do NOT add the polyline to the map as requested.
            // But we use it for the navigation constraints.

            state.ambulanceMarker.setOpacity(1);
            log("Ambulance #204 assigned. Shortest road path calculated.");

            beginRoadConstrainedAnimation();
        }
    } catch (e) {
        log("Route fetch failed: " + e.message);
    }
}

// --- Step 4: Road-Constrained Animation ---
function beginRoadConstrainedAnimation() {
    let progress = 0;
    const TOTAL_STEPS = 400;

    const interval = setInterval(() => {
        progress += 0.0025;
        if (progress > 1) {
            clearInterval(interval);
            log("Ambulance has arrived at your location.");
            // Show arrival banner
            const banner = document.getElementById('arrival-banner');
            if (banner) banner.style.display = 'flex';
            return;
        }

        // Logic: Snap to the nearest point on the geometry for the given progress
        const pointIdx = Math.floor(progress * (state.routeGeometry.length - 1));
        const currentPt = state.routeGeometry[pointIdx];
        const nextPt = state.routeGeometry[pointIdx + 1] || currentPt;

        // Move marker strictly along the road geometry points
        state.ambulanceMarker.setLatLng([currentPt.lat, currentPt.lng]);

        // Dynamic Rotation
        const angle = Math.atan2(nextPt.lng - currentPt.lng, nextPt.lat - currentPt.lat) * (180 / Math.PI);
        const markerWrapper = state.ambulanceMarker.getElement().querySelector('.amb-marker-wrap');
        if (markerWrapper) {
            markerWrapper.style.transform = `rotate(${angle}deg)`;
        }
    }, 40);
}

// --- UI Handlers ---
window.openCaptainPortal = () => {
    const portal = document.getElementById('captain-portal');
    if (portal) portal.style.display = 'block';
};

window.closeCaptainPortal = () => {
    const portal = document.getElementById('captain-portal');
    if (portal) portal.style.display = 'none';
};

window.hideArrivalBanner = () => {
    const banner = document.getElementById('arrival-banner');
    if (banner) banner.style.display = 'none';
};

window.confirmPickup = () => {
    hideArrivalBanner();
    log("TRIP STARTED: Transporting to Hospital.");
    alert("Trip started! Navigating to closest medical facility.");
};

window.emergencyBypass = () => {
    hideArrivalBanner();
    log("EMERGENCY BYPASS: Ride Medically Verified.");
    alert("Emergency Override Activated! Critical Transport Engaged.");

    // Intensify lights for override
    const marker = state.ambulanceMarker.getElement();
    if (marker) {
        const light = marker.querySelector('.ambulance-light');
        if (light) light.style.animation = 'pulse 0.2s infinite';
    }
};

function log(msg) {
    const out = document.getElementById('log-output');
    if (out) out.innerText = `[DISPATCH] ${msg}`;
}

// Initialize
window.onload = initMap;
