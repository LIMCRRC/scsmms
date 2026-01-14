// ========================================= 
// Mileage Dashboard Script
// =========================================

const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbwVO4nV46goTQkD-tqD9ZoPgZTG3YGg_-wJ9-r4u9sM8TBiG5U7SN4PnZXgpF-ivwp--Q/exec'; // <-- replace with your deployed Apps Script URL
let mileageData = [];
let monthlyData = [];
let trendChartInstance = null;

// Train Sets
const TRAIN_SETS = Array.from({length: 38}, (_, i) => 'T' + String(i+1).padStart(2,'0'));

// =========================================
// Initialization
// =========================================
document.addEventListener('DOMContentLoaded', () => {
    loadUserInfo();
    loadMileageData();
    populateTrainDropdown();
    loadMonthlyData();
    bindEventListeners();
    updateDateTime();
    setInterval(updateDateTime, 60000);
});

function bindEventListeners() {
    document.getElementById('refreshBtn')?.addEventListener('click', () => {
        loadMileageData();
        loadMonthlyData();
    });
    document.getElementById('trainSelect')?.addEventListener('change', renderTrendChart);
    document.getElementById('startMonthSelect')?.addEventListener('change', renderTrendChart);
    document.getElementById('endMonthSelect')?.addEventListener('change', renderTrendChart);
}

// Add this new function to handle table cell input
function handleTableCellInput(e) {
    const target = e.target;
    if (!target.classList.contains('editable-cell')) return;

    const scs = target.dataset.scs;
    const field = target.dataset.field;
    const value = target.value;

    // Find the corresponding record in mileageData
    const record = mileageData.find(r => r['SCS No.'] === scs);
    if (!record) return;

    // Update the record
    if (field === 'Latest Mileage (km)' || field === 'Mileage Before L4/Wdiscing (km)' || field === 'Monthly Mileage Input (km)') {
        record[field] = parseNumber(value);
    } else if (field === 'Detained/Non-active Date' || field === 'Resume Date') {
        record[field] = value ? formatDateDisplayInput(value) : '-';
    } else {
        record[field] = value;
    }

    // Optionally: recalculate dashboard stats if Latest Mileage changed
    if (field === 'Latest Mileage (km)') updateDashboardStats();
}
// =========================================
// User Info
// =========================================
function loadUserInfo() {
    document.getElementById('loggedInName').textContent =
        localStorage.getItem('userFullName') || 'Guest';
    document.getElementById('loggedInPosition').textContent =
        localStorage.getItem('userActualPosition') || 'Maintenance Staff';
}

// =========================================
// Time Display
// =========================================
function updateDateTime() {
    document.getElementById('currentDateTime').textContent = formatDateTime(new Date());
}

function formatDateTime(date) {
    return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// =========================================
// Mileage Data
// =========================================
async function loadMileageData() {
    showLoadingOverlay('Loading Train Status...');
    try {
        const params = new URLSearchParams({ action: 'getMileageData' });
        const res = await fetch(`${WEB_APP_URL}?${params}`);
        const json = await res.json();
        if (json.status !== 'success') throw new Error(json.message);

        mileageData = json.data;
        updateDashboardStats();
        renderMileageTable();
        renderMileageChart();
    } catch (err) {
        showStatusMessage(`Error: ${err.message}`, 'error');
    } finally {
        hideLoadingOverlay();
    }
}

function updateDashboardStats() {
    if (!mileageData.length) return;

    const sorted = [...mileageData].sort((a, b) => 
        parseNumber(b['CurrentMileage (km)']) - parseNumber(a['CurrentMileage (km)'])
    );

    const high = sorted[0];
    const low = sorted[sorted.length - 1];
    const total = mileageData.reduce((sum, r) => sum + parseNumber(r['CurrentMileage (km)']), 0);
    const avg = Math.round(total / mileageData.length);

    document.getElementById('highestMileageValue').textContent = `${numberWithCommas(high['CurrentMileage (km)'])} km (${high['TrainSet']})`;
    document.getElementById('lowestMileageValue').textContent = `${numberWithCommas(low['CurrentMileage (km)'])} km (${low['TrainSet']})`;
    document.getElementById('avgMileageValue').textContent = `${numberWithCommas(avg)} km`;
    document.getElementById('totalMileageValue').textContent = `${numberWithCommas(total)} km`;
}

function setStats(high, low, avg, total) {
    document.getElementById('highestMileageValue').textContent = high;
    document.getElementById('lowestMileageValue').textContent  = low;
    document.getElementById('avgMileageValue').textContent     = avg;
    document.getElementById('totalMileageValue').textContent   = total;
}

// =========================================
// Table Rendering
// =========================================
function renderMileageTable() {
    const tbody = document.getElementById('mileageTableBody');
    if (!tbody) return;
    tbody.innerHTML = mileageData.map(r => `
        <tr>
<td>${r['TrainSet'] || '-'}</td>
            <td>${r['Taking-Over Date'] || '-'}</td>
            <td>${numberWithCommas(r['Taking-Over Mileage (km)'] || 0)}</td>
            <td>${r['Status'] || '-'}</td>
            <td>${r['Detained/Non-active Date'] || '-'}</td>
            <td>${r['Resume Date'] || '-'}</td>
            <td>${r['Remarks'] || '-'}</td>
            <td>${r['LastUpdated'] || '-'}</td>
            <td>${numberWithCommas(r['CurrentMileage (km)'] || 0)}</td>
            <td>${numberWithCommas(r['Mileage Before L4/Wdiscing (km)'] || 0)}</td>
            <td>${numberWithCommas(r['Post-L4 /Wdiscing Cycle Initial Mileage (km)'] || 0)}</td>
            <td>${numberWithCommas(r['Post-L4/Wdiscing Cumulative Mileage (km)'] || 0)}</td>
            <td>${r['Years of Operation'] || '-'}</td>
            <td>${r['Month of Operation'] || '-'}</td>
            <td>${numberWithCommas(r['Avg. Mileage/Month'] || 0)}</td>
            <td>${numberWithCommas(r['Avg. Mileage/Day'] || 0)}</td>
        </tr>`).join('');
}

// Helper to format dates for input[type=date] fields
function formatDateInput(val) {
    if (!val || val === '-' ) return '';
    const parts = val.split('/');
    if (parts.length === 3) {
        const [d,m,y] = parts;
        return `${y.padStart(4,'20')}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
    }
    return val;
}

// =========================================
// Make Editable & Track Changes
// =========================================
function makeTableEditable() {
    const tbody = document.getElementById('mileageTableBody');
    if (!tbody) return;
tbody.querySelectorAll('.editable-cell').forEach(input => {
        input.addEventListener('change', function() {
            const row = this.closest('tr');
            row.classList.add('row-edited');
        });
    });
}
// REMOVE THIS DUPLICATE CODE BLOCK:
//     // Columns editable by index
//     const editableCols = [3,4,5,6,7,8,14];
// 
//     tbody.querySelectorAll('tr').forEach((tr, rowIndex) => {
//         tr.querySelectorAll('td').forEach((td, colIndex) => {
//             if (editableCols.includes(colIndex)) {
//                 td.contentEditable = true;
//                 
//                 td.addEventListener('input', () => {
//                     const keyMap = [
//                         'SCS No.', 'Taking-Over Date', 'Taking-Over Mileage (km)', 'Status', 
//                         'Detained/Non-active Date', 'Resume Date', 'Remarks', 'Latest Mileage (km)', 
//                         'Mileage Before L4 (km)', 'Post-L4 Cumulative Mileage (km)', 'Years of Operation',
//                         'Month of Operation', 'Avg. Mileage/Month', 'Avg. Mileage/Day', 'Monthly Mileage Input (km)'
//                     ];
//                     const key = keyMap[colIndex];
//                     mileageData[rowIndex][key] = td.textContent.trim() || '';
//                 });
//             }
//         });
//     });
// }

// =========================================
// Save/Update to Google Sheet
// =========================================
async function saveEditedMileageData() {
    if (!mileageData.length) return;

    showLoadingOverlay('Saving changes to Google Sheet...');
    try {
        const res = await fetch(WEB_APP_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'updateMileageData', data: mileageData }),
            headers: { 'Content-Type': 'application/json' }
        });

        const json = await res.json();
        if (json.status === 'success') {
            showStatusMessage('Mileage data updated successfully!', 'success');
            loadMileageData(); // Refresh table & charts
        } else {
            throw new Error(json.message || 'Failed to update data');
        }
    } catch(err) {
        console.error(err);
        showStatusMessage(`Update failed: ${err.message}`, 'error');
    } finally {
        hideLoadingOverlay();
    }
}

// =========================================
// Bar Chart Rendering
// =========================================
function renderMileageChart() {
    const ctx = document.getElementById('mileageChart').getContext('2d');
    // Map to 'TrainSet' and 'CurrentMileage (km)'
    const labels = mileageData.map(r => r['TrainSet']);
    const data = mileageData.map(r => parseNumber(r['CurrentMileage (km)']));

    if (window.mileageChartInstance) window.mileageChartInstance.destroy();

    window.mileageChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Latest Mileage (km)',
                data: data,
                backgroundColor: 'rgba(54, 162, 235, 0.6)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.raw.toLocaleString() + ' km';
                        }
                    }
                }
            },
            scales: {
                x: { title: { display: true, text: 'Train Sets' } },
                y: { beginAtZero: true, title: { display: true, text: 'Mileage (km)' } }
            }
        }
    });
}

// --- NEW: Robust Period Parser for "MMM-YY" (e.g. Mar-12) ---
function parsePeriodToDate(str) {
    if (!str || typeof str !== 'string') return null;
    const parts = str.split('-');
    if (parts.length !== 2) return new Date(str);

    const months = {
        'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
        'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
    };
    
    const mName = parts[0].charAt(0).toUpperCase() + parts[0].slice(1).toLowerCase();
    const month = months[mName];
    let year = parseInt(parts[1]);
    if (year < 100) year += 2000; // Assume 20xx
    
    return new Date(year, month, 1);
}

function getSortableMonth(str) {
    const dt = parsePeriodToDate(str);
    if (!dt || isNaN(dt.getTime())) return "0000-00";
    return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0');
}

// =========================================
// Monthly Line Chart
// =========================================
function populateTrainDropdown() {
    const select = document.getElementById('trainSelect');
    
    // Add blank default option
    const blankOpt = document.createElement('option');
    blankOpt.value = '';
    blankOpt.textContent = '-- Select Train --';
    select.appendChild(blankOpt);

    TRAIN_SETS.forEach(train => {
        const opt = document.createElement('option');
        opt.value = train;
        opt.textContent = train;
        select.appendChild(opt);
    });
}

// Add this function to populate month dropdowns
function populateMonthDropdowns() {
    const startSelect = document.getElementById('startMonthSelect');
    const endSelect = document.getElementById('endMonthSelect');
    if (!startSelect || !monthlyData.length) return;

    const options = monthlyData.map(row => 
        `<option value="${row._sortKey}">${row.Period || row.Month}</option>`
    ).join('');

    startSelect.innerHTML = options;
    endSelect.innerHTML = options;
    
    startSelect.value = monthlyData[0]._sortKey;
    endSelect.value = monthlyData[monthlyData.length - 1]._sortKey;
}

// Helper function to format month for display
function formatMonthForDisplay(monthStr) {
    const [year, month] = monthStr.split('-');
    const date = new Date(year, month - 1);
    return date.toLocaleString('en-US', { month: 'short', year: 'numeric' });
}

async function loadMonthlyData() {
    try {
        const params = new URLSearchParams({ action: 'getMonthlyData' });
        const res = await fetch(`${WEB_APP_URL}?${params}`);
        const json = await res.json();

        if (json.status === 'success') {
            monthlyData = json.data.map(row => ({
                ...row,
                _sortKey: getSortableMonth(row.Period || row.Month)
            }));
            // Sort by date chronologically
            monthlyData.sort((a, b) => a._sortKey.localeCompare(b._sortKey));
            
            populateMonthDropdowns();
            renderTrendChart();
        }
    } catch (err) {
        console.error("Monthly data failed:", err);
    }
}

function renderTrendChart() {
    const train = document.getElementById('trainSelect').value;
    const start = document.getElementById('startMonthSelect').value;
    const end = document.getElementById('endMonthSelect').value;
    
    if (!train || !monthlyData.length) return;

    const filtered = monthlyData.filter(r => r._sortKey >= start && r._sortKey <= end);
    const labels = filtered.map(r => r.Period || r.Month);
    const data = filtered.map(r => parseNumber(r[train]));

    const ctx = document.getElementById('trendChart').getContext('2d');
    if (trendChartInstance) trendChartInstance.destroy();

    trendChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: `${train} Mileage (km)`,
                data: data,
                borderColor: '#2b6cb0',
                tension: 0.1,
                fill: false
            }]
        },
        options: { responsive: true, scales: { y: { beginAtZero: false } } }
    });
}

// =========================================
// Utility Functions
// =========================================
// --- Helpers ---
function parseNumber(v) { 
    if (!v) return 0;
    return parseFloat(String(v).replace(/,/g, '')) || 0; 
}
function numberWithCommas(x) { 
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ","); 
}
function showLoadingOverlay(msg) { document.getElementById('loadingOverlay').style.display = 'flex'; }
function hideLoadingOverlay() { document.getElementById('loadingOverlay').style.display = 'none'; }
function updateDateTime() { document.getElementById('currentDateTime').textContent = new Date().toLocaleString(); }
function loadUserInfo() { 
    document.getElementById('loggedInName').textContent = localStorage.getItem('userFullName') || 'Guest';
    document.getElementById('loggedInPosition').textContent = localStorage.getItem('userActualPosition') || 'Staff';
}
function populateTrainDropdown() {
    const s = document.getElementById('trainSelect');
    TRAIN_SETS.forEach(t => s.add(new Option(t, t)));
}

function formatDateDisplayInput(val) {
    if (!val || val === '-') return '-';
    
    // Handle multiple date formats
    if (val.includes('-')) {
        // YYYY-MM-DD format
        const parts = val.split('-');
        if (parts.length === 3) {
            return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
    } else if (val.includes('/')) {
        // Already in DD/MM/YYYY format
        return val;
    }
    
    return val;
}
function showLoadingOverlay(message = 'Loading...') {
    let overlay = document.getElementById('loadingOverlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'loadingOverlay';
        overlay.className = 'loading-overlay';
        overlay.innerHTML = `<div class="loading-spinner"></div><div class="loading-text">${message}</div>`;
        document.body.appendChild(overlay);
    } else {
        overlay.querySelector('.loading-text').textContent = message;
        overlay.style.display = 'flex';
    }
}

function hideLoadingOverlay() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.style.display = 'none';
}

function showStatusMessage(message, type) {
    const el = document.createElement('div');
    el.className = `status-message status-${type}`;
    Object.assign(el.style, {
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        zIndex: '1000',
        padding: '10px 20px',
        borderRadius: '4px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
    });
    el.textContent = message;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 5000);
}

function parseNumber(val) {
    if (!val) return 0;
    if (typeof val === "string") val = val.replace(/,/g, '').trim();
    const n = parseFloat(val);
    return isNaN(n) ? 0 : n;
}

function numberWithCommas(n) {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

document.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll('.collapsible .collapse-btn').forEach(button => {
    button.addEventListener('click', function(e) {
      e.preventDefault();
      const parent = this.parentElement;
      parent.classList.toggle('active');
    });
  });
});