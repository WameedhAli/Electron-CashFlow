const { ipcRenderer } = require('electron')
const form = document.querySelector('form')

form.onsubmit = (e) => {
  e.preventDefault()
  const items = [...e.target.querySelectorAll('input')]
  const bankStatus = items.reduce((acc, item) => {
    acc[item.name] = parseFloat(item.value)
    return acc
  }, {})
  ipcRenderer.send('bank-message', bankStatus)
}
ipcRenderer.on('asyn-replchronousy', (event, arg) => {
  console.log(arg)
})
ipcRenderer.on('google_sheets_auth', (event, url) => {
  console.log(url)
})

ipcRenderer.on('bank-message-send-toFrontend', (event, banksStatus) => {
  const lastEntryInBankStatus = banksStatus.data
  // console.log(lastEntryInBankStatus)
  banksStatus.bankStatusHeader.forEach((element, index) => {
    if (element === 'Date') {
      const lastUpdated = document.getElementById(`lastUpdated`)
      lastUpdated.innerText = lastEntryInBankStatus[index]
    } else {
      const input = document.querySelector(`input[name=${element}]`)
      if (input) {
        input.value = lastEntryInBankStatus[index]
      }
    }
  })
})
