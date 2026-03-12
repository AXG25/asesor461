# AGENTS.md - Developer Guidelines for Asesor461

This document provides guidelines for agentic coding agents working on this codebase.

## Project Overview

This is a WhatsApp bot for a beauty/trade school (Escuela ESME) that automates customer conversations, handles course inquiries, manages follow-ups, and integrates with an external CRM.

- **Language**: JavaScript (Node.js)
- **Modules**: CommonJS (require/exports)
- **Key Dependencies**: whatsapp-web.js, puppeteer, qrcode-terminal
- **Platform**: Windows (hardcoded Chrome path)

## Build, Run, and Test Commands

### Running the Application

```bash
# Install dependencies
npm install

# Start the bot (requires WhatsApp authentication via QR code)
node index.js

# Or with npx
npx node index.js
```

### Test Commands

Currently, there are **no formal tests** configured. The package.json test script is a placeholder:

```bash
# This will fail - no tests defined
npm test
```

To add tests, consider using Jest or Mocha:
```bash
npm install --save-dev jest
npm test  # Run tests
npm test -- --testNamePattern="specific test"  # Run single test
```

### Running a Single Test (when tests are added)

```bash
# Jest
npm test -- --testNamePattern="function name"

# Mocha
npm test -- --grep "test name"
```

## Code Style Guidelines

### General Principles

- Keep functions small and focused (single responsibility)
- Use async/await for asynchronous operations
- Handle errors gracefully with try/catch blocks
- Log important actions and errors for debugging

### Imports and Module System

This project uses **CommonJS** (require/module.exports):

```javascript
// Correct
const { Client, LocalAuth } = require('whatsapp-web.js');
const cursos = require('./cursos.js');
const { saveToDB } = require('./saveToDB.js');

// For ES modules (if migrating), use:
// import { Client } from 'whatsapp-web.js';
```

### Naming Conventions

- **Variables/Functions**: Use camelCase
  ```javascript
  const userData = {};
  function getPhoneFromLid() { }
  ```
- **Constants**: Use UPPER_SNAKE_CASE
  ```javascript
  const SEGUIMIENTO_INTERVAL = 24 * 60 * 60 * 1000;
  const ASISTENTE_NUMERO = '573025479797@c.us';
  ```
- **Objects/Arrays**: Use descriptive names in camelCase
  ```javascript
  const mensajesSeguimiento = [];
  const usuariosActivos = {};
  ```

### Formatting

- Use **4 spaces** for indentation (as seen in existing code)
- Maximum line length: 100-120 characters
- Add spaces around operators: `const sum = a + b;`
- No trailing whitespace

### Types

This is a **JavaScript project** (no TypeScript). Use JSDoc for documentation if needed:

```javascript
/**
 * @param {string} chatId - The WhatsApp chat ID
 * @param {object} user - The user object
 * @returns {boolean} Success status
 */
async function sendFollowUp(chatId, user) { }
```

### Error Handling

Always wrap async operations in try/catch:

```javascript
// Good
async function sendMessage(chatId, message) {
    try {
        await getClient().sendMessage(chatId, message);
        return true;
    } catch (error) {
        console.error(`Error al enviar mensaje a ${chatId}:`, error);
        return false;
    }
}

// Avoid silently swallowing errors without logging
```

### File Organization

- **index.js**: Main bot logic, event handlers, message processing
- **cursos.js**: Course data and configuration (palabrasClave, dates, promotions)
- **saveToDB.js**: Puppeteer automation for external CRM integration
- **users.json**: Persistent storage for user state

### Key Patterns

#### Client Initialization
```javascript
const crearCliente = (config) => {
    const client = new Client({
        authStrategy: new LocalAuth({ dataPath: config.sessionName }),
        puppeteer: { /* options */ }
    });
    client.on('ready', () => { /* handlers */ });
    client.on('message', (msg) => manejarMensaje(msg, config.id));
    return client;
};
```

#### Message Processing Flow
1. Normalize incoming text
2. Check if user exists in state
3. Route to appropriate handler based on user state
4. Save state changes

#### State Machine Pattern
Users have an `estado` property that controls conversation flow:
- `inicio` - Initial course information sent
- `seleccion_fechas` - User is choosing a date
- `confirmacion_promocion` - User confirmed interest, payment method discussion

### Configuration Constants

Keep configuration at the top of files:
```javascript
const CLEANUP_INTERVAL = 15 * 24 * 60 * 60 * 1000;
const STOP_EMOJI = '✨';
const MAX_SEGUIMIENTOS = 5;
```

### WhatsApp-Specific Notes

- Use `LocalAuth` for session persistence
- Handle both regular chats (`@c.us`) and LIDs (`@lid`)
- Use `MessageMedia.fromFilePath()` for sending files
- Mark chats as unread with `chat.markUnread()` for important follow-ups

### Database Pattern

The `users.json` file stores user state:
```javascript
users[chatId] = {
    estado: 'inicio',
    curso: 'barberia',
    idInstancia: 1,
    createdAt: Date.now(),
    lastActivity: Date.now(),
    respuestasInesperadas: 0,
    followUpStage: 0
};
```

Always call `saveUsers()` after modifying state.

### Adding New Courses

Edit `cursos.js` following the existing structure:
```javascript
module.exports = {
    'CourseName': {
        palabrasClave: ['keyword1', 'keyword2'],
        pensum: 'image.jpg',
        presentacion: 'audio.ogg',
        video: 'video.mp4',
        promocion: 'Promotion text...',
        fechas: 'Available dates...'
    }
};
```

### Best Practices

1. **Always save state**: Call `saveUsers()` after modifying the users object
2. **Add delays**: Use `waitRandom()` between messages to seem more human
3. **Handle duplicates**: Check `processedMessages` Set to avoid duplicate processing
4. **Clean up old users**: Implement cleanup logic to prevent memory leaks
5. **Graceful shutdown**: Use process error handlers for uncaught exceptions

### Security Considerations

- **Hardcoded credentials**: The `saveToDB.js` contains hardcoded credentials for the CRM - keep these secure
- **Session data**: The `session1`/`session2` folders contain WhatsApp session data - do not commit these
- **User data**: `users.json` contains user phone numbers - treat as sensitive data

### Debugging Tips

- Check console logs for message flow: `console.log('Mensaje entrante:', ...)`
- Use WhatsApp Web in non-headless mode temporarily for visual debugging
- The `session` folder contains Chrome user data for debugging

## Development Workflow

1. Make changes to the code
2. Test manually by scanning QR code with WhatsApp
3. For new features, test edge cases:
   - New user starting conversation
   - User responding at each state
   - User going silent (triggering follow-ups)
   - User returning after completion

## File Structure

```
asesor461/
├── index.js           # Main bot logic
├── cursos.js         # Course definitions
├── saveToDB.js      # CRM integration
├── users.json       # User state (generated)
├── package.json     # Dependencies
├── *.jpg, *.mp4, *.ogg  # Media files
└── session*/        # WhatsApp session data
```

## Common Tasks

### Adding a New Course
1. Add entry to `cursos.js` with all required fields
2. Add media files (pensum image, presentation audio, video)
3. Test keyword matching

### Modifying Conversation Flow
1. Find the relevant handler function in `index.js`
2. Update state transitions in handler functions
3. Update cleanup logic if needed

### Fixing Bugs
1. Check console logs for error messages
2. Reproduce the issue manually
3. Add logging if needed
4. Fix and verify

---

This file should be updated as the project evolves.
