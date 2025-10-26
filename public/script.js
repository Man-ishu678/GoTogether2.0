// API helpers
async function getRidesApi(pickup='', dest=''){
  const res = await fetch('/rides?pickup='+encodeURIComponent(pickup)+'&dest='+encodeURIComponent(dest));
  return await res.json();
}

async function getBookingsApi(){
  const res = await fetch('/bookings');
  return await res.json();
}

async function postBookingApi(data){
  return fetch('/bookings',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify(data)
  });
}

async function postRideApi(data) {
  return fetch('/api/rides', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
}

function escapeHtml(text){
  if(!text) return '';
  return text.replace(/[&<>"']/g, function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m];});
}

// Seed demo rides
async function seedDemo(){
  await fetch('/seed', {method:'POST'});
}
