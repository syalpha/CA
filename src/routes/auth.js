const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const { findUserByUsername } = require('../data');

router.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/');
  res.render('login');
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await findUserByUsername((username || '').trim());
  if (!user || !bcrypt.compareSync(password || '', user.passwordHash)) {
    req.flash('error', 'Identifiants incorrects.');
    return res.redirect('/login');
  }
  req.session.user = {
    id: user.id,
    username: user.username,
    role: user.role,
    sectionId: user.sectionId,
    nomAffichage: user.nomAffichage,
  };
  res.redirect(user.role === 'admin' ? '/admin' : '/presence');
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

module.exports = router;
