const API_BASE_URL = 'https://localhost:7255/api';

// Кэш для названий комнат
let roomsCache = {};

// Загрузка списка комнат для кэширования названий
async function loadRoomsCache() {
    try {
        const response = await fetch(`${API_BASE_URL}/Room/list`);
        const data = await response.json();
        
        if (data.success && data.rooms) {
            roomsCache = {};
            data.rooms.forEach(room => {
                roomsCache[room.id] = room.title;
            });
            console.log('Rooms cache loaded:', roomsCache);
        }
    } catch (error) {
        console.error('Error loading rooms cache:', error);
    }
}

// Получение названия комнаты по ID
function getRoomName(roomId) {
    return roomsCache[roomId] || `Комната #${roomId}`;
}

document.addEventListener('DOMContentLoaded', async function () {
    const token = localStorage.getItem('authToken');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    // Загружаем кэш комнат перед загрузкой бронирований
    await loadRoomsCache();
    await loadUserBookings();
    
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    function showTab(tabId) {
        tabContents.forEach(tab => tab.classList.remove('active'));
        tabButtons.forEach(btn => btn.classList.remove('active'));

        const tabEl = document.getElementById(`${tabId}-tab`);
        if (tabEl) tabEl.classList.add('active');

        const btnEl = document.querySelector(`[data-tab="${tabId}"]`);
        if (btnEl) btnEl.classList.add('active');
    }

    tabButtons.forEach(button => {
        button.addEventListener('click', function () {
            showTab(this.getAttribute('data-tab'));
        });
    });

    showTab('active');
    
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = 'Поиск бронирований...';
    searchInput.style.cssText = `
        padding: 0.8rem 1rem;
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 8px;
        background: rgba(255,255,255,0.1);
        color: white;
        width: 100%;
        max-width: 400px;
        margin-bottom: 2rem;
    `;
    const pageTitle = document.querySelector('.page-title');
    if (pageTitle) pageTitle.insertAdjacentElement('afterend', searchInput);

    searchInput.addEventListener('input', function (e) {
        const term = e.target.value.toLowerCase();
        document.querySelectorAll('.booking-card').forEach(card => {
            const title = card.querySelector('h3')?.textContent.toLowerCase() || '';
            const status = card.querySelector('.booking-status')?.textContent.toLowerCase() || '';
            card.style.display = (title.includes(term) || status.includes(term)) ? 'block' : 'none';
        });
    });
});

async function loadUserBookings() {
    const token = localStorage.getItem('authToken');
    const userId = localStorage.getItem('userId');

    try {
        // Пробуем получить бронирования через эндпоинт пользователя
        let response = await fetch(`${API_BASE_URL}/User/bookings`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        let data = await response.json();

        // Если нет эндпоинта /User/bookings, пробуем через Booking контроллер
        if (!data.success && userId) {
            response = await fetch(`${API_BASE_URL}/Booking/user/${userId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            data = await response.json();
        }

        if (data.success && data.bookings) {
            displayBookings(data.bookings);
            updateStatistics(data.bookings);
        } else {
            console.error('Failed to load bookings:', data);
            showNotification('Нет бронирований или ошибка загрузки', 'info');
            displayEmptyState();
        }
    } catch (error) {
        console.error('Error loading bookings:', error);
        showNotification('Ошибка загрузки бронирований', 'error');
        displayEmptyState();
    }
}

function displayEmptyState() {
    const tabs = {
        active: document.getElementById('active-tab'),
        upcoming: document.getElementById('upcoming-tab'),
        completed: document.getElementById('completed-tab'),
        cancelled: document.getElementById('cancelled-tab')
    };

    Object.values(tabs).forEach(tab => {
        if (tab && !tab.querySelector('.booking-card')) {
            tab.innerHTML = `
                <div class="empty-state" style="text-align:center; padding: 3rem; color: rgba(255,255,255,0.5);">
                    <i class="fa-solid fa-calendar-xmark" style="font-size:2rem; margin-bottom:1rem; display:block;"></i>
                    <p>Нет бронирований в этой категории</p>
                    <a href="../index.html" class="btn btn-primary" style="margin-top: 1rem; display: inline-block;">
                        <i class="fa-solid fa-plus"></i> Найти комнату
                    </a>
                </div>
            `;
        }
    });
}

function displayBookings(bookings) {
    const tabs = {
        active: document.getElementById('active-tab'),
        upcoming: document.getElementById('upcoming-tab'),
        completed: document.getElementById('completed-tab'),
        cancelled: document.getElementById('cancelled-tab')
    };

    // Очищаем все вкладки
    Object.values(tabs).forEach(tab => { 
        if (tab) tab.innerHTML = ''; 
    });

    if (!bookings || bookings.length === 0) {
        displayEmptyState();
        return;
    }

    bookings.forEach(booking => {
        const status = booking.status;
        const bookingCard = createBookingCard(booking, status);

        if (tabs[status]) {
            tabs[status].appendChild(bookingCard);
        }
    });

    // Проверка пустых вкладок
    Object.entries(tabs).forEach(([status, tab]) => {
        if (!tab) return;
        if (!tab.querySelector('.booking-card')) {
            tab.innerHTML = `
                <div class="empty-state" style="text-align:center; padding: 3rem; color: rgba(255,255,255,0.5);">
                    <i class="fa-solid fa-calendar-xmark" style="font-size:2rem; margin-bottom:1rem; display:block;"></i>
                    <p>Нет бронирований в этой категории</p>
                </div>
            `;
        }
    });
}

function createBookingCard(booking, status) {
    const card = document.createElement('div');
    card.className = `booking-card ${status}`;

    const startTime = new Date(booking.start_time);
    const endTime = new Date(booking.end_time);
    const duration = Math.round((endTime - startTime) / (1000 * 60 * 60));
    
    // Получаем название комнаты из кэша
    const roomName = getRoomName(booking.room_id);
    
    // Проверяем, активна ли комната сейчас (для активных бронирований)
    const now = new Date();
    const isCurrentlyActive = status === 'active' && startTime <= now && endTime > now;
    const isUpcoming = status === 'upcoming' && startTime > now;

    const statusLabels = {
        active: isCurrentlyActive ? 'Активно' : 'Предстоит',
        upcoming: 'Предстоящее',
        completed: 'Завершено',
        cancelled: 'Отменено'
    };

    const statusClasses = {
        active: isCurrentlyActive ? 'status-active' : 'status-upcoming',
        upcoming: 'status-upcoming',
        completed: 'status-completed',
        cancelled: 'status-cancelled'
    };

    let timeRemainingHtml = '';
    if (status === 'active' && isCurrentlyActive) {
        const remainMs = endTime - now;
        if (remainMs > 0) {
            const remainMin = Math.floor(remainMs / 60000);
            const hours = Math.floor(remainMin / 60);
            const mins = remainMin % 60;
            const timeStr = hours > 0 ? `${hours}ч ${mins}м` : `${mins}м`;
            timeRemainingHtml = `
                <div class="info-item" style="color: #10b981;">
                    <i class="fa-solid fa-hourglass-half"></i>
                    <span>Осталось: ${timeStr}</span>
                </div>
            `;
        }
    }

    // Отображаем дату в читаемом формате
    const startDateStr = startTime.toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
    
    const startTimeStr = startTime.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    const endTimeStr = endTime.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

    card.innerHTML = `
        <div class="booking-header">
            <h3><i class="fa-solid fa-cube"></i> ${escapeHtml(roomName)}</h3>
            <span class="booking-status ${statusClasses[status]}">${statusLabels[status]}</span>
        </div>
        <div class="booking-details">
            <div class="booking-info">
                <div class="info-item">
                    <i class="fa-solid fa-calendar"></i>
                    <span>${startDateStr}</span>
                </div>
                <div class="info-item">
                    <i class="fa-solid fa-clock"></i>
                    <span>${startTimeStr} — ${endTimeStr} (${duration} ч.)</span>
                </div>
                <div class="info-item">
                    <i class="fa-solid fa-wallet"></i>
                    <span>${booking.total_price} ₽</span>
                </div>
                <div class="info-item">
                    <i class="fa-solid fa-hashtag"></i>
                    <span>Бронь #${booking.id}</span>
                </div>
                ${timeRemainingHtml}
            </div>
            <div class="booking-actions">
                ${getBookingActions(booking, status, isCurrentlyActive)}
            </div>
        </div>
    `;

    return card;
}

function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getBookingActions(booking, status, isCurrentlyActive = false) {
    switch (status) {
        case 'active':
            if (isCurrentlyActive) {
                return `
                    <a href="room.html?id=${booking.room_id}&bookingId=${booking.id}" class="btn btn-primary">
                        <i class="fa-solid fa-play"></i> Подключиться
                    </a>
                    <button class="btn btn-outline" onclick="cancelBooking(${booking.id})">
                        <i class="fa-solid fa-times"></i> Отменить
                    </button>
                `;
            } else {
                // Бронирование еще не началось, но статус active (по факту upcoming)
                return `
                    <button class="btn btn-outline" onclick="cancelBooking(${booking.id})">
                        <i class="fa-solid fa-times"></i> Отменить
                    </button>
                `;
            }
        case 'upcoming':
            return `
                <button class="btn btn-outline" onclick="cancelBooking(${booking.id})">
                    <i class="fa-solid fa-times"></i> Отменить
                </button>
                <button class="btn btn-primary" onclick="editBooking(${booking.id}, ${booking.room_id})">
                    <i class="fa-solid fa-edit"></i> Изменить
                </button>
            `;
        case 'completed':
        case 'cancelled':
            return `
                <button class="btn btn-primary" onclick="bookAgain(${booking.room_id})">
                    <i class="fa-solid fa-repeat"></i> Забронировать снова
                </button>
                <button class="btn btn-outline" onclick="viewBookingDetails(${booking.id})">
                    <i class="fa-solid fa-info-circle"></i> Детали
                </button>
            `;
        default:
            return '';
    }
}

function updateStatistics(bookings) {
    const stats = { active: 0, upcoming: 0, completed: 0, cancelled: 0 };
    
    const now = new Date();

    bookings.forEach(b => {
        const startTime = new Date(b.start_time);
        const endTime = new Date(b.end_time);
        
        // Пересчитываем статус на основе времени
        if (b.status === 'cancelled') {
            stats.cancelled++;
        } else if (endTime < now) {
            stats.completed++;
        } else if (startTime <= now && endTime > now) {
            stats.active++;
        } else if (startTime > now) {
            stats.upcoming++;
        } else {
            // Fallback
            if (stats[b.status] !== undefined) stats[b.status]++;
        }
    });

    const statCards = document.querySelectorAll('.stat-card');
    if (statCards.length >= 4) {
        statCards[0].querySelector('h3').textContent = stats.active;
        statCards[1].querySelector('h3').textContent = stats.upcoming;
        statCards[2].querySelector('h3').textContent = stats.completed;
        statCards[3].querySelector('h3').textContent = stats.cancelled;
    }
}

// Действия с бронированием
async function cancelBooking(bookingId) {
    if (!confirm('Вы уверены, что хотите отменить бронирование?')) return;

    const token = localStorage.getItem('authToken');

    try {
        const response = await fetch(`${API_BASE_URL}/Room/bookings/${bookingId}/cancel`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await response.json();

        if (data.success) {
            showNotification('✅ Бронирование отменено', 'success');
            setTimeout(() => window.location.reload(), 1000);
        } else {
            showNotification(data.message || 'Ошибка при отмене', 'error');
        }
    } catch (error) {
        console.error('Cancel error:', error);
        showNotification('Ошибка при отмене бронирования', 'error');
    }
}

function editBooking(bookingId, roomId) {
    // Перенаправляем на страницу с формой изменения бронирования
    window.location.href = `edit-booking.html?id=${bookingId}&room=${roomId}`;
}

function viewBookingDetails(bookingId) {
    showNotification('Информация о бронировании #' + bookingId, 'info');
    // Можно открыть модальное окно с деталями
}

function bookAgain(roomId) {
    window.location.href = `../index.html?room=${roomId}`;
}

function logout() {
    if (confirm('Вы уверены, что хотите выйти?')) {
        localStorage.removeItem('authToken');
        localStorage.removeItem('userId');
        localStorage.removeItem('userEmail');
        showNotification('Выход из системы...', 'info');
        setTimeout(() => { window.location.href = '../index.html'; }, 1000);
    }
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.innerHTML = `
        <i class="fa-solid ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
        <span>${message}</span>
    `;
    notification.style.cssText = `
        position: fixed; top: 20px; right: 20px;
        padding: 1rem 1.5rem;
        background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
        color: white; border-radius: 8px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        z-index: 1000; display: flex; align-items: center; gap: 0.5rem;
        animation: slideIn 0.3s ease;
        cursor: pointer;
    `;
    document.body.appendChild(notification);
    
    notification.onclick = () => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    };
    
    setTimeout(() => {
        if (notification.parentElement) {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }
    }, 3000);
}

const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
    @keyframes slideOut { from { transform: translateX(0); opacity: 1; } to { transform: translateX(100%); opacity: 0; } }
    
    .booking-card {
        background: rgba(255, 255, 255, 0.05);
        border-radius: 12px;
        padding: 1.5rem;
        margin-bottom: 1rem;
        transition: transform 0.2s, box-shadow 0.2s;
    }
    
    .booking-card:hover {
        transform: translateY(-2px);
        background: rgba(255, 255, 255, 0.08);
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
    }
    
    .booking-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1rem;
        flex-wrap: wrap;
        gap: 0.5rem;
    }
    
    .booking-header h3 {
        font-size: 1.25rem;
        margin: 0;
        color: white;
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }
    
    .booking-status {
        display: inline-block;
        padding: 4px 12px;
        border-radius: 20px;
        font-size: 12px;
        font-weight: 500;
    }
    
    .status-active { background: #10b981; color: white; }
    .status-upcoming { background: #3b82f6; color: white; }
    .status-completed { background: #6b7280; color: white; }
    .status-cancelled { background: #ef4444; color: white; }
    
    .booking-details {
        display: flex;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 1rem;
    }
    
    .booking-info {
        display: flex;
        flex-wrap: wrap;
        gap: 1.5rem;
    }
    
    .info-item {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        color: rgba(255, 255, 255, 0.7);
        font-size: 0.9rem;
    }
    
    .info-item i {
        width: 20px;
        color: #818cf8;
    }
    
    .booking-actions {
        display: flex;
        gap: 0.75rem;
        align-items: center;
        flex-wrap: wrap;
    }
    
    .btn-outline {
        background: transparent;
        border: 1px solid rgba(255, 255, 255, 0.2);
    }
    
    .btn-outline:hover {
        background: rgba(255, 255, 255, 0.1);
        border-color: rgba(255, 255, 255, 0.3);
    }
`;
document.head.appendChild(style);