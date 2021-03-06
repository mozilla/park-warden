var restify = require("restify");

module.exports = function(redis_client) {
  var routes = require("./routes");
  var server = restify.createServer({
    name: "park-warden"
  });

  server.use(restify.CORS({
    origins: ['*']
  }));

  server.get("/api/contributions/:bucket/:date", routes.contributors(redis_client));
  server.get("/api/referrers", routes.referrers(redis_client));

  return server;
};
