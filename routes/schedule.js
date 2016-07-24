const SpotifyWebApi = require('spotify-web-api-node');
const express = require('express');
const router = express.Router();

const scopes = [
  'user-top-read',
  'user-read-email',
];

router.get('/', function(req, res, next) {
  const spotifyApi = new SpotifyWebApi({
    clientId: process.env.SPOTIFY_CLIENT_ID,
    redirectUri: process.env.SPOTIFY_AUTH_CALLBACK
  });
  const authorizeUrl = spotifyApi.createAuthorizeURL(scopes)

  res.redirect(authorizeUrl);
});

router.get('/auth-callback', function(req, res, next) {
  const spotifyApi = new SpotifyWebApi({
    clientId: process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
    redirectUri: process.env.SPOTIFY_AUTH_CALLBACK
  });

  spotifyApi.authorizationCodeGrant(req.query.code)
    .then((data) => spotifyApi.setAccessToken(data.body.access_token))
    .then(() => spotifyApi.getMyTopArtists({ limit: 50 }))
    .then((data) => {
      const artists = data.body.items.map(({ name }) => name);
      res.json(artists)
    })
    .catch((err) => req.json(err))
});



module.exports = router;
