# Credential Generator with Policy Controls

A production-quality, visually stunning password generator dashboard built with vanilla HTML, CSS, and ES6 JavaScript modules.

![Dashboard Preview](https://via.placeholder.com/800x450?text=Credential+Generator+Dashboard)

## Features

### 🔐 Password Generation
- Customizable policy controls (length, character requirements)
- Cryptographically secure random generation using `crypto.getRandomValues()`
- Options to avoid similar characters (I, l, 1, 0, O)
- No immediate repeating characters option

### 🤖 AI-Powered Generation
- Integration with Google Gemini AI
- Natural language password descriptions
- Respects policy constraints

### 📊 Strength Analysis
- Real-time entropy calculation
- Visual strength meter with 5 levels
- Detailed strength labels (Very Weak → Very Strong)

### 📜 Password History
- Persistent storage using IndexedDB (localStorage fallback)
- Search with debounced filtering
- Sort by date, strength, or length
- Pagination for large histories
- Undo support for deletions

### 🎨 Premium UI/UX
- Dark/Light theme with smooth transitions
- Glassmorphism card design
- Micro-interactions and animations
- Fully responsive layout
- Accessible (ARIA, keyboard navigation)

## Project Structure

```
├── index.html              # Main HTML entry point
├── styles/
│   ├── base.css           # Reset, typography, CSS variables
│   ├── layout.css         # Grid/flex layout system
│   └── components.css     # UI components (buttons, inputs, etc.)
├── js/
│   ├── main.js            # Application entry point
│   ├── passwordGenerator.js # Core password generation logic
│   ├── strengthMeter.js   # Entropy & strength calculations
│   ├── uiController.js    # DOM updates & event binding
│   ├── storage.js         # IndexedDB/localStorage management
│   ├── history.js         # Password history with search/sort
│   └── accessibility.js   # ARIA, keyboard shortcuts, focus
├── .env                   # Environment variables (API keys)
└── package.json           # Project configuration
```

## Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

### Configuration

Create a `.env` file with your Gemini API key:

```env
VITE_GEMINI_API_KEY=your_api_key_here
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `G` | Generate new password |
| `C` | Copy password to clipboard |
| `T` | Toggle dark/light theme |
| `H` | Toggle password visibility |
| `/` | Focus search input |
| `Esc` | Close modal |

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Tech Stack

- **HTML5** - Semantic markup
- **CSS3** - Custom properties, Flexbox, Grid, animations
- **JavaScript ES6+** - Modules, async/await, Web APIs
- **Vite** - Build tool and dev server
- **IndexedDB** - Client-side storage
- **Gemini AI** - AI password generation

## Authors

- Harsh Saini
- Aditya Chauhan

## License

MIT License - feel free to use this project for learning or production.
