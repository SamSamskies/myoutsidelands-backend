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
    .then(({ names, topTenArtistIds }) => {
      return Promise.props({
        likedArtists: names,
        recommendedArtists: getRecommendedArtists(spotifyApi, topTenArtistIds)
      });
    })
    .then(({ likedArtists, recommendedArtists }) => {
      return {
        likedArtists,
        recommendedArtists: _.reject(recommendedArtists, (artist) => likedArtists.includes(artist))
      }
    })
    .then((payload) => res.json(payload))
    .catch((err) => res.json(err))
});

function getTopArtists(spotifyApi) {
  return spotifyApi.getMyTopArtists({ limit: 50 })
    .then((data) => data.body.items);
}

function getFollowedArtists(spotifyApi) {
  return spotifyApi.getFollowedArtists({ limit: 50 })
    .then((data) => data.body.artists.items);
}

function getLikedArtists(spotifyApi) {
  return Promise.all([getTopArtists(spotifyApi), getFollowedArtists(spotifyApi)])
    .spread((topArtists, followedArtists) => {
      const topArtistNames = _.pluck(topArtists, 'name').map((name) => name.toLowerCase());
      const followedArtistNames = _.pluck(followedArtists, 'name').map((name) => name.toLowerCase());
      const topTenArtistIds = _.pluck(_.first(topArtists, 10), 'id');

      return {
        names: _.uniq(topArtistNames.concat(followedArtistNames)),
        topTenArtistIds
      };
    });
}

function getRecommendedArtists(spotifyApi, topTenArtistIds) {
  return Promise.map(topTenArtistIds, (id) => getRelatedArtists(spotifyApi, id))
    .then((arrayOfRelatedArtists) => _.uniq(_.flatten(arrayOfRelatedArtists)));
}

function getRelatedArtists(spotifyApi, id) {
  return spotifyApi.getArtistRelatedArtists(id)
    .then((data) => _.pluck(data.body.artists, 'name').map((name) => name.toLowerCase()));
}

module.exports = router;
