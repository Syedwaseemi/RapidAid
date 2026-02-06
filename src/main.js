
// State management - Production Ready Architecture
const state = {
    currentPage: 'home',
    sheetState: 'compact',
    isDragging: false,
    map: null,
    userMarker: null,
    ambulanceMarker: null,
    routeLayer: null,

    // Core Navigation Data (Simulated Rapido-like Backend Stream)
    navigation: {
        pickup: [12.9716, 77.5946], // MG Road Bangalore (User)
        ambulanceStart: [12.9850, 77.6100], // Captain Starting Point
        fullRouteGeometry: [
            [12.9850, 77.6100], // Point A: Kensington Rd
            [12.9850, 77.6050],
            [12.9850, 77.5946], // Point B: Junction to Cubbon Rd
            [12.9800, 77.5946], // Point C: Cubbon Rd
            [12.9750, 77.5946], // Point D: Near MG Rd
            [12.9725, 77.5946],
            [12.9716, 77.5946]  // Destination: MG Road
        ],
        currentRouteIndex: 0,
        isTracking: false
    },

    booking: {
        pickup: '722 Medical Drive, Sector 4',
        status: 'none'
    },
    hospitals: [
        { name: 'City Care Hospital', eta: 7 },
        { name: 'Apollo Clinic', eta: 10 },
        { name: 'GreenLife Medical', eta: 13 }
    ],
    tracking: {
        driver: {
            name: 'Captain Sarah Wilson',
            vehicle: 'Force Traveller ICU',
            licensePlate: 'KA-01-MJ-2024',
            rating: '4.9 ⭐',
            isVerified: true
        }
    },
    otp: {
        code: '4029', // Simulated OTP
        isVerified: false,
        input: ''
    }
};

// --- RAPIDO UI COMPONENTS ---
const Pages = {
    home: () => `
        <div class="page-fade" style="height: 100vh; position: relative; overflow: hidden;">
            <!-- Production Grade Map Stack -->
            <div id="leaflet-map" style="width: 100%; height: 100%; z-index: 1;"></div>
            
            <!-- Arrival Banner Popup (Hidden by default) -->
            <div id="arrival-banner" class="arrival-popup" style="display: none;">
                <div class="arrival-content">
                    <div class="arrival-header">
                        <div class="arrival-badge">ARRIVED</div>
                        <button class="close-banner" onclick="hideArrivalBanner()">✕</button>
                    </div>
                    <div class="arrival-body">
                        <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">🚑</div>
                        <h2 style="margin: 0; font-size: 1.5rem; color: #1E293B;">Ambulance Arrived</h2>
                        <p style="color: #64748B; margin: 4px 0 20px 0;">Share the OTP to start medical transport.</p>
                        
                        <div class="otp-container">
                            <div class="otp-label">PICKUP OTP</div>
                            <div class="otp-code">${state.otp.code}</div>
                        </div>

                        <div class="driver-card-compact" style="margin-bottom: 1.5rem;">
                            <div style="display: flex; gap: 1rem; align-items: center;">
                                <div class="driver-avatar">SW</div>
                                <div style="text-align: left;">
                                    <div style="font-weight: 800; color: #1E293B;">${state.tracking.driver.name} ✅</div>
                                    <div style="font-size: 0.8rem; color: #64748B;">${state.tracking.driver.vehicle} • ${state.tracking.driver.licensePlate}</div>
                                </div>
                            </div>
                        </div>

                        <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                            <button class="btn btn-primary" onclick="confirmPickup()">START TRIP</button>
                            <button class="btn btn-emergency-bypass" onclick="emergencyBypass()">CRITICAL EMERGENCY OVERRIDE</button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Real-time Status Overlay -->
            <div id="nav-status-pill" class="map-nav-pill" style="display: none; z-index: 100; top: 1.5rem;">
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                    <div class="ambulance-light-mini"></div>
                    <span id="nav-status-text" style="font-weight: 700;">Ambulance assigned • Waiting for driver</span>
                </div>
            </div>

            <div class="recenter-btn" onclick="reCenterMap()" title="Re-center" style="z-index: 100;">
                <span>🎯</span>
            </div>

            <div class="captain-portal-trigger" onclick="navigateTo('captainPortal')" title="Captain Portal">
                <span>👨‍✈️</span>
            </div>

            <!-- Draggable Dispatch Sheet -->
            <div class="bottom-sheet compact" id="emergency-panel">
                <div class="bottom-sheet-handle-container" id="sheet-handle">
                    <div class="bottom-sheet-handle"></div>
                </div>
                
                <div class="bottom-sheet-content">
                    <div id="request-state">
                        <button class="btn btn-emergency" onclick="startEmergencyWorkflow()" style="margin-bottom: 1.5rem; font-weight: 800; letter-spacing: 0.02em;">REQUEST AMBULANCE NOW</button>
                        <div style="padding: 0 0.5rem;">
                            <div style="display: flex; align-items: start; gap: 0.75rem; margin-bottom: 1.5rem;">
                                <div style="font-size: 1.25rem;">📍</div>
                                <div>
                                    <div style="font-weight: 800; font-size: 1.1rem; color: #1E293B;">${state.booking.pickup}</div>
                                    <div style="font-size: 0.8rem; color: #64748B;">Bengaluru, Karnataka</div>
                                </div>
                            </div>
                            
                            <h3 style="font-size: 0.8rem; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 1rem;">Closest Emergency Centers</h3>
                            <div id="hospital-list">
                                ${state.hospitals.map(h => `
                                    <div class="hospital-item" style="border-bottom: 1px solid #F1F5F9; padding-bottom: 0.75rem;">
                                        <span class="hospital-name" style="font-weight: 600;">${h.name}</span>
                                        <span class="hospital-eta" style="color: #10B981; font-weight: 700;">${h.eta} min</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>

                    <div id="tracking-state" style="display: none;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                            <div style="display: flex; gap: 1rem; align-items: center;">
                                <div style="width: 50px; height: 50px; background: #EEF2FF; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.25rem;">👨‍✈️</div>
                                <div>
                                    <div style="font-size: 0.75rem; font-weight: 700; color: #3B82F6; text-transform: uppercase;">Captain Arriving</div>
                                    <h2 style="margin: 0; font-size: 1.1rem; color: #1E293B;">${state.tracking.driver.name} ${state.tracking.driver.isVerified ? '✅' : ''}</h2>
                                    <p style="margin: 0; color: #64748B; font-size: 0.8rem;">${state.tracking.driver.licensePlate}</p>
                                </div>
                            </div>
                            <div style="text-align: right;">
                                <div style="font-size: 1.35rem; font-weight: 800; color: #1E293B;" id="live-eta-main">6m</div>
                                <div style="font-size: 0.65rem; font-weight: 700; color: #10B981;">FASTEST ROUTE</div>
                            </div>
                        </div>
                        <div style="display: flex; gap: 0.75rem;">
                            <button class="btn btn-outline" style="flex: 1; height: 48px; border-radius: 12px;" onclick="cancelSearch()">Cancel</button>
                            <button class="btn btn-primary" style="flex: 2; height: 48px; border-radius: 12px; font-weight: 700;" onclick="showToast('Calling Captain...')">📞 CALL CAPTAIN</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `,
    category: () => ``,
    schedule: () => `<div style="padding: 2rem;"><button onclick="navigateTo('home')" class="btn btn-outline">Back</button></div>`,

    captainPortal: () => `
        <div class="page-fade" style="padding: 1.5rem; background: #F8FAF9; min-height: 100vh;">
            <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 2rem;">
                <button onclick="navigateTo('home')" style="background: none; border: none; font-size: 1.5rem; cursor: pointer;">←</button>
                <h1 style="margin: 0; font-size: 1.25rem;">Captain Registration</h1>
            </div>
            
            <div class="card" style="background: white; padding: 1.5rem; border-radius: 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                <div style="text-align: center; margin-bottom: 1.5rem;">
                    <div style="font-size: 3rem; margin-bottom: 0.5rem;">🚑</div>
                    <p style="color: #64748B; font-size: 0.9rem;">Join the RapidAid Lifesaving Fleet</p>
                </div>
                
                <div class="form-group" style="margin-bottom: 1.25rem;">
                    <label style="display: block; font-weight: 700; font-size: 0.8rem; color: #1E293B; margin-bottom: 0.5rem;">Captain Full Name</label>
                    <input type="text" placeholder="e.g. John Doe" style="width: 100%; padding: 12px; border: 1px solid #E2E8F0; border-radius: 8px; box-sizing: border-box;">
                </div>
                
                <div class="form-group" style="margin-bottom: 1.25rem;">
                    <label style="display: block; font-weight: 700; font-size: 0.8rem; color: #1E293B; margin-bottom: 0.5rem;">Ambulance License Plate</label>
                    <input type="text" placeholder="e.g. KA-01-XX-0000" style="width: 100%; padding: 12px; border: 1px solid #E2E8F0; border-radius: 8px; box-sizing: border-box;">
                </div>
                
                <div class="form-group" style="margin-bottom: 1.25rem;">
                    <label style="display: block; font-weight: 700; font-size: 0.8rem; color: #1E293B; margin-bottom: 0.5rem;">Upload RC Book (Govt Proof)</label>
                    <div style="border: 2px dashed #E2E8F0; padding: 1.5rem; text-align: center; border-radius: 12px; cursor: pointer;" onclick="showToast('Choose file from device')">
                        <span style="font-size: 1.5rem;">📁</span>
                        <p style="margin: 0.5rem 0 0 0; color: #64748B; font-size: 0.8rem;">Tap to upload documents</p>
                    </div>
                </div>
                
                <button class="btn btn-primary" style="width: 100%; font-weight: 800;" onclick="showToast('Profile submitted for verification', 'success'); navigateTo('home');">SUBMIT FOR VERIFICATION</button>
            </div>
            
            <p style="text-align: center; color: #94A3B8; font-size: 0.7rem; margin-top: 2rem;">Your documents will be verified by the Govt Medical Authority within 24-48 hours.</p>
        </div>
    `
};

// --- REAL-TIME ARCHITECTURE ENGINE ---

// 1. Initialize Leaflet + OpenStreetMap (Reliable Stack)
const initMap = () => {
    if (state.map) return;
    state.map = L.map('leaflet-map', {
        zoomControl: false,
        attributionControl: false,
        center: state.navigation.pickup,
        zoom: 15
    });

    // Clean Google Road Tiles (User preference)
    L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
        maxZoom: 20
    }).addTo(state.map);

    // Initial User Marker (Locked)
    const userIcon = L.divIcon({
        className: 'user-dot-container',
        html: '<div class="user-dot"></div>',
        iconSize: [20, 20]
    });
    state.userMarker = L.marker(state.navigation.pickup, { icon: userIcon }).addTo(state.map);
};

// 2. Directions API Call Logic (Simulation)
// "Draw the blue path once by calling Routing API"
const fetchRouteAndDraw = () => {
    // In production, you'd fetch from OSRM/Google here
    const geometry = state.navigation.fullRouteGeometry;

    // Line rendering completely removed for a clean UI
    // We only keep the geometry for the animation logic
    return geometry;
};

// 3. Captain Update Stream (WebSocket Simulation)
// "Receive new GPS every few seconds and snap to road"
let updateInterval;
const startCaptainUpdates = (routePoints) => {
    let currentStep = 0;
    const totalSteps = 200; // Animation resolution
    const statusText = document.getElementById('nav-status-text');
    const etaDisplay = document.getElementById('live-eta-main');

    // Create Ambulance Marker if it doesn't exist
    const ambIcon = L.divIcon({
        className: 'ambulance-marker-wrap',
        html: `
            <div style="position: relative;">
                <div class="ambulance-light"></div>
                <svg width="60" height="60" viewBox="0 0 60 60" fill="none">
                    <ellipse cx="30" cy="45" rx="20" ry="6" fill="black" fill-opacity="0.2"/>
                    <rect x="15" y="10" width="30" height="40" rx="4" fill="white" stroke="#1E293B" stroke-width="2"/>
                    <path d="M15 18H45V14C45 11.7909 43.2091 10 41 10H19C16.7909 10 15 11.7909 15 14V18Z" fill="#1E293B"/>
                    <rect x="25" y="24" width="10" height="15" rx="1" fill="#EF4444"/>
                    <path d="M26 31H34M30 27V36" stroke="white" stroke-width="2"/>
                </svg>
            </div>
        `,
        iconSize: [60, 60],
        iconAnchor: [30, 30]
    });

    state.ambulanceMarker = L.marker(routePoints[0], { icon: ambIcon }).addTo(state.map);

    updateInterval = setInterval(() => {
        currentStep++;
        const progress = currentStep / totalSteps;

        if (progress >= 1) {
            clearInterval(updateInterval);
            onCaptainArrived();
            return;
        }

        // SNAP-TO-ROAD LOGIC:
        // Instead of moving in a straight line to the destination,
        // we move ONLY along the polyline segments index by index.
        const numSegments = routePoints.length - 1;
        const segmentProgress = progress * numSegments;
        const index = Math.floor(segmentProgress);
        const t = segmentProgress - index;

        const p1 = routePoints[index];
        const p2 = routePoints[index + 1];

        const lat = p1[0] + (p2[0] - p1[0]) * t;
        const lng = p1[1] + (p2[1] - p1[1]) * t;

        // CALC ROTATION:
        const angle = Math.atan2(p2[1] - p1[1], p2[0] - p1[0]) * (180 / Math.PI);

        // PUSH UPDATE TO MAP:
        state.ambulanceMarker.setLatLng([lat, lng]);
        const el = state.ambulanceMarker.getElement();
        if (el) el.style.transform += ` rotate(${angle}deg)`;

        // Update UI (Real-time Feel)
        const minsLeft = Math.ceil((1 - progress) * 6);
        if (statusText) statusText.textContent = `Ambulance on the way • ETA ${minsLeft} min`;
        if (etaDisplay) etaDisplay.textContent = `${minsLeft}m`;

    }, 100); // 100ms for smooth fluid movement
};

// --- WORKFLOW HELPERS ---

window.startEmergencyWorkflow = () => {
    showToast("Searching for Captain...");
    setTimeout(() => {
        const route = fetchRouteAndDraw();

        // UI State Switch
        document.getElementById('nav-status-pill').style.display = 'flex';
        document.getElementById('request-state').style.display = 'none';
        document.getElementById('tracking-state').style.display = 'block';

        setSheetState('compact');

        // Focus map on the tracking area
        const bounds = L.latLngBounds(route);
        state.map.fitBounds(bounds, { padding: [80, 80] });

        // Start "Broadcasting location" simulation
        startCaptainUpdates(route);
    }, 2500);
};

const onCaptainArrived = () => {
    showToast("Captain has arrived!", "success");
    const statusText = document.getElementById('nav-status-text');
    if (statusText) statusText.textContent = "Captain is here • Ready for pickup";

    // Show the arrival banner popup
    const banner = document.getElementById('arrival-banner');
    if (banner) {
        banner.style.display = 'flex';
        // Add animation class if needed
        banner.classList.add('animate-up');
    }
};

window.hideArrivalBanner = () => {
    const banner = document.getElementById('arrival-banner');
    if (banner) banner.style.display = 'none';
};

window.confirmPickup = () => {
    state.otp.isVerified = true;
    hideArrivalBanner();
    showToast("Trip started! Navigating to Hospital.", "success");
    // Change UI state to 'In-Trip'
    const statusText = document.getElementById('nav-status-text');
    if (statusText) statusText.textContent = "Moving to City Care Hospital • ETA 5 min";
};

window.emergencyBypass = () => {
    state.otp.isVerified = true;
    hideArrivalBanner();
    showToast("Emergency Override Activated!", "warning");
    showToast("Ride marked as Medically Verified.", "success");

    // Change UI state to 'In-Trip'
    const statusText = document.getElementById('nav-status-text');
    if (statusText) statusText.textContent = "CRITICAL TRANSPORT • En Route to ER";

    if (state.ambulanceMarker) {
        state.ambulanceMarker.getElement().querySelector('.ambulance-light').style.animation = 'pulse 0.2s infinite';
    }
};

window.reCenterMap = () => {
    if (state.map) {
        state.map.flyTo(state.navigation.pickup, 16);
        showToast("Re-centered on you");
    }
};

window.cancelSearch = () => {
    clearInterval(updateInterval);
    navigateTo('home');
    showToast("Request cancelled");
};

// Standard Framework Handlers
const setSheetState = (s) => {
    const sheet = document.getElementById('emergency-panel');
    if (sheet) {
        state.sheetState = s;
        sheet.className = `bottom-sheet ${s}`;
    }
};

const initBottomSheet = () => {
    const handle = document.getElementById('sheet-handle');
    if (!handle) return;
    let dragStartY;
    handle.onmousedown = (e) => {
        state.isDragging = true;
        dragStartY = e.clientY;
    };
    window.onmouseup = (e) => {
        if (!state.isDragging) return;
        state.isDragging = false;
        const delta = dragStartY - e.clientY;
        if (delta > 50) setSheetState('half');
        else if (delta < -50) setSheetState('compact');
    };
};

window.navigateTo = (p) => {
    state.currentPage = p;
    render();
};

window.showToast = (m, t = 'info') => {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<span>${t === 'success' ? '✅' : '🔔'}</span><span>${m}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
};

const render = () => {
    const app = document.getElementById('app');
    if (state.currentPage === 'home') {
        app.innerHTML = Pages.home();
        initMap();
        initBottomSheet();
    } else {
        app.innerHTML = Pages[state.currentPage]();
    }
};

render();
