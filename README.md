# Activity Tracking

🔍 **Comprehensive Desktop Activity Monitoring Application**

Activity Tracking is a powerful desktop application built with Electron, Vue, and TypeScript that provides comprehensive monitoring of your computer activities. Track your productivity, monitor application usage, and gain insights into your digital habits.

## 🌟 Features

- **Real-time Activity Monitoring** - Track active windows and applications
- **Productivity Analytics** - Detailed insights into your work patterns
- **Screenshot Capture** - Optional screenshot functionality for activity verification
- **Local Data Storage** - All data stored securely on your machine using SQLite
- **Export Capabilities** - Export your data to CSV format
- **Cross-Platform** - Available for Windows, macOS, and Linux
- **Privacy Focused** - No data leaves your machine
- **Configurable Tracking** - Customize tracking intervals and preferences

## 🚀 Quick Start

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Installation

## Recommended IDE Setup

- [VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode) + [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar)

## Project Setup

### Install

```bash
$ npm install
```

### Development

```bash
$ npm run dev
```

### Build

```bash
# For windows
$ npm run build:win

# For macOS
$ npm run build:mac

# For Linux
$ npm run build:linux
```

## 🛠️ Technology Stack

- **[Electron](https://electronjs.org/)** - Cross-platform desktop app framework
- **[Vue.js](https://vuejs.org/)** - Progressive JavaScript framework
- **[TypeScript](https://typescriptlang.org/)** - Typed superset of JavaScript
- **[SQLite](https://sqlite.org/)** - Lightweight database engine
- **[Electron Vite](https://electron-vite.org/)** - Build tooling
- **[Node.js](https://nodejs.org/)** - JavaScript runtime

## 📊 Database Schema

The application uses SQLite to store activity data locally:

- **activities** - Main activity tracking table
- **screenshots** - Screenshot metadata and paths
- **configurations** - User preferences and settings

## 🔒 Privacy & Security

- All data is stored locally on your machine
- No telemetry or data collection
- Optional screenshot feature can be disabled
- Open source - audit the code yourself

## 🌐 Website

Visit our project website: [https://keleshteri.github.io/activity-tracker](https://keleshteri.github.io/activity-tracker)

## 👨‍💻 Author

**Mohammad mehdi shaban keleshteri (MMS Keleshteri)**

- GitHub: [@keleshteri](https://github.com/keleshteri)
- Project: [activity-tracker](https://github.com/keleshteri/activity-tracker)

## 📄 License

This project is open source. Please check the LICENSE file for details.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📞 Support

If you encounter any issues or have questions, please [open an issue](https://github.com/keleshteri/activity-tracker/issues) on GitHub.
