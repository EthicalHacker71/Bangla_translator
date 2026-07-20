const { app, BrowserWindow, Menu, MenuItem } = require('electron')
const path = require('path')

let mainWindow = null;

// Ensure only one instance of the app runs at a time (like VLC)
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  // If user double-clicks a second video while app is already open
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
      
      const fileArg = commandLine.find(arg => typeof arg === 'string' && arg.match(/\.(mp4|mkv|webm|avi|mov|m4v)$/i))
      if (fileArg) {
        mainWindow.webContents.send('open-file', fileArg)
      }
    }
  })

  app.whenReady().then(() => {
    mainWindow = new BrowserWindow({
      width: 1400,
      height: 900,
      backgroundColor: '#000000',
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        webSecurity: false // CRITICAL: Allows local <video src="file://..."> to bypass CORS restrictions
      }
    })

    // Use loadFile to naturally run on the file:// protocol
    mainWindow.loadFile(path.join(__dirname, 'dist/index.html')).catch(err => {
      console.error("Failed to load app:", err);
    });

    // Hand off the video file to React the moment the UI finishes loading
    mainWindow.webContents.on('did-finish-load', () => {
      const fileArg = process.argv.find(arg => typeof arg === 'string' && arg.match(/\.(mp4|mkv|webm|avi|mov|m4v)$/i))
      if (fileArg) {
        mainWindow.webContents.send('open-file', fileArg)
      }
    })

    mainWindow.webContents.on('context-menu', (event, params) => {
      const menu = new Menu()
      if (params.isEditable) {
        menu.append(new MenuItem({ role: 'undo' }))
        menu.append(new MenuItem({ role: 'redo' }))
        menu.append(new MenuItem({ type: 'separator' }))
        menu.append(new MenuItem({ role: 'cut' }))
        menu.append(new MenuItem({ role: 'copy' }))
        menu.append(new MenuItem({ role: 'paste' }))
        menu.append(new MenuItem({ type: 'separator' }))
        menu.append(new MenuItem({ role: 'selectAll' }))
      } else if (params.selectionText && params.selectionText.trim().length > 0) {
        menu.append(new MenuItem({ role: 'copy' }))
        menu.append(new MenuItem({ type: 'separator' }))
        menu.append(new MenuItem({ role: 'selectAll' }))
      }
      menu.popup(mainWindow)
    })
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})