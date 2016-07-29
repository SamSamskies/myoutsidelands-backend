const express = require('express');
const  router = express.Router();

const SpotifyWebApi = require('spotify-web-api-node');
const scopes = [
  'user-top-read',
  'user-read-email',
  'user-follow-read'
];
const spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  redirectUri: process.env.SPOTIFY_AUTH_CALLBACK
});
const spotifyAuthorizeUrl = spotifyApi.createAuthorizeURL(scopes);

router.get('/', function(req, res, next) {
  res.render('index', { spotifyAuthorizeUrl });
});

module.exports = router;
