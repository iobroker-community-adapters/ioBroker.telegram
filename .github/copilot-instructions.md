# ioBroker Adapter Development with GitHub Copilot

**Version:** 0.4.0
**Template Source:** https://github.com/DrozmotiX/ioBroker-Copilot-Instructions

This file contains instructions and best practices for GitHub Copilot when working on ioBroker adapter development.

## Project Context

You are working on an ioBroker adapter. ioBroker is an integration platform for the Internet of Things, focused on building smart home and industrial IoT solutions. Adapters are plugins that connect ioBroker to external systems, devices, or services.

### ioBroker.telegram Specific Context

This is the **ioBroker.telegram** adapter - a messaging adapter that allows ioBroker to send and receive messages via the Telegram Bot API. The adapter acts as both a Telegram bot and a bridge for bidirectional communication between ioBroker and Telegram users.

**Key Functionality:**
- **Telegram Bot Integration**: Uses `node-telegram-bot-api` library to interact with Telegram Bot API
- **Message Handling**: Supports text messages, photos, videos, documents, locations, and other media types
- **User Authentication**: Implements user registration and authentication system
- **State Management**: Creates and manages ioBroker states for communication
- **Web Interface**: Optional webhook mode for receiving messages
- **Notifications**: Sends system notifications and alerts via Telegram
- **Interactive Commands**: Supports custom keyboards and inline buttons
- **File Management**: Handles file uploads/downloads with configurable storage options

**Target Users:**
- Home automation enthusiasts using ioBroker
- System administrators needing remote notifications
- IoT developers requiring mobile messaging integration

**Dependencies:**
- `node-telegram-bot-api`: Main Telegram Bot API client
- `@iobroker/adapter-core`: ioBroker adapter framework
- `axios`: HTTP client for API requests
- `@iobroker/webserver`: For webhook functionality

## Testing

### Unit Testing
- Use Jest as the primary testing framework for ioBroker adapters
- Create tests for all adapter main functions and helper methods
- Test error handling scenarios and edge cases
- Mock external API calls and hardware dependencies
- For adapters connecting to APIs/devices not reachable by internet, provide example data files to allow testing of functionality without live connections
- Example test structure:
  ```javascript
  describe('AdapterName', () => {
    let adapter;
    
    beforeEach(() => {
      // Setup test adapter instance
    });
    
    test('should initialize correctly', () => {
      // Test adapter initialization
    });
  });
  ```

### Integration Testing

**IMPORTANT**: Use the official `@iobroker/testing` framework for all integration tests. This is the ONLY correct way to test ioBroker adapters.

**Official Documentation**: https://github.com/ioBroker/testing

#### Framework Structure
Integration tests MUST follow this exact pattern:

```javascript
const path = require('path');
const { tests } = require('@iobroker/testing');

// Define test coordinates or configuration
const TEST_COORDINATES = '52.520008,13.404954'; // Berlin
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

// Use tests.integration() with defineAdditionalTests
tests.integration(path.join(__dirname, '..'), {
    defineAdditionalTests({ suite }) {
        suite('Test adapter with specific configuration', (getHarness) => {
            let harness;

            before(() => {
                harness = getHarness();
            });

            it('should configure and start adapter', function () {
                return new Promise(async (resolve, reject) => {
                    try {
                        harness = getHarness();
                        
                        // Get adapter object using promisified pattern
                        const obj = await new Promise((res, rej) => {
                            harness.objects.getObject('system.adapter.your-adapter.0', (err, o) => {
                                if (err) return rej(err);
                                res(o);
                            });
                        });
                        
                        if (!obj) {
                            return reject(new Error('Adapter object not found'));
                        }

                        // Configure adapter properties
                        Object.assign(obj.native, {
                            position: TEST_COORDINATES,
                            createCurrently: true,
                            createHourly: true,
                            createDaily: true,
                            // Add other configuration as needed
                        });

                        // Set the updated configuration
                        harness.objects.setObject(obj._id, obj);

                        console.log('✅ Step 1: Configuration written, starting adapter...');
                        
                        // Start adapter and wait
                        await harness.startAdapterAndWait();
                        
                        console.log('✅ Step 2: Adapter started');

                        // Wait for adapter to process data
                        const waitMs = 15000;
                        await wait(waitMs);

                        console.log('🔍 Step 3: Checking states after adapter run...');
                        
                        // Test state creation and values
                        const states = await harness.states.getKeysAsync('your-adapter.0.*');
                        expect(states.length).to.be.greaterThan(0);
                        
                        console.log(`✅ Found ${states.length} states created by adapter`);
                        resolve();
                    } catch (error) {
                        console.error('❌ Test failed:', error.message);
                        reject(error);
                    }
                });
            });
        });
    }
});
```

#### Telegram-Specific Testing Patterns

For the Telegram adapter, use these specific test patterns:

```javascript
// Mock Telegram Bot API for testing
const mockTelegramBot = {
    sendMessage: jest.fn().mockResolvedValue({ message_id: 123 }),
    on: jest.fn(),
    getMe: jest.fn().mockResolvedValue({ id: 123456789, first_name: 'TestBot' })
};

// Test message sending functionality
it('should send telegram message', async () => {
    const message = 'Test message';
    const chatId = '123456789';
    
    const result = await adapter.sendMessage(chatId, message);
    
    expect(mockTelegramBot.sendMessage).toHaveBeenCalledWith(chatId, message);
    expect(result).toEqual({ message_id: 123 });
});

// Test state handling for communication
it('should create communication states', async () => {
    const states = await harness.states.getKeysAsync('telegram.0.communicate.*');
    
    expect(states).toContain('telegram.0.communicate.response');
    expect(states).toContain('telegram.0.communicate.request');
    expect(states).toContain('telegram.0.communicate.users');
});

// Test user authentication
it('should handle user registration', async () => {
    const userData = {
        id: 123456789,
        username: 'testuser',
        first_name: 'Test',
        last_name: 'User'
    };
    
    await adapter.handleUserRegistration(userData);
    
    const usersState = await harness.states.getStateAsync('telegram.0.communicate.users');
    const users = JSON.parse(usersState.val);
    
    expect(users).toHaveProperty('testuser');
    expect(users.testuser.id).toBe(123456789);
});
```

## Code Structure and Architecture

### Main Adapter Structure

The ioBroker.telegram adapter follows this architecture:

```javascript
class TelegramAdapter extends Adapter {
    constructor(options) {
        super({
            ...options,
            name: 'telegram',
        });
        
        this.telegramBot = null;
        this.users = {};
        this.messageQueue = [];
    }

    async onReady() {
        // Initialize Telegram Bot API
        await this.initializeTelegramBot();
        
        // Setup state subscriptions
        this.subscribeStates('*');
        
        // Initialize communication states
        await this.createCommunicationStates();
        
        // Start message processing
        this.startMessageProcessing();
    }

    async onStateChange(id, state) {
        if (state && !state.ack) {
            // Handle outgoing messages
            await this.handleOutgoingMessage(id, state);
        }
    }

    onUnload(callback) {
        try {
            // Close Telegram Bot connection
            if (this.telegramBot) {
                this.telegramBot.stopPolling();
                this.telegramBot = null;
            }
            
            // Clear timers and intervals
            if (this.connectionTimer) {
                clearTimeout(this.connectionTimer);
                this.connectionTimer = undefined;
            }
            
            callback();
        } catch (e) {
            callback();
        }
    }
}
```

### Telegram Bot API Integration

Use these patterns for Telegram Bot API integration:

```javascript
// Initialize bot with proper error handling
async initializeTelegramBot() {
    try {
        const TelegramBot = require('node-telegram-bot-api');
        
        this.telegramBot = new TelegramBot(this.config.token, {
            polling: {
                interval: this.config.pollingInterval || 300,
                autoStart: true,
                params: {
                    timeout: 10
                }
            }
        });

        // Set up message handlers
        this.telegramBot.on('message', (msg) => this.handleIncomingMessage(msg));
        this.telegramBot.on('photo', (msg) => this.handleIncomingPhoto(msg));
        this.telegramBot.on('document', (msg) => this.handleIncomingDocument(msg));
        
        // Test bot connection
        const botInfo = await this.telegramBot.getMe();
        this.log.info(`Connected to Telegram Bot: ${botInfo.first_name} (@${botInfo.username})`);
        
        await this.setStateAsync('info.connection', true, true);
        
    } catch (error) {
        this.log.error(`Failed to initialize Telegram Bot: ${error.message}`);
        await this.setStateAsync('info.connection', false, true);
    }
}

// Handle different message types
async handleIncomingMessage(msg) {
    try {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const userName = msg.from.username || `${msg.from.first_name}_${msg.from.last_name}`;
        
        // Check user authentication
        if (!await this.isUserAuthenticated(userId, userName)) {
            await this.telegramBot.sendMessage(chatId, 'You are not authorized to use this bot.');
            return;
        }
        
        // Update communication states
        await this.updateCommunicationStates(msg);
        
        // Process commands
        if (msg.text && msg.text.startsWith('/')) {
            await this.handleCommand(msg);
        } else {
            // Handle regular text messages
            await this.handleTextMessage(msg);
        }
        
    } catch (error) {
        this.log.error(`Error handling incoming message: ${error.message}`);
    }
}

// Send messages with proper formatting
async sendMessage(chatId, text, options = {}) {
    try {
        const result = await this.telegramBot.sendMessage(chatId, text, {
            parse_mode: 'HTML',
            disable_web_page_preview: true,
            ...options
        });
        
        // Update sent message states
        await this.updateSentMessageStates(result);
        
        return result;
    } catch (error) {
        this.log.error(`Failed to send message: ${error.message}`);
        throw error;
    }
}
```

### State Management

Implement proper state management for communication:

```javascript
// Create communication states
async createCommunicationStates() {
    const states = [
        {
            id: 'communicate.request',
            common: {
                name: 'Last received request',
                type: 'string',
                role: 'text',
                read: true,
                write: false
            }
        },
        {
            id: 'communicate.response',
            common: {
                name: 'Send text through Telegram',
                type: 'string',
                role: 'text',
                read: true,
                write: true
            }
        },
        {
            id: 'communicate.users',
            common: {
                name: 'Authenticated users as JSON',
                type: 'string',
                role: 'json',
                read: true,
                write: false,
                def: '{}'
            }
        }
    ];

    for (const state of states) {
        await this.setObjectNotExistsAsync(state.id, {
            type: 'state',
            common: state.common,
            native: {}
        });
    }
}

// Handle state changes for outgoing messages
async handleOutgoingMessage(id, state) {
    const stateId = id.split('.').pop();
    
    switch (stateId) {
        case 'response':
            await this.sendToAllUsers(state.val);
            break;
            
        case 'responseJson':
            try {
                const messageData = JSON.parse(state.val);
                await this.sendMessageFromJson(messageData);
            } catch (error) {
                this.log.error(`Invalid JSON in responseJson: ${error.message}`);
            }
            break;
    }
    
    // Acknowledge the state change
    await this.setStateAsync(id, state.val, true);
}
```

## Error Handling and Logging

Implement comprehensive error handling:

```javascript
// Connection monitoring and recovery
async monitorConnection() {
    try {
        await this.telegramBot.getMe();
        await this.setStateAsync('info.connection', true, true);
    } catch (error) {
        this.log.warn(`Connection check failed: ${error.message}`);
        await this.setStateAsync('info.connection', false, true);
        
        // Attempt to reconnect
        setTimeout(() => this.initializeTelegramBot(), 30000);
    }
}

// Graceful error handling for API calls
async safeApiCall(apiMethod, ...args) {
    try {
        return await apiMethod.apply(this.telegramBot, args);
    } catch (error) {
        this.log.error(`Telegram API call failed: ${error.message}`);
        
        // Handle specific error types
        if (error.code === 'ETELEGRAM' && error.response && error.response.statusCode === 429) {
            // Rate limiting - wait and retry
            const retryAfter = error.response.body.parameters?.retry_after || 60;
            this.log.warn(`Rate limited. Retrying after ${retryAfter} seconds`);
            
            setTimeout(() => this.safeApiCall(apiMethod, ...args), retryAfter * 1000);
        }
        
        throw error;
    }
}
```

## Configuration Management

Handle adapter configuration properly:

```javascript
// Validate configuration on startup
validateConfig() {
    if (!this.config.token) {
        this.log.error('Telegram bot token is required');
        return false;
    }
    
    if (this.config.server && !this.config.port) {
        this.log.error('Port is required when webhook mode is enabled');
        return false;
    }
    
    return true;
}

// Handle configuration changes
async onObjectChange(id, obj) {
    if (id === `system.adapter.${this.namespace}`) {
        this.log.info('Configuration changed, restarting adapter...');
        this.restart();
    }
}
```

## Development Patterns

### Async/Await Usage
Always use async/await for asynchronous operations:

```javascript
// Good
async onReady() {
    try {
        await this.initializeTelegramBot();
        await this.createCommunicationStates();
        this.startMessageProcessing();
    } catch (error) {
        this.log.error(`Initialization failed: ${error.message}`);
    }
}

// Avoid callbacks when possible
// Bad
this.setObject('communicate.request', obj, (err) => {
    if (err) this.log.error('Failed to create state');
});

// Good
try {
    await this.setObjectAsync('communicate.request', obj);
} catch (error) {
    this.log.error('Failed to create state');
}
```

### Resource Cleanup
Always implement proper cleanup in unload():

```javascript
onUnload(callback) {
  try {
    // Stop Telegram Bot polling
    if (this.telegramBot) {
      this.telegramBot.stopPolling();
      this.telegramBot = null;
    }
    
    // Clear all timers
    if (this.connectionTimer) {
      clearTimeout(this.connectionTimer);
      this.connectionTimer = undefined;
    }
    
    if (this.messageQueueTimer) {
      clearInterval(this.messageQueueTimer);
      this.messageQueueTimer = undefined;
    }
    
    // Close any open connections
    this.setState('info.connection', false, true);
    
    callback();
  } catch (e) {
    callback();
  }
}
```

## Code Style and Standards

- Follow JavaScript/TypeScript best practices
- Use async/await for asynchronous operations
- Implement proper resource cleanup in `unload()` method
- Use semantic versioning for adapter releases
- Include proper JSDoc comments for public methods

## CI/CD and Testing Integration

### GitHub Actions for API Testing
For adapters with external API dependencies, implement separate CI/CD jobs:

```yaml
# Tests API connectivity with demo credentials (runs separately)
demo-api-tests:
  if: contains(github.event.head_commit.message, '[skip ci]') == false
  
  runs-on: ubuntu-22.04
  
  steps:
    - name: Checkout code
      uses: actions/checkout@v4
      
    - name: Use Node.js 20.x
      uses: actions/setup-node@v4
      with:
        node-version: 20.x
        cache: 'npm'
        
    - name: Install dependencies
      run: npm ci
      
    - name: Run demo API tests
      run: npm run test:integration-demo
```

### CI/CD Best Practices
- Run credential tests separately from main test suite
- Use ubuntu-22.04 for consistency
- Don't make credential tests required for deployment
- Provide clear failure messages for API connectivity issues
- Use appropriate timeouts for external API calls (120+ seconds)

### Package.json Script Integration
Add dedicated script for credential testing:
```json
{
  "scripts": {
    "test:integration-demo": "mocha test/integration-demo --exit"
  }
}
```

### Practical Example: Complete API Testing Implementation
Here's a complete example based on lessons learned from the Discovergy adapter:

#### test/integration-demo.js
```javascript
const path = require("path");
const { tests } = require("@iobroker/testing");

// Helper function to encrypt password using ioBroker's encryption method
async function encryptPassword(harness, password) {
    const systemConfig = await harness.objects.getObjectAsync("system.config");
    
    if (!systemConfig || !systemConfig.native || !systemConfig.native.secret) {
        throw new Error("Could not retrieve system secret for password encryption");
    }
    
    const secret = systemConfig.native.secret;
    let result = '';
    for (let i = 0; i < password.length; ++i) {
        result += String.fromCharCode(secret[i % secret.length].charCodeAt(0) ^ password.charCodeAt(i));
    }
    
    return result;
}

// Run integration tests with demo credentials
tests.integration(path.join(__dirname, ".."), {
    defineAdditionalTests({ suite }) {
        suite("API Testing with Demo Credentials", (getHarness) => {
            let harness;
            
            before(() => {
                harness = getHarness();
            });

            it("Should connect to API and initialize with demo credentials", async () => {
                console.log("Setting up demo credentials...");
                
                if (harness.isAdapterRunning()) {
                    await harness.stopAdapter();
                }
                
                const encryptedPassword = await encryptPassword(harness, "demo_password");
                
                await harness.changeAdapterConfig("your-adapter", {
                    native: {
                        username: "demo@provider.com",
                        password: encryptedPassword,
                        // other config options
                    }
                });

                console.log("Starting adapter with demo credentials...");
                await harness.startAdapter();
                
                // Wait for API calls and initialization
                await new Promise(resolve => setTimeout(resolve, 60000));
                
                const connectionState = await harness.states.getStateAsync("your-adapter.0.info.connection");
                
                if (connectionState && connectionState.val === true) {
                    console.log("✅ SUCCESS: API connection established");
                    return true;
                } else {
                    throw new Error("API Test Failed: Expected API connection to be established with demo credentials. " +
                        "Check logs above for specific API errors (DNS resolution, 401 Unauthorized, network issues, etc.)");
                }
            }).timeout(120000);
        });
    }
});
```

### Telegram-Specific Testing Considerations

For the Telegram adapter, testing should focus on:

1. **Mock API Testing**: Use mock Telegram Bot API for unit tests
2. **Message Flow Testing**: Test bidirectional message handling
3. **User Authentication**: Test user registration and permissions
4. **State Management**: Verify communication states are properly created and updated
5. **Error Recovery**: Test connection recovery and error handling scenarios

```javascript
// Example Telegram integration test
it("Should handle Telegram bot initialization", async () => {
    // Mock configuration with test token
    await harness.changeAdapterConfig("telegram", {
        native: {
            token: "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11",
            pollingInterval: 300,
            server: false
        }
    });

    console.log("Starting Telegram adapter...");
    await harness.startAdapter();
    
    // Wait for initialization
    await new Promise(resolve => setTimeout(resolve, 15000));
    
    // Check if communication states were created
    const states = await harness.states.getKeysAsync("telegram.0.communicate.*");
    expect(states).toContain("telegram.0.communicate.response");
    expect(states).toContain("telegram.0.communicate.request");
    expect(states).toContain("telegram.0.communicate.users");
    
    console.log("✅ Telegram adapter initialized successfully");
}).timeout(60000);
```