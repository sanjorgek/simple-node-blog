var passport = require('passport')
  , LocalStrategy = require('passport-local').Strategy;

/**
 * passport local conf
 * @param app
 */
module.exports = function(app)
{
    passport.use(new LocalStrategy(
        function(login, pass, next) {
          var crypto = require('crypto');
          var hash = crypto.createHash('md5').update(pass).digest('hex');

          db.query("SELECT * " +
          "FROM users " +
          "WHERE login=:login AND pass=:password " +
          "LIMIT 1",{
            replacements: {
              login: login,
              password: hash
            },
            type: Sequelize.QueryTypes.SELECT
          }).then(function(user) {
            if (user[0]) {

              return next(null, user[0]);
            } else {

              return next(null, null);
            }
          });
        }
    ));

    // local auth routes here
    app.post('/auth/local',
        passport.authenticate('local', { failureRedirect: '/login', failureFlash: 'passport-error' }),
        function(req, res) {
          req.session.sys_auth = 1;
          req.session.auth_type = 'local';
          // set user params
          require('../routes/auth').set_user(req, function(){
            res.redirect('/');
          });
    });
};
