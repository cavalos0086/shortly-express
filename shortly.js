var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var bodyParser = require('body-parser');

// Added as part of our solution
var knex = require('knex');
var session = require('express-session');
var cookieParser = require('cookie-parser');


var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');

var app = express();
app.use(session({secret: 'whatever', 
  proxy: true,
  resave: true,
  saveUninitialized: true}));
var sess;

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(partials());
// Parse JSON (uniform resource locators)
app.use(bodyParser.json());
// Parse forms (signup/login)
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));


app.get('/', 
  function(req, res) {
    // if session exist then render home page
    if (req.session.username) {
      res.render('index');
      res.send(200);
    }
    else {
      // else, go to login
      res.redirect('login');
      res.end();
    }
  });

app.get('/login', function(req, res){
  res.render('login');
  res.end();

});

app.get('/create', 
  function(req, res) {
    res.redirect('login');
    res.end();
  });

app.get('/links', 
  function(req, res) {
  // if session exist then render home page
  if (req.session.username) {
    res.render('index');
  }
  else {
      // else, go to login
      res.redirect('login');
      res.end();
    }

  });

app.post('/signup', function(req, res) {

  // ****** Future: add verification of non-blank username and password
  var un = req.body.username;
  var pw = req.body.password;
  var user = new User({'password': pw, 'username': un})

  app.use(bodyParser.urlencoded({
    extended: true
  }));
  app.use(bodyParser.json());
  app.use(cookieParser('whatever'));
  // app.use(expressSession({secret : 'whatever',
  //   resave: true,
  //   saveUninitialized: true}));

user.save().then(function(newUser) {
  Users.add(newUser);
  sess = req.session;
  sess.username = un;
  sess.password = pw;
});
res.redirect('/');
res.end();

  // store the username and the password in a session
});

app.post('/links', 
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
// Write your dedicated authentication routes here
// e.g. login, logout, etc.
/************************************************************/

app.post('/login', function(req, res){
  // check if req.username is in db
  // check if req.pass is in db
  // if so, then redirect to '/'
  // else, redirect to '/login'
  var un = req.body.username;
  var pw = req.body.password;

  new User({username: un, password: pw}).fetch().then(function(found){
    if(found){
      // then start the session
      sess = req.session;
      sess.username = un;
      sess.password = pw; // do we need this?
      res.redirect('/');
    }
    else{
      res.redirect('/login');
    }
  });

});

app.get('/signup', function(req, res){

});


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
