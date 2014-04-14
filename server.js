var redis_url = require("url").parse(process.env.REDIS_URL);
var redis_client = require("redis").createClient(redis_url.port, redis_url.hostname);
if (redis_url.auth) {
  redis_client.auth(redis_url.auth);
}
if (redis_url.pathname !== "/") {
  redis_client.select(redis_url.pathname.substring(1));
}

var async = require("async");
var http = require("http");
var querystring = require('querystring');

var server = http.createServer();
server.on("request", function(req, res) {
  console.time("http request");

  var query = require('url').parse(req.url).query;
  var queryDate = querystring.parse(query).date;
  var date;

  if (queryDate) {
    date = new Date(queryDate).valueOf();
  }

  if (isNaN(date)) {
    date = Date.now();
  }

  res.writeHead(200, {
    "Content-Type": "application/json; charset=utf-8"
  });

  var scan_index = 0;
  var user_ids = [];

  console.time("scan keys");
  async.doUntil(function fn(cb) {
    redis_client.scan([scan_index, "count", 1000, "match", "*:contributions"], function(err, data) {
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
    console.timeEnd("scan keys");
    if (err) {
      console.timeEnd("http request");
      return res.end(JSON.stringify({error: err.toString()}));
    }

    var one_year_ago = date - (365 * 24 * 60 * 60 * 1000);
    var total_active_contributors = 0;
    var seven_days_ago = date - (7 * 24 * 60 * 60 * 1000);
    var new_contributors_7_days = 0;

    var smembers = user_ids.map(function(uid) {
      return ["smembers", uid];
    });

    console.time("fetch data");
    redis_client.multi(smembers).exec(function(err, replies) {
      console.timeEnd("fetch data");
      if (err) {
        console.timeEnd("http request");
        return res.end(JSON.stringify({error: err.toString()}));
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

      console.timeEnd("http request");
      res.end(JSON.stringify({
        total_active_contributors: total_active_contributors,
        new_contributors_7_days: new_contributors_7_days
      }));
    });
  });
});

server.listen(process.env.PORT, function() {
  console.log("park-warden listening on http://localhost:%s", process.env.PORT);
});
