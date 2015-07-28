var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var bodyParser = require('body-parser');


var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');

//ready to be refractored
var bcrypt = require('bcrypt');

var app = express();

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
  res.render('index');
});

app.get('/create', 
function(req, res) {
  res.render('index');
});

app.get('/links', 
function(req, res) {
  Links.reset().fetch().then(function(links) {
    res.send(200, links.models);
  });
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
// Write your authentication routes here
/************************************************************/

app.get('/login', function(req, res) {
  res.render('login');
});

app.get('/signup', function(req, res) {
  res.render('signup');
});

// Where to post to?
app.post('/login', function(req, res){
  var username = req.body.username;
  var password = req.body.password;
  var oldPassword; 
  var attr;
  new User({ username: username }).fetch().then(function(row) {
    if(row){
      attr = row.attributes;
      oldPassword = attr.password;
      password += attr.salt;
      bcrypt.hash(password, attr.salt, function(err, hash){
        password = hash;
        if(oldPassword === password){
          console.log('it WOrks!!')
          res.redirect('/');
          //put the name of the user, somwhere on the screen :)
        } else {
          res.redirect('/login');
          res.send('Wrong!')
        }
      });
      
    } else {
      
       res.send('POST Failed!');
    }
  });





});

app.post('/signup', function(req, res){
  var username = req.body.username;
  var password = req.body.password;

  // Generate aand store salt somehow,
  bcrypt.genSalt(10, function(err, salt) {
    password+=salt;
    bcrypt.hash(password, salt, function(err, hash) {
        // Store hash in your password DB. 
        password = hash;
        new User({ username: username }).fetch().then(function(found) {
          if(found){
            res.send('Username already exists!');
          } else {
            new User({username: username, password: password, salt: salt}).save().then(function(model){
        
              res.send('POST works!');
            })
            
            console.log('RIGHT on!!');
          }
        })
    });
}); 
  // Append it to the user password & hash the result
  // Insert it in the database along with username & salt.


  // db. some how insert sthings
  // Get the info from the form
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
