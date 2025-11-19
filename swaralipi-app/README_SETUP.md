# स्वरलिपि (Swaralipi) - Advanced Music Notation Editor

A modern Angular-based Indian classical music notation editor with advanced features including:
- Two-line notation display (Swar + Bol)
- Real-time audio playback of swar and tabla
- Keyboard navigation and shortcuts
- Multiple taal support (Teen, Ektaal, Jhaptaal, Rupak, Dadra, Keherwa)
- Tabla recording and automatic notation generation
- Export to PDF, PNG, and JSON
- BHU Musical font integration

## Prerequisites

- Node.js 22.x or higher
- npm 10.x or higher
- Modern web browser with Web Audio API support

## Installation

1. Navigate to the project directory:
```bash
cd /home/user/swaralipi/swaralipi-app
```

2. Install dependencies:
```bash
npm install
```

3. Install additional dependencies for PDF export:
```bash
npm install jspdf html2canvas
```

## Running the Application

### Development Server

```bash
npm start
```

or

```bash
npx ng serve
```

The application will be available at `http://localhost:4200`

### Production Build

```bash
npx ng build --configuration production
```

The build artifacts will be stored in the `dist/` directory.

## Features

### Two-Line Notation
- **First Line (Swar)**: Musical notes (सा, रे, ग, म, प, ध, नी)
- **Second Line (Bol)**: Tabla bols (धा, धिं, ति, ता, etc.)

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `↑↓←→` | Navigate cells |
| `Enter` | Start editing (Swar → Bol) |
| `Esc` | Exit edit mode |
| `Tab` | Move to next cell |
| `Shift+Tab` | Move to previous cell |
| `Delete/Backspace` | Clear cell |
| `s, r, g, m, p, d, n` | Quick input for swar |
| `Ctrl+L` | Toggle lower octave |
| `Ctrl+U` | Toggle upper octave |
| `Ctrl+M` | Toggle meend |
| `Ctrl+K` | Toggle kan swar |
| `Ctrl+I` | Insert row |
| `Ctrl+D` | Delete row |
| `Ctrl+Z` | Undo |
| `Ctrl+Y` | Redo |
| `Ctrl+S` | Save |

### Quick Input Mapping

- `s` → सा (Sa)
- `r` → रे (Re)
- `g` → ग (Ga)
- `m` → म (Ma)
- `p` → प (Pa)
- `d` → ध (Dha)
- `n` → नी (Ni)

### Audio Playback

- Click any cell to play its swar or bol
- Supports octave modifiers (lower/upper)
- Realistic tabla sound synthesis
- Full composition playback with taal synchronization

### Tabla Features

- Record tabla patterns via microphone
- Automatic rhythm detection (placeholder - to be enhanced)
- Synthesized tabla sounds for different bols:
  - धा (Dha) - Bass + resonance
  - ति (Ti) - High pitched
  - ता (Ta) - Sharp attack
  - गे/का (Ge/Ka) - Medium resonance
  - ना (Na) - Bass resonance

### Export Options

- **PDF**: High-quality print output
- **PNG**: Image export for sharing
- **JSON**: Save/load compositions

## Project Structure

```
src/
├── app/
│   ├── components/
│   │   ├── notation-grid/          # Main notation grid with two-line display
│   │   ├── toolbar/                # Top toolbar with controls
│   │   ├── sidebar/                # Left sidebar with palette
│   │   └── playback-controls/      # Playback controls
│   ├── services/
│   │   ├── notation.ts             # Grid state management
│   │   ├── audio.ts                # Swar playback engine
│   │   ├── tabla.ts                # Tabla sound synthesis
│   │   └── export.ts               # Export functionality
│   ├── models/
│   │   └── notation.model.ts       # TypeScript interfaces
│   └── app.ts                      # Main app component
├── assets/
│   └── fonts/
│       └── BHU_Musical_Hindi_V3-Regular(1).ttf
└── styles.scss                     # Global styles

```

## Technical Details

### Architecture
- **Framework**: Angular 20.x with standalone components
- **Language**: TypeScript 5.x
- **Styling**: SCSS
- **Audio**: Web Audio API
- **State Management**: RxJS BehaviorSubjects

### Key Technologies
- Web Audio API for real-time sound synthesis
- MediaRecorder API for tabla recording
- HTML5 Canvas for export
- Responsive design with CSS Grid/Flexbox

## Development Roadmap

### Current Features ✅
- Two-line notation (Swar + Bol)
- Keyboard navigation
- Audio playback
- Multiple taal support
- Basic export

### Planned Enhancements 🚧
- Advanced tabla rhythm detection using ML
- More sophisticated audio synthesis (tanpura drone)
- Collaborative editing
- Cloud storage
- Mobile app version
- MIDI export
- Notation templates library
- Video tutorial integration

## Troubleshooting

### Audio not playing
- Ensure browser supports Web Audio API
- Check if audio context is resumed (requires user interaction)
- Verify browser permissions for audio

### Font not displaying correctly
- Clear browser cache
- Ensure font file is in `src/assets/fonts/`
- Check browser console for loading errors

### Performance issues
- Reduce grid size
- Disable real-time playback during editing
- Use production build for better performance

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Opera 76+

## Contributing

This project uses TypeScript strict mode and follows Angular best practices. Contributions are welcome!

## License

[Specify your license here]

## Credits

- BHU Musical Hindi Font
- Web Audio API
- Angular Team
- Indian Classical Music Community

## Support

For issues, questions, or feature requests, please open an issue on the project repository.

---

**Made with ❤️ for Indian Classical Music**
