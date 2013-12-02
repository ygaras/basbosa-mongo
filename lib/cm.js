var Db = require('mongodb').Db,
  Server = require('mongodb').Server,
  EventEmitter = require('events').EventEmitter,
  Basbosa = require('basbosa-registry');

var Cm = function() {
  this.connections = {};
};

Cm.prototype = {
  connectionParams : {
    host : 'localhost',
    port : 27017,
    database : false,
    username : '',
    password : ''
  },
  
  add : function(connectionName, params) {
    if (typeof params === 'undefined') {
        params = connectionName;
        connectionName = 'default';
    }
    this.connections[connectionName] = {db : false};
    for (var k in this.connectionParams) {
      this.connections[connectionName][k] = params[k] || this.connectionParams[k];
    }
    
    this.connect(connectionName);
  }, 
  
  connect : function(connectionName) {
    var config, mongoClient, self = this, uri;
    connectionName = connectionName || 'default';
    config = this.connections[connectionName];
    
    // make sure we are connecting to an actual database
    if (typeof config.database !== 'string') {
      Basbosa('Logger').trace('Not a valid DB config', config);
      return;
    }
    
    uri = this.uriFomConfig(config);

    
    Basbosa('Logger').trace('Connecting to: ' + uri);
    Db.connect(uri, function(err, db){
      var con, allConnected = true;
      if (err) throw new Error(err);
      self.connections[connectionName].db = db;
      Basbosa('Logger').trace('Connection Name: ' + connectionName +' connected to: ' + uri);
      self.emit('connected:' + connectionName);

      // If all db are connected, emit connected
      for (var con in self.connections) {
        if (self.connections[con].db === false) allConnected = false;
      }
      if (allConnected) self.emit('connected');
    });

  },

  uriFomConfig : function(config) {
    // 'mongodb://heroku_app123456:password@dbh73.mongolab.com:27737/heroku_app123456'
    var uri = 'mongodb://';
    if (config.username) {
      uri += config.username + ':' + config.password + '@';
    }

    return uri + config.host + ':' + config.port + '/' + config.database + '?w=1';
  },
  
  getDb : function(connectionName) {
    return this.connections[connectionName || 'default'].db;
  },

  getDbUrl : function(connectionName) {
    return this.uriFomConfig(this.connections[connectionName || 'default']);
  }
  
};

/**
 * Inherits from EventEmitter.
 */
Cm.prototype.__proto__ = EventEmitter.prototype;

module.exports = new Cm();

Basbosa.add('Cm', module.exports);


// Establish connections to defined databases
if (typeof 'Basbosa' !== 'undefined' && Basbosa('Config').get('db')) {
  if (Array.isArray(Basbosa('Config').get('db'))) {
    Basbosa('Logger').trace('Provided connections are in an array');
    Basbosa('Config').get('db').forEach(function(connection) {
      Basbosa('Logger').trace(connection);
      Basbosa('Cm').add(connection.name, connection);
    });
  } else if (typeof Basbosa('Config').get('db') === 'object') {
    Basbosa('Logger').trace('Provided connection is an object');
    Basbosa('Cm').add('default', Basbosa('Config').get('db'));
  }
}
