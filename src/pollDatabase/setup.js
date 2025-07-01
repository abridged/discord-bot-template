const { initializePollDatabase, setupModels } = require('./index');

/**
 * Initialize the poll tracking system
 */
const initializePollTracking = async () => {
  try {
    // Connect to database
    const connected = await initializePollDatabase();
    if (!connected) {
      console.error('Failed to initialize poll tracking: Database connection failed');
      return false;
    }

    // Setup models and ensure tables exist
    await setupModels();
    console.log('Poll tracking system initialized');
    return true;
  } catch (error) {
    console.error('Failed to initialize poll tracking:', error);
    return false;
  }
};

module.exports = { initializePollTracking };
