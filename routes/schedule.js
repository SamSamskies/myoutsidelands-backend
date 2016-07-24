const Promise = require('bluebird');
const _ = require('underscore');
const SpotifyWebApi = require('spotify-web-api-node');
const express = require('express');
const router = express.Router();

const scopes = [
  'user-top-read',
  'user-read-email',
  'user-follow-read'
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
    .then(() => getLikedArtists(spotifyApi))
    .then((likedArtists) => ({ likedArtists }))
    .then((payload) => res.json(payload))
    .catch((err) => req.json(err))
});

function getTopArtists(spotifyApi) {
  return spotifyApi.getMyTopArtists({ limit: 50 })
    .then((data) => data.body.items.map(({ name }) => name.toLowerCase()));
}

function getFollowedArtists(spotifyApi) {
  return spotifyApi.getFollowedArtists({ limit: 50 })
    .then((data) => data.body.artists.items.map(({ name }) => name.toLowerCase()));
}

function getLikedArtists(spotifyApi) {
  return Promise.all([getTopArtists(spotifyApi), getFollowedArtists(spotifyApi)])
    .spread((topArtists, followedArtists) => _.uniq(topArtists.concat(followedArtists)));
}

module.exports = router;
