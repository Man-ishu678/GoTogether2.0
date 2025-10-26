// fare.js
// Constants (as confirmed)
const FARE_PER_KM = 7; // ₹7 per km
const AVG_SPEED_KMPH = 40; // 40 km/hr for ETA calculation

export function calcFare(distanceMeters) {
  const km = distanceMeters / 1000;
  const fare = Math.max(10, Math.round(km * FARE_PER_KM)); // minimum fare guard
  return { km: km.toFixed(2), fare, distanceMeters };
}

export function calcETA(distanceMeters) {
  const km = distanceMeters / 1000;
  const hours = km / AVG_SPEED_KMPH;
  const minutes = Math.round(hours * 60);
  return minutes; // ETA in minutes
}

