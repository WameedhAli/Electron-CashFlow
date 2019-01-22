const { ipcRenderer } = require('electron')

// readystatechange as an alternative to DOMContentLoaded event
document.onreadystatechange = function () {
  if (document.readyState === 'interactive') {
    addClickEventListener()
  }
}

function addClickEventListener () {
  document.getElementById('btnEd').addEventListener('click', showtable)
  // ****bankStatus*****
  document.getElementById('id-View-Latest-Update').addEventListener('click', viewLatestUpdate)
}
// ****bankStatus*****
function viewLatestUpdate (e) {
  console.log('button click view')
  ipcRenderer.send('viewLastUpdate')
  // setInterval(viewLatestUpdate, 100000)
}

function showtable (e) {
  ipcRenderer.send('getnewtable')
}

ipcRenderer.on('overschrijvingen-message', (event, overschrijvingen) => {
  const oldTable = document.getElementById('overschrijvingenTableId')
  if (oldTable) {
    oldTable.remove()
  }

  const overschrijvingenArray = overschrijvingen.data
  const table = document.createElement('table')
  table.id = 'overschrijvingenTableId'
  document.getElementById('idShowTableData').appendChild(table)

  let tr, tdText, thText
  tr = document.createElement('tr')
  tr.classList.add('table-style')
  table.appendChild(tr)
  const headers = overschrijvingen.headers
  for (let j = 0; j < headers.length; j++) {
    thText = document.createElement('th')
    thText.textContent = headers[j]
    tr.appendChild(thText)
  }
  for (let i = 0; i < overschrijvingenArray.length; i++) {
    const overschrijving = overschrijvingenArray[i]
    const spreadsheetLine = i + 2 // because header is line 1, our array index 0 == 2 spreadsheetline
    tr = document.createElement('tr')
    table.appendChild(tr)
    tr.addEventListener('dblclick', (e) => {
      overschrijving[2] = overschrijving[2] === '' ? 'x' : ''
      console.log(overschrijving)
      ipcRenderer.send('overschrijvingen-message', {
        overschrijving,
        spreadsheetLine
      })
    })
    for (let j = 0; j < overschrijving.length; j++) {
      tdText = document.createElement('td')
      tdText.textContent = overschrijving[j]
      tr.appendChild(tdText)
    }
  }
})
