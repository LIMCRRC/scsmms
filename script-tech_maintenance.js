// script-maintenance.js

// Replace with your deployed Google Apps Script Web App URL
const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbwVO4nV46goTQkD-tqD9ZoPgZTG3YGg_-wJ9-r4u9sM8TBiG5U7SN4PnZXgpF-ivwp--Q/exec';

// Global variables
let currentWorkOrder = null;
let maintenanceTrainsCache = [];

// Display current date and time
function updateDateTime() {
    const now = new Date();
    document.getElementById('currentDateTime').textContent = formatDateTime(now);
    document.getElementById('handOverDateTime').textContent = formatDateTime(now);
    document.getElementById('handBackDateTime').textContent = formatDateTime(now);
    document.getElementById('historyDateTime').textContent = formatDateTime(now);
}

// Format date for display
function formatDateTime(date) {
    return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Show specific view
function showView(viewId) {
    // Hide all views
    document.getElementById('dashboardView').style.display = 'none';
    document.getElementById('handOverView').style.display = 'none';
    document.getElementById('handBackView').style.display = 'none';
    document.getElementById('historyView').style.display = 'none';
    
    // Show selected view
    document.getElementById(`${viewId}View`).style.display = 'block';
    
    // Update active tab in sidebar
    document.querySelectorAll('.options-list a.option-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Set the appropriate button as active
    document.getElementById(`${viewId}Btn`).classList.add('active');
    
    // Load data for the selected view
    if (viewId === 'handBack') {
        populateMaintenanceTrains();
    } else if (viewId === 'history') {
        loadMaintenanceHistory();
    } else if (viewId === 'dashboard') {
        loadTrainStatusDashboard();
    }
}

// Submit hand-over form
async function submitHandOver() {
    const trainSet = document.getElementById('trainSet').value;
    const handOverSheet = document.getElementById('hand-overSheet').value;
    const maintenanceType = document.getElementById('maintenanceType').value;
    const mileage = document.getElementById('mileage').value;
    const location = document.getElementById('location').value;
    const remarks = document.getElementById('hand-overRemarks').value;
    const username = localStorage.getItem('maintenanceUser') || 'System';
    
    // Set loading state
    const submitBtn = document.getElementById('hand-overSubmitBtn');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<span class="loading"></span> Processing...';
    submitBtn.disabled = true;
    
    try {
        // Prepare data for Google Apps Script
        const formData = new FormData();
        formData.append('action', 'handOver');
        formData.append('trainSet', trainSet);
        formData.append('handOverSheet', handOverSheet);
        formData.append('maintenanceType', maintenanceType);
        formData.append('mileage', mileage);
        formData.append('location', location);
        formData.append('user', username);
        formData.append('updateMileage', 'true'); // Flag to trigger mileage update
        if (remarks) formData.append('remarks', remarks);
        
        // Send to Google Script
        const response = await fetch(WEB_APP_URL, {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (result.status === 'success') {
            // Display work order
            currentWorkOrder = result.data.workOrder;
            const workOrderDetails = `
                <<div><strong>Work Order #:</strong> ${result.data.workOrder}</div>
    <div><strong>Train Set:</strong> ${trainSet}</div>
    <div><strong>Maintenance Type:</strong> ${getMaintenanceTypeName(maintenanceType)}</div>
    <div><strong>Mileage:</strong> ${mileage} km</div>
    <div><strong>Location:</strong> ${location}</div>
    <div><strong>Start Time:</strong> ${formatDateTime(new Date(result.data.startTime))}</div>
    <div><strong>Status:</strong> In Progress</div>
    ${remarks ? `<div><strong>Remarks:</strong> ${remarks}</div>` : ''}
`;
            
            document.getElementById('workOrderDetails').innerHTML = workOrderDetails;
            document.getElementById('workOrderDisplay').style.display = 'block';
            
            // Show success message
            showStatusMessage('hand-overStatus', 
                `Hand-Over recorded successfully. Work Order ${result.data.workOrder} generated.`, 
                'success');
            
            // Reset form (but keep the work order displayed)
            document.getElementById('hand-overForm').reset();
            
            // Update the maintenance trains cache
            maintenanceTrainsCache.push({
                TrainSet: trainSet,
                WorkOrder: result.data.workOrder,
                Status: 'Maintenance'
            });
            
            // Refresh dashboard
            loadTrainStatusDashboard();
            
        } else {
            throw new Error(result.message || 'Failed to record hand-over');
        }
    } catch (error) {
        console.error('Error submitting hand-over:', error);
        showStatusMessage('hand-overStatus', 
            error.message || 'Failed to submit hand-over. Please try again.', 
            'error');
    } finally {
        // Reset button state
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

// Submit hand-back form
async function submitHandBack() {
    const trainSet = document.getElementById('maintenanceTrainSet').value;
    const handBackSheet = document.getElementById('handBackSheet').value;
    const remarks = document.getElementById('hand-backRemarks').value;
    const username = localStorage.getItem('maintenanceUser') || 'System'; // Get username from localStorage
    
    // Set loading state
    const submitBtn = document.getElementById('hand-backSubmitBtn');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<span class="loading"></span> Processing...';
    submitBtn.disabled = true;
    
    try {
        // Prepare data for Google Apps Script
        const formData = new FormData();
        formData.append('action', 'handBack');
        formData.append('trainSet', trainSet);
        formData.append('handBackSheet', handBackSheet);
        formData.append('user', username); // Add username to form data
        if (remarks) formData.append('remarks', remarks);
        
        // Send to Google Script
        const response = await fetch(WEB_APP_URL, {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (result.status === 'success') {
            // Show success message
            showStatusMessage('hand-backStatus', 
                `Maintenance completed for ${trainSet}. Hand-Back recorded at ${formatDateTime(new Date(result.data.endTime))}.`, 
                'success');
            
            // Reset form
            resetForm('hand-backForm');
            
            // Update the maintenance trains cache
            maintenanceTrainsCache = maintenanceTrainsCache.filter(train => train.TrainSet !== trainSet);
            
            // Refresh the dropdown and dashboard
            populateMaintenanceTrains();
            loadTrainStatusDashboard();
            
        } else {
            throw new Error(result.message || 'Failed to record hand-back');
        }
    } catch (error) {
        console.error('Error submitting hand-back:', error);
        showStatusMessage('hand-backStatus', 
            error.message || 'Failed to submit hand-back. Please try again.', 
            'error');
    } finally {
        // Reset button state
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

// Populate maintenance trains dropdown with trains currently in maintenance
async function populateMaintenanceTrains() {
    const select = document.getElementById('maintenanceTrainSet');
    select.innerHTML = '<option value="">-- Select a train set --</option>';
    
    try {
        // First check if we have cached data
        if (maintenanceTrainsCache.length > 0) {
            maintenanceTrainsCache.forEach(train => {
                const option = document.createElement('option');
                option.value = train.TrainSet;
                option.textContent = `${train.TrainSet} (WO: ${train.WorkOrder})`;
                select.appendChild(option);
            });
            return;
        }
        
        // If no cache, fetch from server
        const response = await fetch(`${WEB_APP_URL}?action=getTrains`);
        const result = await response.json();
        
        if (result.status === 'success') {
            const maintenanceTrains = result.data.filter(train => 
                train.Status === 'Maintenance');
            
            // Update cache
            maintenanceTrainsCache = maintenanceTrains;
            
            if (maintenanceTrains.length === 0) {
                const option = document.createElement('option');
                option.value = '';
                option.textContent = 'No trains currently in maintenance';
                option.disabled = true;
                select.appendChild(option);
                return;
            }
            
            maintenanceTrains.forEach(train => {
                const option = document.createElement('option');
                option.value = train.TrainSet;
                option.textContent = `${train.TrainSet}${train.WorkOrder ? ' (WO: ' + train.WorkOrder + ')' : ''}`;
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error fetching maintenance trains:', error);
        // If there's an error, show a message in the dropdown
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'Error loading maintenance trains';
        option.disabled = true;
        select.appendChild(option);
    }
}

// Fetch and display train status dashboard
async function loadTrainStatusDashboard() {
    showLoadingOverlay('Loading dashboard data...');
    
    try {
        // Fetch both status and plan in parallel
        const [statusRes, planRes] = await Promise.all([
            fetch(`${WEB_APP_URL}?action=getTrainStatus`),
            fetch(`${WEB_APP_URL}?action=getMaintenancePlan`)
        ]);

        const statusResult = await statusRes.json();
        const planResult = await planRes.json();
        
        if (statusResult.status === 'success' && planResult.status === 'success') {
            updateDashboardStats(statusResult.data);
            populateTrainCards(statusResult.data);
            updatePlanCards(planResult.data); // New function call
            populateHistoryTrainFilter(statusResult.data);
        }
    } catch (error) {
        console.error('Error loading dashboard:', error);
    } finally {
        hideLoadingOverlay();
    }
}

// New function to update the specific Daily, Weekly, Monthly cards
function updatePlanCards(resultData) {
    // Note the change from 'planData' to 'resultData.summary'
    const planData = resultData.summary; 
    
    document.getElementById('dailyToday').textContent = planData.daily.length;
    document.getElementById('dailyTrains').textContent = planData.daily.length > 0 ? planData.daily.join(', ') : 'None';
    
    document.getElementById('weeklyToday').textContent = planData.weekly.length;
    document.getElementById('weeklyTrains').textContent = planData.weekly.length > 0 ? planData.weekly.join(', ') : 'None';
    
    document.getElementById('monthlyToday').textContent = planData.monthly.length;
    document.getElementById('monthlyTrains').textContent = planData.monthly.length > 0 ? planData.monthly.join(', ') : 'None';
}

function updateDashboardStats(data) {
    const totalTrains = data.length;
    const inService = data.filter(train => train.Status === 'In Service').length;
    const inMaintenance = data.filter(train => train.Status === 'Maintenance').length;
    const detained = data.filter(train => train.Status === 'Detained').length;
    const nonActive = data.filter(train => train.Status === 'Non-Active').length;
    
    document.getElementById('totalTrains').textContent = totalTrains;
    document.getElementById('inService').textContent = inService;
    document.getElementById('inMaintenance').textContent = inMaintenance;
    document.getElementById('detained').textContent = detained;
    document.getElementById('nonActive').textContent = nonActive;
}

function populateTrainCards(data) {
    const grid = document.getElementById('trainCardsGrid');
    grid.innerHTML = '';
    
    data.forEach(train => {
        const card = document.createElement('div');
        card.className = 'train-card';
        card.dataset.status = train.Status;
        
        let statusClass = '';
        if (train.Status === 'In Service') {
            statusClass = 'status-service';
        } else if (train.Status === 'Maintenance') {
            statusClass = 'status-maintenance';
        } else if (train.Status === 'Detained') {
            statusClass = 'status-detained';
        } else if (train.Status === 'Non-Active') {
            statusClass = 'status-nonactive';
        }
        
        card.innerHTML = `
            <div class="train-id">${train.TrainSet}</div>
            <div class="train-status ${statusClass}">${train.Status}</div>
            <div class="train-mileage">${train.Mileage || 'N/A'} km
            </div>
        `;
        
        // Add click handler to quickly access hand-over/hand-back
        card.addEventListener('click', () => {
            if (train.Status === 'In Service' || train.Status === 'Detained' || train.Status === 'Non-Active') {
                // If train is not in maintenance, suggest hand-over
                showConfirmationDialog(
                    `Would you like to initiate hand-over for ${train.TrainSet}?`,
                    () => {
                        showView('handOver');
                        document.getElementById('trainSet').value = train.TrainSet;
                    }
                );
            } else if (train.Status === 'Maintenance') {
                // If train is in maintenance, suggest hand-back
                showConfirmationDialog(
                    `Would you like to initiate hand-back for ${train.TrainSet}?`,
                    () => {
                        showView('handBack');
                        document.getElementById('maintenanceTrainSet').value = train.TrainSet;
                    }
                );
            }
        });
        
        grid.appendChild(card);
    });
    
    // Initialize status filter buttons
    document.querySelectorAll('.status-filter-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.status-filter-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            const status = this.dataset.status;
            filterTrainCards(status);
        });
    });
}

function filterTrainCards(status) {
    const cards = document.querySelectorAll('.train-card');
    
    cards.forEach(card => {
        if (status === 'all' || card.dataset.status === status) {
            card.style.display = 'flex';
        } else {
            card.style.display = 'none';
        }
    });
}

// Populate history train filter dropdown
function populateHistoryTrainFilter(trainData) {
    const select = document.getElementById('historyFilterTrain');
    select.innerHTML = '<option value="">All Trains</option>';
    
    // Get unique train sets
    const uniqueTrains = [...new Set(trainData.map(train => train.TrainSet))];
    
    uniqueTrains.forEach(train => {
        const option = document.createElement('option');
        option.value = train;
        option.textContent = train;
        select.appendChild(option);
    });
}

function renderHistory(history) {
  const tbody = document.getElementById('historyTableBody');
  tbody.innerHTML = '';

  if (!history.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align:center;">No maintenance records found</td>
      </tr>
    `;
    return;
  }

  history.forEach(item => {
    const displayDate = item.handBackDate || item.handOverDate;
    const statusClass =
      item.status === 'Completed'
        ? 'status-completed'
        : 'status-in-progress';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${displayDate ? formatDateTime(new Date(displayDate)) : '-'}</td>
      <td><strong>${item.trainSet}</strong></td>
      <td>${getMaintenanceTypeName(item.maintenanceType)}</td>
      <td>
        HO: ${item.handOverSheet || '-'}<br>
        HB: ${item.handBackSheet || '-'}
      </td>
      <td><code>${item.workOrder}</code></td>
      <td><span class="badge ${statusClass}">${item.status}</span></td>
      <td>${item.user}</td>
    `;
    tbody.appendChild(tr);
  });
}

// Load maintenance history
async function loadMaintenanceHistory() {
  const trainSet = document.getElementById('historyFilterTrain').value;
  const type = document.getElementById('historyFilterType').value;

  showLoadingOverlay('Loading maintenance history...');

  try {
    let url = `${WEB_APP_URL}?action=getMaintenanceHistory`;
    if (trainSet) url += `&trainSet=${trainSet}`;
    if (type) url += `&maintenanceType=${type}`;

    const res = await fetch(url);
    const result = await res.json();

    if (result.status !== 'success') {
      throw new Error('Failed to load history');
    }

    renderHistory(result.data);
  } catch (err) {
    console.error(err);
    showStatusMessage('historyStatus', err.message, 'error');
  } finally {
    hideLoadingOverlay();
  }
}

function populateHistoryTable(data) {
    const tbody = document.getElementById('historyTableBody');
    tbody.innerHTML = '';
    
    if (data.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = `<td colspan="6" style="text-align: center;">No completed maintenance records found</td>`;
        tbody.appendChild(row);
        return;
    }
    
    data.forEach(record => {
        const row = document.createElement('tr');
        
        row.innerHTML = `
            <td>${formatDateTime(new Date(record.Timestamp))}</td>
            <td>${record.TrainSet}</td>
            <td>${record.MaintenanceType ? getMaintenanceTypeName(record.MaintenanceType) : 'Maintenance'}</td>
            <td>${record.SheetNumber || '-'}</td>
            <td>${record.WorkOrder || '-'}</td>
            <td>${record.User || 'System'}</td>
        `;
        
        tbody.appendChild(row);
    });
}

// Loading overlay functions
function showLoadingOverlay(message) {
    let overlay = document.getElementById('loadingOverlay');
    
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'loadingOverlay';
        overlay.className = 'loading-overlay';
        overlay.innerHTML = `
            <div class="loading-spinner"></div>
            <div class="loading-text">${message || 'Loading...'}</div>
        `;
        document.body.appendChild(overlay);
    } else {
        overlay.querySelector('.loading-text').textContent = message || 'Loading...';
        overlay.style.display = 'flex';
    }
}

function hideLoadingOverlay() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}

// Confirmation dialog
function showConfirmationDialog(message, callback) {
    const dialog = document.createElement('div');
    dialog.className = 'confirmation-dialog';
    dialog.innerHTML = `
        <div class="dialog-content">
            <div class="dialog-message">${message}</div>
            <div class="dialog-buttons">
                <button class="btn btn-secondary" id="dialogCancel">Cancel</button>
                <button class="btn btn-primary" id="dialogConfirm">Confirm</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(dialog);
    
    document.getElementById('dialogCancel').addEventListener('click', () => {
        document.body.removeChild(dialog);
    });
    
    document.getElementById('dialogConfirm').addEventListener('click', () => {
        document.body.removeChild(dialog);
        callback();
    });
}

// Get full maintenance type name
function getMaintenanceTypeName(typeCode) {
    if (typeCode === 'DA') return 'Daily (DA)';
    if (typeCode === 'DB') return 'Weekly (DB)';
    if (typeCode === 'DC') return 'Weekly (DC)';
    if (typeCode.startsWith('M')) return `Monthly (${typeCode})`;
    return typeCode;
}

// Show status message
function showStatusMessage(elementId, message, type) {
    const element = document.getElementById(elementId);
    element.textContent = message;
    element.className = 'status-message';
    if (type) {
        element.classList.add(`status-${type}`);
    }
    
    // Auto-hide after 5 seconds
    if (type === 'success') {
        setTimeout(() => {
            element.style.display = 'none';
        }, 5000);
    } else {
        element.style.display = 'block';
    }
}

// Reset form
function resetForm(formId) {
    document.getElementById(formId).reset();
    const statusElement = formId === 'hand-overForm' ? 'hand-overStatus' : 'hand-backStatus';
    document.getElementById(statusElement).style.display = 'none';
    
    if (formId === 'hand-overForm') {
        document.getElementById('workOrderDisplay').style.display = 'none';
        // Optionally reset specific fields if needed
        // document.getElementById('mileage').value = '';
        // document.getElementById('location').value = '';
    }
}

// Get URL parameter
function getUrlParameter(name) {
    name = name.replace(/[\[\]]/g, '\\$&');
    const regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)');
    const results = regex.exec(window.location.href);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, ' '));
}

// Initialize the page
document.addEventListener('DOMContentLoaded', function() {
    updateDateTime();
    populateMaintenanceTrains();
    loadTrainStatusDashboard();
    
    // Initialize history filters
    document.getElementById('historyFilterTrain').addEventListener('change', loadMaintenanceHistory);
    document.getElementById('historyFilterType').addEventListener('change', loadMaintenanceHistory);
    
    // Update time every minute
    setInterval(updateDateTime, 60000);
    
    const user = localStorage.getItem('currentUser');
    const role = localStorage.getItem('userRole');

    if (!user) {
        // Redirect if no user is found
        window.location.href = 'login.html';
    } else {
        const nameElement = document.getElementById('loggedInName');
        const positionElement = document.getElementById('loggedInPosition');

        if (nameElement) nameElement.textContent = user;
        if (positionElement) positionElement.textContent = role;
        
        // Also update maintenanceUser to keep your form submissions working
        localStorage.setItem('maintenanceUser', user);
    }

document.querySelector('a[href="login.html"]').addEventListener('click', () => {
    localStorage.clear(); // Clears user and role info
});
    
    // Add refresh button event listener
    document.getElementById('refreshBtn').addEventListener('click', function(e) {
        e.preventDefault();
        showConfirmationDialog('Refresh all data from server?', () => {
            populateMaintenanceTrains();
            loadTrainStatusDashboard();
            if (document.getElementById('historyView').style.display !== 'none') {
                loadMaintenanceHistory();
            }
        });
    });
    
    // Navigation event listeners
    document.getElementById('dashboardBtn').addEventListener('click', function(e) {
        e.preventDefault();
        showView('dashboard');
    });
    
    document.getElementById('handOverBtn').addEventListener('click', function(e) {
        e.preventDefault();
        showView('handOver');
    });
    
    document.getElementById('handBackBtn').addEventListener('click', function(e) {
        e.preventDefault();
        showView('handBack');
    });
    
    document.getElementById('historyBtn').addEventListener('click', function(e) {
        e.preventDefault();
        showView('history');
    });
 
    // Back button event listeners
    document.getElementById('backFromHandOver').addEventListener('click', function(e) {
        e.preventDefault();
        showView('dashboard');
    });
    
    document.getElementById('backFromHandBack').addEventListener('click', function(e) {
        e.preventDefault();
        showView('dashboard');
    });
    
    document.getElementById('backFromHistory').addEventListener('click', function(e) {
        e.preventDefault();
        showView('dashboard');
    });
    
    // Quick action cards
    document.getElementById('quickHandOver').addEventListener('click', function() {
        showView('handOver');
    });
    
    document.getElementById('quickHandBack').addEventListener('click', function() {
        showView('handBack');
    });
    
    document.getElementById('quickHistory').addEventListener('click', function() {
        showView('history');
    });
    
    // Update hand-over submit to use confirmation
    document.getElementById('hand-overSubmitBtn').addEventListener('click', function() {
const trainSet = document.getElementById('trainSet').value;
    const handOverSheet = document.getElementById('hand-overSheet').value;
    const maintenanceType = document.getElementById('maintenanceType').value;
    const mileage = document.getElementById('mileage').value;  // Get the value
    const location = document.getElementById('location').value;  // Get the value
    
    if (!trainSet || !handOverSheet || !maintenanceType || !mileage || !location) {
        showStatusMessage('hand-overStatus', 'Please fill all required fields', 'error');
        return;
    }
    
showConfirmationDialog(
    `<strong>Confirm hand-over details:</strong><br><br>
    <table style="width:100%">
        <tr><td>Train Set:</td><td>${trainSet}</td></tr>
        <tr><td>Maintenance Type:</td><td>${maintenanceType}</td></tr>
        <tr><td>Mileage:</td><td>${mileage} km</td></tr>
        <tr><td>Location:</td><td>${location}</td></tr>
    </table>`,
    submitHandOver
);
});
    
    // Update hand-back submit to use confirmation
    document.getElementById('hand-backSubmitBtn').addEventListener('click', function() {
        const trainSet = document.getElementById('maintenanceTrainSet').value;
        const handBackSheet = document.getElementById('handBackSheet').value;
        
        if (!trainSet || !handBackSheet) {
            showStatusMessage('hand-backStatus', 'Please fill all required fields', 'error');
            return;
        }
        
        showConfirmationDialog(
            `Confirm hand-back for train ${trainSet}?`,
            submitHandBack
        );
    });
});