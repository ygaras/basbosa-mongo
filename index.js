module.exports = {
    Cm : require('./lib/cm'),
    BasbosaModel : require('./lib/model'),
    AutoModels : require('./lib/auto_models')
};


// Establish connections to defined databases
if (typeof 'Basbosa' !== 'undefined' && Basbosa('Config').get('db')) {
  if (Array.isArray(Basbosa('Config').get('db'))) {
    Basbosa('Config').get('db').forEach(function(connection) {
      B('Logger').debug(connection);
      Basbosa('Cm').add(connection.name, connection);
    });
  } else if (typeof Basbosa('Config').get('db') === 'object') {
    Basbosa('Cm').add('default', Basbosa('Config').get('db'));
  }
}