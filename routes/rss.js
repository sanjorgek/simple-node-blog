var rss = require('rss');

// get main rss feed
exports.getMain = function(req, res, next){

  db.query("SELECT b.*\
    FROM blog  b\
    LEFT JOIN (\
      SELECT DISTINCT b.id as exc\
      FROM blog b\
      INNER JOIN blog_tags bt ON b.id=bt.blog_id\
      INNER JOIN tags t ON t.id=bt.tag_id AND t.exclude=1\
    ) as t1 ON b.id=t1.exc\
    WHERE b.visible=1 AND t1.exc IS NULL\
    GROUP BY b.id\
    ORDER BY b.id DESC \
    LIMIT 20", {
      type: Sequelize.QueryTypes.SELECT
    }).then(function(qres) {

      var feed = new rss({
          title: req.hostname,
          description: 'блог одного программиста',
          feed_url: 'http://' + req.hostname + '/rss/main.rss',
          site_url: 'http://' + req.hostname,
          image_url: 'http://' + req.hostname + '/img/cocainum.jpg',
          author: 'Ilya Rogojin',
          pubDate: dateformat(new Date(), "fullDate"),
          ttl: '600'
      });

      for (i in qres) {
        feed.item({
          title:  qres[i].header,
          description: qres[i].text.replace(/(\<img\ [^>]*src=\")(\/images)/g,'$1http://' + req.hostname + '$2'),
          url: 'http://' + req.hostname + '/post/' + qres[i].id + '/',
          date: qres[i].post_date
        });
      }

      res.end(feed.xml());
    });
};
