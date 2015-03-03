var db = require('../config');
var bcrypt = require('bcrypt-nodejs');
var Promise = require('bluebird');

var User = db.Model.extend({
  tableName: 'users',
  hasTimestamps: true,
  initialize: function(attributes, callback) {
    var self = this;
    bcrypt.hash(self.get('hash'), null, null, function(err, hash) {
      self.set('hash', hash);
      self.save().then(function(model) {
        callback(model.get('id'));
      });
    });
  }
});

module.exports = User;
