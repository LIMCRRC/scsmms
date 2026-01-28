// failure.js - Modified for CORS Compatibility
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwHdGZgbb-koV0qK7qF9MJmPTtxPxy4OB6Ep-u6XN_X0T-5VStlH0j5rDyF227ucdL5/exec";
const date = new Date();
Chart.register(ChartDataLabels);

// Use local date for display
document.getElementById("todayDate").textContent = 
  `${date.getDate().toString().padStart(2, '0')}-${date.toLocaleString('en-US', { month: 'short' })}-${date.getFullYear()}`;

let chartFailuresByTrain, chartFailuresBySystem, chartFailuresByMonth, chartFailuresByTrainHistorical;

// Utility function to format dates correctly
function formatDateFromSheet(dateString, isPeriod = false) {
  if (!dateString) return '';
  if (isPeriod && typeof dateString === 'string' && dateString.match(/^\d{4}-\d{2}-\d{2}/)) {
    try {
      const dateObj = new Date(dateString);
      if (!isNaN(dateObj.getTime())) {
        const month = dateObj.toLocaleDateString('en-US', { month: 'short' });
        const year = dateObj.getFullYear().toString().slice(-2);
        return `${month}-${year}`;
      }
    } catch (e) { console.error('Error formatting period:', e); }
    return dateString;
  }
  if (typeof dateString === 'string' && dateString.match(/^\d{4}-\d{2}-\d{2}/)) {
    return dateString.includes('T') ? new Date(dateString).toLocaleDateString('en-CA') : dateString;
  }
  return dateString;
}

function getUrlParameter(name) {
  name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
  const regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
  const results = regex.exec(location.search);
  return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
}

function setUserInfo() {
  const name = localStorage.getItem('userFullName') || getUrlParameter('name') || localStorage.getItem('maintenanceUser') || 'Guest';
  const position = localStorage.getItem('userActualPosition') || getUrlParameter('position') || localStorage.getItem('userPosition') || 'Maintenance Staff';
  document.getElementById('loggedInName').textContent = name;
  document.getElementById('loggedInPosition').textContent = position;
}

async function fetchFailureData() {
  try {
    const res = await fetch(SCRIPT_URL);
    const json = await res.json();
    return json.data || [];
  } catch (err) {
    console.error("Error fetching failure data:", err);
    return [];
  }
}

function groupByType(arr, key) {
  const result = {};
  arr.forEach(item => {
    const label = item[key];
    const type = item.Fault;
    if (!result[label]) result[label] = { Major: 0, Minor: 0, Omitted: 0 };
    result[label][type] = (result[label][type] || 0) + 1;
  });
  return result;
}

function populatePeriodFilter(data) {
  const periods = [...new Set(data.map(d => d.Period))];
  const filter = document.getElementById("periodFilter");
  filter.innerHTML = '<option value="all">All</option>';
  periods.sort((a, b) => new Date(a) - new Date(b)).forEach(p => {
    const d = new Date(p);
    const opt = document.createElement("option");
    opt.value = p;
    opt.textContent = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
    filter.appendChild(opt);
  });
}

function getSelectedFaults(chartId) {
  return Array.from(document.querySelectorAll(`.faultFilter[data-chart="${chartId}"]:checked`)).map(cb => cb.value);
}

function createStackedChart(ctx, labels, datasets, chartId) {
  const totals = labels.map((_, i) => datasets.reduce((sum, ds) => sum + (ds.data[i] || 0), 0));
  const maxValue = Math.max(...totals);
  const paddedMax = Math.ceil(maxValue * 1.2);

  const chart = new Chart(ctx, {
    type: "bar",
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { right: 60, top: 10 } },
      plugins: {
        legend: { position: "bottom", labels: { boxWidth: 12, padding: 20 } },
        tooltip: { mode: "index", intersect: false },
        datalabels: {
          anchor: "end", align: "end", clamp: false, clip: false, color: "#000",
          font: { weight: "bold", size: 10 },
          formatter: (value, context) => {
            const index = context.dataIndex;
            const total = context.chart.data.datasets.reduce((sum, ds) => sum + ds.data[index], 0);
            return context.datasetIndex === context.chart.data.datasets.length - 1 ? total : "";
          }
        }
      },
      scales: {
        x: { stacked: true },
        y: { stacked: true, beginAtZero: true, suggestedMax: paddedMax, ticks: { stepSize: Math.max(1, Math.ceil(paddedMax / 20)), callback: v => (v % 1 === 0 ? v : null) } }
      },
      onClick: (evt, elements) => {
        if (!elements.length) return;
        const idx = elements[0].index;
        const label = chart.data.labels[idx];
        const selectedTypes = getSelectedFaults(chartId);
        const selectedPeriod = document.getElementById("periodFilter").value;
        const filteredRecords = window.failureData.filter(d => {
          const matchPeriod = selectedPeriod === "all" || d.Period === selectedPeriod;
          let matchLabel = false;
          if (chartId.includes("Train")) matchLabel = d.Train === label;
          else if (chartId.includes("System")) matchLabel = d.System === label;
          else if (chartId.includes("Month")) {
            const formatted = new Date(d.Period).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
            matchLabel = formatted === label;
          }
          return matchPeriod && matchLabel && selectedTypes.includes(d.Fault);
        });
        openRecordsModal(filteredRecords, `${label} Failures`);
      }
    }
  });
  return chart;
}

function createFilteredDataset(labels, dataByType, selectedTypes) {
  const colors = { Major: "#6F8FAF", Minor: "#A7C7E7", Omitted: "#cccccc" };
  return selectedTypes.map(type => ({
    label: type,
    data: labels.map(l => dataByType[l][type] || 0),
    backgroundColor: colors[type]
  }));
}

function updateCharts(data, selectedPeriod) {
  const filtered = selectedPeriod === "all" ? data : data.filter(d => d.Period === selectedPeriod);
  
  const trainData = groupByType(filtered, "Train");
  const trainLabels = Object.keys(trainData).sort((a, b) => parseInt(a.replace("T", "")) - parseInt(b.replace("T", "")));
  if(chartFailuresByTrain) chartFailuresByTrain.destroy();
  chartFailuresByTrain = createStackedChart(document.getElementById("failuresByTrain"), trainLabels, createFilteredDataset(trainLabels, trainData, getSelectedFaults("failuresByTrain")), "failuresByTrain");

  const systemData = groupByType(filtered, "System");
  const sortedSystems = Object.keys(systemData).sort((a, b) => Object.values(systemData[b]).reduce((s,v)=>s+v,0) - Object.values(systemData[a]).reduce((s,v)=>s+v,0));
  if (chartFailuresBySystem) chartFailuresBySystem.destroy();
  chartFailuresBySystem = createStackedChart(document.getElementById("failuresBySystem"), sortedSystems, createFilteredDataset(sortedSystems, systemData, getSelectedFaults("failuresBySystem")), "failuresBySystem");

  const monthData = groupByType(data, "Period");
  const monthKeys = Object.keys(monthData).sort((a,b)=> new Date(a)-new Date(b));
  const monthLabels = monthKeys.map(d => new Date(d).toLocaleDateString("en-US", { month: "short", year: "2-digit" }));
  if(chartFailuresByMonth) chartFailuresByMonth.destroy();
  chartFailuresByMonth = createStackedChart(document.getElementById("failuresByMonth"), monthLabels, createFilteredDataset(monthKeys, monthData, getSelectedFaults("failuresByMonth")), "failuresByMonth");

  const totalTrainData = groupByType(data, "Train");
  const trainOverallLabels = Object.keys(totalTrainData).sort((a,b)=>parseInt(a.replace("T",""))-parseInt(b.replace("T","")));
  if(chartFailuresByTrainHistorical) chartFailuresByTrainHistorical.destroy();
  chartFailuresByTrainHistorical = createStackedChart(document.getElementById("failuresByTrainHistorical"), trainOverallLabels, createFilteredDataset(trainOverallLabels, totalTrainData, getSelectedFaults("failuresByTrainHistorical")), "failuresByTrainHistorical");

  document.getElementById("MajorFailure").textContent = data.filter(d=>d.Fault==="Major").length;
  document.getElementById("MinorFailure").textContent = data.filter(d=>d.Fault==="Minor").length;
  document.getElementById("OmittedFailure").textContent = data.filter(d=>d.Fault==="Omitted").length;
}

function validateForm(formData) {
  const errors = [];
  ['Year', 'Period', 'Fault', 'Date', 'Train', 'System'].forEach(f => {
    if (!formData[f] || formData[f].trim() === '') errors.push(`${f} is required`);
  });
  return errors;
}

function showFormMessage(message, type) {
  const messageDiv = document.getElementById('formMessage');
  messageDiv.innerHTML = message;
  messageDiv.className = `form-message ${type}`;
  messageDiv.style.display = 'block';
  if (type === 'success') setTimeout(() => { messageDiv.style.display = 'none'; }, 5000);
}

function autoPopulateCurrentDate() {
  const now = new Date();
  document.querySelector('input[name="Date"]').valueAsDate = now;
  document.querySelector('input[name="Year"]').value = now.getFullYear();
  document.querySelector('input[name="Period"]').value = `${now.toLocaleString('en-US', { month: 'short' })}-${now.getFullYear().toString().slice(-2)}`;
}

// MODIFIED: Form Submission Logic to handle CORS
document.getElementById('failureForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  const form = e.target;
  const formData = new FormData(form);
  const data = Object.fromEntries(formData.entries());
  
  const errors = validateForm(data);
  if (errors.length > 0) {
    showFormMessage(errors.join('<br>'), 'error');
    return;
  }
  
  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.textContent = 'Submitting...';
  submitBtn.disabled = true;
  
  try {
    // We use mode: 'no-cors' and text/plain to bypass preflight checks
    await fetch(SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors', 
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(data)
    });
    
    // Because of 'no-cors', we cannot read the response. We assume success if no network error.
    showFormMessage('Record sent! Refreshing dashboard...', 'success');
    form.reset();
    
    setTimeout(() => {
      initDashboard();
      submitBtn.textContent = 'Submit Record';
      submitBtn.disabled = false;
    }, 2500);

  } catch (error) {
    showFormMessage(`Network error: ${error.message}`, 'error');
    submitBtn.textContent = 'Submit Record';
    submitBtn.disabled = false;
  }
});

// Modal and Initialization logic remains the same
let currentRecords = [];
let currentPage = 1;
const rowsPerPage = 10;

function openRecordsModal(records, title) {
  currentRecords = records;
  currentPage = 1;
  document.querySelector('#recordsModal .dialog-message strong').textContent = title;
  renderRecordsTable();
  document.getElementById("recordsModal").style.display = "flex";
}

function closeRecordsModal(){ document.getElementById("recordsModal").style.display = "none"; }

function renderRecordsTable(){
  const tbody = document.getElementById("recordsTableBody");
  const thead = document.getElementById("recordsTableHead");
  tbody.innerHTML = ""; thead.innerHTML = "";

  if(!currentRecords.length) return;

  const allColumns = Object.keys(currentRecords[0]).slice(0,26).filter((_, idx) => idx !== 11);
  const trHead = document.createElement("tr");
  allColumns.forEach(col => trHead.innerHTML += `<th>${col}</th>`);
  thead.appendChild(trHead);

  let start = (currentPage - 1) * rowsPerPage;
  let end = Math.min(start + rowsPerPage, currentRecords.length);

  for(let i = start; i < end; i++){
    const r = currentRecords[i];
    const tr = document.createElement("tr");
    allColumns.forEach(col => {
      let val = col === "Period" ? formatDateFromSheet(r[col], true) : formatDateFromSheet(r[col]);
      tr.innerHTML += `<td>${val}</td>`;
    });
    tbody.appendChild(tr);
  }

  const totalPages = Math.ceil(currentRecords.length / rowsPerPage);
  document.getElementById("pageInfo").textContent = `Page ${currentPage} of ${totalPages}`;
  document.getElementById("prevPageBtn").disabled = currentPage === 1;
  document.getElementById("nextPageBtn").disabled = currentPage === totalPages;
}

document.getElementById("prevPageBtn").onclick = () => { if(currentPage > 1) { currentPage--; renderRecordsTable(); }};
document.getElementById("nextPageBtn").onclick = () => { if(currentPage < Math.ceil(currentRecords.length/rowsPerPage)) { currentPage++; renderRecordsTable(); }};

async function initDashboard(){
  setUserInfo();
  const overlay = document.getElementById("loadingOverlay");
  overlay.style.display="flex";
  const data = await fetchFailureData();
  if(data.length){
    window.failureData = data;
    populatePeriodFilter(data);
    updateCharts(data, "all");
  }
  overlay.style.display="none";
}

document.getElementById('tabInfo').onclick = () => {
  document.getElementById('tabInfo').classList.add('active');
  document.getElementById('tabInput').classList.remove('active');
  document.getElementById('dataInputSection').style.display = 'none';
  document.querySelector('.dashboard-stats').style.display = 'flex';
  document.querySelectorAll('.card').forEach(c => c.style.display = 'block');
};

document.getElementById('tabInput').onclick = () => {
  document.getElementById('tabInput').classList.add('active');
  document.getElementById('tabInfo').classList.remove('active');
  document.getElementById('dataInputSection').style.display = 'block';
  document.querySelector('.dashboard-stats').style.display = 'none';
  document.querySelectorAll('.card').forEach(c => c.style.display = 'none');
  autoPopulateCurrentDate();
};

document.querySelectorAll(".faultFilter").forEach(cb => cb.onchange = () => updateCharts(window.failureData, document.getElementById("periodFilter").value));
document.getElementById("periodFilter").onchange = (e) => updateCharts(window.failureData, e.target.value);
document.getElementById('refreshBtn').onclick = () => initDashboard();
document.getElementById("cardMajor").onclick = () => openRecordsModal(window.failureData.filter(d=>d.Fault==="Major"), "Major Failures");
document.getElementById("cardMinor").onclick = () => openRecordsModal(window.failureData.filter(d=>d.Fault==="Minor"), "Minor Failures");
document.getElementById("cardOmitted").onclick = () => openRecordsModal(window.failureData.filter(d=>d.Fault==="Omitted"), "Omitted Failures");

initDashboard();