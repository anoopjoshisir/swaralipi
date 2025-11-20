# Swaralipi - Indian Classical Music Notation Editor

A modern, full-featured web application for creating, editing, and sharing Indian Classical Music notation with advanced features for practice, collaboration, and performance analysis.

## Features

### Core Features
- 📝 **Dual-line Notation System**: Swar (notes) and Bol (tabla)
- 🎵 **Playback Engine**: Real-time audio synthesis for both vocal and tabla
- 🎨 **Rich Notation Elements**: Meend, Kan, Gamak, Andolan, and more
- 📊 **Multi-layer Support**: Multiple tracks with independent editing
- 🎼 **Lyrics Integration**: Synchronized lyrics with notation

### Cloud Features (Firebase Backend)
- 🔐 **Authentication**: Email/Password and Google OAuth
- ☁️ **Cloud Storage**: Save and sync compositions across devices
- 🔄 **Real-time Collaboration**: See others edit in real-time
- 💬 **Comments & Discussion**: Annotate specific cells
- 🔗 **Share Links**: Generate secure shareable links
- 📚 **Version History**: Track and restore previous versions

### Practice & Performance
- 🎤 **Recording**: Practice session audio recording
- 📈 **Performance Analytics**: Track accuracy, timing, and progress
- 🔥 **Heatmaps**: Visualize practice patterns
- 💡 **Practice Insights**: AI-powered suggestions

### Export Options
- 📄 PDF Export
- 🖼️ PNG Export
- 🎹 MIDI Export
- 📋 JSON Export/Import

## Tech Stack

### Frontend
- **Framework**: Angular 20.3
- **Language**: TypeScript 5.9
- **Styling**: SCSS
- **State Management**: RxJS
- **Audio**: Web Audio API

### Backend (Firebase)
- **Authentication**: Firebase Authentication
- **Database**: Cloud Firestore
- **Storage**: Cloud Storage
- **Functions**: Cloud Functions (Node.js 20)
- **Hosting**: Firebase Hosting

## Getting Started

### Prerequisites
- Node.js 20.x or higher
- npm or yarn
- Firebase CLI (`npm install -g firebase-tools`)

### Installation

1. **Clone the repository**
\`\`\`bash
git clone https://github.com/yourusername/swaralipi.git
cd swaralipi
\`\`\`

2. **Install app dependencies**
\`\`\`bash
cd swaralipi-app
npm install
\`\`\`

3. **Install functions dependencies**
\`\`\`bash
cd ../functions
npm install
\`\`\`

4. **Configure Firebase**
   - Follow the detailed guide in [FIREBASE_SETUP.md](./FIREBASE_SETUP.md)
   - Create a Firebase project
   - Update environment files with your Firebase config

5. **Run locally**
\`\`\`bash
cd swaralipi-app
npm start
\`\`\`

Open http://localhost:4200 in your browser.

## Deployment

### Deploy to Firebase

1. **Build the app**
\`\`\`bash
cd swaralipi-app
npm run build
\`\`\`

2. **Deploy everything**
\`\`\`bash
cd ..
firebase deploy
\`\`\`

Or deploy specific services:
\`\`\`bash
firebase deploy --only hosting          # Web app
firebase deploy --only functions        # Cloud Functions
firebase deploy --only firestore:rules  # Security rules
firebase deploy --only storage:rules    # Storage rules
\`\`\`

See [FIREBASE_SETUP.md](./FIREBASE_SETUP.md) for detailed deployment instructions.

## Firebase Free Tier Configuration

This application is optimized to stay within Firebase's free tier:

- **Firestore**: Max 50 compositions per user
- **Storage**: Max 100MB per user (5MB per recording, 20 recordings max)
- **Functions**: Optimized invocations and batched operations
- **Hosting**: Efficient caching and compression

## Project Structure

\`\`\`
swaralipi/
├── swaralipi-app/           # Angular application
│   ├── src/
│   │   ├── app/
│   │   │   ├── components/  # UI components
│   │   │   ├── services/    # Business logic services
│   │   │   ├── models/      # Data models
│   │   │   └── app.ts       # Main component
│   │   ├── assets/          # Static assets
│   │   ├── environments/    # Environment configs
│   │   └── styles.scss      # Global styles
│   ├── angular.json
│   ├── package.json
│   └── tsconfig.json
├── functions/               # Firebase Cloud Functions
│   ├── src/
│   │   └── index.ts        # Functions implementation
│   ├── package.json
│   └── tsconfig.json
├── firestore.rules          # Firestore security rules
├── firestore.indexes.json   # Firestore indexes
├── storage.rules            # Storage security rules
├── firebase.json            # Firebase configuration
├── .firebaserc             # Firebase project config
├── FIREBASE_SETUP.md       # Deployment guide
└── README.md
\`\`\`

## Core Services

### Frontend Services

1. **AuthService** - User authentication and session management
2. **FirebaseConfigService** - Firebase initialization
3. **CloudStorageService** - Composition cloud sync
4. **CollaborationService** - Real-time collaboration features
5. **NotationService** - Notation grid management
6. **AudioService** - Swar synthesis and playback
7. **TablaService** - Tabla sound synthesis
8. **RecordingPracticeService** - Practice recording
9. **PerformanceAnalyticsService** - Practice insights
10. **VersionHistoryService** - Version control
11. **ExportService** - PDF/PNG/MIDI export

### Backend Functions

1. **onUserCreated** - Initialize user data
2. **onUserDeleted** - Cleanup user data
3. **onCompositionUpdate** - Auto-versioning
4. **generateShareLink** - Create share links
5. **recordShareLinkAccess** - Track link usage
6. **aggregatePracticeAnalytics** - Daily analytics
7. **cleanupTempFiles** - Remove old temp files
8. **updateStorageUsage** - Track storage quota

## Security

- ✅ Firebase Authentication for user management
- ✅ Firestore Security Rules for data access control
- ✅ Storage Security Rules for file access
- ✅ Server-side validation in Cloud Functions
- ✅ HTTPS-only communication
- ✅ Input sanitization and validation

## Performance Optimizations

- ✅ Lazy loading of components
- ✅ Real-time listeners with optimized queries
- ✅ Client-side caching with service workers
- ✅ Bundle size optimization
- ✅ Image and asset compression
- ✅ CDN caching headers
- ✅ Offline-first architecture

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Opera (latest)

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Built with Angular and Firebase
- Inspired by traditional Indian Classical Music notation systems
- Special thanks to the Indian Classical Music community

## Support

- Documentation: See [FIREBASE_SETUP.md](./FIREBASE_SETUP.md)
- Issues: GitHub Issues
- Discussions: GitHub Discussions

## Roadmap

### Version 1.0 (Current)
- ✅ Complete notation editor
- ✅ Firebase backend integration
- ✅ Real-time collaboration
- ✅ Practice and analytics features

### Version 1.1 (Planned)
- 🔲 Mobile app (iOS/Android)
- 🔲 Advanced ML-based practice feedback
- 🔲 Community compositions library
- 🔲 Live performance mode
- 🔲 Multi-language support

### Version 2.0 (Future)
- 🔲 Video recording integration
- 🔲 Teacher-student workflows
- 🔲 Competitions and leaderboards
- 🔲 Advanced audio processing
- 🔲 Custom tablature systems

---

Made with ❤️ for Indian Classical Music
