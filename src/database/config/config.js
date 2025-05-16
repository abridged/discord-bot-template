require('dotenv').config();

module.exports = {
  development: {
    dialect: 'sqlite',
    storage: './db/database.sqlite',
    logging: console.log,
  },
  test: {
    dialect: 'sqlite',
    storage: ':memory:',
    logging: false,
  },
  production: {
    dialect: 'sqlite',
    storage: './db/database.sqlite',
    logging: false,
  },
};
