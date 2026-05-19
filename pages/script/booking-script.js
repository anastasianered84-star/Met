const API_BASE_URL = 'https://metabook-production.up.railway.app/api';
const API_HOST = 'https://metabook-production.up.railway.app';

// ========== ГЛАВНОЕ ИСПРАВЛЕНИЕ ==========
// Функция парсит дату из БД как ЛОКАЛЬНОЕ время (игнорирует UTC/Z)
function parseLocalTimeFromDB(dateString) {
    if (!dateString) return new Date();
    // Бэкенд теперь отдаёт UTC с Z — браузер сам конвертирует в локальное время
    return new Date(dateString);

    // Убираем Z, если он есть
    let cleaned = dateString.replace('Z', '');

    // Формат: "2026-05-03T19:00:00"
    const [datePart, timePart] = cleaned.split('T');
    const [year, month, day] = datePart.split('-');
    const [hour, minute] = timePart.split(':');

    // Создаём дату в ЛОКАЛЬНОМ часовом поясе (без преобразований UTC)
    return new Date(
        parseInt(year),
        parseInt(month) - 1,
        parseInt(day),
        parseInt(hour),
        parseInt(minute)
    );
}
// =======================================

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
        let response = await fetch(`${API_BASE_URL}/User/bookings`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        let data = await response.json();

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

    // ========== ИСПРАВЛЕНИЕ: парсим как ЛОКАЛЬНОЕ время ==========
    const startTime = parseLocalTimeFromDB(booking.start_time);
    const endTime = parseLocalTimeFromDB(booking.end_time);
    // ============================================================

    const duration = Math.round((endTime - startTime) / (1000 * 60 * 60));

    const roomName = getRoomName(booking.room_id);

    const now = new Date();
    const isCurrentlyActive = status === 'active' && startTime <= now && endTime > now;

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
    

    const startDateStr = startTime.toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });

    const startTimeStr = startTime.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    const endTimeStr = endTime.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

    // Отладка (после исправления время будет правильным)
    console.log(`=== Бронирование #${booking.id} ===`);
    console.log('Raw start_time:', booking.start_time);
    console.log('Parsed startTime:', startTime.toString());
    console.log('Display time:', startTimeStr);

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
    // Получаем текущего пользователя
    const currentUserId = parseInt(localStorage.getItem('userId'));
    // Проверяем, является ли текущий пользователь владельцем бронирования
    const isOwner = booking.user_id === currentUserId;
    
    switch (status) {
        case 'active':
            if (isCurrentlyActive) {
                return `
                    <a href="room.html?id=${booking.room_id}&bookingId=${booking.id}" class="btn btn-primary">
                        <i class="fa-solid fa-play"></i> Подключиться
                    </a>
                `;
            } else {
                // Кнопка отмены ТОЛЬКО для владельца
                return `
                    ${isOwner ? `
                        <button class="btn btn-outline" onclick="cancelBooking(${booking.id})">
                            <i class="fa-solid fa-times"></i> Отменить
                        </button>
                        <button class="btn btn-primary" onclick="showInviteModalForBooking(${booking.id}, ${booking.room_id})">
                            <i class="fa-solid fa-user-plus"></i> Пригласить
                        </button>
                    ` : ''}
                `;
            }
        case 'upcoming':
            // Кнопки ТОЛЬКО для владельца
            return `
                ${isOwner ? `
                    <button class="btn btn-outline" onclick="cancelBooking(${booking.id})">
                        <i class="fa-solid fa-times"></i> Отменить
                    </button>
                    <button class="btn btn-primary" onclick="showInviteModalForBooking(${booking.id}, ${booking.room_id})">
                        <i class="fa-solid fa-user-plus"></i> Пригласить
                    </button>
                ` : ''}
            `;
        case 'completed':
        case 'cancelled':
            return ``;
        default:
            return '';
    }
}

function updateStatistics(bookings) {
    const stats = { active: 0, upcoming: 0, completed: 0, cancelled: 0 };

    const now = new Date();

    bookings.forEach(b => {
        // ========== ИСПРАВЛЕНИЕ: парсим как ЛОКАЛЬНОЕ время ==========
        const startTime = parseLocalTimeFromDB(b.start_time);
        const endTime = parseLocalTimeFromDB(b.end_time);
        // ============================================================

        if (b.status === 'cancelled') {
            stats.cancelled++;
        } else if (endTime < now) {
            stats.completed++;
        } else if (startTime <= now && endTime > now) {
            stats.active++;
        } else if (startTime > now) {
            stats.upcoming++;
        } else {
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

async function cancelBooking(bookingId) {
    // Находим карточку бронирования
    const allCards = document.querySelectorAll('.booking-card');
    let targetCard = null;
    for (const card of allCards) {
        if (card.innerHTML.includes(`cancelBooking(${bookingId})`)) {
            targetCard = card;
            break;
        }
    }
    
    if (!targetCard) {
        await doCancelBooking(bookingId);
        return;
    }
    
    // Получаем время начала из текста карточки
    const dateRangeText = targetCard.querySelector('.info-item:first-child span')?.textContent || '';
    const timeText = targetCard.querySelector('.info-item:nth-child(2) span')?.textContent || '';
    
    let startDateTime = null;
    try {
        const dateMatch = dateRangeText.match(/(\d+)\s+(\w+)\s+(\d+)/);
        if (dateMatch) {
            const months = { 'января': 0, 'февраля': 1, 'марта': 2, 'апреля': 3, 'мая': 4, 'июня': 5, 'июля': 6, 'августа': 7, 'сентября': 8, 'октября': 9, 'ноября': 10, 'декабря': 11 };
            const month = months[dateMatch[2].toLowerCase()];
            if (month !== undefined) {
                const day = parseInt(dateMatch[1]);
                const year = parseInt(dateMatch[3]);
                const timeMatch = timeText.match(/(\d{2}:\d{2})\s*—/);
                if (timeMatch) {
                    const [hours, minutes] = timeMatch[1].split(':');
                    startDateTime = new Date(year, month, day, parseInt(hours), parseInt(minutes));
                }
            }
        }
    } catch (e) {
        console.error('Error parsing date:', e);
    }
    
    if (startDateTime) {
        const now = new Date();
        const hoursUntilStart = (startDateTime - now) / (1000 * 60 * 60);
        
        if (hoursUntilStart < 12 && hoursUntilStart > 0) {
            const hoursLeft = Math.floor(hoursUntilStart);
            const minutesLeft = Math.floor((hoursUntilStart - hoursLeft) * 60);
            showNotification(`❌ Отменить бронирование можно не менее чем за 12 часов до начала.\nДо начала осталось ${hoursLeft} ч ${minutesLeft} мин.`, 'error');
            return;
        }
        
        if (hoursUntilStart <= 0) {
            showNotification('❌ Нельзя отменить уже начавшееся или завершённое бронирование.', 'error');
            return;
        }
    }
    
    await doCancelBooking(bookingId);
}

async function doCancelBooking(bookingId) {
    if (!confirm('Вы уверены, что хотите отменить бронирование?')) return;

    const token = localStorage.getItem('authToken');
    
    // Определяем, владелец ли это (по наличию кнопки "Пригласить" в карточке)
    const allCards = document.querySelectorAll('.booking-card');
    let isOwner = false;
    for (const card of allCards) {
        if (card.innerHTML.includes(`cancelBooking(${bookingId})`) && card.innerHTML.includes('showInviteModalForBooking')) {
            isOwner = true;
            break;
        }
    }

    try {
        showNotification('Отмена бронирования...', 'info');
        
        let response;
        let data;
        
        if (isOwner) {
            // Владелец: отменяем всех через Payment/refund
            response = await fetch(`${API_BASE_URL}/Payment/refund`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ BookingId: bookingId })
            });
            data = await response.json();
            
            if (data.success) {
                if (data.refunded) {
                    showNotification(`✅ ${data.message}`, 'success');
                } else {
                    showNotification('✅ Бронирование отменено', 'success');
                }
            } else {
                showNotification(data.message || 'Ошибка при отмене', 'error');
            }
        } else {
            // Приглашённый: отменяем только себя через User/bookings
            response = await fetch(`${API_BASE_URL}/User/bookings/${bookingId}/cancel`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            data = await response.json();
            
            if (data.success) {
                showNotification('✅ Ваше бронирование отменено', 'success');
            } else {
                showNotification(data.message || 'Ошибка при отмене', 'error');
            }
        }
        
        if (data.success) {
            setTimeout(() => window.location.reload(), 1500);
        }
    } catch (error) {
        console.error('Cancel error:', error);
        showNotification('Ошибка при отмене бронирования', 'error');
    }
}

function editBooking(bookingId, roomId) {
    window.location.href = `edit-booking.html?id=${bookingId}&room=${roomId}`;
}

function viewBookingDetails(bookingId) {
    showNotification('Информация о бронировании #' + bookingId, 'info');
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
// ========== ПРИГЛАШЕНИЕ УЧАСТНИКОВ В ПРЕДСТОЯЩИЕ БРОНИРОВАНИЯ ==========

// Переменные для хранения контекста приглашения
let pendingInviteBookingId = null;
let pendingInviteRoomId = null;

// Показывает модальное окно для приглашения участников в предстоящую бронь
function showInviteModalForBooking(bookingId, roomId) {
    pendingInviteBookingId = bookingId;
    pendingInviteRoomId = roomId;
    
    let modal = document.getElementById('inviteModal');
    if (!modal) {
        createInviteModal();
        modal = document.getElementById('inviteModal');
    }
    
    if (modal) {
        modal.style.display = 'flex';
        // Очищаем поиск
        const searchInput = modal.querySelector('.search-input');
        if (searchInput) searchInput.value = '';
        const searchResults = modal.querySelector('.search-results');
        if (searchResults) searchResults.innerHTML = '';
        // Показываем сразу поиск (без выбора метода)
        document.querySelectorAll('.invite-method').forEach(el => el.style.display = 'none');
        const searchMethod = document.getElementById('searchMethod');
        if (searchMethod) searchMethod.style.display = 'block';
        const inviteOptions = document.querySelector('.invite-options');
        if (inviteOptions) inviteOptions.style.display = 'none';
        const backButton = document.getElementById('backButton');
        if (backButton) backButton.style.display = 'block';
    }
}

function createInviteModal() {
    const modalHtml = `
        <div class="modal" id="inviteModal">
            <div class="modal-content">
                <button class="close-modal" onclick="closeModal('inviteModal')">&times;</button>
                <h2 class="modal-title">Пригласить в комнату</h2>
                
                <div class="invite-method" id="searchMethod">
                    <h4>Поиск пользователей</h4>
                    <div class="user-search">
                        <input type="text" placeholder="Поиск по имени или email..." class="search-input" oninput="searchUsersForInvite(this.value)">
                        <div class="search-results"></div>
                    </div>
                </div>
                
                <div class="modal-actions">
                    <button class="btn btn-outline" onclick="backToInviteMethods()" id="backButton" style="display: none;">
                        <i class="fa-solid fa-arrow-left"></i> Назад
                    </button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // Добавляем стили если их нет
    if (!document.querySelector('#invite-modal-styles')) {
        const style = document.createElement('style');
        style.id = 'invite-modal-styles';
        style.textContent = `
            .modal {
                display: none;
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.8);
                justify-content: center;
                align-items: center;
                z-index: 1000;
            }
            .modal-content {
                background: #1f2937;
                border-radius: 16px;
                padding: 24px;
                width: 90%;
                max-width: 500px;
                color: white;
            }
            .close-modal {
                float: right;
                background: none;
                border: none;
                color: white;
                font-size: 24px;
                cursor: pointer;
            }
            .modal-title {
                margin-top: 0;
                margin-bottom: 20px;
            }
            .search-input {
                width: 100%;
                padding: 10px;
                border-radius: 8px;
                border: 1px solid #4b5563;
                background: #374151;
                color: white;
                margin-bottom: 16px;
            }
            .search-results {
                max-height: 300px;
                overflow-y: auto;
            }
            .search-result {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 12px;
                background: #374151;
                border-radius: 8px;
                margin-bottom: 8px;
            }
            .search-result img {
                width: 40px;
                height: 40px;
                border-radius: 50%;
            }
            .search-result-info {
                flex: 1;
            }
            .search-result-name {
                display: block;
                font-weight: 500;
            }
            .search-result-status {
                font-size: 12px;
                color: #9ca3af;
            }
            .invite-btn {
                padding: 6px 12px;
                background: #10b981;
                border: none;
                border-radius: 6px;
                color: white;
                cursor: pointer;
            }
            .invite-btn:hover {
                background: #059669;
            }
            .invite-btn:disabled {
                background: #6b7280;
                cursor: not-allowed;
            }
            .btn-outline {
                background: transparent;
                border: 1px solid #4b5563;
                padding: 8px 16px;
                border-radius: 8px;
                color: white;
                cursor: pointer;
            }
            .btn-outline:hover {
                background: #374151;
            }
        `;
        document.head.appendChild(style);
    }
}

function backToInviteMethods() {
    closeModal('inviteModal');
}

// Обновленная функция поиска для booking
async function searchUsersForInvite(query) {
    const token = localStorage.getItem('authToken');
    const roomId = pendingInviteRoomId;
    const bookingId = pendingInviteBookingId;  // ← ДОБАВЬ ЭТУ СТРОКУ
    
    if (!roomId) return;
    
    if (query.length < 2) {
        const container = document.querySelector('.search-results');
        if (container) container.innerHTML = '';
        return;
    }

    try {
        // ДОБАВЛЯЕМ bookingId В ЗАПРОС
        const url = `${API_BASE_URL}/Room/${roomId}/search-users?query=${encodeURIComponent(query)}&bookingId=${bookingId}`;
        console.log('Search URL:', url);  // Для отладки
        
        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        const container = document.querySelector('.search-results');
        if (!container) return;

        if (!data.success || !data.users || !data.users.length) {
            container.innerHTML = `<p style="color:#9ca3af; padding:0.5rem;">Пользователи не найдены</p>`;
            return;
        }

        container.innerHTML = data.users.map(u => {
            const alreadyThere = u.is_already_in_room;
            const label = alreadyThere ? '✅ Уже в комнате' : '➕ Пригласить';
            return `
                <div class="search-result">
                    <img src="../images/iconprofile.png" alt="User">
                    <div class="search-result-info">
                        <span class="search-result-name">${escapeHtml(u.first_name)} ${escapeHtml(u.last_name)}</span>
                        <span class="search-result-status">${escapeHtml(u.email)}</span>
                    </div>
                    <button class="invite-btn" onclick="inviteUserToBooking(${u.user_id})" ${alreadyThere ? 'disabled style="opacity:0.5"' : ''}>
                        ${label}
                    </button>
                </div>
            `;
        }).join('');
    } catch (e) {
        console.error('Ошибка поиска пользователей:', e);
    }
}

async function inviteUserToBooking(invitedUserId) {
    const token = localStorage.getItem('authToken');
    const roomId = pendingInviteRoomId;
    const bookingId = pendingInviteBookingId;
    
    if (!roomId) {
        showNotification('Ошибка: комната не определена', 'error');
        return;
    }

    try {
        const formData = new FormData();
        formData.append('roomId', roomId);
        formData.append('invitedUserId', invitedUserId);
        if (bookingId) {
            formData.append('bookingId', bookingId);
        }

        const res = await fetch(`${API_BASE_URL}/Room/invite`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });
        const data = await res.json();

        if (data.success) {
            showNotification(data.message, 'success');
            closeModal('inviteModal');
            await loadUserBookings();
        } else {
            // Показываем сообщение об ошибке (включая "Комната заполнена")
            showNotification(data.message || 'Ошибка при приглашении', 'error');
        }
    } catch (e) {
        console.error('Invite error:', e);
        showNotification('Ошибка при приглашении', 'error');
    }
}


// Закрытие модального окна
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
    // Сбрасываем контекст
    pendingInviteBookingId = null;
    pendingInviteRoomId = null;
}

// Показывает выбранный метод приглашения
function showInviteMethod(method) {
    document.querySelectorAll('.invite-method').forEach(el => {
        el.style.display = 'none';
    });
    const inviteOptions = document.querySelector('.invite-options');
    if (inviteOptions) inviteOptions.style.display = 'none';
    
    const methodElement = document.getElementById(method + 'Method');
    if (methodElement) methodElement.style.display = 'block';
    
    const backButton = document.getElementById('backButton');
    if (backButton) backButton.style.display = 'block';
    
    if (method === 'link') {
        updateInviteLink();
    }
}

// Возврат к списку методов приглашения
function backToInviteMethods() {
    document.querySelectorAll('.invite-method').forEach(el => {
        el.style.display = 'none';
    });
    const inviteOptions = document.querySelector('.invite-options');
    if (inviteOptions) inviteOptions.style.display = 'grid';
    
    const backButton = document.getElementById('backButton');
    if (backButton) backButton.style.display = 'none';
}

// Обновление ссылки для приглашения
function updateInviteLink() {
    const linkInput = document.getElementById('inviteLink');
    if (linkInput && pendingInviteRoomId) {
        const inviteUrl = `${window.location.origin}${window.location.pathname.replace('booking.html', 'room.html')}?id=${pendingInviteRoomId}&invite=1`;
        linkInput.value = inviteUrl;
    }
}

// Копирование ссылки
function copyInviteLink() {
    const input = document.getElementById('inviteLink');
    if (input) {
        input.select();
        document.execCommand('copy');
        showNotification('Ссылка скопирована!', 'success');
    }
}

// Поиск пользователей для приглашения

// Приглашение пользователя в предстоящую бронь
async function inviteUserToBooking(invitedUserId) {
    const token = localStorage.getItem('authToken');
    const roomId = pendingInviteRoomId;
    const bookingId = pendingInviteBookingId;
    
    if (!roomId) {
        showNotification('Ошибка: комната не определена', 'error');
        return;
    }

    try {
        const formData = new FormData();
        formData.append('roomId', roomId);
        formData.append('invitedUserId', invitedUserId);
        if (bookingId) {
            formData.append('bookingId', bookingId);
        }

        const res = await fetch(`${API_BASE_URL}/Room/invite`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });
        const data = await res.json();

        if (data.success) {
            showNotification(data.message, 'success');
            // Обновляем список бронирований
            await loadUserBookings();
            // Закрываем модальное окно
            closeModal('inviteModal');
        } else {
            showNotification(data.message || 'Ошибка при приглашении', 'error');
        }
    } catch (e) {
        console.error('Invite error:', e);
        showNotification('Ошибка при приглашении', 'error');
    }
}

document.head.appendChild(style);