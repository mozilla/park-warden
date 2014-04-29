var restify = require("restify");

module.exports = function(redis_client) {
  var routes = require("./routes");
  var server = restify.createServer({
    name: "park-warden"
  });

  server.get("/api/contributions/:bucket/:date", routes.contributors(redis_client));

  return server;
};
