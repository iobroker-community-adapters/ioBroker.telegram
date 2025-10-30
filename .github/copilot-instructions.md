
# ioBroker Adapter Development with GitHub Copilot

**Version:** 0.4.2
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
                        
                        // Get all states created by adapter
                        const stateIds = await harness.dbConnection.getStateIDs('your-adapter.0.*');
                        
                        console.log(`📊 Found ${stateIds.length} states`);

                        if (stateIds.length > 0) {
                            console.log('✅ Adapter successfully created states');
                            
                            // Show sample of created states
                            const allStates = await new Promise((res, rej) => {
                                harness.states.getStates(stateIds, (err, states) => {
                                    if (err) return rej(err);
                                    res(states || []);
                                });
                            });
                            
                            console.log('📋 Sample states created:');
                            stateIds.slice(0, 5).forEach((stateId, index) => {
                                const state = allStates[index];
                                console.log(`   ${stateId}: ${state && state.val !== undefined ? state.val : 'undefined'}`);
                            });
                            
                            await harness.stopAdapter();
                            resolve(true);
                        } else {
                            console.log('❌ No states were created by the adapter');
                            reject(new Error('Adapter did not create any states'));
                        }
                    } catch (error) {
                        reject(error);
                    }
                });
            }).timeout(40000);
        });
    }
});
```

#### Testing Both Success AND Failure Scenarios

**IMPORTANT**: For every "it works" test, implement corresponding "it doesn't work and fails" tests. This ensures proper error handling and validates that your adapter fails gracefully when expected.

```javascript
// Example: Testing successful configuration
it('should configure and start adapter with valid configuration', function () {
    return new Promise(async (resolve, reject) => {
        // ... successful configuration test as shown above
    });
}).timeout(40000);

// Example: Testing failure scenarios
it('should NOT create daily states when daily is disabled', function () {
    return new Promise(async (resolve, reject) => {
        try {
            harness = getHarness();
            
            console.log('🔍 Step 1: Fetching adapter object...');
            const obj = await new Promise((res, rej) => {
                harness.objects.getObject('system.adapter.your-adapter.0', (err, o) => {
                    if (err) return rej(err);
                    res(o);
                });
            });
            
            if (!obj) return reject(new Error('Adapter object not found'));
            console.log('✅ Step 1.5: Adapter object loaded');

            console.log('🔍 Step 2: Updating adapter config...');
            Object.assign(obj.native, {
                position: TEST_COORDINATES,
                createCurrently: false,
                createHourly: true,
                createDaily: false, // Daily disabled for this test
            });

            await new Promise((res, rej) => {
                harness.objects.setObject(obj._id, obj, (err) => {
                    if (err) return rej(err);
                    console.log('✅ Step 2.5: Adapter object updated');
                    res(undefined);
                });
            });

            console.log('🔍 Step 3: Starting adapter...');
            await harness.startAdapterAndWait();
            console.log('✅ Step 4: Adapter started');

            console.log('⏳ Step 5: Waiting 20 seconds for states...');
            await new Promise((res) => setTimeout(res, 20000));

            console.log('🔍 Step 6: Fetching state IDs...');
            const stateIds = await harness.dbConnection.getStateIDs('your-adapter.0.*');

            console.log(`📊 Step 7: Found ${stateIds.length} total states`);

            const hourlyStates = stateIds.filter((key) => key.includes('hourly'));
            if (hourlyStates.length > 0) {
                console.log(`✅ Step 8: Correctly ${hourlyStates.length} hourly weather states created`);
            } else {
                console.log('❌ Step 8: No hourly states created (test failed)');
                return reject(new Error('Expected hourly states but found none'));
            }

            // Check daily states should NOT be present
            const dailyStates = stateIds.filter((key) => key.includes('daily'));
            if (dailyStates.length === 0) {
                console.log(`✅ Step 9: No daily states found as expected`);
            } else {
                console.log(`❌ Step 9: Daily states present (${dailyStates.length}) (test failed)`);
                return reject(new Error('Expected no daily states but found some'));
            }

            await harness.stopAdapter();
            console.log('🛑 Step 10: Adapter stopped');

            resolve(true);
        } catch (error) {
            reject(error);
        }
    });
}).timeout(40000);

// Example: Testing missing required configuration  
it('should handle missing required configuration properly', function () {
    return new Promise(async (resolve, reject) => {
        try {
            harness = getHarness();
            
            console.log('🔍 Step 1: Fetching adapter object...');
            const obj = await new Promise((res, rej) => {
                harness.objects.getObject('system.adapter.your-adapter.0', (err, o) => {
                    if (err) return rej(err);
                    res(o);
                });
            });
            
            if (!obj) return reject(new Error('Adapter object not found'));

            console.log('🔍 Step 2: Removing required configuration...');
            // Remove required configuration to test failure handling
            delete obj.native.position; // This should cause failure or graceful handling

            await new Promise((res, rej) => {
                harness.objects.setObject(obj._id, obj, (err) => {
                    if (err) return rej(err);
                    res(undefined);
                });
            });

            console.log('🔍 Step 3: Starting adapter...');
            await harness.startAdapterAndWait();

            console.log('⏳ Step 4: Waiting for adapter to process...');
            await new Promise((res) => setTimeout(res, 10000));

            console.log('🔍 Step 5: Checking adapter behavior...');
            const stateIds = await harness.dbConnection.getStateIDs('your-adapter.0.*');

            // Check if adapter handled missing configuration gracefully
            if (stateIds.length === 0) {
                console.log('✅ Adapter properly handled missing configuration - no invalid states created');
                resolve(true);
            } else {
                // If states were created, check if they're in error state
                const connectionState = await new Promise((res, rej) => {
                    harness.states.getState('your-adapter.0.info.connection', (err, state) => {
                        if (err) return rej(err);
                        res(state);
                    });
                });
                
                if (!connectionState || connectionState.val === false) {
                    console.log('✅ Adapter properly failed with missing configuration');
                    resolve(true);
                } else {
                    console.log('❌ Adapter should have failed or handled missing config gracefully');
                    reject(new Error('Adapter should have handled missing configuration'));
                }
            }

            await harness.stopAdapter();
        } catch (error) {
            console.log('✅ Adapter correctly threw error with missing configuration:', error.message);
            resolve(true);
        }
    });
}).timeout(40000);
```

#### Advanced State Access Patterns

For testing adapters that create multiple states, use bulk state access methods to efficiently verify large numbers of states:

```javascript
it('should create and verify multiple states', () => new Promise(async (resolve, reject) => {
    // Configure and start adapter first...
    harness.objects.getObject('system.adapter.tagesschau.0', async (err, obj) => {
        if (err) {
            console.error('Error getting adapter object:', err);
            reject(err);
            return;
        }

        // Configure adapter as needed
        obj.native.someConfig = 'test-value';
        harness.objects.setObject(obj._id, obj);

        await harness.startAdapterAndWait();

        // Wait for adapter to create states
        setTimeout(() => {
            // Access bulk states using pattern matching
            harness.dbConnection.getStateIDs('tagesschau.0.*').then(stateIds => {
                if (stateIds && stateIds.length > 0) {
                    harness.states.getStates(stateIds, (err, allStates) => {
                        if (err) {
                            console.error('❌ Error getting states:', err);
                            reject(err); // Properly fail the test instead of just resolving
                            return;
                        }

                        // Verify states were created and have expected values
                        const expectedStates = ['tagesschau.0.info.connection', 'tagesschau.0.articles.0.title'];
                        let foundStates = 0;
                        
                        for (const stateId of expectedStates) {
                            if (allStates[stateId]) {
                                foundStates++;
                                console.log(`✅ Found expected state: ${stateId}`);
                            } else {
                                console.log(`❌ Missing expected state: ${stateId}`);
                            }
                        }

                        if (foundStates === expectedStates.length) {
                            console.log('✅ All expected states were created successfully');
                            resolve();
                        } else {
                            reject(new Error(`Only ${foundStates}/${expectedStates.length} expected states were found`));
                        }
                    });
                } else {
                    reject(new Error('No states found matching pattern tagesschau.0.*'));
                }
            }).catch(reject);
        }, 20000); // Allow more time for multiple state creation
    });
})).timeout(45000);
```

#### Key Integration Testing Rules

1. **NEVER test API URLs directly** - Let the adapter handle API calls
2. **ALWAYS use the harness** - `getHarness()` provides the testing environment  
3. **Configure via objects** - Use `harness.objects.setObject()` to set adapter configuration
4. **Start properly** - Use `harness.startAdapterAndWait()` to start the adapter
5. **Check states** - Use `harness.states.getState()` to verify results
6. **Use timeouts** - Allow time for async operations with appropriate timeouts
7. **Test real workflow** - Initialize → Configure → Start → Verify States

#### Workflow Dependencies
Integration tests should run ONLY after lint and adapter tests pass:

```yaml
integration-tests:
  needs: [check-and-lint, adapter-tests]
  runs-on: ubuntu-latest
  steps:
    - name: Run integration tests
      run: npx mocha test/integration-*.js --exit
```

#### What NOT to Do
❌ Direct API testing: `axios.get('https://api.example.com')`
❌ Mock adapters: `new MockAdapter()`  
❌ Direct internet calls in tests
❌ Bypassing the harness system

#### What TO Do
✅ Use `@iobroker/testing` framework
✅ Configure via `harness.objects.setObject()`
✅ Start via `harness.startAdapterAndWait()`
✅ Test complete adapter lifecycle
✅ Verify states via `harness.states.getState()`
✅ Allow proper timeouts for async operations

### API Testing with Credentials
For adapters that connect to external APIs requiring authentication, implement comprehensive credential testing:

#### Password Encryption for Integration Tests
When creating integration tests that need encrypted passwords (like those marked as `encryptedNative` in io-package.json):

1. **Read system secret**: Use `harness.objects.getObjectAsync("system.config")` to get `obj.native.secret`
2. **Apply XOR encryption**: Implement the encryption algorithm:
   ```javascript
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
   ```
3. **Store encrypted password**: Set the encrypted result in adapter config, not the plain text
4. **Result**: Adapter will properly decrypt and use credentials, enabling full API connectivity testing

#### Demo Credentials Testing Pattern
- Use provider demo credentials when available (e.g., `demo@api-provider.com` / `demo`)
- Create separate test file (e.g., `test/integration-demo.js`) for credential-based tests
- Add npm script: `"test:integration-demo": "mocha test/integration-demo --exit"`
- Implement clear success/failure criteria with recognizable log messages
- Expected success pattern: Look for specific adapter initialization messages
- Test should fail clearly with actionable error messages for debugging

#### Enhanced Test Failure Handling
```javascript
it("Should connect to API with demo credentials", async () => {
    // ... setup and encryption logic ...
    
    const connectionState = await harness.states.getStateAsync("adapter.0.info.connection");
    
    if (connectionState && connectionState.val === true) {
        console.log("✅ SUCCESS: API connection established");
        return true;
    } else {
        throw new Error("API Test Failed: Expected API connection to be established with demo credentials. " +
            "Check logs above for specific API errors (DNS resolution, 401 Unauthorized, network issues, etc.)");
    }
}).timeout(120000); // Extended timeout for API calls
```

## README Updates

### Required Sections
When updating README.md files, ensure these sections are present and well-documented:

1. **Installation** - Clear npm/ioBroker admin installation steps
2. **Configuration** - Detailed configuration options with examples
3. **Usage** - Practical examples and use cases
4. **Changelog** - Version history and changes (use "## **WORK IN PROGRESS**" section for ongoing changes following AlCalzone release-script standard)
5. **License** - License information (typically MIT for ioBroker adapters)
6. **Support** - Links to issues, discussions, and community support

### Documentation Standards
- Use clear, concise language
- Include code examples for configuration
- Add screenshots for admin interface when applicable
- Maintain multilingual support (at minimum English and German)
- When creating PRs, add entries to README under "## **WORK IN PROGRESS**" section following ioBroker release script standard
- Always reference related issues in commits and PR descriptions (e.g., "solves #xx" or "fixes #xx")

### Mandatory README Updates for PRs
For **every PR or new feature**, always add a user-friendly entry to README.md:

- Add entries under `## **WORK IN PROGRESS**` section before committing
- Use format: `* (author) **TYPE**: Description of user-visible change`
- Types: **NEW** (features), **FIXED** (bugs), **ENHANCED** (improvements), **TESTING** (test additions), **CI/CD** (automation)
- Focus on user impact, not technical implementation details
- Example: `* (DutchmanNL) **FIXED**: Adapter now properly validates login credentials instead of always showing "credentials missing"`

### Documentation Workflow Standards
- **Mandatory README updates**: Establish requirement to update README.md for every PR/feature
- **Standardized documentation**: Create consistent format and categories for changelog entries
- **Enhanced development workflow**: Integrate documentation requirements into standard development process

### Changelog Management with AlCalzone Release-Script
Follow the [AlCalzone release-script](https://github.com/AlCalzone/release-script) standard for changelog management:

#### Format Requirements
- Always use `## **WORK IN PROGRESS**` as the placeholder for new changes
- Add all PR/commit changes under this section until ready for release
- Never modify version numbers manually - only when merging to main branch
- Maintain this format in README.md or CHANGELOG.md:

```markdown
# Changelog

<!--
  Placeholder for the next version (at the beginning of the line):
  ## **WORK IN PROGRESS**
-->

## **WORK IN PROGRESS**

-   Did some changes
-   Did some more changes

## v0.1.0 (2023-01-01)
Initial release
```

#### Workflow Process
- **During Development**: All changes go under `## **WORK IN PROGRESS**`
- **For Every PR**: Add user-facing changes to the WORK IN PROGRESS section
- **Before Merge**: Version number and date are only added when merging to main
- **Release Process**: The release-script automatically converts the placeholder to the actual version

#### Change Entry Format
Use this consistent format for changelog entries:
- `- (author) **TYPE**: User-friendly description of the change`
- Types: **NEW** (features), **FIXED** (bugs), **ENHANCED** (improvements)
- Focus on user impact, not technical implementation details
- Reference related issues: "fixes #XX" or "solves #XX"

#### Example Entry
```markdown
## **WORK IN PROGRESS**

- (DutchmanNL) **FIXED**: Adapter now properly validates login credentials instead of always showing "credentials missing" (fixes #25)
- (DutchmanNL) **NEW**: Added support for device discovery to simplify initial setup
```

## Dependency Updates

### Package Management
- Always use `npm` for dependency management in ioBroker adapters
- When working on new features in a repository with an existing package-lock.json file, use `npm ci` to install dependencies. Use `npm install` only when adding or updating dependencies.
- Keep dependencies minimal and focused
- Only update dependencies to latest stable versions when necessary or in separate Pull Requests. Avoid updating dependencies when adding features that don't require these updates.
- When you modify `package.json`:
  1. Run `npm install` to update and sync `package-lock.json`.
  2. If `package-lock.json` was updated, commit both `package.json` and `package-lock.json`.

### Dependency Best Practices
- Prefer built-in Node.js modules when possible
- Use `@iobroker/adapter-core` for adapter base functionality
- Avoid deprecated packages
- Document any specific version requirements

## JSON-Config Admin Instructions

### Configuration Schema
When creating admin configuration interfaces:

- Use JSON-Config format for modern ioBroker admin interfaces
- Provide clear labels and help text for all configuration options
- Include input validation and error messages
- Group related settings logically
- Example structure:
  ```json
  {
    "type": "panel",
    "items": {
      "host": {
        "type": "text",
        "label": "Host address",
        "help": "IP address or hostname of the device"
      }
    }
  }
  ```

### Admin Interface Guidelines
- Use consistent naming conventions
- Provide sensible default values
- Include validation for required fields
- Add tooltips for complex configuration options
- Ensure translations are available for all supported languages (minimum English and German)
- Write end-user friendly labels and descriptions, avoiding technical jargon where possible

## Best Practices for Dependencies

### HTTP Client Libraries
- **Preferred:** Use native `fetch` API (Node.js 20+ required for adapters; built-in since Node.js 18)
- **Avoid:** `axios` unless specific features are required (reduces bundle size)

### Example with fetch:
```javascript
try {
  const response = await fetch('https://api.example.com/data');
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  const data = await response.json();
} catch (error) {
  this.log.error(`API request failed: ${error.message}`);
}
```

### Other Dependency Recommendations
- **Logging:** Use adapter built-in logging (`this.log.*`)
- **Scheduling:** Use adapter built-in timers and intervals
- **File operations:** Use Node.js `fs/promises` for async file operations
- **Configuration:** Use adapter config system rather than external config libraries

## Error Handling

### Adapter Error Patterns
- Always catch and log errors appropriately
- Use adapter log levels (error, warn, info, debug)
- Provide meaningful, user-friendly error messages that help users understand what went wrong
- Handle network failures gracefully
- Implement retry mechanisms where appropriate
- Always clean up timers, intervals, and other resources in the `unload()` method

### Example Error Handling:
```javascript
try {
  await this.connectToDevice();
} catch (error) {
  this.log.error(`Failed to connect to device: ${error.message}`);
  this.setState('info.connection', false, true);
  // Implement retry logic if needed
}
```

### Timer and Resource Cleanup:
```javascript
// In your adapter class
private connectionTimer?: NodeJS.Timeout;

async onReady() {
  this.connectionTimer = setInterval(() => {
    this.checkConnection();
  }, 30000);
}

onUnload(callback) {
  try {
    // Clean up timers and intervals
    if (this.connectionTimer) {
      clearInterval(this.connectionTimer);
      this.connectionTimer = undefined;
    }
    // Close connections, clean up resources
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


### Telegram-Specific Testing Patterns

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
