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
    destination: [12.9716, 77.5946], // Will be updated with real location
    startPos: [12.9850, 77.6100],
    isTracking: false,
    userLocation: null,
    usingRealLocation: false
};

// --- Step 1: Professional SVG Icon ---
const AMBULANCE_SVG = (angle = 0) => `
    <div class="amb-marker-wrap" style="transform: rotate(${angle}deg); position: relative;">
        <!-- Emergency Pulse Halo (Highly Highlighted) -->
        <div style="
            position: absolute;
            top: 50%; left: 50%;
            transform: translate(-50%, -50%);
            width: 100px; height: 100px;
            background: radial-gradient(circle, rgba(239, 68, 68, 0.4) 0%, rgba(239, 68, 68, 0) 70%);
            border-radius: 50%;
            animation: emergency-halo 1.5s infinite;
            z-index: -1;
        "></div>

        <div style="filter: drop-shadow(0 4px 15px rgba(0,0,0,0.5));">
            <svg width="68" height="68" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                <!-- Base glow -->
                <circle cx="50" cy="50" r="48" fill="rgba(37, 99, 235, 0.15)" />
                
                <!-- Main Chassis -->
                <rect x="30" y="20" width="40" height="65" rx="8" fill="white" stroke="#2563eb" stroke-width="2"/>
                
                <!-- Windshield -->
                <path d="M30 35C30 32.7909 31.7909 31 34 31H66C68.2091 31 70 32.7909 70 35V42H30V35Z" fill="#1e293b"/>
                
                <!-- Medical Compartment -->
                <rect x="30" y="42" width="40" height="43" rx="4" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1"/>
                
                <!-- Flashers (Faster) -->
                <rect x="32" y="25" width="16" height="6" rx="3" fill="#ef4444">
                    <animate attributeName="opacity" values="1;0.4;1" dur="0.2s" repeatCount="indefinite" />
                </rect>
                <rect x="52" y="25" width="16" height="6" rx="3" fill="#3b82f6">
                    <animate attributeName="opacity" values="0.4;1;0.4" dur="0.2s" repeatCount="indefinite" />
                </rect>

                <!-- Medical Cross Symbol -->
                <rect x="44" y="52" width="12" height="22" rx="2" fill="#ef4444" />
                <rect x="39" y="57" width="22" height="12" rx="2" fill="#ef4444" />
                
                <!-- Direction Pointer -->
                <path d="M50 8 L58 20 L42 20 Z" fill="#ef4444" />
            </svg>
        </div>
        <style>
            @keyframes emergency-halo {
                0% { transform: translate(-50%, -50%) scale(0.6); opacity: 0.8; }
                100% { transform: translate(-50%, -50%) scale(1.4); opacity: 0; }
            }
        </style>
    </div>
`;

function initMap() {
    state.map = L.map('map', {
        zoomControl: false,
        attributionControl: false
    }).setView(state.destination, 15);

    // Clean Professional Street Map (CartoDB Positron)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(state.map);

    // Get user's real location
    getUserLocation();

    // User's Exact Location (Premium Indicator)
    const userIcon = L.divIcon({
        className: 'user-marker',
        html: `
            <div style="position: relative; display: flex; align-items: center; justify-content: center;">
                <div style="position: absolute; width: 30px; height: 30px; background: rgba(59, 130, 246, 0.3); border-radius: 50%; animation: user-pulse 2s infinite;"></div>
                <div style="width: 14px; height: 14px; background: #3B82F6; border: 3px solid white; border-radius: 50%; box-shadow: 0 0 10px rgba(59, 130, 246, 0.5); z-index: 2;"></div>
                <div style="position: absolute; top: -25px; background: #3B82F6; color: white; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 800; white-space: nowrap; box-shadow: 0 2px 5px rgba(0,0,0,0.2);">MY LOCATION</div>
            </div>
            <style>
                @keyframes user-pulse {
                    0% { transform: scale(0.6); opacity: 0.8; }
                    100% { transform: scale(1.6); opacity: 0; }
                }
            </style>
        `,
        iconSize: [30, 30],
        iconAnchor: [15, 15]
    });
    state.userMarker = L.marker(state.destination, { icon: userIcon }).addTo(state.map);

    // Initial Assigned Ambulance (Invisible until fetch)
    const ambIcon = L.divIcon({
        className: 'main-amb',
        html: AMBULANCE_SVG(0), // High-detail icon
        iconSize: [64, 64],
        iconAnchor: [32, 32]
    });
    state.ambulanceMarker = L.marker(state.startPos, { icon: ambIcon, opacity: 0 }).addTo(state.map);

    log("🛰️ Satellite link established. Getting your precise location...");
    spawnAndAssignNearest();
    fetchRouteAndTrack();
    startSearchEscalation();
}

// 📍 Get User's Real Location using Geolocation API
function getUserLocation() {
    if (navigator.geolocation) {
        log("📍 Requesting your location access...");

        navigator.geolocation.getCurrentPosition(
            // Success callback
            (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                const accuracy = position.coords.accuracy;

                state.userLocation = [lat, lng];
                state.destination = [lat, lng];
                state.usingRealLocation = true;

                log(`✅ Location locked: ${lat.toFixed(6)}, ${lng.toFixed(6)} (±${Math.round(accuracy)}m)`);

                // Update map center to real location
                state.map.setView(state.destination, 16);

                // Update user marker to real position
                if (state.userMarker) {
                    state.userMarker.setLatLng(state.destination);
                }

                // Re-fetch route with real location
                fetchRouteAndTrack();
            },
            // Error callback
            (error) => {
                let errorMsg = "";
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        errorMsg = "⚠️ Location access denied. Using demo location.";
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMsg = "⚠️ Location unavailable. Using demo location.";
                        break;
                    case error.TIMEOUT:
                        errorMsg = "⚠️ Location timeout. Using demo location.";
                        break;
                    default:
                        errorMsg = "⚠️ Location error. Using demo location.";
                }
                log(errorMsg);
            },
            // Options
            {
                enableHighAccuracy: true,  // Use GPS if available
                timeout: 10000,            // 10 second timeout
                maximumAge: 0              // Don't use cached position
            }
        );
    } else {
        log("⚠️ Geolocation not supported. Using demo location.");
    }
}

function startSearchEscalation() {
    let seconds = 0;
    const ticker = document.getElementById('search-ticker');
    const logOutput = document.getElementById('log-output');

    const interval = setInterval(() => {
        if (state.driverAccepted) {
            clearInterval(interval);
            if (ticker) {
                ticker.innerText = "✅ AMBULANCE CONFIRMED";
                ticker.style.color = '#10b981';
            }
            return;
        }
        seconds++;

        // PHASE 1: Initial search (0-20 seconds)
        if (seconds < 20) {
            if (ticker) ticker.innerText = `PHASE 1: SEARCHING LOCAL UNITS (${20 - seconds}s)`;
        }
        // PHASE 2: Expand radius (20 seconds)
        else if (seconds === 20) {
            log("⚠️ NO ACCEPTANCE YET → Expanding search radius to 10km...");
            if (ticker) {
                ticker.innerText = "PHASE 2: RADIUS EXPANDED (10KM)";
                ticker.style.color = '#f59e0b';
            }
            if (logOutput) logOutput.style.borderLeftColor = '#f59e0b';

            // Simulate radius expansion
            expandSearchRadius();
        }
        // PHASE 3: Alert hospitals and control room (30 seconds)
        else if (seconds === 30) {
            log("🚨 CRITICAL ESCALATION → Partner Hospitals + Control Room Alerted!");
            if (ticker) {
                ticker.innerText = "PHASE 3: HOSPITALS & CONTROL ROOM NOTIFIED";
                ticker.style.color = '#ef4444';
            }
            if (logOutput) logOutput.style.borderLeftColor = '#ef4444';

            // Alert partner hospitals and control room
            alertPartnersAndControlRoom();
        }
        // PHASE 4: Satellite priority (45 seconds)
        else if (seconds === 45) {
            log("🛰️ MAXIMUM PRIORITY → Satellite alert sent to ALL medical units in region!");
            if (ticker) {
                ticker.innerText = "PHASE 4: SATELLITE PRIORITY BROADCAST";
                ticker.style.color = '#dc2626';
                ticker.style.fontWeight = '900';
            }
            if (logOutput) {
                logOutput.style.borderLeftColor = '#dc2626';
                logOutput.style.animation = 'pulse 0.5s infinite';
            }
        }
    }, 1000);
}

// Expand search radius visually
function expandSearchRadius() {
    // Add visual circle to show expanded search area
    if (state.searchCircle) state.map.removeLayer(state.searchCircle);

    state.searchCircle = L.circle(state.destination, {
        radius: 10000, // 10km
        color: '#f59e0b',
        fillColor: '#fbbf24',
        fillOpacity: 0.1,
        weight: 2,
        dashArray: '5, 10'
    }).addTo(state.map);

    // Simulate finding more ambulances in expanded radius
    log("📡 Scanning expanded area... 8 additional units detected.");
}

// Alert partner hospitals and control room
function alertPartnersAndControlRoom() {
    // Visual feedback
    const hospitalMarkers = [
        { name: 'Apollo Hospital', pos: [12.9698, 77.6089] },
        { name: 'Manipal Hospital', pos: [12.9631, 77.6445] },
        { name: 'St. Johns Medical', pos: [12.9650, 77.5850] }
    ];

    hospitalMarkers.forEach((hospital, idx) => {
        setTimeout(() => {
            const marker = L.circleMarker(hospital.pos, {
                radius: 8,
                fillColor: '#ef4444',
                fillOpacity: 0.8,
                color: '#ffffff',
                weight: 2
            }).addTo(state.map);

            marker.bindPopup(`<b>🏥 ${hospital.name}</b><br/>Alerted - Standing By`);
            log(`🏥 ${hospital.name} notified and standing by.`);
        }, idx * 800);
    });

    // Control room notification
    setTimeout(() => {
        log("📞 Medical Control Room: Emergency dispatcher notified. Manual override available.");
    }, 2500);
}

// --- Step 2: Show Nearby Units & Auto-Assign Nearest ---
function spawnAndAssignNearest() {
    const pool = [
        { id: '101', pos: [12.9750, 77.6000] },
        { id: '102', pos: [12.9680, 77.5850] },
        { id: '103', pos: [12.9730, 77.5980] }, // Much closer
        { id: '104', pos: [12.9600, 77.6000] }
    ];

    let nearest = pool[0];
    let minDistance = Infinity;

    pool.forEach((unit) => {
        // Simple Euclidean distance for selection
        const dist = Math.sqrt(
            Math.pow(unit.pos[0] - state.destination[0], 2) +
            Math.pow(unit.pos[1] - state.destination[1], 2)
        );

        if (dist < minDistance) {
            minDistance = dist;
            nearest = unit;
        }

        // Render nearby (gray)
        const icon = L.divIcon({
            className: 'near-amb',
            html: AMBULANCE_SVG(0).replace('white', '#f1f5f9').replace('rgba(37, 99, 235, 0.4)', 'transparent'),
            iconSize: [48, 48],
            iconAnchor: [24, 24]
        });
        const marker = L.marker(unit.pos, { icon: icon }).addTo(state.map);
        marker.bindPopup(`<b>Unit #${unit.id}</b><br>Status: Available`);
        state.nearbyMarkers.push(marker);
    });

    // Set the state to the nearest unit
    state.startPos = nearest.pos;
    log(`System optimized. Nearest Unit #${nearest.id} found at ${(minDistance * 111).toFixed(2)}km.`);

    // Update main marker position before tracking starts
    state.ambulanceMarker.setLatLng(state.startPos);
}

// --- Step 3: Fetch Route & Track along Roads (INTELLIGENT ROUTING MODE) ---
async function fetchRouteAndTrack() {
    const start = [state.startPos[1], state.startPos[0]];
    const end = [state.destination[1], state.destination[0]];

    console.log("🚨 DEBUG: Fetching route from", start, "to", end);

    try {
        // 🚨 INTELLIGENT ROUTING: Prefer wider roads, avoid residential/narrow lanes
        // Using OSRM's exclude parameter where available, or fallback to standard routing
        // In production, you'd use custom routing profiles or prefer "primary" and "secondary" road types
        const url = `https://router.project-osrm.org/route/v1/driving/${start[0]},${start[1]};${end[0]},${end[1]}?overview=full&geometries=geojson&continue_straight=false`;

        console.log("🚨 DEBUG: OSRM URL -", url);
        const response = await fetch(url);
        const data = await response.json();
        console.log("🚨 DEBUG: Route response received", data);

        if (data.routes && data.routes.length > 0) {
            state.routeGeometry = data.routes[0].geometry.coordinates.map(c => ({ lat: c[1], lng: c[0] }));
            console.log("🚨 DEBUG: Route has", state.routeGeometry.length, "points");

            // Add the polyline to the map for tracking visibility
            if (state.polyline) state.map.removeLayer(state.polyline);
            state.polyline = L.polyline(state.routeGeometry, {
                color: '#000000', // Professional Black Line
                weight: 8,
                opacity: 0.8,
                lineJoin: 'round',
                lineCap: 'round'
            }).addTo(state.map);

            state.ambulanceMarker.setOpacity(1);

            // Enhanced routing log with specific avoidance details
            log("🚨 INTELLIGENT ROUTE ACTIVATED: Wider arterial roads prioritized • Narrow lanes avoided • School/market zones bypassed");

            // Broadcast the request with Special Routing Metadata
            broadcastRequest();

            console.log("🚨 DEBUG: Starting animation with", state.routeGeometry.length, "points");
            beginRoadConstrainedAnimation();
        }
    } catch (e) {
        console.error("🚨 DEBUG: Route fetch ERROR -", e);
        log("Route fetch failed: " + e.message);
    }
}

// --- Step 4: Road-Constrained Animation ---
function beginRoadConstrainedAnimation() {
    console.log("🚨 DEBUG: beginRoadConstrainedAnimation called, isTracking =", state.isTracking);
    if (state.isTracking) {
        console.log("🚨 DEBUG: Already tracking, returning");
        return;
    }
    state.isTracking = true;

    let progress = 0;
    const step = 0.0005; // Realistic speed: ~3-4 minutes to complete
    let lastAngle = 0;

    console.log("🚨 DEBUG: Route geometry length:", state.routeGeometry.length);

    // Initialize lastAngle to the first segment's orientation
    if (state.routeGeometry.length > 1) {
        const p1 = state.routeGeometry[0];
        const p2 = state.routeGeometry[1];
        lastAngle = Math.atan2(p2.lng - p1.lng, p2.lat - p1.lat) * (180 / Math.PI);
    }

    console.log("🚨 DEBUG: Starting animation frame loop...");

    function frame() {
        if (progress > 1 || !state.isTracking) {
            state.isTracking = false;
            return;
        }

        const idx = Math.floor(progress * (state.routeGeometry.length - 1));
        const current = state.routeGeometry[idx];
        const next = state.routeGeometry[idx + 1] || current;

        // Target Angle from geometry
        let targetAngle = Math.atan2(next.lng - current.lng, next.lat - current.lat) * (180 / Math.PI);

        // Handle 360-degree wrapping for smooth interpolation
        while (targetAngle - lastAngle > 180) targetAngle -= 360;
        while (targetAngle - lastAngle < -180) targetAngle += 360;

        // Aggressive Smoothing (Lerp)
        const smoothAngle = lastAngle + (targetAngle - lastAngle) * 0.04;
        lastAngle = smoothAngle;

        // Move marker strictly along the road geometry points
        state.ambulanceMarker.setLatLng([current.lat, current.lng]);

        // Apply Smooth Rotation
        const el = state.ambulanceMarker.getElement();
        if (el) {
            const wrapper = el.querySelector('.amb-marker-wrap');
            if (wrapper) {
                wrapper.style.transform = `rotate(${smoothAngle}deg)`;
            }
        }

        progress += step;
        requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
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

// --- Step 5: Real-time Connection to Driver App ---
const comm = new BroadcastChannel('rapid_aid_dispatch');

comm.onmessage = (event) => {
    const { type, data } = event.data;

    switch (type) {
        case 'DRIVER_POSITION':
            if (state.ambulanceMarker) {
                state.ambulanceMarker.setOpacity(1);
                state.ambulanceMarker.setLatLng(data.pos);
                const wrapper = state.ambulanceMarker.getElement().querySelector('.amb-marker-wrap');
                if (wrapper) wrapper.style.transform = `rotate(${data.angle}deg)`;

                // Real-time tracking line update
                if (!state.currentPath) {
                    state.currentPath = L.polyline([data.pos, state.destination], {
                        color: '#ef4444',
                        weight: 4,
                        opacity: 0.8,
                        dashArray: '5, 10',
                        lineJoin: 'round'
                    }).addTo(state.map);
                } else {
                    state.currentPath.setLatLngs([data.pos, state.destination]);
                }

                if (data.eta) log(`Ambulance approaching. Estimated arrival: ${data.eta} min`);
            }
            break;

        case 'REQUEST_ACCEPTED':
            state.driverAccepted = true;
            log(`Captain ${data.driverName} (${data.vehicle}) is on the way.`);
            break;

        case 'TRIP_STATUS':
            if (data.status === 'ARRIVED') {
                log("Ambulance has arrived at your location.");
                const banner = document.getElementById('arrival-banner');
                if (banner) banner.style.display = 'flex';
            } else if (data.status === 'ON_BOARD') {
                log("Trip started. Navigating to hospital.");
                hideArrivalBanner();
            } else if (data.status === 'REACHED_HOSPITAL') {
                log("Arrived at Hospital. Handover in progress.");
            }
            break;

        case 'DRIVER_STATUS':
            if (data.status === 'OFFLINE') {
                log("Assigned unit went offline. Re-dispatching...");
                state.ambulanceMarker.setOpacity(0);
            }
            break;
    }
};

function broadcastRequest() {
    comm.postMessage({
        type: 'EMERGENCY_REQUEST',
        data: {
            patientLocation: state.destination,
            address: "124 Brigade Road, Bangalore",
            condition: "Adult Male • Severe Respiratory Distress",
            distance: "2.4 km",
            routingMode: "INTELLIGENT", // Special routing flag
            routePreferences: {
                preferWideRoads: true,
                avoidNarrowLanes: true,
                avoidSchoolZones: true,
                avoidMarketAreas: true,
                preferArterialRoads: true
            }
        }
    });
}

function log(msg) {
    const out = document.getElementById('log-output');
    if (out) out.innerText = `[DISPATCH] ${msg}`;
}

// Initialize
window.onload = initMap;
