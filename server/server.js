var async = require("async");
var restify = require("restify");

var validBuckets = [
  "events"
];

module.exports = function(redis_client) {
  var server = restify.createServer({
    name: "park-warden"
  });

  server.use(restify.queryParser());

  server.get("/", function(req, res, next) {
    var bucket = req.query.bucket;
    var date;
    var queryDate = req.query.date;

    if ( validBuckets.indexOf(bucket) === -1 ) {
      bucket = "";
    }
    if (queryDate) {
      date = new Date(queryDate).valueOf();
    }
    if (isNaN(date)) {
      date = Date.now();
    }

    var scan_index = 0;
    var user_ids = [];
    var scanPattern = bucket ? "*:contributions:" + bucket : "*:contributions";

    async.doUntil(function fn(cb) {
      redis_client.scan([scan_index, "count", 1000, "match", scanPattern], function(err, data) {
        if (err) {
          return cb(err);
        }

        scan_index = parseInt(data.shift(), 10);
        user_ids = user_ids.concat(data[0]);
        cb();
      });
    }, function test() {
      return scan_index === 0;
    }, function done(err) {
      if (err) {
        res.send({error: err.toString()});
        return next();
      }

      var one_year_ago = date - (365 * 24 * 60 * 60 * 1000);
      var total_active_contributors = 0;
      var seven_days_ago = date - (7 * 24 * 60 * 60 * 1000);
      var new_contributors_7_days = 0;

      var smembers = user_ids.map(function(uid) {
        return ["smembers", uid];
      });

      redis_client.multi(smembers).exec(function(err, replies) {
        if (err) {
          res.send({error: err.toString()});
          return next();
        }

        replies.forEach(function(contributor) {
          if (contributor.some(function(contribution_date) {
            var temp_date = new Date(contribution_date).valueOf();

            return temp_date > one_year_ago && temp_date < date;
          })) {
            total_active_contributors++;
          }

          if (contributor.some(function(contribution_date) {
            var temp_date = new Date(contribution_date).valueOf();

            return temp_date > seven_days_ago && temp_date < date;
          })) {
            new_contributors_7_days++;
          }
        });

        res.send({
          total_active_contributors: total_active_contributors,
          new_contributors_7_days: new_contributors_7_days
        });
        next();
      });
    });
  });

  return server;
};
