var Db = require('mongodb').Db,
  MongoDb =  require('mongodb'),
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
    database : 'test',
    username : 'admin',
    password : 'admin'   
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
    uri = this.uriFomConfig(config);
    Basbosa('Logger').debug(uri);

    Db.connect(uri, function(err, db){
      if (err) throw new Error(err);
      self.connections[connectionName].db = db;
      self.emit('connected', connectionName);
      self.emit('connected:' + connectionName);
    });

//    var db = new Db(config.database, new Server(config.host, config.port,
//      {auto_reconnect: false, poolSize: 4}), {w: 0, native_parser: false});
//
//    mongoClient = new MongoClient(new Server(config.host, config.port));


//    mongoClient.open(function(err, mongoClient) {
//      if (err) throw new Error(err);
//      self.connections[connectionName].db = mongoClient.db(config.database);
//      self.emit('connected', connectionName);
//      self.emit('connected:' + connectionName);
//    });
  },

  uriFomConfig : function(config) {
    // 'mongodb://heroku_app123456:password@dbh73.mongolab.com:27737/heroku_app123456'
    var uri = 'mongodb://';
    if (config.username) {
      uri += config.username + ':' + config.password + '@';
    }

    return uri + config.host + ':' + config.port + '/' + config.database;
  },
  
  getDb : function(connectionName) {
    return this.connections[connectionName || 'default'].db;
  }
  
};

/**
 * Inherits from EventEmitter.
 */
Cm.prototype.__proto__ = EventEmitter.prototype;

module.exports = new Cm();

Basbosa.add('Cm', module.exports);

