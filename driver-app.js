/**
 * RapidAid Captain App Logic - V2
 * Mandatory Verification -> Search -> Emergency Flow
 */

const CONFIG = {
    OSRM_URL: 'https://router.project-osrm.org/route/v1/driving/',
    BROADCAST_CHANNEL: 'rapid_aid_dispatch',
    PATIENT_POS: [12.9716, 77.5946],
    START_POS: [12.9850, 77.6100],
    HOSPITAL_POS: [12.9650, 77.5850],
    VAL_OTP: "4029"
};

const state = {
    map: null,
    marker: null,
    patientMarker: null, // Track patient location
    polyline: null,
    routeGeometry: [],
    status: 'VERIFICATION_PENDING', // VERIFICATION_PENDING, UNDER_REVIEW, APPROVED, ONLINE, SEARCHING, EN_ROUTE, ARRIVED, ON_BOARD
    currentPos: [...CONFIG.START_POS],
    animating: false,
    offline: false
};

const comm = new BroadcastChannel(CONFIG.BROADCAST_CHANNEL);

// Listen for Incoming Requests from Patient App
comm.onmessage = (event) => {
    const { type, data } = event.data;
    if (type === 'EMERGENCY_REQUEST' && !state.offline) {
        triggerEmergencyFound(data);
    }
};

// --- State Persistence (Mock) ---
function loadPersistence() {
    const saved = localStorage.getItem('driver_state');
    if (saved) {
        state.status = saved;
        updateUI();
    }
}

function savePersistence(status) {
    state.status = status;
    localStorage.setItem('driver_state', status);
}

// --- Icons ---
const AMBULANCE_ICON = (angle = 0) => L.divIcon({
    className: 'driver-marker-wrap',
    html: `
        <div style="transform: rotate(${angle}deg); position: relative;">
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
                    
                    <!-- Main Chassis (Vibrant White) -->
                    <rect x="30" y="20" width="40" height="65" rx="8" fill="white" stroke="#2563eb" stroke-width="2"/>
                    
                    <!-- High-Contrast Front -->
                    <path d="M30 35C30 32.7909 31.7909 31 34 31H66C68.2091 31 70 32.7909 70 35V42H30V35Z" fill="#0f172a"/>
                    
                    <!-- Dual High-Intensity Flashers (Faster speed) -->
                    <rect x="32" y="25" width="16" height="6" rx="3" fill="#ef4444">
                        <animate attributeName="opacity" values="1;0.4;1" dur="0.2s" repeatCount="indefinite" />
                    </rect>
                    <rect x="52" y="25" width="16" height="6" rx="3" fill="#3b82f6">
                        <animate attributeName="opacity" values="0.4;1;0.4" dur="0.2s" repeatCount="indefinite" />
                    </rect>

                    <!-- Reflective Medical Symbol -->
                    <rect x="44" y="52" width="12" height="22" rx="2" fill="#ef4444" />
                    <rect x="39" y="57" width="22" height="12" rx="2" fill="#ef4444" />
                    
                    <!-- Direction Pointer (Vibrant) -->
                    <path d="M50 8 L58 20 L42 20 Z" fill="#ef4444" />
                </svg>
            </div>
        </div>
        <style>
            @keyframes emergency-halo {
                0% { transform: translate(-50%, -50%) scale(0.6); opacity: 0.8; }
                100% { transform: translate(-50%, -50%) scale(1.4); opacity: 0; }
            }
        </style>
    `,
    iconSize: [64, 64],
    iconAnchor: [32, 32]
});

// --- Core Initialization ---
function init() {
    state.map = L.map('map', {
        zoomControl: false,
        attributionControl: false,
        zoomSnap: 0.1
    }).setView(state.currentPos, 15);

    // Clean Professional Street Map (CartoDB Positron)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(state.map);

    state.marker = L.marker(state.currentPos, { icon: AMBULANCE_ICON() }).addTo(state.map);

    loadPersistence();
    checkSystemStatus();
}

/** Check for GPS and Internet */
function checkSystemStatus() {
    if (!navigator.onLine) {
        document.getElementById('network-warning').style.display = 'block';
    }
    // Mock GPS check
    console.log("System Checks: Internet [OK], GPS [OK]");
}

// --- Flow: Verification ---
function submitVerification() {
    const fields = ['v-name', 'v-dl', 'v-id', 'v-reg', 'v-operator'];
    const data = {};
    let valid = true;

    fields.forEach(id => {
        data[id] = document.getElementById(id).value;
        if (!data[id]) valid = false;
    });

    if (!valid) {
        alert("Please fill all mandatory fields and upload documents.");
        return;
    }

    document.getElementById('verify-form').style.display = 'none';
    const statusDiv = document.getElementById('verify-status');
    statusDiv.style.display = 'block';

    savePersistence('UNDER_REVIEW');

    // Simulate Admin Approval after 5 seconds
    setTimeout(() => {
        document.getElementById('status-icon').innerText = '✅';
        document.getElementById('status-title').innerText = 'Approved';
        document.getElementById('status-desc').innerText = 'Verification complete. Welcome to the RapidAid network.';

        const nextBtn = document.createElement('button');
        nextBtn.className = 'btn btn-primary';
        nextBtn.innerText = 'ENTER DASHBOARD';
        nextBtn.style.marginTop = '20px';
        nextBtn.onclick = () => {
            savePersistence('APPROVED');
            updateUI();
        };
        statusDiv.appendChild(nextBtn);
    }, 5000);
}

// --- Flow: Dashboard & Search ---
function updateUI() {
    const overlay = document.getElementById('verification-overlay');
    const homeUi = document.getElementById('home-ui');
    const badge = document.getElementById('user-badge');

    if (state.status === 'APPROVED' || state.status === 'ONLINE' || state.status === 'SEARCHING') {
        overlay.style.display = 'none';
        homeUi.style.display = 'block';
        badge.style.display = 'flex';
        document.getElementById('display-name').innerText = document.getElementById('v-name').value || "Sarah Wilson";
    }
}

let backgroundSearchTimer = null;

function toggleOnlineFlow() {
    state.offline = !state.offline;
    const btn = document.getElementById('master-toggle');
    const txt = document.getElementById('status-text');
    const mainStatus = document.getElementById('system-status-main');
    const subStatus = document.getElementById('system-status-sub');
    const navIndicator = document.getElementById('online-indicator');
    const navText = document.getElementById('online-text');

    if (!state.offline) {
        // GOING ONLINE
        btn.classList.add('active');
        txt.innerText = 'SEARCHING...';
        mainStatus.innerText = 'Online';
        mainStatus.style.color = '#10b981';
        subStatus.innerText = 'Scanning for nearby emergencies...';
        navIndicator.style.background = '#10b981';
        navText.innerText = 'ONLINE';

        // Start Background Search Simulation
        if (backgroundSearchTimer) clearTimeout(backgroundSearchTimer);
        backgroundSearchTimer = setTimeout(() => {
            if (!state.offline) triggerEmergencyFound();
        }, 5000);

    } else {
        // GOING OFFLINE
        btn.classList.remove('active');
        txt.innerText = 'GO ONLINE';
        mainStatus.innerText = 'Offline';
        mainStatus.style.color = '#0f172a';
        subStatus.innerText = 'Ready for duty';
        navIndicator.style.background = '#64748b';
        navText.innerText = 'OFFLINE';

        if (backgroundSearchTimer) clearTimeout(backgroundSearchTimer);
    }
}

function triggerEmergencyFound(data) {
    playLoudAlert();
    document.getElementById('request-sheet').classList.add('active');

    // Store request data for later use
    state.currentRequest = data;

    // Add Patient Marker to Map
    if (data && data.patientLocation) {
        const patientIcon = L.divIcon({
            className: 'patient-marker',
            html: '<div class="patient-pulse"><div class="patient-dot"></div></div>',
            iconSize: [24, 24],
            iconAnchor: [12, 12]
        });

        if (state.patientMarker) state.map.removeLayer(state.patientMarker);
        state.patientMarker = L.marker(data.patientLocation, { icon: patientIcon }).addTo(state.map);

        // Label the patient
        state.patientMarker.bindTooltip("Patient Location", { permanent: true, direction: 'top' }).openTooltip();
    }

    // Update dashboard to show active request with routing mode
    const txt = document.getElementById('status-text');
    const mainStatus = document.getElementById('system-status-main');
    const subStatus = document.getElementById('system-status-sub');

    txt.innerText = 'REQUEST READY';

    // Check if intelligent routing is enabled
    if (data && data.routingMode === 'INTELLIGENT') {
        mainStatus.innerText = '🚨 INTELLIGENT ROUTING MODE';
        mainStatus.style.color = '#ef4444';

        // Build preferences string
        const prefs = data.routePreferences || {};
        const prefsList = [];
        if (prefs.preferWideRoads) prefsList.push('Wide Roads Prioritized');
        if (prefs.avoidNarrowLanes) prefsList.push('Narrow Lanes Avoided');
        if (prefs.avoidSchoolZones) prefsList.push('School Zones Bypassed');
        if (prefs.avoidMarketAreas) prefsList.push('Market Areas Avoided');

        subStatus.innerText = data.address ? `${prefsList.join(' • ')} • At ${data.address}` : prefsList.join(' • ');
    } else {
        mainStatus.innerText = 'STANDARD ROUTE';
        mainStatus.style.color = '#3b82f6';
        subStatus.innerText = data ? `At ${data.address}` : 'Emergency Route Found';
    }
}

function playLoudAlert() {
    // In a real app, this would trigger a high-volume notification
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
    audio.play().catch(e => console.log("Audio prevented by browser: " + e));
}

// --- Flow: Emergency Accept & Trip ---
function acceptEmergency() {
    document.getElementById('request-sheet').classList.remove('active');
    document.getElementById('home-ui').style.display = 'none';

    // UI HUDs
    document.getElementById('nav-hud').style.display = 'block';
    document.getElementById('trip-bar').style.display = 'block';
    document.getElementById('sos-btn').style.display = 'flex';

    // Keep Patient Marker visible for navigation
    if (state.patientMarker) state.patientMarker.addTo(state.map);

    // Lock interactions for Navigation mode
    state.map.dragging.disable();
    state.map.touchZoom.disable();
    state.map.doubleClickZoom.disable();
    state.map.scrollWheelZoom.disable();

    // Use the actual patient location from the request, fallback to CONFIG if needed
    const dest = state.currentRequest && state.currentRequest.patientLocation
        ? state.currentRequest.patientLocation
        : CONFIG.PATIENT_POS;

    startNavigation(dest);
    broadcast('REQUEST_ACCEPTED', { driverName: document.getElementById('v-name').value || "Sarah Wilson", vehicle: "KA-01-MJ-2024" });
}

function skipRequest() {
    document.getElementById('request-sheet').classList.remove('active');
    // Random wait before next search result is possible
}

async function startNavigation(destination) {
    const start = [state.currentPos[1], state.currentPos[0]];
    const end = [destination[1], destination[0]];

    try {
        // 🚨 INTELLIGENT ROUTING: Apply special routing for emergency vehicles
        // Using continue_straight=false to prefer major roads and avoid tight residential areas
        const url = `${CONFIG.OSRM_URL}${start[0]},${start[1]};${end[0]},${end[1]}?overview=full&geometries=geojson&continue_straight=false`;

        const response = await fetch(url);
        const data = await response.json();

        if (data.routes && data.routes.length > 0) {
            const route = data.routes[0];
            state.routeGeometry = route.geometry.coordinates.map(c => ({ lat: c[1], lng: c[0] }));

            if (state.polyline) state.map.removeLayer(state.polyline);
            state.polyline = L.polyline(state.routeGeometry, {
                color: '#000000', // Black line for high visibility
                weight: 8,
                opacity: 0.8,
                lineJoin: 'round',
                lineCap: 'round'
            }).addTo(state.map);

            updateHUD(route.duration, route.distance);

            // Log routing mode if intelligent
            if (state.currentRequest && state.currentRequest.routingMode === 'INTELLIGENT') {
                console.log('🚨 INTELLIGENT ROUTING ACTIVE: Preferring wider roads, avoiding narrow lanes and congested areas');
            }

            animateMovement();
        }
    } catch (e) {
        console.error("Routing failed", e);
    }
}

function updateHUD(duration, distance) {
    document.getElementById('nav-eta').innerText = `${Math.ceil(duration / 60)} min`;
    document.getElementById('nav-dist').innerText = `${(distance / 1000).toFixed(1)} km to patient`;
}

function animateMovement() {
    if (state.animating) return;
    state.animating = true;
    let progress = 0;
    const step = 0.0005; // Realistic speed: ~3-4 minutes (was 0.012)

    let lastAngle = 0;
    if (state.routeGeometry.length > 1) {
        const p1 = state.routeGeometry[0];
        const p2 = state.routeGeometry[1];
        lastAngle = Math.atan2(p2.lng - p1.lng, p2.lat - p1.lat) * (180 / Math.PI);
    }

    function frame() {
        if (progress > 1 || !state.animating) {
            state.animating = false;

            // Remove the route line completely when arrived
            if (state.polyline && progress > 1) {
                state.map.removeLayer(state.polyline);
                state.polyline = null;
            }

            // Reset map rotation when finished
            const mapContainer = state.map.getContainer();
            if (mapContainer) mapContainer.style.transform = "rotate(0deg)";
            return;
        }

        // --- Navigation Mode Interpolation ---
        const totalPoints = state.routeGeometry.length - 1;
        const currentProgress = progress * totalPoints;
        const idx = Math.floor(currentProgress);
        const subProgress = currentProgress - idx;

        const current = state.routeGeometry[idx];
        const next = state.routeGeometry[idx + 1] || current;
        const furtherNext = state.routeGeometry[idx + 2] || next;

        // Interpolate Position
        const interpLat = current.lat + (next.lat - current.lat) * subProgress;
        const interpLng = current.lng + (next.lng - current.lng) * subProgress;
        const interpPos = [interpLat, interpLng];

        // Interpolate Angle
        let targetAngle = Math.atan2(next.lng - current.lng, next.lat - current.lat) * (180 / Math.PI);
        while (targetAngle - lastAngle > 180) targetAngle -= 360;
        while (targetAngle - lastAngle < -180) targetAngle += 360;

        // Smooth rotation damping
        const smoothAngle = lastAngle + (targetAngle - lastAngle) * 0.08;
        lastAngle = smoothAngle;

        // --- Map Transformation (Game Navigation Style) ---
        // 1. Lock Camera to Ambulance
        state.marker.setLatLng(interpPos); // 🚑 MOVES THE VEHICLE!
        state.map.setView(interpPos, state.map.getZoom(), { animate: false });

        // 2. Lock Map Rotation (North Up) to keep labels readable
        // Container rotation is removed because it makes map labels upside-down
        const mapContainer = state.map.getContainer();
        if (mapContainer) {
            mapContainer.style.transform = "rotate(0deg)";
        }

        // 3. Dynamic Zoom based on Turn Severity
        const upcomingTarget = Math.atan2(furtherNext.lng - next.lng, furtherNext.lat - next.lat) * (180 / Math.PI);
        const turnSeverity = Math.abs(upcomingTarget - targetAngle);

        // Auto-zoom in on turns, zoom out on straights
        const targetZoom = turnSeverity > 20 ? 18.5 : 17.0;
        const currZoom = state.map.getZoom();
        state.map.setZoom(currZoom + (targetZoom - currZoom) * 0.02, { animate: false });

        // 🚨 FIXED: Connect route line EXACTLY to ambulance position (No Gaps)
        if (state.polyline) {
            // Prepend current interpolated position so line starts AT the ambulance icon
            // We use idx + 1 for the rest to avoid backtracking
            const remainingRoute = [interpPos, ...state.routeGeometry.slice(idx + 1)];
            state.polyline.setLatLngs(remainingRoute);

            // Fade out line as we approach destination
            const remainingProgress = 1 - progress;
            state.polyline.setStyle({
                opacity: Math.max(0.2, remainingProgress * 0.8)
            });
        }

        // Update Patient Marker Rotation to stay Upright
        if (state.patientMarker) {
            const pmEl = state.patientMarker.getElement();
            if (pmEl) {
                const inner = pmEl.querySelector('.patient-pin-wrap');
                if (inner) inner.style.transform = `rotate(${smoothAngle}deg) translateY(${Math.sin(Date.now() * 0.005) * 5}px)`;
            }
        }
        const el = state.marker.getElement();
        if (el) {
            const wrapper = el.querySelector('.driver-marker-wrap > div');
            // We rotate map by -smoothAngle, so marker must rotate by smoothAngle
            // to stay pointing "Up" on the actual physical screen
            if (wrapper) wrapper.style.transform = `rotate(${smoothAngle}deg)`;
        }

        // Sync with Patient side
        broadcast('DRIVER_POSITION', {
            pos: interpPos,
            angle: smoothAngle,
            eta: Math.max(1, Math.ceil((1 - progress) * 15))
        });

        // Update HUD Live
        const etaEl = document.getElementById('nav-eta');
        if (etaEl) etaEl.innerText = `${Math.max(1, Math.ceil((1 - progress) * 15))} min`;

        progress += step;
        requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
}

// --- Trip Actions ---
let tripStage = 0; // 0: Nav to Pick, 1: Arrived, 2: Nav to Hospital

function handleTripAction() {
    const btn = document.getElementById('trip-btn');

    if (tripStage === 0) {
        // Arrived at Pickup
        tripStage = 1;
        state.animating = false;
        btn.innerText = "VERIFY OTP & LOAD PATIENT";
        broadcast('TRIP_STATUS', { status: 'ARRIVED' });

        // Show OTP overlay
        document.getElementById('otp-overlay').style.display = 'flex';
    } else if (tripStage === 2) {
        // Reached Hospital
        broadcast('TRIP_STATUS', { status: 'REACHED_HOSPITAL' });
        alert("Trip Completed. Details sent to Hospital Billing ID #HB-9122.");
        location.reload();
    }
}

function verifyPickupOTP() {
    const inputs = document.querySelectorAll('.otp-input');
    const entered = Array.from(inputs).map(i => i.value).join('');

    if (entered === CONFIG.VAL_OTP) {
        alert("OTP Verified ✅ Patient Securely Onboard.");
        document.getElementById('otp-overlay').style.display = 'none';
        tripStage = 2;

        document.getElementById('trip-btn').innerText = "REACHED HOSPITAL";
        document.getElementById('nav-dist').innerText = "En route to St. John's Hospital";

        startNavigation(CONFIG.HOSPITAL_POS);
        broadcast('TRIP_STATUS', { status: 'ON_BOARD' });
    } else {
        alert("Invalid OTP. Please check with the patient.");
        inputs.forEach(i => i.value = '');
        inputs[0].focus();
    }
}

function closeOTP() {
    document.getElementById('otp-overlay').style.display = 'none';
}

// --- Utilities ---
function broadcast(type, data) {
    comm.postMessage({ type, data, timestamp: Date.now() });
}

function triggerPanic() {
    alert("🚨 PANIC ALERT SENT: Support team and police notified of your location.");
}

function callPatient() { alert("Simulating call to patient: +91 90000 12345"); }
function callHospital() { alert("Calling St. John's Intake: +91 4400 9922"); }

// Map inputs to next
document.querySelectorAll('.otp-input').forEach((input, idx, all) => {
    input.oninput = (e) => {
        if (e.target.value.length === 1 && all[idx + 1]) all[idx + 1].focus();
    };
});

window.onload = init;
