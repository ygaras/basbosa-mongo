var MongoClient = require('mongodb').MongoClient,
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
    var config, mongoClient, self = this;
    connectionName = connectionName || 'default';
    config = this.connections[connectionName];
    
    mongoClient = new MongoClient(new Server(config.host, config.port));

    mongoClient.open(function(err, mongoClient) {
      if (err) throw new Error(err);
      self.connections[connectionName].db = mongoClient.db(config.database);
      self.emit('connected', connectionName);
      self.emit('connected:' + connectionName);
    });
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

