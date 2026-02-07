# 🔧 AMBULANCE STUCK - DEBUGGING GUIDE

## ✅ Debug Logs Added!

I've added console logging to help diagnose why the ambulance isn't moving.

---

## 🚀 How to See Debug Logs

1. **Open the Patient App:**
   ```
   http://localhost:5173/ambulance-tracker.html
   ```

2. **Open Browser Developer Console:**
   - Press `F12` OR
   - Right-click → "Inspect" → Click "Console" tab

3. **Watch for These Debug Messages:**

```
🚨 DEBUG: Fetching route from [lat, lng] to [lat, lng]
🚨 DEBUG: OSRM URL - https://router.project-osrm.org/...
🚨 DEBUG: Route response received {routes: [...]}
🚨 DEBUG: Route has XXX points
🚨 DEBUG: Starting animation with XXX points
🚨 DEBUG: beginRoadConstrainedAnimation called, isTracking = false
🚨 DEBUG: Route geometry length: XXX
🚨 DEBUG: Starting animation frame loop...
```

---

## 🐛 Common Issues & Solutions

### Issue 1: Route Fetch Failing
**Symptoms:** Error message in console like "Route fetch ERROR"
**Solution:** CORS issue or network problem. The app should still work offline.

### Issue 2: No Route Points
**Symptoms:** "Route has 0 points" or undefined
**Solution:** Check if coordinates are valid

### Issue 3: Animation Already Running
**Symptoms:** "Already tracking, returning"
**Solution:** Refresh the page - state.isTracking might be stuck

### Issue 4: Ambulance Not Visible
**Symptoms:** Can't see ambulance on map
**Solution:** 
- Check if opacity is set to 0
- Zoom out to see full map
- Check if marker exists in console: `state.ambulanceMarker`

---

## 🔍 Manual Debugging Commands

Open browser console and type these commands:

### Check Animation State:
```javascript
state.isTracking  // Should be true when animating
state.routeGeometry.length  // Should be > 0
state.ambulanceMarker  // Should exist
```

### Force Animation Start:
```javascript
state.isTracking = false;  // Reset
beginRoadConstrainedAnimation();  // Restart
```

### Check Marker Position:
```javascript
state.ambulanceMarker.getLatLng()  // Current position
state.destination  // Target position
```

### Check Route Line:
```javascript
state.polyline  // Should exist (the black line on map)
state.routeGeometry  // Array of lat/lng points
```

---

## 🎯 Expected Behavior

**When Working Correctly:**

1. Page loads → "Connecting to Medical Command..."
2. ~1 second → "System optimized. Nearest Unit #103 found..."
3. ~2 seconds → Black route line appears on map
4. ~3 seconds → Ambulance marker becomes visible (opacity 1)
5. **Ambulance starts moving along the black line**
6. Ambulance rotates smoothly as it follows the route

**Animation Speed:**
- Progress step = 0.0012 per frame
- At 60fps, completes in ~14 minutes (sped up demo)
- Should see visible movement within 1-2 seconds

---

## ⚡ Quick Fix: Speed Up Animation

If ambulance is moving too slowly, add this to console:

```javascript
// Speed up 10x  
state.isTracking = false;
// Then edit the file and change line 332:
// const step = 0.0012;  to  const step = 0.012;
```

Or edit the file directly:
**File:** `ambulance-tracker.js`
**Line:** ~332
**Change:** `const step = 0.0012;` → `const step = 0.012;` (10x faster)

---

## 📊 What Should You See in Console?

**Successful Load:**
```
🚨 DEBUG: Fetching route from [77.61, 12.985] to [77.5946, 12.9716]
🚨 DEBUG: OSRM URL - https://router.project-osrm.org/route/v1/driving/...
🚨 DEBUG: Route response received {code: "Ok", routes: Array(1), ...}
🚨 DEBUG: Route has 156 points
🚨 DEBUG: Starting animation with 156 points
🚨 DEBUG: beginRoadConstrainedAnimation called, isTracking = false
🚨 DEBUG: Route geometry length: 156
🚨 DEBUG: Starting animation frame loop...
```

Then silence (animation is running in requestAnimationFrame loop).

---

## 🛠️ If Still Stuck

### Refresh the Page
```
Ctrl + Shift + R  (Hard refresh)
```

### Check Vite Server
Make sure the server is running:
```
npm run dev
```
Should show: `Local: http://localhost:5173/`

### Try the Demo Page
```
http://localhost:5173/dispatch-demo.html
```
Shows both apps side-by-side - easier to debug.

---

## 🎬 Expected Animation

The ambulance should:
- ✅ Start from nearest ambulance position (Unit #103 typically)
- ✅ Follow the black route line
- ✅ Rotate smoothly as it turns
- ✅ Move steadily toward your location
- ✅ Take ~30-60 seconds to arrive (at current speed)

---

## 📝 Report Back

After opening the console, let me know:
1. What debug messages do you see?
2. Are there any errors (red text)?
3. Does `state.routeGeometry.length` show a number > 0?
4. Is the ambulance visible on the map?

This will help me pinpoint the exact issue! 🚑
