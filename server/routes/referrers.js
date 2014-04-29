module.exports = function(redis_client) {
  return function(req, res, next) {
    redis_client.smembers(["referrer_ids"], function(err, referrer_ids) {
      if (err) {
        return next(new restify.InternalError(err.toString()));
      }

      res.send(referrer_ids.map(function(rid) {
        return JSON.parse(rid);
      }));
      next();
    });
  };
};
