var redis_url = require("url").parse(process.env.REDIS_URL);
var redis_client = require("redis").createClient(redis_url.port, redis_url.hostname);
if (redis_url.auth) {
  redis_client.auth(redis_url.auth);
}
if (redis_url.pathname && redis_url.pathname !== "/") {
  redis_client.select(redis_url.pathname.substring(1));
}

var server = require("./server")(redis_client);

server.listen(process.env.PORT, function() {
  console.log("%s listening at %s", server.name, server.url);
});
