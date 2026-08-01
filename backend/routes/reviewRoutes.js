const express = require('express');
const router = express.Router();
const Review = require('../models/Review');
const Booking = require('../models/Booking');
const auth = require('../middleware/auth');
const { notify } = require('../utils/notificationService');

router.post('/', auth, async (req, res) => {
  try {
    const bookingId = req.body.bookingId;
    const rating = Number(req.body.rating);
    const comment = String(req.body.comment || '').trim();
    if (!bookingId || !Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Choose a rating from 1 to 5.' });
    }
    const booking = await Booking.findOne({ _id: bookingId, customer: req.user.id });
    if (!booking) return res.status(404).json({ message: 'Booking not found.' });
    if (booking.status !== 'Completed') return res.status(400).json({ message: 'You can review a completed service only.' });
    if (!booking.provider) return res.status(400).json({ message: 'This booking has no assigned worker.' });
    const review = await Review.findOneAndUpdate(
      { booking: booking._id },
      { booking: booking._id, customer: req.user.id, provider: booking.provider, service: booking.service, rating, comment, status: 'Published' },
      { new: true, upsert: true, runValidators: true }
    );
    req.app.get('io')?.emit('review-updated', { providerId: booking.provider, bookingId: booking._id });
    await notify({ app:req.app, user:booking.provider, title:'New customer review', message:`You received a ${rating}-star review.`, type:'review', link:'provider.html', metadata:{ bookingId:booking._id, reviewId:review._id } });
    res.json({ message: 'Thank you. Your review has been saved.', review });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get('/mine', auth, async (req, res) => {
  try {
    const reviews = await Review.find({ customer: req.user.id }).select('booking rating comment createdAt');
    res.json(reviews);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get('/provider-summary', auth, async (req, res) => {
  try {
    const providerId = req.user.id;
    const reviews = await Review.find({ provider: providerId, status: 'Published' })
      .populate('customer', 'name')
      .populate('service', 'name')
      .sort({ createdAt: -1 });
    const count = reviews.length;
    const average = count ? reviews.reduce((sum, r) => sum + r.rating, 0) / count : 0;
    res.json({ average: Number(average.toFixed(1)), count, recent: reviews.slice(0, 5) });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get("/public", async (req, res) => {
    try {
        const reviews = await Review.find({
            status: "Published"
        })
            .populate("customer", "name")
            .populate("service", "name")
            .sort({ createdAt: -1 })
            .limit(20)
            .lean();

        const count = reviews.length;

        const average = count
            ? reviews.reduce(
                (sum, review) =>
                    sum + Number(review.rating || 0),
                0
            ) / count
            : 0;

        return res.json({
            success: true,
            average: Number(average.toFixed(1)),
            count,
            reviews
        });
    } catch (err) {
        console.error("Unable to load public reviews:", err);

        return res.status(500).json({
            success: false,
            message: "Unable to load customer reviews"
        });
    }
});
module.exports = router;
