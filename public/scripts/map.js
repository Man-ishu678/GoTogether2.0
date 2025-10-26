// map.js
// This file sets up Leaflet map, routing, marker placement, route calculation and simulated bike movement.

// dynamic import fallback if modules unsupported
(async function () {
  let fareModule;
  try {
    fareModule = await import('/scripts/fare.js');
  } catch (e) {
    // fallback: create simple inline functions if import fails
    fareModule = {
      calcFare(distanceMeters) {
        const km = distanceMeters / 1000;
        const fare = Math.max(10, Math.round(km * 7));
        return { km: km.toFixed(2), fare, distanceMeters };
      },
      calcETA(distanceMeters) {
        const km = distanceMeters / 1000;
        const minutes = Math.round((km / 40) * 60);
        return minutes;
      }
    };
  }

  // Map init
  const map = L.map('map', { zoomControl: false }).setView([17.3850, 78.4867], 13); // Hyderabad default
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  // UI elements
  const pickupText = document.getElementById('pickup-text');
  const dropText = document.getElementById('drop-text');
  const distanceText = document.getElementById('distance-text');
  const etaText = document.getElementById('eta-text');
  const fareText = document.getElementById('fare-text');
  const confirmCard = document.getElementById('confirm-card');
  const confirmMsg = document.getElementById('confirm-msg');
  const calcBtn = document.getElementById('calc-route');
  const confirmBtn = document.getElementById('confirm-ride');
  const resetBtn = document.getElementById('reset-btn');

  let pickupMarker = null;
  let dropMarker = null;
  let routeControl = null;
  let lastRoute = null;
  let simulatedDriver = null;
  let driverMarker = null;
  let animationHandle = null;

  // custom bike icon
  const bikeIcon = L.icon({
    iconUrl: '/assets/bike-marker.png', // create this file in public/assets/
    iconSize: [42, 42],
    iconAnchor: [21, 21],
  });

  // helper to format latlng
  function fmtLatLng(latlng) {
    return `${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}`;
  }

  map.on('click', function(e) {
    // first click sets pickup, second sets drop
    if (!pickupMarker) {
      pickupMarker = L.marker(e.latlng, { draggable: true }).addTo(map);
      pickupMarker.bindPopup('Pickup').openPopup();
      pickupText.textContent = fmtLatLng(e.latlng);
      pickupMarker.on('drag', () => { pickupText.textContent = fmtLatLng(pickupMarker.getLatLng()); });
    } else if (!dropMarker) {
      dropMarker = L.marker(e.latlng, { draggable: true }).addTo(map);
      dropMarker.bindPopup('Drop').openPopup();
      dropText.textContent = fmtLatLng(e.latlng);
      dropMarker.on('drag', () => { dropText.textContent = fmtLatLng(dropMarker.getLatLng()); });
    } else {
      // if both present, clicking resets drop marker
      dropMarker.setLatLng(e.latlng);
      dropText.textContent = fmtLatLng(e.latlng);
    }
  });

  calcBtn.addEventListener('click', async () => {
    if (!pickupMarker || !dropMarker) {
      alert('Please select both pickup and drop points on the map.');
      return;
    }

    // remove old route if present
    if (routeControl) {
      map.removeControl(routeControl);
      routeControl = null;
    }

    // Use Leaflet Routing Machine with OSRM demo backend
    routeControl = L.Routing.control({
      waypoints: [pickupMarker.getLatLng(), dropMarker.getLatLng()],
      router: L.Routing.osrmv1({
        serviceUrl: 'https://router.project-osrm.org/route/v1'
      }),
      createMarker: function() { return null; }, // hide default markers
      addWaypoints: false,
      lineOptions: { styles: [{ color: '#2563eb', weight: 4 }] },
      show: false,
      fitSelectedRoutes: true,
    }).addTo(map);

    routeControl.on('routesfound', function(e) {
      const route = e.routes[0];
      lastRoute = route;
      const distance = route.summary.totalDistance; // meters
      const res = fareModule.calcFare(distance);
      const etaMin = fareModule.calcETA(distance);

      distanceText.textContent = `Distance: ${res.km} km`;
      fareText.textContent = `Fare: ₹${res.fare}`;
      etaText.textContent = `ETA: ${etaMin} min`;

      confirmCard.classList.add('hidden');
    });

    routeControl.on('routingerror', function(e) {
      alert('Routing error. Please try again or adjust points.');
    });
  });

  confirmBtn.addEventListener('click', () => {
    if (!lastRoute) {
      alert('Calculate route first.');
      return;
    }
    // Show confirmation
    const distance = lastRoute.summary.totalDistance;
    const res = fareModule.calcFare(distance);
    const etaMin = fareModule.calcETA(distance);

    confirmMsg.innerHTML = `<strong>Ride Confirmed</strong><br/>
      Vehicle: ${document.getElementById('vehicle-select').value.toUpperCase()}<br/>
      Distance: ${res.km} km • Fare: ₹${res.fare} • ETA: ${etaMin} min`;

    confirmCard.classList.remove('hidden');

    // start driver simulation
    startDriverSimulation(lastRoute);
  });

  resetBtn.addEventListener('click', () => {
    if (pickupMarker) { map.removeLayer(pickupMarker); pickupMarker = null; pickupText.textContent = 'Not selected'; }
    if (dropMarker) { map.removeLayer(dropMarker); dropMarker = null; dropText.textContent = 'Not selected'; }
    if (routeControl) { map.removeControl(routeControl); routeControl = null; lastRoute = null; }
    if (driverMarker) { map.removeLayer(driverMarker); driverMarker = null; }
    if (animationHandle) { cancelAnimationFrame(animationHandle); animationHandle = null; }
    distanceText.textContent = 'Distance: —';
    fareText.textContent = 'Fare: —';
    etaText.textContent = 'ETA: —';
    confirmCard.classList.add('hidden');
  });

  // Driver simulation: pick a nearby random point as driver start and move towards pickup then to drop.
  function startDriverSimulation(route) {
    // compute polyline points from route.coordinates
    const coords = route.coordinates.map(c => L.latLng(c.lat, c.lng));
    if (!coords || coords.length === 0) return;

    // choose a starting point a little away from route[0] (pickup) - random offset
    const pickup = coords[0];
    const start = L.latLng(pickup.lat + (Math.random() * 0.01 + 0.002), pickup.lng + (Math.random() * 0.01 + 0.002));

    if (driverMarker) map.removeLayer(driverMarker);
    driverMarker = L.marker(start, { icon: bikeIcon }).addTo(map).bindPopup('Driver (bike)').openPopup();

    // path: start -> pickup -> rest of route
    const path = [start].concat(coords);

    animateAlongPath(driverMarker, path, 80, () => {
      // Arrived at pickup: wait 1.5s then move to drop
      driverMarker.bindPopup('Picked you up!').openPopup();
      setTimeout(() => {
        const dropCoords = route.coordinates.map(c => L.latLng(c.lat, c.lng));
        // animate to drop (reverse of remaining path)
        animateAlongPath(driverMarker, dropCoords, 60, () => {
          driverMarker.bindPopup('Ride complete').openPopup();
        });
      }, 1500);
    });
  }

  // animateAlongPath: marker moves along a list of latlngs, speed in meters per second
  // speedMetersPerHour param used to pace animation roughly (not physically exact)
  function animateAlongPath(marker, latlngs, speedMetersPerHour = 40, onComplete) {
    if (!latlngs || latlngs.length < 2) {
      if (onComplete) onComplete();
      return;
    }

    // create an array of segment lengths and cumulative distances
    const segs = [];
    let total = 0;
    for (let i = 0; i < latlngs.length - 1; i++) {
      const a = latlngs[i];
      const b = latlngs[i+1];
      const segLen = a.distanceTo(b);
      segs.push({ a, b, len: segLen });
      total += segLen;
    }

    // animation state
    let segIndex = 0;
    let segProgress = 0; // meters progressed in current segment
    const speedMps = (speedMetersPerHour * 1000) / 3600; // meter per second

    let lastTime = null;
    function step(now) {
      if (!lastTime) lastTime = now;
      const dt = (now - lastTime) / 1000; // seconds
      lastTime = now;

      const moveBy = speedMps * dt;
      segProgress += moveBy;

      while (segIndex < segs.length && segProgress > segs[segIndex].len) {
        segProgress -= segs[segIndex].len;
        segIndex++;
      }

      if (segIndex >= segs.length) {
        marker.setLatLng(latlngs[latlngs.length - 1]);
        if (onComplete) onComplete();
        return;
      }

      const s = segs[segIndex];
      const ratio = s.len === 0 ? 0 : segProgress / s.len;
      const lat = s.a.lat + (s.b.lat - s.a.lat) * ratio;
      const lng = s.a.lng + (s.b.lng - s.a.lng) * ratio;
      marker.setLatLng([lat, lng]);

      animationHandle = requestAnimationFrame(step);
    }

    animationHandle = requestAnimationFrame(step);
  }

})();
