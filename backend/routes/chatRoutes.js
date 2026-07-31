const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Booking = require('../models/Booking');
const Message = require('../models/Message');
const User = require('../models/User');

router.use(auth);

async function allowedBooking(req, res) {
  const booking = await Booking.findById(req.params.bookingId)
    .populate('customer', 'name email phone')
    .populate('provider', 'name email phone')
    .populate('service', 'name');
  if (!booking) { res.status(404).json({ message: 'Booking not found.' }); return null; }
  const user = await User.findById(req.user.id).select('role isActive');
  if (!user || user.isActive === false) { res.status(403).json({ message: 'Account is inactive.' }); return null; }
  const isCustomer = String(booking.customer?._id) === String(req.user.id);
  const isProvider = booking.provider && String(booking.provider._id) === String(req.user.id);
  const isAdmin = user.role === 'admin';
  if (!isCustomer && !isProvider && !isAdmin) { res.status(403).json({ message: 'You cannot access this conversation.' }); return null; }
  if (!booking.provider && !isAdmin) { res.status(409).json({ message: 'Chat becomes available after a worker is assigned.' }); return null; }
  return { booking, user };
}

router.get('/:bookingId', async (req, res) => {
  try {
    const access = await allowedBooking(req, res); if (!access) return;
    const messages = await Message.find({ booking: req.params.bookingId })
      .populate('sender', 'name role').sort({ createdAt: 1 }).limit(300);
    await Message.updateMany({ booking: req.params.bookingId, sender: { $ne: req.user.id }, readBy: { $ne: req.user.id } }, { $addToSet: { readBy: req.user.id } });
    res.json({ booking: access.booking, messages });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post('/:bookingId', async (req, res) => {
  try {
    const access = await allowedBooking(req, res); if (!access) return;
    if (['Completed','Cancelled'].includes(access.booking.status)) return res.status(409).json({ message: 'This conversation is closed.' });
    const text = String(req.body.text || '').trim();
    if (!text) return res.status(400).json({ message: 'Enter a message.' });
    if (text.length > 1000) return res.status(400).json({ message: 'Message is too long.' });
    const message = await Message.create({ booking: req.params.bookingId, sender: req.user.id, senderRole: access.user.role, text, readBy: [req.user.id] });
    await message.populate('sender', 'name role');
    req.app.get('io')?.emit('chat-message', { bookingId: req.params.bookingId, message });
    res.status(201).json(message);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
