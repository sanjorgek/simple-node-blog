/**
 * blog module
 */

// update comments count for selected post
function updateCommentsCount(post_id) {
  // update comments quant
  db.q("UPDATE blog \
    SET comments_cnt=( \
      SELECT COUNT(*) \
        FROM comments \
        WHERE post_id=?) \
    WHERE blog_id=?",
    [
      post_id,
      post_id
    ]);
}

// get page list with posts
exports.blogList = function (req, res, next) {

  var pageSize = 5;
  var pageId = check.numeric(req.params.page_id, 1);
  if (pageId > 0) {
    pageId -= 1;
  }
  var tagId = check.numeric(req.params.tag_id, 0);
  var pageTitle = '';
  if (tagId != 0) {
    pageTitle = 'tag #' + tagId + ' - page #' + (pageId + 1);
  } else {
    pageTitle = 'page #' + (pageId + 1);
  }


  // listing options here
  var searchByTag, tagExclude;

  if (tagId != 0) {

      searchByTag = "INNER JOIN blog_tags bt ON bt.blog_id=b.id AND bt.tag_id=" + tagId;
      tagExclude = "";
  } else {

    searchByTag = "LEFT JOIN (\
      SELECT DISTINCT b.id as exc\
      FROM blog b\
      INNER JOIN blog_tags bt ON b.id=bt.blog_id\
      INNER JOIN tags t ON t.id=bt.tag_id AND t.exclude=1\
    ) as t1 ON b.id=t1.exc";
    tagExclude = "AND t1.exc IS NULL";
  }

  // select posts for listing
  db.query("SELECT b.*\
    FROM blog  b \
    " + searchByTag + " \
    WHERE b.visible=1 " + tagExclude + "\
    GROUP BY b.id\
    ORDER BY b.id " + ((req.params.sort == 'back') ? 'ASC' : 'DESC') + " \
    LIMIT :offset, :pageSize", {
    replacements: {offset: pageId * pageSize, pageSize: pageSize},
    type: Sequelize.QueryTypes.SELECT
  }).then(function(posts) {

      // count rows
      db.query("SELECT COUNT(b.id) AS cnt\
        FROM blog  b \
        " + searchByTag + " \
        WHERE b.visible=1 " + tagExclude, {
        type: Sequelize.QueryTypes.SELECT
      }).then(function (count) {

        Sequelize.Promise.map(posts, function(row) {
          var cur = db.query("SELECT t.* \
          FROM blog_tags bt \
          INNER JOIN tags t ON t.id=bt.tag_id \
          WHERE bt.blog_id=:blog_id", {
            replacements: {blog_id: row.id}
          }).then(function (tags) {
            row.tags = tags[0]; // strange..
            return row;
          });

          return cur;
        }).then(function() {

          res.render('blog_list', {
            posts: posts,
            pager_cnt: count[0].cnt, // total posts quant
            pager_size: pageSize, // page size, posts on page
            pager_current: (pageId + 1), // current page
            tagId: tagId, // current tag
            tags_line: req.tags_line, // all tags array
            title: pageTitle,
            sort: (req.params.sort == 'back') ? 'back' : ''
          });
        });
      });

  });

}

// delete one comment
exports.delComment = function (req, res, next) {
  comment_id = check.numeric(req.params.comment_id);

  db.getRow("SELECT * \
    FROM comments \
    WHERE comment_id=?",
    [
      comment_id
    ], function (err, comment) {
      if (err) return next(err);

      if (comment) {
        // if curren user is owner of comment or admin
        if (comment.user_id == req.userInfo.user_id || req.userInfo.role == 'admin') {
          db.q("DELETE \
            FROM comments \
            WHERE comment_id=?",
            [
              comment_id
            ], function (err, qres) {
              if (err) return next(err);

              // count comments count for post, async
              updateCommentsCount(comment.post_id);
              return res.redirect('back');
            });
        } else {
          return res.redirect('back');
        }
      } else {
        return res.redirect('back');
      }
    });
}

// one blog post
exports.blogPost = function (req, res, next) {
  var postId = check.numeric(req.params.post_id);

  md.Blog.find(postId).then(function(post) {

    db.query("SELECT t.* \
      FROM blog_tags bt \
      INNER JOIN tags t ON t.id=bt.tag_id \
      WHERE bt.blog_id=:blogId", {
      replacements: {blogId: post.id}
    }).then(function(tags) {

      return tags[0];
    }).then(function(tags) {

      var comm = db.query("SELECT c.*, u.name \
        FROM comments c \
        INNER JOIN users u ON u.user_id=c.user_id \
        WHERE post_id=:postId \
        ORDER BY c.comment_id ASC", {
        replacements: {postId: post.id}
      }).then(function(comments) {

        return {
          tags: tags,
          comments: comments[0]
        };
      });

      return comm;
    }).then(function(props) {

      // render post page
      res.render('blog_post', {
        fullTitle: post.header,
        post: post,
        host: req.headers.host,
        tags: props.tags,
        comments: props.comments
      });
    });
  });
}

// tags in header
exports.tagsLine = function (req, res, next) {

  md.Tags.hasMany(md.BlogTags, {foreignKey: 'tag_id'});
  md.Tags.findAll({
    include: [md.BlogTags],
    where: {
      exclude: 0
    },
    group: 'id',
    order: 'name'
  }).then(function(qres) {

    req.tags_line = qres;
    next();
  });
}

// add comment
exports.newComment = function (req, res) {
  post_id = check.numeric(req.body.post_id);

  if (req.userInfo.auth == 1) {

    db.getRow("SELECT * \
      FROM blog \
      WHERE blog_id=?",
      [
        post_id
      ], function (err, post) {
        if (err) return next(err);

        if (post) {
          db.q("INSERT comments \
            SET post_id=?, user_id=?, pub_date=NOW(), text=?",
            [
              post_id,
              req.userInfo.user_id,
              req.body.text
            ], function (err, res) {
              if (err) return next(err);

              // count commets count for post, async
              updateCommentsCount(post.blog_id);

              db.lastId(function (err, commentId) {
                if (err) return next(err);

                // send email
                if (appConfig.send_comment_notice && appConfig.comment_notice_email) {
                  var Email = require('email').Email;
                  new Email(
                    { from: "noreply@" + req.headers.host,
                      to: appConfig.comment_notice_email,
                      subject: "Новый комментарий #" + commentId,
                      body: "Пользователь " + req.userInfo.name +
                        " оставил новый комментарий в блоге: http://" +
                        req.headers.host + "/post/" + post.blog_id + "/"
                    }).send(function (err) {
                      // gag for errors
                      console.log('cant send email now for comment #' + commentId);
                    });
                }
              }); // last id
            }); // get comments
        }

      });
  }

  // go back
  if (post_id > 0) {
    res.redirect('/post/' + post_id + '/');
    return;
  } else {
    res.redirect('/');
    return;
  }

}

exports.blogPostsList = function (req, res, next) {

  var tagId = check.numeric(req.params.tag_id, 0);

  if (tagId != 0) {

    searchByTag = "INNER JOIN blog_tags bt ON bt.blog_id=b.id AND bt.tag_id=" + tagId;
    tagExclude = "";
  } else {

    searchByTag = "LEFT JOIN (\
        SELECT DISTINCT b.id as exc\
        FROM blog b\
        INNER JOIN blog_tags bt ON b.id=bt.blog_id\
        INNER JOIN tags t ON t.id=bt.tag_id AND t.exclude=1\
      ) as t1 ON b.id=t1.exc";
    tagExclude = "AND t1.exc IS NULL";
  }

  db.query("SELECT b.* \
    FROM blog  b \
    " + searchByTag + " \
    WHERE b.visible=1 " + tagExclude + "\
    ORDER BY b.id DESC", {
    type: Sequelize.QueryTypes.SELECT
  }).then(function(qres) {

      res.render('blog_posts_list', {
        title: 'full list of notes',
        posts: qres,
        tags_line: req.tags_line,
        tags_line_link: 'full-list',
        tagId: tagId
      });
    });
}
