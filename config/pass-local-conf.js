var passport = require('passport')
  , LocalStrategy = require('passport-local').Strategy;

var bcrypt = require('bcrypt'),
  SALT_WORK_FACTOR = 10;

/**
 * passport local conf
 * @param app
 */
module.exports = function(app)
{
    passport.use(new LocalStrategy(
        function(login, pass, next) {

          db.getRow("SELECT * \
            FROM users \
            WHERE login=?\
              AND login<>''",
            [
              login
            ], function(err, user){
              if (err) return next(err);

              if(!user) {
                return next(null, false);
              }
              bcrypt.compare(pass, user.pass, function(err, isMatch) {
                if(err) return next(err);
                if(isMatch) next(null, user);
                else return next(null, false);
              });
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
