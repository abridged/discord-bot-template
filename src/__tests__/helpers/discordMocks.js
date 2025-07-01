/**
 * Discord.js Mock Helpers for E2E Testing
 * Provides mock Discord interactions and components
 */

/**
 * Creates a mock Discord interaction for testing
 */
function createMockInteraction(commandName, overrides = {}) {
  const defaultInteraction = {
    commandName: commandName.replace('/', ''),
    options: {
      getString: jest.fn(),
      getInteger: jest.fn(),
      getBoolean: jest.fn(),
      getUser: jest.fn(),
      getChannel: jest.fn(),
      getRole: jest.fn(),
      getMentionable: jest.fn(),
      getNumber: jest.fn(),
      getAttachment: jest.fn()
    },
    user: {
      id: 'mock-user-123',
      username: 'mockuser',
      discriminator: '1234',
      tag: 'mockuser#1234',
      avatar: null,
      bot: false,
      system: false,
      flags: null,
      createdAt: new Date(),
      defaultAvatarURL: 'https://cdn.discordapp.com/embed/avatars/0.png',
      displayAvatarURL: jest.fn().mockReturnValue('https://cdn.discordapp.com/embed/avatars/0.png'),
      toString: jest.fn().mockReturnValue('<@mock-user-123>')
    },
    member: {
      id: 'mock-user-123',
      user: null, // Will be set to interaction.user
      nickname: null,
      roles: {
        cache: new Map(),
        highest: { position: 0 }
      },
      permissions: {
        has: jest.fn().mockReturnValue(true)
      }
    },
    guild: {
      id: 'mock-guild-123',
      name: 'Mock Guild',
      members: {
        cache: new Map(),
        fetch: jest.fn()
      },
      channels: {
        cache: new Map(),
        fetch: jest.fn()
      },
      roles: {
        cache: new Map(),
        fetch: jest.fn()
      }
    },
    channel: {
      id: 'mock-channel-123',
      name: 'mock-channel',
      type: 0, // TEXT_CHANNEL
      send: jest.fn().mockResolvedValue({
        id: 'mock-message-123',
        edit: jest.fn(),
        delete: jest.fn(),
        react: jest.fn()
      }),
      permissionsFor: jest.fn().mockReturnValue({
        has: jest.fn().mockReturnValue(true)
      })
    },
    reply: jest.fn().mockResolvedValue({
      id: 'mock-reply-123',
      edit: jest.fn(),
      delete: jest.fn()
    }),
    followUp: jest.fn().mockResolvedValue({
      id: 'mock-followup-123',
      edit: jest.fn(),
      delete: jest.fn()
    }),
    editReply: jest.fn().mockResolvedValue({
      id: 'mock-edit-reply-123'
    }),
    deferReply: jest.fn().mockResolvedValue(undefined),
    deleteReply: jest.fn().mockResolvedValue(undefined),
    showModal: jest.fn().mockResolvedValue(undefined),
    update: jest.fn().mockResolvedValue({
      id: 'mock-update-123'
    }),
    responded: false,
    deferred: false,
    ephemeral: false,
    customId: null,
    componentType: null,
    createdAt: new Date(),
    createdTimestamp: Date.now(),
    id: 'mock-interaction-123',
    applicationId: 'mock-app-123',
    token: 'mock-token-123',
    version: 1,
    locale: 'en-US',
    guildLocale: 'en-US'
  };

  // Set member.user to interaction.user
  defaultInteraction.member.user = defaultInteraction.user;

  // Apply overrides
  const interaction = { ...defaultInteraction, ...overrides };
  
  // Ensure overridden user is also set in member
  if (overrides.user) {
    interaction.member.user = overrides.user;
  }

  return interaction;
}

/**
 * Creates a mock modal submission interaction
 */
function createMockModalSubmission(options = {}) {
  const defaultModalSubmission = {
    customId: options.customId || 'mock-modal',
    fields: {
      getTextInputValue: jest.fn().mockReturnValue('default-value'),
      ...options.fields
    },
    user: options.user || {
      id: 'mock-user-456',
      username: 'modaluser',
      discriminator: '5678',
      tag: 'modaluser#5678'
    },
    member: {
      id: 'mock-user-456',
      user: null, // Will be set below
      nickname: null,
      roles: {
        cache: new Map(),
        highest: { position: 0 }
      },
      permissions: {
        has: jest.fn().mockReturnValue(true)
      }
    },
    guild: {
      id: 'mock-guild-456',
      name: 'Mock Guild'
    },
    channel: {
      id: 'mock-channel-456',
      name: 'mock-channel',
      type: 0,
      send: jest.fn().mockResolvedValue({
        id: 'mock-message-456'
      })
    },
    reply: jest.fn().mockResolvedValue({
      id: 'mock-modal-reply-123'
    }),
    update: jest.fn().mockResolvedValue({
      id: 'mock-modal-update-123'
    }),
    deferUpdate: jest.fn().mockResolvedValue(undefined),
    editReply: jest.fn().mockResolvedValue({
      id: 'mock-modal-edit-123'
    }),
    followUp: jest.fn().mockResolvedValue({
      id: 'mock-modal-followup-123'
    }),
    showModal: jest.fn().mockResolvedValue(undefined),
    responded: false,
    deferred: false,
    ephemeral: false,
    componentType: 9, // MODAL_SUBMIT
    createdAt: new Date(),
    createdTimestamp: Date.now(),
    id: 'mock-modal-interaction-456',
    applicationId: 'mock-app-456',
    token: 'mock-modal-token-456',
    version: 1,
    locale: 'en-US',
    guildLocale: 'en-US'
  };

  // Set member.user to interaction.user
  defaultModalSubmission.member.user = defaultModalSubmission.user;

  // Apply additional options
  return { ...defaultModalSubmission, ...options };
}

/**
 * Creates a mock button interaction
 */
function createMockButtonInteraction(customId, options = {}) {
  const defaultButtonInteraction = {
    customId: customId,
    componentType: 2, // BUTTON
    user: options.user || {
      id: 'mock-user-789',
      username: 'buttonuser',
      discriminator: '9012',
      tag: 'buttonuser#9012'
    },
    member: {
      id: 'mock-user-789',
      user: null, // Will be set below
      nickname: null,
      roles: {
        cache: new Map(),
        highest: { position: 0 }
      },
      permissions: {
        has: jest.fn().mockReturnValue(true)
      }
    },
    guild: {
      id: 'mock-guild-789',
      name: 'Mock Guild'
    },
    channel: {
      id: 'mock-channel-789',
      name: 'mock-channel',
      type: 0,
      send: jest.fn().mockResolvedValue({
        id: 'mock-message-789'
      })
    },
    message: {
      id: 'mock-original-message-789',
      edit: jest.fn().mockResolvedValue({
        id: 'mock-edited-message-789'
      }),
      delete: jest.fn().mockResolvedValue(undefined),
      embeds: [],
      components: []
    },
    reply: jest.fn().mockResolvedValue({
      id: 'mock-button-reply-789'
    }),
    update: jest.fn().mockResolvedValue({
      id: 'mock-button-update-789'
    }),
    deferUpdate: jest.fn().mockResolvedValue(undefined),
    editReply: jest.fn().mockResolvedValue({
      id: 'mock-button-edit-789'
    }),
    followUp: jest.fn().mockResolvedValue({
      id: 'mock-button-followup-789'
    }),
    responded: false,
    deferred: false,
    ephemeral: false,
    createdAt: new Date(),
    createdTimestamp: Date.now(),
    id: 'mock-button-interaction-789',
    applicationId: 'mock-app-789',
    token: 'mock-button-token-789',
    version: 1,
    locale: 'en-US',
    guildLocale: 'en-US'
  };

  // Set member.user to interaction.user
  defaultButtonInteraction.member.user = defaultButtonInteraction.user;

  // Apply additional options
  return { ...defaultButtonInteraction, ...options };
}

/**
 * Creates a mock Discord client
 */
function createMockClient() {
  return {
    user: {
      id: 'mock-bot-123',
      username: 'MockBot',
      discriminator: '0000',
      tag: 'MockBot#0000',
      avatar: null,
      bot: true
    },
    guilds: {
      cache: new Map(),
      fetch: jest.fn()
    },
    channels: {
      cache: new Map(),
      fetch: jest.fn()
    },
    users: {
      cache: new Map(),
      fetch: jest.fn()
    },
    on: jest.fn(),
    once: jest.fn(),
    emit: jest.fn(),
    login: jest.fn().mockResolvedValue('mock-token'),
    destroy: jest.fn().mockResolvedValue(undefined),
    isReady: jest.fn().mockReturnValue(true),
    readyAt: new Date(),
    readyTimestamp: Date.now(),
    uptime: 60000,
    ws: {
      ping: 50,
      status: 0 // READY
    }
  };
}

/**
 * Creates a mock embed for testing
 */
function createMockEmbed(data = {}) {
  return {
    title: data.title || 'Mock Embed',
    description: data.description || 'Mock description',
    color: data.color || 0x3498db,
    fields: data.fields || [],
    footer: data.footer || null,
    timestamp: data.timestamp || null,
    thumbnail: data.thumbnail || null,
    image: data.image || null,
    author: data.author || null,
    toJSON: jest.fn().mockReturnValue(data)
  };
}

/**
 * Utilities for test setup
 */
const TestUtils = {
  /**
   * Sets up a clean test environment
   */
  setupTestEnvironment() {
    const originalEnv = { ...process.env };
    
    // Set test-specific environment
    process.env.NODE_ENV = 'test';
    process.env.USE_REAL_BLOCKCHAIN = 'false';
    process.env.USE_MOCK_BLOCKCHAIN = 'true';
    
    return {
      restore: () => {
        process.env = originalEnv;
      }
    };
  },

  /**
   * Creates a complete test scenario with interaction and context
   */
  createTestScenario(scenarioType = 'quiz_creation') {
    switch (scenarioType) {
      case 'quiz_creation':
        return {
          interaction: createMockInteraction('/mother'),
          user: {
            id: 'test-user-scenario',
            username: 'testuser',
            balance: 5000,
            smartAccountAddress: '0x1234567890123456789012345678901234567890'
          },
          quizData: {
            id: 'test-quiz-scenario',
            question: 'Test question?',
            choices: ['A', 'B', 'C', 'D'],
            correctAnswer: 1,
            explanation: 'Test explanation'
          }
        };
      
      case 'quiz_participation':
        return {
          interaction: createMockButtonInteraction('quiz_answer_1'),
          user: {
            id: 'test-participant',
            username: 'participant',
            balance: 2000
          },
          quizData: {
            id: 'active-quiz-123',
            status: 'active',
            participants: []
          }
        };
      
      default:
        throw new Error(`Unknown scenario type: ${scenarioType}`);
    }
  }
};

module.exports = {
  createMockInteraction,
  createMockModalSubmission,
  createMockButtonInteraction,
  createMockClient,
  createMockEmbed,
  TestUtils
};
