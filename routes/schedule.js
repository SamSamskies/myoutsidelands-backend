const NodeCache = require('node-cache');
const Promise = require('bluebird');
const _ = require('underscore');
const SpotifyWebApi = require('spotify-web-api-node');

const schedule = require('../schedule.json');

const express = require('express');
const router = express.Router();
const cache = new NodeCache({ stdTTL: 600 });

router.get('/', function(req, res) {
  res.json(cache.get(req.query.email));
});

router.get('/auth-callback', function(req, res) {
  const spotifyApi = new SpotifyWebApi({
    clientId: process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
    redirectUri: process.env.SPOTIFY_AUTH_CALLBACK
  });

  spotifyApi.authorizationCodeGrant(req.query.code)
    .then((data) => spotifyApi.setAccessToken(data.body.access_token))
    .then(() => getEmail(spotifyApi))
    .then((email) => {
      const url = `http://schedule.myoutsidelands.com?email=${email}`;
      const cachedSchedule = cache.get(email);

      if (cachedSchedule) {
        res.redirect(url);
      } else {
        createNewSchedule(spotifyApi, email)
          .then((scheduleWithTags) => {
            cache.set(email, scheduleWithTags);
            res.redirect(url);
          });
      }
    })
});

function createNewSchedule(spotifyApi) {
  return getLikedArtists(spotifyApi)
    .then(({ names, topArtistIds }) => {
      return Promise.props({
        likedArtists: names,
        recommendedArtists: getRecommendedArtists(spotifyApi, topArtistIds)
      });
    })
    .then(({ likedArtists, recommendedArtists }) => addTagsToSchedule(likedArtists, recommendedArtists))
}

function getEmail(spotifyApi) {
  return spotifyApi.getMe()
    .then((data) => data.body.email);
}

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
      const topArtistIds = _.pluck(_.first(topArtists, 40), 'id');

      return {
        names: _.uniq(topArtistNames.concat(followedArtistNames)),
        topArtistIds
      };
    });
}

function getRecommendedArtists(spotifyApi, topArtistIds) {
  return Promise.map(topArtistIds, (id) => getRelatedArtists(spotifyApi, id))
    .then((arrayOfRelatedArtists) => _.uniq(_.flatten(arrayOfRelatedArtists)));
}

function getRelatedArtists(spotifyApi, id) {
  return spotifyApi.getArtistRelatedArtists(id)
    .then((data) => _.pluck(data.body.artists, 'name').map((name) => name.toLowerCase()));
}

function addTagsToSchedule(likedArtists, recommendedArtists) {
  return schedule.map((timeSlotRecord) => {
      const tag = getTagForArtist(timeSlotRecord.name, likedArtists, recommendedArtists);
      return Object.assign({ tag }, timeSlotRecord);
    });
}

function getTagForArtist(artistName, likedArtists, recommendedArtists) {
  if (likedArtists.find((likedArtistName) => artistName.includes(likedArtistName))) {
    return 'liked';
  }

  if (recommendedArtists.find((recommendedArtistName) => artistName.includes(recommendedArtistName))) {
    return 'recommended';
  }

  return null;
}

module.exports = router;
