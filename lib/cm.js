var MongoClient = require('mongodb').MongoClient,
  Server = require('mongodb').Server,
  EventEmitter = require('events').EventEmitter, 
  instance;

var Cm = function() {
  this.connections = {};
};


Cm.prototype = {
  connectionParams : {
    host : 'localhost',
    port : 27017,
    database : 'techfilter',
    username : 'admin',
    password : 'admin'   
  },
  
  add : function(connectionName, params) {
    if (typeof params === 'undefined') {
      connectionName = 'default';
      params = connectionName;
    }
    this.connections[connectionName] = {};
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
 
      Basbosa('Logger').debug('returning db ' + config.database);
     
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

instance ;
module.exports = new Cm();
if (typeof 'Basbosa' !== 'undefined') Basbosa.add('Database', module.exports);
