// server.js
const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
require('dotenv').config();
const PORT = process.env.PORT || 4000; 
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/gotogether';

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Connect to MongoDB
mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(()=> console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// Schemas
const rideSchema = new mongoose.Schema({
  driverName: { type: String, required: true },
  vehicle: String,
  contact: String,
  pickup: { type: String, required: true },
  dest: { type: String, required: true },
  time: String, // ISO string or hh:mm
  seatsAvailable: { type: Number, default: 1 },
  notes: String,
  createdAt: { type: Date, default: Date.now }
});

const bookingSchema = new mongoose.Schema({
  rideId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ride', required: true },
  riderName: { type: String, required: true },
  riderContact: String,
  createdAt: { type: Date, default: Date.now }
});

const Ride = mongoose.model('Ride', rideSchema);
const Booking = mongoose.model('Booking', bookingSchema);

// API routes
app.post('/api/rides', async (req, res) => {
  try {
    const { driverName, pickup, dest } = req.body;
    if (!driverName || !pickup || !dest) return res.status(400).json({ error: 'Missing required fields (driverName, pickup, dest)' });
    const ride = new Ride(req.body);
    await ride.save();
    res.status(201).json(ride);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create ride' });
  }
});

app.get('/api/rides', async (req, res) => {
  try {
    const { pickup, dest } = req.query;
    const q = {};
    if (pickup) q.pickup = new RegExp(pickup, 'i');
    if (dest) q.dest   = new RegExp(dest, 'i');
    const rides = await Ride.find(q).sort({ createdAt: -1 }).lean();
    res.json(rides);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch rides' });
  }
});

app.post('/api/bookings', async (req, res) => {
  const { rideId, riderName } = req.body;
  if (!rideId || !riderName) 
    return res.status(400).json({ error: 'Missing required fields (rideId, riderName)' });

  const ride = await Ride.findById(rideId);
  if (!ride) return res.status(404).json({ error: 'Ride not found' });
  if (ride.seatsAvailable <= 0) return res.status(400).json({ error: 'No seats available' });

  ride.seatsAvailable = Math.max(0, ride.seatsAvailable - 1);
  await ride.save();

  const booking = new Booking(req.body);
  await booking.save();

  res.status(201).json({ booking });
});


app.get('/api/bookings', async (req, res) => {
  try {
    const bookings = await Booking.find().sort({ createdAt: -1 }).populate('rideId').lean();
    res.json(bookings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => console.log(`GoTogether server running on http://localhost:${PORT}`));
