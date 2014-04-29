var async = require("async");

var validBuckets = [
  "events"
];

module.exports = function(redis_client) {
  return function(req, res, next) {
    var bucket = req.params.bucket;
    if (validBuckets.indexOf(bucket) === -1) {
      return next(new restify.InvalidArgumentError("'bucket' must be one of " + validBuckets));
    }

    var date = new Date(req.params.date).valueOf();
    if (isNaN(date)) {
      return next(new restify.InvalidArgumentError("'date' must be a valid Date"));
    }

    var scan_index = 0;
    var user_ids = [];
    var scanPattern = "*:contributions:" + bucket;

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
        return next(new restify.InternalError(err.toString()));
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
          return next(new restify.InternalError(err.toString()));
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
  };
};
