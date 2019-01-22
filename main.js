'use strict'

const fs = require('fs')
const readline = require('readline')
const { google } = require('googleapis')
// const path = require('path')
let moment = require('moment')
// eslint-disable-next-line node/no-deprecated-api
const { parse } = require('url')
moment().format()

require('electron-reload')(__dirname)

const { app, BrowserWindow, ipcMain } = require('electron')
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets']
const TOKEN_PATH = 'token.json'
const isToday = (date) => {
  return moment(date, 'DD-MM-YYYY').isSame(moment(), 'day')
}

let sheets, auth, mainWindow, bankStatusHeader, contents

const createWindow = () => {
  // Create the browser window.
  mainWindow = new BrowserWindow({ width: 950, height: 650 })

  // and load the index.html of the app.
  mainWindow.loadFile('src/index.html')
  // Open the DevTools.
  mainWindow.webContents.openDevTools()
  // Emitted when the window is closed.
  mainWindow.on('closed', () => {
    mainWindow = null
  })

  ipcMain.on('bank-message', async (event, arg) => {
    console.log('bank-message', arg) // prints "ping"
    await updateBankStatus(arg)
    // sendBankStatusToFrontend()
  })

  ipcMain.on('overschrijvingen-message', async (event, arg) => {
    console.log('overschrijvingen-message', arg) // prints "ping"
    await updateOverschrijvingenSheet(arg)
    sendOverschrijvingenToFrontend()
  })

  ipcMain.on('getnewtable', async (event, arg) => {
    sendOverschrijvingenToFrontend()
  })

  ipcMain.on('viewLastUpdate', async (event, arg) => {
    sendBankStatusToFrontend()
  })
  // eslint-disable-next-line no-unused-vars
  contents = mainWindow.webContents

  setTimeout(() => {
    // Load client secrets from a local file.
    fs.readFile('credentials.json', (err, content) => {
      if (err) return console.log('Error loading client secret file:', err)
      // Authorize a client with credentials, then call the Google Sheets API.
      authorize(JSON.parse(content), (a) => {
        auth = a
        sheets = google.sheets({ version: 'v4', auth })
        console.log('Authenticated')
        sendBankStatusToFrontend()
      })
    })
  }, 2000)

  function authorize (credentials, callback) {
    // eslint-disable-next-line camelcase
    const { client_secret, client_id, redirect_uris } = credentials.installed
    const oAuth2Client = new google.auth.OAuth2(
      client_id, client_secret, redirect_uris[0])

    // Check if we have previously stored a token.
    fs.readFile(TOKEN_PATH, (err, token) => {
      if (err) return getNewToken(oAuth2Client, callback)
      oAuth2Client.setCredentials(JSON.parse(token))
      callback(oAuth2Client)
    })
  }

  function getNewToken (oAuth2Client, callback) {
    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES
    })
    console.log('Authorize this app by visiting this url:', authUrl)

    // contents.send('google_sheets_auth',authUrl)

    const authWindow = new BrowserWindow({
      width: 500,
      height: 600,
      show: true
    })
    function handleNavigation (url) {
      const query = parse(url, true).query
      console.log(query)
      if (query) {
        if (query.error) {
          // eslint-disable-next-line no-new
          new Error(`There was an error: ${query.error}`)
        } else if (query.approvalCode) {
          // Login is complete
          authWindow.removeAllListeners('closed')
          setImmediate(() => authWindow.close())
          const code = query.approvalCode
          oAuth2Client.getToken(code, (err, token) => {
            if (err) return console.error('Error while trying to retrieve access token', err)
            oAuth2Client.setCredentials(token)
            // Store the token to disk for later program executions
            fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
              if (err) console.error(err)
              console.log('Token stored to', TOKEN_PATH)
            })
            callback(oAuth2Client)
          })
        }
      }
    }
    authWindow.on('closed', () => {
      // TODO: Handle this smoothly
      throw new Error('Auth window was closed by user')
    })

    authWindow.webContents.on('will-navigate', (event, url) => {
      handleNavigation(url)
    })

    authWindow.webContents.on('did-get-redirect-request', (event, oldUrl, newUrl) => {
      handleNavigation(newUrl)
    })
    authWindow.loadURL(authUrl)

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    })

    rl.question('Enter the code from that page here: ', (code) => {
      rl.close()
      oAuth2Client.getToken(code, (err, token) => {
        if (err) return console.error('Error while trying to retrieve access token', err)
        oAuth2Client.setCredentials(token)
        // Store the token to disk for later program executions
        fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
          if (err) console.error(err)
          console.log('Token stored to', TOKEN_PATH)
        })
        callback(oAuth2Client)
      })
    })
  }
}

app.on('ready', createWindow)
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
app.on('activate', function () {
  if (mainWindow === null) {
    createWindow()
  }
})

//* *************** BankStatus ************************* */
const updateBankStatus = async (bankStatus) => {
  if (!auth) return
  const currentBankStatus = await getCurrentBankStatus()
  const isCurrentBankStatusToday = isToday(currentBankStatus.data[0])
  let row
  if (isCurrentBankStatusToday) {
    // update last line
    row = currentBankStatus.row
  } else {
    // add new line
    row = currentBankStatus.row + 1
  }
  return updateBankStatusSheet(bankStatus, row)
}

const getCurrentBankStatus = (bankStatus) => {
  return new Promise((resolve, reject) => {
    sheets.spreadsheets.values.get({
      spreadsheetId: '1xNDhfQOXmo1Az_2akfXIJz9z7N9_GYfJmFmeyM15i5E',
      range: 'bank status!A:E',
      auth: auth
    }, (err, result) => {
      if (err) {
        // Handle error
        console.log(err)
      } else {
        bankStatusHeader = result.data.values[0].map(item => item.trim())
        resolve({
          data: result.data.values[result.data.values.length - 1],
          row: result.data.values.length,
          bankStatusHeader
        })
      }
    })
  })
}

const updateBankStatusSheet = (bankStatus, row) => {
  return new Promise((resolve, reject) => {
    let values = bankStatusHeader.map((item) => {
      if (item === 'Date') return moment().format('D-M-YYYY')
      else return bankStatus[item]
    })
    const resource = {
      values: [values]
    }
    sheets.spreadsheets.values.update({
      spreadsheetId: '1xNDhfQOXmo1Az_2akfXIJz9z7N9_GYfJmFmeyM15i5E',
      range: 'bank status!A' + row + ':E',
      resource,
      valueInputOption: 'RAW',
      auth: auth
    }, (err, result) => {
      if (err) {
        reject(err)
        console.log(err)
      } else {
        return resolve(result)
      }
    })
  })
}

const sendBankStatusToFrontend = async () => {
  const banksStatus = await getCurrentBankStatus()
  contents.send('bank-message-send-toFrontend', banksStatus)
}

//* *************** overschrijvingen ************************* */
const sendOverschrijvingenToFrontend = async () => {
  const overschrijvingen = await getOverschrijvingen()
  contents.send('overschrijvingen-message', overschrijvingen)
}

const getOverschrijvingen = () => {
  return new Promise((resolve, reject) => {
    sheets.spreadsheets.values.get({
      spreadsheetId: '1xNDhfQOXmo1Az_2akfXIJz9z7N9_GYfJmFmeyM15i5E',
      range: 'Overschrijvingen!A:K',
      auth: auth
    }, (err, result) => {
      if (err) {
        // Handle error
        console.log(err)
      } else {
        const overschrijvingen = result.data.values
        const headers = overschrijvingen.shift()
        resolve({
          data: overschrijvingen,
          headers
        })
      }
    })
  })
}

const updateOverschrijvingenSheet = ({ overschrijving, spreadsheetLine }) => {
  return new Promise((resolve, reject) => {
    const resource = {
      values: [overschrijving]
    }
    sheets.spreadsheets.values.update({
      spreadsheetId: '1xNDhfQOXmo1Az_2akfXIJz9z7N9_GYfJmFmeyM15i5E',
      range: 'Overschrijvingen!A' + spreadsheetLine + ':K',
      resource,
      valueInputOption: 'RAW',
      auth: auth
    }, (err, result) => {
      if (err) {
        reject(err)
        console.log(err)
      } else {
        return resolve(result)
      }
    })
  })
}
