var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var bodyParser = require('body-parser');
var bcrypt = require('bcrypt-nodejs');
var session = require('express-session');
var passport = require('passport');
var GitHubStrategy = require('passport-github').Strategy;
var credentials = require('./credentials.js');


var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');

var app = express();

passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(obj, done) {
  done(null, obj);
});


passport.use(new GitHubStrategy({
    clientID: credentials.GITHUB_CLIENT_ID,
    clientSecret: credentials.GITHUB_CLIENT_SECRET,
    callbackURL: "http://127.0.0.1:4568/auth/github/callback"
  },

  function(accessToken, refreshToken, profile, done) {
    process.nextTick(function() {
      return done(null, profile);
    });
  }
));

app.use(session({secret: 'lol bbq', resave: false, saveUninitialized: true}));
app.use(passport.initialize());
app.use(passport.session());
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(partials());
// Parse JSON (uniform resource locators)
app.use(bodyParser.json());
// Parse forms (signup/login)
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));

var validateUser = function(req, res, next) {
  if (req.isAuthenticated()) {
      return next();
  }
  res.redirect('/login');
};

app.get('/', validateUser,
function(req, res) {
  res.render('index');
});

app.get('/create', validateUser,
function(req, res) {
  res.render('index');
});

app.get('/links', validateUser,
function(req, res) {
  Links.reset().fetch().then(function(links) {
    res.send(200, links.models);
  });
});

app.get('/auth/github/callback',
  passport.authenticate('github', { failureRedirect: '/login' }),
  function(req, res) {
    // Successful authentication, redirect home.
    res.redirect('/');
  });

app.get('/signup',
function(req, res) {
  res.redirect('/login');
});

app.get('/github-login', passport.authenticate('github'), function(){});

app.get('/login',
function(req, res) {
  res.render('login');
});

app.get('/logout',
function(req, res) {
  req.session.userId = null;
  res.redirect("/login");
});


app.post('/login',
  function(req, res) {
    var username = req.body.username;
    var password = req.body.password;
    db.knex('users').where({
      name: username
    }).select('*').then(function(data) {
      if (!data.length) {
        res.redirect('/login');
      } else {
        bcrypt.compare(password, data[0].hash, function(err, result) {
          if (!result) {
            res.redirect('/login');
          } else {
            req.session.userId = data[0].id;
            res.redirect('/');
          }
        });
      }
    });
  });

app.post('/signup',
function(req, res) {
  var username = req.body.username;
  var password = req.body.password;
  var user = new User({name: username, hash: password}, function(userId) {
    req.session.userId = userId;
    res.redirect('/');
  });
});

app.post('/links', validateUser,
function(req, res) {

  var uri = req.body.url;

  if (!util.isValidUrl(uri)) {
    console.log('Not a valid url: ', uri);
    return res.send(404);
  }

  new Link({ url: uri }).fetch().then(function(found) {
    if (found) {
      res.send(200, found.attributes);
    } else {
      util.getUrlTitle(uri, function(err, title) {
        if (err) {
          console.log('Error reading URL heading: ', err);
          return res.send(404);
        }

        var link = new Link({
          url: uri,
          title: title,
          base_url: req.headers.origin
        });

        link.save().then(function(newLink) {
          Links.add(newLink);
          res.send(200, newLink);
        });
      });
    }
  });
});

/************************************************************/
// Write your authentication routes here
/************************************************************/



/************************************************************/
// Handle the wildcard route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/*', function(req, res) {
  new Link({ code: req.params[0] }).fetch().then(function(link) {
    if (!link) {
      res.redirect('/');
    } else {
      var click = new Click({
        link_id: link.get('id')
      });

      click.save().then(function() {
        db.knex('urls')
          .where('code', '=', link.get('code'))
          .update({
            visits: link.get('visits') + 1,
          }).then(function() {
            return res.redirect(link.get('url'));
          });
      });
    }
  });
});

console.log('Shortly is listening on 4568');
app.listen(4568);
