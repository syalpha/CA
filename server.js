const path = require('path');
const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');

const authRoutes = require('./src/routes/auth');
const attendanceRoutes = require('./src/routes/attendance');
const adminRoutes = require('./src/routes/admin');
const { requireAuth } = require('./src/auth');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'src', 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'ca-presence-secret-local',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 8 },
  })
);
app.use(flash());

app.use((req, res, next) => {
  res.locals.currentUser = req.session.user || null;
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  next();
});

app.use('/', authRoutes);
app.use('/presence', requireAuth, attendanceRoutes);
app.use('/admin', adminRoutes);

app.get('/', (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  if (req.session.user.role === 'admin') return res.redirect('/admin');
  return res.redirect('/presence');
});

app.use((req, res) => {
  res.status(404).render('404');
});

app.listen(PORT, () => {
  console.log(`Application de presence CA disponible sur http://localhost:${PORT}`);
});
